import { describe, expect, it, vi } from "vitest";
import {
  createWebGpuAppOwnedResources,
  registerWebGpuAppOwnedDevice,
  webGpuAppResourceDevice,
} from "../../packages/webgpu/src/app/owned-resources.js";

describe("app-owned GPU allocation bookkeeping", () => {
  it("binds native receivers, preserves resource identity, destroys aliases once and excludes raw-device borrowed creations", () => {
    const sharedDestroy = vi.fn();
    const shared = { destroy: sharedDestroy },
      borrowed = { destroy: vi.fn() };
    class Device {
      #token = 1;
      #allocations = 0;
      get features() {
        return { has: () => this.#token === 1 };
      }
      createBuffer() {
        return this.#token === 1 && this.#allocations++ > 0 ? shared : borrowed;
      }
      createTexture() {
        return this.#token === 1 ? shared : borrowed;
      }
      createQuerySet() {
        return this.#token === 1 ? shared : borrowed;
      }
    }
    const raw = new Device();
    expect(raw.createBuffer()).toBe(borrowed);
    const owner = createWebGpuAppOwnedResources(raw);
    const internal = owner.device as Device;
    const app = { initialization: { device: raw } };
    registerWebGpuAppOwnedDevice(app, internal);
    expect(app.initialization.device).toBe(raw);
    expect(webGpuAppResourceDevice(app)).toBe(internal);
    expect(internal.features.has()).toBe(true);
    expect(internal.createBuffer()).toBe(shared);
    expect(internal.createTexture()).toBe(shared);
    expect(internal.createQuerySet()).toBe(shared);
    const destroy = vi.fn();
    const separatelyCreated = { destroy };
    // Objects merely supplied by callers are never traversed by the owner.
    Object.assign(app, {
      sourceTexture: separatelyCreated,
      customPassBuffer: borrowed,
    });
    owner.dispose();
    owner.dispose();
    expect(sharedDestroy).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();
    expect(borrowed.destroy).not.toHaveBeenCalled();
    shared.destroy();
    expect(sharedDestroy).toHaveBeenCalledTimes(1);
    expect(() => internal.createBuffer()).toThrow("disposed");
  });

  it("removes normal replacement destroys and continues after a destroy failure", () => {
    const normalDestroy = vi.fn(),
      badDestroy = vi.fn(() => {
        throw new Error("destroy failed");
      }),
      finalDestroy = vi.fn();
    const values = [
      { destroy: normalDestroy },
      { destroy: badDestroy },
      { destroy: finalDestroy },
    ];
    const raw = { createBuffer: vi.fn(() => values.shift()!) };
    const owner = createWebGpuAppOwnedResources(raw),
      internal = owner.device as typeof raw;
    const replaced = internal.createBuffer();
    replaced.destroy();
    replaced.destroy();
    internal.createBuffer();
    internal.createBuffer();
    expect(() => owner.dispose()).toThrow(AggregateError);
    owner.dispose();
    expect(normalDestroy).toHaveBeenCalledTimes(1);
    expect(badDestroy).toHaveBeenCalledTimes(1);
    expect(finalDestroy).toHaveBeenCalledTimes(1);
  });

  it("releases a just-created object if the host cannot decorate destroy", () => {
    const destroy = vi.fn();
    const raw = { createTexture: () => Object.freeze({ destroy }) };
    const owner = createWebGpuAppOwnedResources(raw);
    expect(() => (owner.device as typeof raw).createTexture()).toThrow(
      TypeError,
    );
    owner.dispose();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
