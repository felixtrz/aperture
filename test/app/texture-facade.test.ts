import { describe, expect, it } from "vitest";

import { createTextureAccess } from "@aperture-engine/app/systems";
import {
  AssetRegistry,
  assetHandleKey,
  createTextureHandle,
} from "@aperture-engine/simulation";
import type { TextureAsset } from "@aperture-engine/render";

// D3 (three.js parity plan): the worker-side `this.textures.register(...)`
// authoring facade for dynamic texture source assets. DOM-free metadata that
// mirrors to the renderer, where the main thread uploads pixels.

describe("app texture facade authoring (D3)", () => {
  it("registers a dynamic texture with sampled + copy-dst usage", () => {
    const registry = new AssetRegistry();
    const textures = createTextureAccess(registry);
    const handle = textures.register({ id: "wall", width: 64, height: 32 });

    expect(assetHandleKey(handle)).toBe("texture:wall");
    const entry = registry.get<"texture", TextureAsset>(handle);
    expect(entry?.status).toBe("ready");
    expect(entry?.asset?.usage).toEqual(["sampled", "copy-dst"]);
    expect(entry?.asset?.width).toBe(64);
    expect(entry?.asset?.height).toBe(32);
    expect(entry?.asset?.format).toBe("rgba8unorm");
    expect(textures.get("wall")).toBe(entry?.asset);
  });

  it("adds render-attachment usage for externalImage textures", () => {
    const registry = new AssetRegistry();
    const textures = createTextureAccess(registry);
    const handle = textures.register({
      id: "tv",
      width: 8,
      height: 8,
      externalImage: true,
    });

    expect(registry.get<"texture", TextureAsset>(handle)?.asset?.usage).toEqual(
      ["sampled", "copy-dst", "render-attachment"],
    );
  });

  it("carries initial data through as sourceData", () => {
    const registry = new AssetRegistry();
    const textures = createTextureAccess(registry);
    const data = new Uint8Array(4 * 4 * 4);
    const handle = textures.register({
      id: "seeded",
      width: 4,
      height: 4,
      data,
    });

    const asset = registry.get<"texture", TextureAsset>(handle)?.asset;
    expect(asset?.sourceData?.bytes).toBe(data);
    expect(asset?.sourceData?.bytesPerRow).toBe(16);
  });

  it("republishing bumps the asset version", () => {
    const registry = new AssetRegistry();
    const textures = createTextureAccess(registry);
    textures.register({ id: "wall", width: 8, height: 8 });
    const first = registry.get(createTextureHandle("wall"))?.version ?? 0;
    textures.register({ id: "wall", width: 16, height: 16 });
    const second = registry.get(createTextureHandle("wall"))?.version ?? 0;
    expect(second).toBeGreaterThan(first);
  });

  it("throws on an unsupported format", () => {
    const registry = new AssetRegistry();
    const textures = createTextureAccess(registry);
    expect(() =>
      textures.register({
        id: "bad",
        width: 8,
        height: 8,
        format: "bc7-rgba-unorm" as never,
      }),
    ).toThrow(/unsupported format/i);
  });
});
