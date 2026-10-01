import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import {
  material,
  mesh,
  type HeightfieldMeshDescriptorOptions,
} from "@aperture-engine/app/systems";
import type { ApertureSessionSnapshot } from "@aperture-engine/app/headless";
import { mirrorSourceAssetRegistryFromMessage } from "@aperture-engine/app/asset-mirror";
import {
  createHeightfieldMeshAsset,
  decodeTypedArrayTree,
  renderSnapshotFromJsonValue,
  type HeightfieldMeshOptions,
  type MeshAsset,
} from "@aperture-engine/render";
import {
  AssetRegistry,
  createMeshHandle,
  resolveWorldTransforms,
  transformPoint,
} from "@aperture-engine/simulation";
import { createHeadlessSessionController } from "../../packages/cli/src/headless/session-controller.js";
import {
  preflightApertureSnapshotBundle,
  type ApertureRenderBundle,
} from "../../packages/cli/src/headless/bundle.js";
import {
  collectCandidateSources,
  discoverPackageExportInfo,
} from "../../packages/cli/src/reference/source-collection.js";
import {
  flatHeightfield,
  invalidHeightfields,
} from "../helpers/heightfield-cases.js";
import HeightfieldAuthoringScene, {
  terrain,
} from "../fixtures/heightfield-authoring/scene.js";

const config = defineApertureConfig({
  mode: "headless",
  render: {
    defaultCamera: false,
    defaultLight: false,
    defaultEnvironment: false,
  },
});
const app = () => createApertureApp({ config, systems: [] });
function source(
  scene: Awaited<ReturnType<typeof app>>,
  key = "terrain",
): MeshAsset {
  return scene.lowLevel.assets.get<"mesh", MeshAsset>(
    createMeshHandle(`${key}.mesh`),
  )!.asset!;
}

describe("app heightfield descriptor", () => {
  it("exposes typed options and the frozen shallow descriptor contract", () => {
    expectTypeOf<HeightfieldMeshDescriptorOptions>().toEqualTypeOf<HeightfieldMeshOptions>();
    expectTypeOf(mesh.heightfield)
      .parameter(0)
      .toEqualTypeOf<HeightfieldMeshDescriptorOptions>();
    const options = { ...flatHeightfield, label: "Original" };
    const descriptor = mesh.heightfield(options);
    options.label = "Later";
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(descriptor.options).not.toBe(options);
    expect(descriptor).toEqual({
      kind: "heightfield",
      options: { ...flatHeightfield, label: "Original" },
    });
  });

  it("registers exact factory buffers without changing existing primitive descriptors", async () => {
    const scene = await app();
    try {
      scene.context.spawn.mesh({
        key: "terrain",
        mesh: mesh.heightfield(terrain),
        material: material.standard(),
      });
      expect(source(scene)).toEqual(createHeightfieldMeshAsset(terrain));
      for (const [index, descriptor] of [
        mesh.box(),
        mesh.sphere(),
        mesh.plane(),
        mesh.capsule(),
        mesh.cylinder(),
        mesh.cone(),
        mesh.torus(),
        mesh.lineList({
          positions: [
            [0, 0, 0],
            [1, 1, 1],
          ],
        }),
        mesh.triangleList({
          positions: [
            [0, 0, 0],
            [1, 0, 0],
            [0, 1, 0],
          ],
        }),
      ].entries()) {
        scene.context.spawn.mesh({
          key: `primitive.${index}`,
          mesh: descriptor,
          material: material.standard(),
        });
      }
      expect(scene.lowLevel.assets.createManifestReport().byKind.mesh).toBe(10);
    } finally {
      await scene.dispose();
    }
  });

  it("reports stable field locations and permits same-key retry after invalid terrain", async () => {
    const scene = await app();
    try {
      for (const { options, path: field } of invalidHeightfields) {
        expect(() =>
          scene.context.spawn.mesh({
            key: "retry",
            mesh: {
              kind: "heightfield",
              options: options as HeightfieldMeshOptions,
            },
            material: material.standard(),
          }),
        ).toThrow(
          expect.objectContaining({
            name: "ApertureSystemError",
            code: "aperture.spawn.invalidHeightfieldMesh",
            detail: { path: field },
            suggestedFix: expect.stringContaining("rectangular heights array"),
          }),
        );
        expect(scene.lowLevel.assets.createManifestReport().total).toBe(0);
      }
      scene.context.spawn.mesh({
        key: "retry",
        mesh: mesh.heightfield(flatHeightfield),
        material: material.standard(),
      });
      expect(source(scene, "retry")).toEqual(
        createHeightfieldMeshAsset(flatHeightfield),
      );
    } finally {
      await scene.dispose();
    }
  });

  it("does not mask a thrown height accessor as input validation", async () => {
    const scene = await app();
    const failure = new Error("Custom height accessor failed");
    try {
      const options = {
        get heights(): HeightfieldMeshOptions["heights"] {
          throw failure;
        },
      };
      expect(() =>
        scene.context.spawn.mesh({
          key: "terrain",
          mesh: { kind: "heightfield", options },
          material: material.standard(),
        }),
      ).toThrow(failure);
      expect(scene.lowLevel.assets.createManifestReport().total).toBe(0);
    } finally {
      await scene.dispose();
    }
  });

  it("edits through a stable dynamic mesh handle with refreshed normals, bounds, and asset version", async () => {
    const scene = await app();
    try {
      const initial = createHeightfieldMeshAsset(flatHeightfield);
      const dynamic = scene.context.meshes.dynamic("terrain.dynamic", {
        initial,
      });
      scene.context.spawn.camera({
        key: "camera",
        camera: { frustumCulling: false },
        transform: { translation: [0, 4, 6], lookAt: [0, 0, 0] },
      });
      const entity = scene.context.spawn.mesh({
        key: "terrain",
        mesh: dynamic.handle,
        material: material.standard(),
      });
      const before = scene.extract();
      const edited = createHeightfieldMeshAsset({
        heights: [
          [0, 2],
          [0, 0],
        ],
      });
      expect(dynamic.publish(edited)).toMatchObject({
        handle: dynamic.handle,
        version: 2,
      });
      expect(dynamic.get()).toBe(edited);
      expect(initial.localAabb!.max[1]).toBe(0);
      resolveWorldTransforms(scene.lowLevel.world);
      const after = scene.extract();
      expect(after.meshDraws).toHaveLength(1);
      expect(after.meshDraws[0]!.mesh).toEqual(before.meshDraws[0]!.mesh);
      expect(after.meshDraws[0]!.renderId).toEqual(
        before.meshDraws[0]!.renderId,
      );
      expect(
        after.bounds[after.meshDraws[0]!.boundsIndex]!.localAabb.max[1],
      ).toBe(2);
      expect(edited.vertexStreams[0]!.data).not.toEqual(
        initial.vertexStreams[0]!.data,
      );
      expect(entity).toBeDefined();
      expect(() =>
        dynamic.publish(createHeightfieldMeshAsset({ heights: [[0], [0]] })),
      ).toThrow();
      expect(dynamic.get()).toBe(edited);
      expect(scene.lowLevel.assets.get(dynamic.handle)!.version).toBe(2);
    } finally {
      await scene.dispose();
    }
  });

  it.each([false, true])(
    "extracts finite geometry under parent transforms, reflection = %s",
    async (reflected) => {
      const scene = await app();
      try {
        scene.context.spawn.camera({
          key: "camera",
          camera: { frustumCulling: false },
          transform: { translation: [0, 5, 15], lookAt: [0, 0, 0] },
        });
        const parent = scene.context.spawn.group({
          key: "assembly",
          transform: {
            translation: [2, 3, -1],
            scale: [reflected ? -2 : 2, 3, 0.5],
            rotationEulerDegrees: [0, 30, 0],
          },
        });
        scene.context.spawn.mesh({
          key: "terrain",
          mesh: mesh.heightfield(terrain),
          material: material.standard(),
          transform: { parent, translation: [1, -1, 2] },
          castShadow: true,
          receiveShadow: true,
        });
        resolveWorldTransforms(scene.lowLevel.world);
        const snapshot = scene.extract();
        expect(snapshot.diagnostics).toEqual([]);
        expect(snapshot.meshDraws).toHaveLength(1);
        const draw = snapshot.meshDraws[0]!;
        expect(draw).toMatchObject({
          vertexCount: 72,
          indexCount: 0,
          castsShadow: true,
          receivesShadow: true,
          batchKey: { topology: "triangle-list" },
        });
        const bounds = snapshot.bounds[draw.boundsIndex]!;
        const matrix = snapshot.transforms.subarray(
          draw.worldTransformOffset,
          draw.worldTransformOffset + 16,
        );
        expect(Array.from(matrix).every(Number.isFinite)).toBe(true);
        const data = source(scene).vertexStreams[0]!.data;
        for (let i = 0; i < data.length; i += 8) {
          const point = transformPoint(matrix, [
            data[i]!,
            data[i + 1]!,
            data[i + 2]!,
          ]);
          for (let axis = 0; axis < 3; axis += 1) {
            expect(point[axis]).toBeGreaterThanOrEqual(
              bounds.worldAabb.min[axis]! - 1e-5,
            );
            expect(point[axis]).toBeLessThanOrEqual(
              bounds.worldAabb.max[axis]! + 1e-5,
            );
          }
        }
        expect(source(scene)).toEqual(createHeightfieldMeshAsset(terrain));
      } finally {
        await scene.dispose();
      }
    },
  );

  it("round-trips terrain buffers through bundle mirroring, reset, and session restore", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "aperture-heightfield-bundle-"),
    );
    const session = await createHeadlessSessionController({
      config,
      systems: [{ default: HeightfieldAuthoringScene }],
      seed: 42,
      assetMode: "strict",
      root: process.cwd(),
      publicDir: "public",
      allowHttpAssets: false,
      determinism: "off",
    });
    try {
      const capture = async (name: string) => {
        const out = path.join(root, `${name}.json`);
        await session.createBundle({ out, digest: true });
        const bundle = JSON.parse(
          await readFile(out, "utf8"),
        ) as ApertureRenderBundle;
        expect(preflightApertureSnapshotBundle(bundle)).toMatchObject({
          ok: true,
          closure: { missing: [], unready: [], placeholders: [] },
        });
        expect(bundle.assetProvenance.placeholderCount).toBe(0);
        const registry = new AssetRegistry();
        mirrorSourceAssetRegistryFromMessage(registry, {
          sourceAssets: decodeTypedArrayTree({
            entries: bundle.assets.entries,
          }),
        });
        const mirrored = registry.get<"mesh", MeshAsset>(
          createMeshHandle("terrain.surface.mesh"),
        )!.asset!;
        expect(mirrored).toEqual(createHeightfieldMeshAsset(terrain));
        expect(mirrored.vertexStreams[0]!.data).toBeInstanceOf(Float32Array);
        return bundle;
      };
      const first = await capture("first");
      await session.reset({ seed: 42 });
      const reset = await capture("reset");
      expect(reset.digest.hash).toBe(first.digest.hash);
      const saved = path.join(root, "session.json");
      await session.saveSessionSnapshot({ out: saved });
      await session.restoreSessionSnapshot({
        snapshot: JSON.parse(
          await readFile(saved, "utf8"),
        ) as ApertureSessionSnapshot,
      });
      const restored = await capture("restored");
      const before = renderSnapshotFromJsonValue(reset.snapshot.value);
      const after = renderSnapshotFromJsonValue(restored.snapshot.value);
      expect(after.transforms).toEqual(before.transforms);
      expect(after.bounds.map((bounds) => bounds.worldAabb)).toEqual(
        before.bounds.map((bounds) => bounds.worldAabb),
      );
      expect(restored.assets.entries).toEqual(reset.assets.entries);
    } finally {
      session.dispose();
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);

  it("exposes the factory and facade in generated reference discovery and docs", async () => {
    const sources = await collectCandidateSources(
      process.cwd(),
      await discoverPackageExportInfo(process.cwd()),
    );
    for (const file of [
      "packages/render/src/mesh/primitives-heightfield.ts",
      "packages/render/src/mesh/heightfield-types.ts",
    ]) {
      expect(
        sources.find((source) => source.file === file)?.entrypoint,
      ).toContain("@aperture-engine/render");
    }
    const docs = await readFile("docs/AUTHORING.md", "utf8");
    for (const text of [
      "mesh.heightfield",
      "createHeightfieldMeshAsset",
      "heights[row][column]",
      "dynamic.publish",
      "(r+1, c+1)",
    ])
      expect(docs).toContain(text);
  }, 30_000);
});
