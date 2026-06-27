import { describe, expect, it } from "vitest";
import {
  APERTURE_SNAPSHOT_BUNDLE_FORMAT,
  APERTURE_SNAPSHOT_BUNDLE_VERSION,
  createApertureSnapshotBundle,
} from "@aperture-engine/cli";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { renderSnapshotFromJsonValue } from "@aperture-engine/render";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";

const cubeSystem: ApertureSystemModule = {
  default: class CubeScene extends createSystem({ priority: 0 }) {
    override init(): void {
      this.spawn.camera({
        key: "camera.main",
        transform: { translation: [0, 1, 6], lookAt: [0, 0, 0] },
        fovYDegrees: 60,
      });
      this.spawn.mesh({
        key: "cube",
        mesh: mesh.box({ size: [1, 1, 1] }),
        material: material.standard(),
        transform: { translation: [0, 0, 0] },
      });
    }
  },
};

function meshHandleIds(value: unknown): string[] {
  const snapshot = value as { meshDraws?: ReadonlyArray<{ mesh?: { id?: string } }> };
  return (snapshot.meshDraws ?? [])
    .map((draw) => draw.mesh?.id)
    .filter((id): id is string => typeof id === "string");
}

describe("createApertureSnapshotBundle (P1.6)", () => {
  it("emits a versioned bundle whose snapshot round-trips through the codec", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [cubeSystem],
    });
    const { snapshot } = runner.step(1 / 60, 0);

    const bundle = createApertureSnapshotBundle({
      snapshot,
      assets: runner.app.lowLevel.assets,
    });

    expect(bundle.format).toBe(APERTURE_SNAPSHOT_BUNDLE_FORMAT);
    expect(bundle.version).toBe(APERTURE_SNAPSHOT_BUNDLE_VERSION);
    expect(bundle.frame).toBe(snapshot.frame);

    // The bundle must survive JSON serialization (it is written to disk).
    const onDisk = JSON.parse(JSON.stringify(bundle)) as typeof bundle;
    const rebuilt = renderSnapshotFromJsonValue(onDisk.snapshot);
    expect(rebuilt.meshDraws.length).toBe(snapshot.meshDraws.length);
    expect(Array.from(rebuilt.transforms)).toEqual(Array.from(snapshot.transforms));
  });

  it("co-persists a source-asset entry for every mesh draw handle", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [cubeSystem],
    });
    const { snapshot } = runner.step(1 / 60, 0);
    const bundle = createApertureSnapshotBundle({
      snapshot,
      assets: runner.app.lowLevel.assets,
    });

    const sourceAssets = bundle.sourceAssets as {
      entries: ReadonlyArray<{ handle: { id?: string } }>;
    };
    const assetIds = new Set(
      sourceAssets.entries
        .map((entry) => entry.handle.id)
        .filter((id): id is string => typeof id === "string"),
    );

    const drawIds = meshHandleIds(snapshot);
    expect(drawIds.length).toBeGreaterThan(0);
    for (const id of drawIds) {
      expect(assetIds.has(id)).toBe(true);
    }
  });
});
