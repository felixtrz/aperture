import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createTextureHandle,
} from "@aperture-engine/simulation";
import { createTextureAsset, type TextureAsset } from "@aperture-engine/render";
import {
  createWebGpuAppDynamicTextureState,
  dynamicTextureCacheKey,
  registerWebGpuAppDynamicTexture,
  updateWebGpuAppDynamicTexture,
  updateWebGpuAppDynamicTextureFromExternalImage,
  webGpuAppDynamicTextureReport,
  type WebGpuAppDynamicTextureState,
} from "@aperture-engine/webgpu/test-support";

// D3 (three.js parity plan): the headless core of the runtime texture update
// facade. All GPU work is behind a fake queue so the command/packet round-trip,
// sub-rect math, report counters, and every failure diagnostic are asserted
// without a real device.

interface WriteTextureCall {
  readonly destination: {
    readonly texture: unknown;
    readonly mipLevel: number;
    readonly origin: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
  };
  readonly data: Uint8Array;
  readonly layout: {
    readonly offset: number;
    readonly bytesPerRow: number;
    readonly rowsPerImage: number;
  };
  readonly size: {
    readonly width: number;
    readonly height: number;
    readonly depthOrArrayLayers: number;
  };
}

interface ExternalImageCall {
  readonly source: { readonly source: unknown; readonly flipY: boolean };
  readonly destination: {
    readonly texture: unknown;
    readonly origin: { readonly x: number; readonly y: number };
  };
  readonly size: { readonly width: number; readonly height: number };
}

function createFakeDevice(options: { readonly throwOnWrite?: boolean } = {}) {
  const writeTextureCalls: WriteTextureCall[] = [];
  const externalImageCalls: ExternalImageCall[] = [];
  const device = {
    queue: {
      writeTexture(
        destination: WriteTextureCall["destination"],
        data: Uint8Array,
        layout: WriteTextureCall["layout"],
        size: WriteTextureCall["size"],
      ): void {
        if (options.throwOnWrite === true) {
          throw new Error("device write rejected");
        }
        writeTextureCalls.push({ destination, data, layout, size });
      },
      copyExternalImageToTexture(
        source: ExternalImageCall["source"],
        destination: ExternalImageCall["destination"],
        size: ExternalImageCall["size"],
      ): void {
        externalImageCalls.push({ source, destination, size });
      },
    },
  };
  return { device, writeTextureCalls, externalImageCalls };
}

/** Register + simulate the renderer realizing the texture into a textures cache. */
function setupRealized(
  state: WebGpuAppDynamicTextureState,
  registry: AssetRegistry,
  descriptor: Parameters<
    typeof registerWebGpuAppDynamicTexture
  >[0]["descriptor"],
): {
  readonly textures: Map<string, { texture: unknown }>;
  readonly gpuTexture: object;
} {
  registerWebGpuAppDynamicTexture({ state, registry, descriptor });
  const handle = createTextureHandle(descriptor.id);
  const version = registry.get(handle)?.version ?? 1;
  const gpuTexture = { marker: descriptor.id };
  const textures = new Map<string, { texture: unknown }>();
  textures.set(dynamicTextureCacheKey(descriptor.id, version), {
    resourceKey: descriptor.id,
    texture: gpuTexture,
    view: {},
    descriptor: {},
  } as never);
  return { textures: textures as never, gpuTexture };
}

describe("dynamic texture registration (D3 AC1/AC2)", () => {
  it("registers a real copy-dst texture asset a material can sample", () => {
    const state = createWebGpuAppDynamicTextureState();
    const registry = new AssetRegistry();
    const result = registerWebGpuAppDynamicTexture({
      state,
      registry,
      descriptor: { id: "dyn.a", width: 16, height: 8 },
    });

    expect(result.ok).toBe(true);
    expect(result.handle).not.toBeNull();

    const entry = registry.get<"texture", TextureAsset>(
      createTextureHandle("dyn.a"),
    );
    expect(entry?.status).toBe("ready");
    expect(entry?.asset?.usage).toEqual(["sampled", "copy-dst"]);
    expect(entry?.asset?.format).toBe("rgba8unorm");
    expect(entry?.asset?.width).toBe(16);
  });

  it("adds render-attachment usage for the external-image path", () => {
    const state = createWebGpuAppDynamicTextureState();
    const registry = new AssetRegistry();
    registerWebGpuAppDynamicTexture({
      state,
      registry,
      descriptor: { id: "dyn.video", width: 8, height: 8, externalImage: true },
    });

    const entry = registry.get<"texture", TextureAsset>(
      createTextureHandle("dyn.video"),
    );
    expect(entry?.asset?.usage).toEqual([
      "sampled",
      "copy-dst",
      "render-attachment",
    ]);
  });

  it("diagnoses an unsupported format", () => {
    const state = createWebGpuAppDynamicTextureState();
    const registry = new AssetRegistry();
    const result = registerWebGpuAppDynamicTexture({
      state,
      registry,
      // A block-compressed format cannot be written per-texel / rendered into.
      descriptor: {
        id: "dyn.bad",
        width: 8,
        height: 8,
        format: "bc7-rgba-unorm" as never,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe(
      "dynamicTexture.invalidDescriptor",
    );
    expect(registry.has(createTextureHandle("dyn.bad"))).toBe(false);
  });

  it("diagnoses non-positive dimensions", () => {
    const state = createWebGpuAppDynamicTextureState();
    const registry = new AssetRegistry();
    const result = registerWebGpuAppDynamicTexture({
      state,
      registry,
      descriptor: { id: "dyn.zero", width: 0, height: 8 },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe(
      "dynamicTexture.invalidDescriptor",
    );
  });
});

describe("dynamic texture CPU update (D3 AC1)", () => {
  it("uploads a full-image update via writeTexture and counts bytes", () => {
    const state = createWebGpuAppDynamicTextureState();
    const registry = new AssetRegistry();
    const { device, writeTextureCalls } = createFakeDevice();
    const { textures, gpuTexture } = setupRealized(state, registry, {
      id: "dyn.full",
      width: 4,
      height: 2,
    });

    const result = updateWebGpuAppDynamicTexture({
      state,
      registry,
      textures: textures as never,
      device,
      id: "dyn.full",
      update: { data: new Uint8Array(4 * 2 * 4) },
    });

    expect(result.ok).toBe(true);
    expect(result.bytesUploaded).toBe(4 * 2 * 4);
    expect(result.region).toEqual({ x: 0, y: 0, width: 4, height: 2 });
    expect(writeTextureCalls).toHaveLength(1);

    const call = writeTextureCalls[0];
    expect(call?.destination.texture).toBe(gpuTexture);
    expect(call?.destination.origin).toEqual({ x: 0, y: 0, z: 0 });
    expect(call?.layout).toEqual({
      offset: 0,
      bytesPerRow: 16,
      rowsPerImage: 2,
    });
    expect(call?.size).toEqual({ width: 4, height: 2, depthOrArrayLayers: 1 });
  });

  it("uploads a sub-rect with the requested origin + bytesPerRow", () => {
    const state = createWebGpuAppDynamicTextureState();
    const registry = new AssetRegistry();
    const { device, writeTextureCalls } = createFakeDevice();
    const { textures } = setupRealized(state, registry, {
      id: "dyn.sub",
      width: 32,
      height: 32,
    });

    const result = updateWebGpuAppDynamicTexture({
      state,
      registry,
      textures: textures as never,
      device,
      id: "dyn.sub",
      update: {
        region: { x: 8, y: 4, width: 16, height: 8 },
        bytesPerRow: 16 * 4,
        data: new Uint8Array(16 * 8 * 4),
      },
    });

    expect(result.ok).toBe(true);
    expect(result.bytesUploaded).toBe(16 * 8 * 4);
    const call = writeTextureCalls[0];
    expect(call?.destination.origin).toEqual({ x: 8, y: 4, z: 0 });
    expect(call?.layout.bytesPerRow).toBe(64);
    expect(call?.size).toEqual({ width: 16, height: 8, depthOrArrayLayers: 1 });
  });

  it("diagnoses an out-of-bounds sub-rect without touching the queue", () => {
    const state = createWebGpuAppDynamicTextureState();
    const registry = new AssetRegistry();
    const { device, writeTextureCalls } = createFakeDevice();
    const { textures } = setupRealized(state, registry, {
      id: "dyn.oob",
      width: 16,
      height: 16,
    });

    const result = updateWebGpuAppDynamicTexture({
      state,
      registry,
      textures: textures as never,
      device,
      id: "dyn.oob",
      update: {
        region: { x: 8, y: 0, width: 16, height: 4 },
        bytesPerRow: 16 * 4,
        data: new Uint8Array(16 * 4 * 4),
      },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("dynamicTexture.invalidRegion");
    expect(writeTextureCalls).toHaveLength(0);
  });

  it("diagnoses a bytesPerRow smaller than the row minimum", () => {
    const state = createWebGpuAppDynamicTextureState();
    const registry = new AssetRegistry();
    const { device } = createFakeDevice();
    const { textures } = setupRealized(state, registry, {
      id: "dyn.bpr",
      width: 8,
      height: 4,
    });

    const result = updateWebGpuAppDynamicTexture({
      state,
      registry,
      textures: textures as never,
      device,
      id: "dyn.bpr",
      update: { data: new Uint8Array(8 * 4 * 4), bytesPerRow: 8 },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe(
      "dynamicTexture.invalidBytesPerRow",
    );
  });

  it("diagnoses data shorter than the region requires", () => {
    const state = createWebGpuAppDynamicTextureState();
    const registry = new AssetRegistry();
    const { device } = createFakeDevice();
    const { textures } = setupRealized(state, registry, {
      id: "dyn.short",
      width: 8,
      height: 4,
    });

    const result = updateWebGpuAppDynamicTexture({
      state,
      registry,
      textures: textures as never,
      device,
      id: "dyn.short",
      update: { data: new Uint8Array(8) },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe(
      "dynamicTexture.uploadDataTooSmall",
    );
  });

  it("diagnoses an unknown texture id", () => {
    const state = createWebGpuAppDynamicTextureState();
    const registry = new AssetRegistry();
    const { device } = createFakeDevice();

    const result = updateWebGpuAppDynamicTexture({
      state,
      registry,
      textures: new Map(),
      device,
      id: "dyn.missing",
      update: { data: new Uint8Array(4) },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("dynamicTexture.notRegistered");
  });

  it("updates a WORKER-registered texture with no prior main-thread state (lazy)", () => {
    // Simulate the asset-mirror: the worker registered the texture, so it lands
    // in the source-asset registry with no main-thread registerDynamicTexture.
    const state = createWebGpuAppDynamicTextureState();
    const registry = new AssetRegistry();
    const { device, writeTextureCalls } = createFakeDevice();
    const handle = createTextureHandle("dyn.worker");
    const asset = createTextureAsset({
      label: "worker",
      dimension: "2d",
      width: 4,
      height: 4,
      format: "rgba8unorm",
      colorSpace: "linear",
      semantic: "data",
      usage: ["sampled", "copy-dst"],
    });
    registry.register(handle, { label: "worker" });
    registry.markReady(handle, asset);
    const version = registry.get(handle)?.version ?? 1;
    const textures = new Map<string, { texture: unknown }>();
    textures.set(dynamicTextureCacheKey("dyn.worker", version), {
      resourceKey: "dyn.worker",
      texture: { marker: "worker" },
      view: {},
      descriptor: {},
    } as never);

    const result = updateWebGpuAppDynamicTexture({
      state,
      registry,
      textures: textures as never,
      device,
      id: "dyn.worker",
      update: { data: new Uint8Array(4 * 4 * 4) },
    });

    expect(result.ok).toBe(true);
    expect(writeTextureCalls).toHaveLength(1);
    // The entry was created lazily from the registry asset.
    expect(webGpuAppDynamicTextureReport(state)?.textureCount).toBe(1);
  });

  it("diagnoses a texture that has not been realized on the GPU yet", () => {
    const state = createWebGpuAppDynamicTextureState();
    const registry = new AssetRegistry();
    const { device } = createFakeDevice();
    registerWebGpuAppDynamicTexture({
      state,
      registry,
      descriptor: { id: "dyn.unrealized", width: 8, height: 8 },
    });

    const result = updateWebGpuAppDynamicTexture({
      state,
      registry,
      textures: new Map(),
      device,
      id: "dyn.unrealized",
      update: { data: new Uint8Array(8 * 8 * 4) },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("dynamicTexture.notRealized");
  });

  it("degrades a device writeTexture failure to a structured diagnostic", () => {
    const state = createWebGpuAppDynamicTextureState();
    const registry = new AssetRegistry();
    const { device } = createFakeDevice({ throwOnWrite: true });
    const { textures } = setupRealized(state, registry, {
      id: "dyn.throw",
      width: 4,
      height: 4,
    });

    const result = updateWebGpuAppDynamicTexture({
      state,
      registry,
      textures: textures as never,
      device,
      id: "dyn.throw",
      update: { data: new Uint8Array(4 * 4 * 4) },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("dynamicTexture.uploadFailed");
  });
});

describe("dynamic texture external-image update (D3 AC2)", () => {
  it("imports a source via copyExternalImageToTexture", () => {
    const state = createWebGpuAppDynamicTextureState();
    const registry = new AssetRegistry();
    const { device, externalImageCalls } = createFakeDevice();
    const { textures, gpuTexture } = setupRealized(state, registry, {
      id: "dyn.ext",
      width: 8,
      height: 8,
      externalImage: true,
    });
    const source = { fakeCanvas: true };

    const result = updateWebGpuAppDynamicTextureFromExternalImage({
      state,
      registry,
      textures: textures as never,
      device,
      id: "dyn.ext",
      update: { source },
    });

    expect(result.ok).toBe(true);
    expect(result.bytesUploaded).toBe(8 * 8 * 4);
    expect(externalImageCalls).toHaveLength(1);
    expect(externalImageCalls[0]?.source.source).toBe(source);
    expect(externalImageCalls[0]?.destination.texture).toBe(gpuTexture);
    expect(externalImageCalls[0]?.size).toEqual({
      width: 8,
      height: 8,
      depthOrArrayLayers: 1,
    });
  });

  it("diagnoses a missing source", () => {
    const state = createWebGpuAppDynamicTextureState();
    const registry = new AssetRegistry();
    const { device, externalImageCalls } = createFakeDevice();
    const { textures } = setupRealized(state, registry, {
      id: "dyn.nosrc",
      width: 8,
      height: 8,
      externalImage: true,
    });

    const result = updateWebGpuAppDynamicTextureFromExternalImage({
      state,
      registry,
      textures: textures as never,
      device,
      id: "dyn.nosrc",
      update: { source: null as never },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("dynamicTexture.missingSource");
    expect(externalImageCalls).toHaveLength(0);
  });
});

describe("dynamic texture frame report (D3)", () => {
  it("is undefined when no dynamic texture was registered (byte-identical report)", () => {
    const state = createWebGpuAppDynamicTextureState();
    expect(webGpuAppDynamicTextureReport(state)).toBeUndefined();
  });

  it("aggregates counters and resets the per-frame rate", () => {
    const state = createWebGpuAppDynamicTextureState();
    const registry = new AssetRegistry();
    const { device } = createFakeDevice();
    const { textures } = setupRealized(state, registry, {
      id: "dyn.rep",
      width: 4,
      height: 4,
    });

    updateWebGpuAppDynamicTexture({
      state,
      registry,
      textures: textures as never,
      device,
      id: "dyn.rep",
      update: { data: new Uint8Array(4 * 4 * 4) },
    });
    updateWebGpuAppDynamicTexture({
      state,
      registry,
      textures: textures as never,
      device,
      id: "dyn.rep",
      update: { data: new Uint8Array(4 * 4 * 4) },
    });

    const firstReport = webGpuAppDynamicTextureReport(state, { reset: true });
    expect(firstReport?.textureCount).toBe(1);
    expect(firstReport?.frameUpdates).toBe(2);
    expect(firstReport?.frameBytesUploaded).toBe(2 * 4 * 4 * 4);
    expect(firstReport?.totalUpdates).toBe(2);
    expect(firstReport?.textures[0]?.id).toBe("dyn.rep");

    // After reset the per-frame rate is zero but the cumulative totals persist.
    const secondReport = webGpuAppDynamicTextureReport(state, { reset: true });
    expect(secondReport?.frameUpdates).toBe(0);
    expect(secondReport?.totalUpdates).toBe(2);
  });

  it("counts failed updates without a queue call", () => {
    const state = createWebGpuAppDynamicTextureState();
    const registry = new AssetRegistry();
    const { device, writeTextureCalls } = createFakeDevice();
    const { textures } = setupRealized(state, registry, {
      id: "dyn.fail",
      width: 8,
      height: 8,
    });

    updateWebGpuAppDynamicTexture({
      state,
      registry,
      textures: textures as never,
      device,
      id: "dyn.fail",
      update: { data: new Uint8Array(2) },
    });

    const report = webGpuAppDynamicTextureReport(state);
    expect(report?.totalFailedUpdates).toBe(1);
    expect(report?.totalUpdates).toBe(0);
    expect(writeTextureCalls).toHaveLength(0);
  });
});
