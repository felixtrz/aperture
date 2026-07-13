import { describe, expect, it } from "vitest";

import { createApertureApp } from "@aperture-engine/app";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import {
  createSystem,
  type SystemTextureAssetHandle,
} from "@aperture-engine/app/systems";
import { createTextureAsset } from "@aperture-engine/render";
import {
  createTextureHandle,
  type Entity,
  type TextureHandle,
} from "@aperture-engine/simulation";

function markBulletTextureReady(
  system: {
    readonly assets: { texture(id: string): SystemTextureAssetHandle };
    readonly assetsRegistry: {
      markReady(handle: TextureHandle, asset: unknown): void;
    };
  },
  id = "bullet",
): SystemTextureAssetHandle {
  const texture = system.assets.texture(id);

  system.assetsRegistry.markReady(
    texture.renderHandle,
    createTextureAsset({
      label: "Bullet",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm-srgb",
      colorSpace: "srgb",
      semantic: "base-color",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array(2 * 2 * 4).fill(255),
        bytesPerRow: 8,
      },
    }),
  );

  return texture;
}

function bulletTextureConfig() {
  return defineApertureConfig({
    mode: "headless",
    assets: {
      bullet: asset.texture("/bullet.png", {
        preload: "manual",
        colorSpace: "srgb",
        semantic: "base-color",
      }),
    },
  });
}

describe("app decal spawning", () => {
  it("extracts a projected decal packet with folded fade + depth bias", async () => {
    const refs: { decal: Entity | null } = { decal: null };

    class DecalSetup extends createSystem({ priority: 0 }) {
      override init(): void {
        const texture = markBulletTextureReady(this);

        this.spawn.camera({
          key: "camera",
          camera: { layerMask: 1, frustumCulling: false },
        });
        refs.decal = this.spawn.decal({
          key: "decal.a",
          texture,
          size: [0.8, 0.6],
          color: [1, 0.5, 0.25, 0.8],
          opacity: 0.5,
          depthBias: 0.03,
          capacity: 6,
          sequence: 4,
          transform: { translation: [1, 2, 3] },
          layer: 1,
        });
      }
    }

    const app = await createApertureApp({
      config: bulletTextureConfig(),
      systems: [{ default: DecalSetup }],
    });

    const snapshot = app.extract(7);
    const packet = snapshot.decals?.[0];

    expect(refs.decal).not.toBeNull();
    expect(snapshot.decals).toHaveLength(1);
    expect(packet).toMatchObject({
      entity: {
        index: refs.decal?.index,
        generation: refs.decal?.generation,
      },
      texture: createTextureHandle("bullet"),
      layerMask: 1,
    });
    // Float32-stored authoring values.
    expect(packet?.width).toBeCloseTo(0.8, 5);
    expect(packet?.height).toBeCloseTo(0.6, 5);
    expect(packet?.depthOffset).toBeCloseTo(0.03, 5);
    // opacity (0.5) folds into the tint alpha (0.8 * 0.5 = 0.4).
    expect(packet?.color[3]).toBeCloseTo(0.4, 5);
    expect(snapshot.report.decals).toEqual({
      capacity: 6,
      live: 1,
      evicted: 0,
      submitted: 1,
    });
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("caps live decals and evicts the oldest, surfacing the tally in the report", async () => {
    class DecalStorm extends createSystem({ priority: 0 }) {
      override init(): void {
        const texture = markBulletTextureReady(this);

        this.spawn.camera({
          key: "camera",
          camera: { layerMask: 1, frustumCulling: false },
        });
        for (let index = 0; index < 12; index += 1) {
          this.spawn.decal({
            key: `decal.${index}`,
            texture,
            size: 0.5,
            capacity: 6,
            sequence: index + 1,
            transform: { translation: [index, 0, 0] },
          });
        }
      }
    }

    const app = await createApertureApp({
      config: bulletTextureConfig(),
      systems: [{ default: DecalStorm }],
    });

    const snapshot = app.extract(9);

    expect(snapshot.report.decals).toEqual({
      capacity: 6,
      live: 6,
      evicted: 6,
      submitted: 12,
    });
    expect(snapshot.decals).toHaveLength(6);

    // Survivors are the newest 6 slots (x = 6..11); the oldest 6 (x = 0..5) were
    // evicted. Each decal's x-translation is column 3, row 0 of its baked matrix.
    const survivorX = new Set(
      (snapshot.decals ?? []).map((decal) =>
        Math.round(snapshot.transforms[decal.worldTransformOffset + 12] ?? -1),
      ),
    );
    expect(survivorX).toEqual(new Set([6, 7, 8, 9, 10, 11]));
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("auto-stamps spawn order so eviction follows firing order without an explicit sequence", async () => {
    class AutoSequence extends createSystem({ priority: 0 }) {
      override init(): void {
        const texture = markBulletTextureReady(this);

        this.spawn.camera({
          key: "camera",
          camera: { layerMask: 1, frustumCulling: false },
        });
        for (let index = 0; index < 3; index += 1) {
          this.spawn.decal({
            key: `decal.${index}`,
            texture,
            size: 0.5,
            capacity: 2,
            transform: { translation: [index, 0, 0] },
          });
        }
      }
    }

    const app = await createApertureApp({
      config: bulletTextureConfig(),
      systems: [{ default: AutoSequence }],
    });

    const snapshot = app.extract(3);

    expect(snapshot.report.decals).toMatchObject({
      capacity: 2,
      live: 2,
      evicted: 1,
      submitted: 3,
    });
    const survivorX = new Set(
      (snapshot.decals ?? []).map((decal) =>
        Math.round(snapshot.transforms[decal.worldTransformOffset + 12] ?? -1),
      ),
    );
    // The first-fired decal (x = 0) is evicted; the two newest (x = 1, 2) survive.
    expect(survivorX).toEqual(new Set([1, 2]));
    expect(snapshot.diagnostics).toEqual([]);
  });

  it("filters decals by render layer against the camera mask", async () => {
    class LayeredDecals extends createSystem({ priority: 0 }) {
      override init(): void {
        const texture = markBulletTextureReady(this);

        this.spawn.camera({
          key: "camera",
          camera: { layerMask: 1, frustumCulling: false },
        });
        this.spawn.decal({
          key: "decal.visible",
          texture,
          size: 0.5,
          sequence: 1,
          transform: { translation: [0, 0, 0] },
          layer: 1,
        });
        this.spawn.decal({
          key: "decal.hidden",
          texture,
          size: 0.5,
          sequence: 2,
          transform: { translation: [1, 0, 0] },
          layer: 2,
        });
      }
    }

    const app = await createApertureApp({
      config: bulletTextureConfig(),
      systems: [{ default: LayeredDecals }],
    });

    const snapshot = app.extract(4);

    // Only the layer-1 decal survives the camera-layer gate.
    expect(snapshot.decals).toHaveLength(1);
    expect(snapshot.report.decals).toMatchObject({ live: 1, submitted: 1 });
    expect(
      snapshot.diagnostics.some(
        (diagnostic) => diagnostic.code === "render.layerMismatch",
      ),
    ).toBe(true);
  });
});
