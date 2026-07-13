import { describe, expect, it } from "vitest";

import { createApertureApp } from "@aperture-engine/app";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem } from "@aperture-engine/app/systems";
import {
  assetHandleKey,
  type RenderTargetHandle,
  type TextureHandle,
} from "@aperture-engine/simulation";
import type { RenderTargetAsset } from "@aperture-engine/render";

describe("app render-target facade authoring (B1)", () => {
  it("registers render-target assets and pairs cameras via spawn.camera renderTarget", async () => {
    const refs: {
      target: RenderTargetHandle | null;
      colorTexture: TextureHandle | null;
    } = { target: null, colorTexture: null };

    class MinimapSetupSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        const target = this.renderTargets.register({
          id: "minimap.rt",
          width: 256,
          height: 256,
          label: "Minimap Target",
        });

        refs.target = target;
        refs.colorTexture = this.renderTargets.colorTexture(target);
        // Offscreen camera: lower priority renders before the main camera so
        // same-frame sampling sees fresh content.
        this.spawn.camera({
          key: "camera.minimap",
          renderTarget: target,
          camera: { projection: "orthographic", priority: 0 },
        });
        this.spawn.camera({ key: "camera.main", camera: { priority: 1 } });
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({ mode: "headless" }),
      systems: [{ default: MinimapSetupSystem }],
    });

    expect(refs.target).not.toBeNull();
    expect(refs.colorTexture).toEqual({ kind: "texture", id: "minimap.rt" });

    const entry = app.lowLevel.assets.get<"render-target", RenderTargetAsset>(
      refs.target as RenderTargetHandle,
    );

    expect(entry?.status).toBe("ready");
    expect(entry?.asset).toEqual({
      kind: "render-target",
      label: "Minimap Target",
      width: 256,
      height: 256,
      format: "swapchain",
      msaa: 1,
      depth: true,
      sampleable: true,
    });

    // Headless extraction: the paired view carries the render-target handle
    // (ViewPacket.renderTarget), ordered before the swapchain view by
    // priority; the main camera stays a swapchain view.
    const snapshot = app.extract(1);

    expect(snapshot.views).toHaveLength(2);
    expect(snapshot.views[0]?.renderTarget).toEqual({
      kind: "render-target",
      id: "minimap.rt",
    });
    expect(snapshot.views[1]?.renderTarget).toBeNull();
  });

  it("accepts bare ids and full keys for the spawn.camera renderTarget convenience", async () => {
    class StringPairingSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        this.renderTargets.register({ id: "probe", width: 64, height: 64 });
        this.spawn.camera({
          key: "camera.bare",
          renderTarget: "probe",
          camera: { priority: 0 },
        });
        this.spawn.camera({
          key: "camera.full",
          renderTarget: "render-target:probe",
          camera: { priority: 1 },
        });
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({ mode: "headless" }),
      systems: [{ default: StringPairingSystem }],
    });
    const snapshot = app.extract(1);

    expect(snapshot.views).toHaveLength(2);

    for (const view of snapshot.views) {
      expect(view.renderTarget).toEqual({
        kind: "render-target",
        id: "probe",
      });
    }
  });

  it("resizes handle-stable: same handle, new dimensions, bumped version", async () => {
    const versions: number[] = [];
    const assets: RenderTargetAsset[] = [];

    class ResizeSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        const handle = this.renderTargets.register({
          id: "resizable.rt",
          width: 128,
          height: 128,
          sampleable: false,
        });
        const registry = this.assetsRegistry;
        const record = (): void => {
          const entry = registry.get<"render-target", RenderTargetAsset>(
            handle,
          );

          if (entry?.asset != null) {
            versions.push(entry.version);
            assets.push(entry.asset);
          }
        };

        record();

        const resized = this.renderTargets.resize(handle, {
          width: 384,
          height: 384,
        });

        expect(assetHandleKey(resized)).toBe(assetHandleKey(handle));
        record();
      }
    }

    await createApertureApp({
      config: defineApertureConfig({ mode: "headless" }),
      systems: [{ default: ResizeSystem }],
    });

    expect(assets).toHaveLength(2);
    expect(assets[0]).toMatchObject({ width: 128, height: 128 });
    // The resized asset keeps every non-size option (sampleable stays false).
    expect(assets[1]).toMatchObject({
      width: 384,
      height: 384,
      sampleable: false,
      format: "swapchain",
    });
    expect(versions[1]).toBeGreaterThan(versions[0] ?? 0);
  });

  it("rejects invalid registrations and unknown resizes with structured errors", async () => {
    const failures: string[] = [];

    class InvalidTargetSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        const attempts: (() => unknown)[] = [
          () =>
            this.renderTargets.register({
              id: "bad.size",
              width: 0,
              height: 4,
            }),
          () =>
            this.renderTargets.register({
              id: "bad.depth",
              width: 4,
              height: 4,
              depth: false,
            }),
          () =>
            this.renderTargets.resize("never.registered", {
              width: 8,
              height: 8,
            }),
        ];

        for (const attempt of attempts) {
          try {
            attempt();
          } catch (error) {
            failures.push(error instanceof Error ? error.message : "unknown");
          }
        }
      }
    }

    await createApertureApp({
      config: defineApertureConfig({ mode: "headless" }),
      systems: [{ default: InvalidTargetSystem }],
    });

    expect(failures).toHaveLength(3);
    expect(failures[0]).toContain("width");
    expect(failures[1]).toContain("depth");
    expect(failures[2]).toContain("no ready render-target asset");
  });
});
