import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { asset } from "@aperture-engine/app/config";
import {
  material,
  mesh,
  type TriangleListMeshDescriptorOptions,
} from "@aperture-engine/app/systems";
import type { ApertureSessionSnapshot } from "@aperture-engine/app/headless";
import { mirrorSourceAssetRegistryFromMessage } from "@aperture-engine/app/asset-mirror";
import {
  createTriangleListMeshAsset,
  decodeTypedArrayTree,
  renderSnapshotFromJsonValue,
  validateMeshAsset,
  type MeshAsset,
  type TriangleListMeshOptions,
} from "@aperture-engine/render";
import {
  AssetRegistry,
  createMeshHandle,
  resolveWorldTransforms,
  transformPoint,
} from "@aperture-engine/simulation";
import { ApertureSystemError } from "../../packages/app/src/systems/errors.js";
import { createHeadlessSessionController } from "../../packages/cli/src/headless/session-controller.js";
import {
  preflightApertureSnapshotBundle,
  type ApertureRenderBundle,
} from "../../packages/cli/src/headless/bundle.js";
import {
  collectCandidateSources,
  discoverPackageExportInfo,
} from "../../packages/cli/src/reference/source-collection.js";
import TriangleAuthoringScene, {
  ramp,
  roof,
} from "../fixtures/triangle-authoring/scene.js";
import {
  invalidTriangleLists,
  triangle,
} from "../helpers/triangle-list-cases.js";

async function app() {
  return createApertureApp({
    config: defineApertureConfig({
      mode: "headless",
      render: {
        defaultCamera: false,
        defaultLight: false,
        defaultEnvironment: false,
      },
    }),
    systems: [],
  });
}

function sourceMesh(
  scene: Awaited<ReturnType<typeof app>>,
  key: string,
): MeshAsset {
  const entry = scene.lowLevel.assets.get<"mesh", MeshAsset>(
    createMeshHandle(`${key}.mesh`),
  );
  expect(entry?.status).toBe("ready");
  return entry!.asset!;
}

describe("app triangle-list descriptor", () => {
  it("exposes typed options and the existing frozen descriptor-shell contract", () => {
    expectTypeOf<TriangleListMeshDescriptorOptions>().toEqualTypeOf<TriangleListMeshOptions>();
    expectTypeOf(mesh.triangleList)
      .parameter(0)
      .toEqualTypeOf<TriangleListMeshDescriptorOptions>();
    const options = { ...triangle, label: "Authored" };
    const descriptor = mesh.triangleList(options);
    options.label = "Edited later";
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(descriptor).toEqual({
      kind: "triangle-list",
      options: { ...triangle, label: "Authored" },
    });
    expect(descriptor.options).not.toBe(options);
  });

  it.each([
    { key: "roof", options: roof },
    { key: "ramp", options: ramp },
  ])("registers exact factory buffers for $key", async ({ key, options }) => {
    const scene = await app();
    try {
      scene.context.spawn.mesh({
        key,
        mesh: mesh.triangleList(options),
        material: material.standard(),
      });
      const source = sourceMesh(scene, key);
      expect(source).toEqual(createTriangleListMeshAsset(options));
      expect(validateMeshAsset(source)).toEqual({
        valid: true,
        diagnostics: [],
      });
    } finally {
      await scene.dispose();
    }
  });

  it("rejects malformed runtime descriptors before publishing mesh or material assets", async () => {
    const scene = await app();
    try {
      for (const [
        index,
        { options, path: field },
      ] of invalidTriangleLists.entries()) {
        const key = `invalid.${index}`;
        expect(() =>
          scene.context.spawn.mesh({
            key,
            mesh: {
              kind: "triangle-list",
              options: options as TriangleListMeshOptions,
            },
            material: material.standard(),
          }),
        ).toThrow(
          expect.objectContaining({
            name: "ApertureSystemError",
            code: "aperture.spawn.invalidTriangleListMesh",
            detail: { path: field },
            suggestedFix: expect.stringContaining("nondegenerate triangles"),
          }),
        );
        expect(scene.lowLevel.assets.has(createMeshHandle(`${key}.mesh`))).toBe(
          false,
        );
      }
      expect(scene.lowLevel.assets.createManifestReport().total).toBe(0);
      // Existing spawn.mesh creates entity metadata before resolving its assets;
      // this assertion covers asset publication, not broader spawn atomicity.
      expect(() =>
        scene.context.spawn.mesh({
          key: "missing-options",
          mesh: mesh.triangleList(
            undefined as unknown as TriangleListMeshOptions,
          ),
          material: material.standard(),
        }),
      ).toThrow(ApertureSystemError);
    } finally {
      await scene.dispose();
    }
  });

  it("does not relabel unexpected failures as validation diagnostics", async () => {
    const scene = await app();
    const failure = new Error("Custom position accessor failed");
    try {
      const options = {
        get positions(): TriangleListMeshOptions["positions"] {
          throw failure;
        },
      };
      expect(() =>
        scene.context.spawn.mesh({
          key: "accessor-failure",
          mesh: { kind: "triangle-list", options },
          material: material.standard(),
        }),
      ).toThrow(failure);
      expect(
        scene.lowLevel.assets.has(createMeshHandle("accessor-failure.mesh")),
      ).toBe(false);
    } finally {
      await scene.dispose();
    }
  });

  it("keeps independent keyed meshes and safely preserves a ready asset on invalid replacement", async () => {
    const scene = await app();
    try {
      scene.context.spawn.mesh({
        key: "roof",
        mesh: mesh.triangleList(roof),
        material: material.standard(),
      });
      scene.context.spawn.mesh({
        key: "ramp",
        mesh: mesh.triangleList(ramp),
        material: material.standard(),
      });
      const before = sourceMesh(scene, "roof");
      expect(() =>
        scene.context.spawn.mesh({
          key: "roof",
          mesh: mesh.triangleList({ ...roof, uvs: [] }),
          material: material.standard(),
        }),
      ).toThrow(ApertureSystemError);
      expect(sourceMesh(scene, "roof")).toBe(before);
      expect(sourceMesh(scene, "ramp")).toEqual(
        createTriangleListMeshAsset(ramp),
      );
      expect(scene.lowLevel.assets.createManifestReport().byKind.mesh).toBe(2);
    } finally {
      await scene.dispose();
    }
  });

  it.each([false, true])(
    "extracts triangles under nonuniform parent transforms with reflection = %s",
    async (reflected) => {
      const scene = await app();
      try {
        scene.context.spawn.camera({
          key: "camera",
          camera: { frustumCulling: false },
          transform: { translation: [0, 3, 15], lookAt: [0, 0, 0] },
        });
        const group = scene.context.spawn.group({
          key: "assembly",
          transform: {
            translation: [3, -2, 1],
            scale: [reflected ? -2 : 2, 3, 0.5],
            rotationEulerDegrees: [0, 30, 0],
          },
        });
        scene.context.spawn.mesh({
          key: "roof",
          mesh: mesh.triangleList(roof),
          material: material.standard(),
          transform: {
            parent: group,
            translation: [1, 2, -3],
            rotationEulerDegrees: [15, 0, 45],
          },
          castShadow: true,
          receiveShadow: true,
        });
        resolveWorldTransforms(scene.lowLevel.world);
        const source = sourceMesh(scene, "roof");
        const snapshot = scene.extract();
        expect(snapshot.diagnostics).toEqual([]);
        expect(snapshot.meshDraws).toHaveLength(1);
        const draw = snapshot.meshDraws[0]!;
        expect(draw).toMatchObject({
          mesh: createMeshHandle("roof.mesh"),
          vertexCount: 24,
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
        const determinant =
          matrix[0]! * (matrix[5]! * matrix[10]! - matrix[6]! * matrix[9]!) -
          matrix[4]! * (matrix[1]! * matrix[10]! - matrix[2]! * matrix[9]!) +
          matrix[8]! * (matrix[1]! * matrix[6]! - matrix[2]! * matrix[5]!);
        expect(Math.sign(determinant)).toBe(reflected ? -1 : 1);
        expect(Math.abs(determinant)).toBeCloseTo(3, 5);
        expect(bounds.localAabb).toEqual(source.localAabb);
        for (const position of roof.positions) {
          const point = transformPoint(matrix, position);
          for (let axis = 0; axis < 3; axis += 1) {
            expect(point[axis]).toBeGreaterThanOrEqual(
              bounds.worldAabb.min[axis]! - 1e-5,
            );
            expect(point[axis]).toBeLessThanOrEqual(
              bounds.worldAabb.max[axis]! + 1e-5,
            );
          }
        }
        expect(source).toEqual(createTriangleListMeshAsset(roof));
      } finally {
        await scene.dispose();
      }
    },
  );

  it("round-trips authored roof/ramp buffers with real GLB assets through headless bundles and session restore", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "aperture-triangle-bundle-"),
    );
    const session = await createHeadlessSessionController({
      config: defineApertureConfig({
        mode: "headless",
        render: {
          defaultCamera: false,
          defaultLight: false,
          defaultEnvironment: false,
        },
        assets: {
          model: asset.gltf("/assets/cube.glb", { preload: "blocking" }),
        },
      }),
      systems: [{ default: TriangleAuthoringScene }],
      seed: 42,
      assetMode: "strict",
      root: path.resolve("examples/developer-api"),
      publicDir: "public",
      allowHttpAssets: false,
      determinism: "off",
    });
    try {
      const capture = async (filename: string) => {
        expect(session.callTool({ name: "camera_create_agent" }).ok).toBe(true);
        expect(
          session.callTool({
            name: "camera_frame_entities",
            arguments: { subjects: [{ key: "triangle.assembly" }] },
          }).ok,
        ).toBe(true);
        expect(
          session.callTool({
            name: "asset_inspect",
            arguments: { id: "model" },
          }),
        ).toMatchObject({ ok: true, result: { ready: true, meshes: 1 } });
        const out = path.join(root, filename);
        await session.createBundle({ out, digest: true });
        const bundle = JSON.parse(
          await readFile(out, "utf8"),
        ) as ApertureRenderBundle;
        expect(preflightApertureSnapshotBundle(bundle)).toMatchObject({
          ok: true,
          closure: { missing: [], unready: [], placeholders: [] },
        });
        expect(bundle.assetProvenance.placeholderCount).toBe(0);
        expect(bundle.closure.roots).toEqual(
          expect.arrayContaining([
            "mesh:triangle.roof.mesh",
            "mesh:triangle.ramp.mesh",
          ]),
        );
        const snapshot = session.extract().snapshot;
        expect(snapshot.meshDraws).toHaveLength(3);
        const registry = new AssetRegistry();
        const assets = decodeTypedArrayTree({ entries: bundle.assets.entries });
        expect(
          mirrorSourceAssetRegistryFromMessage(registry, {
            sourceAssets: assets,
          }).mirrored,
        ).toBeGreaterThan(0);
        for (const [name, options] of [
          ["roof", roof],
          ["ramp", ramp],
        ] as const) {
          const mirrored = registry.get<"mesh", MeshAsset>(
            createMeshHandle(`triangle.${name}.mesh`),
          )!.asset!;
          expect(mirrored).toEqual(createTriangleListMeshAsset(options));
          expect(mirrored.vertexStreams[0]!.data).toBeInstanceOf(Float32Array);
        }
        return bundle;
      };
      const first = await capture("first.json");
      await session.reset({ seed: 42 });
      const repeated = await capture("reset.json");
      expect(repeated.digest.hash).toBe(first.digest.hash);
      const saved = path.join(root, "session.json");
      await session.saveSessionSnapshot({ out: saved });
      const snapshot = JSON.parse(
        await readFile(saved, "utf8"),
      ) as ApertureSessionSnapshot;
      await session.restoreSessionSnapshot({ snapshot });
      const restoredOut = path.join(root, "restored.json");
      await session.createBundle({ out: restoredOut, digest: true });
      const restored = JSON.parse(
        await readFile(restoredOut, "utf8"),
      ) as ApertureRenderBundle;
      expect(preflightApertureSnapshotBundle(restored).ok).toBe(true);
      // Restoring a session intentionally remaps entity generations/render IDs.
      // Compare source geometry and its extracted transforms/bounds, not IDs.
      const before = renderSnapshotFromJsonValue(repeated.snapshot.value);
      const after = renderSnapshotFromJsonValue(restored.snapshot.value);
      expect(after.transforms).toEqual(before.transforms);
      expect(
        after.meshDraws.map((draw) => ({
          mesh: draw.mesh,
          material: draw.material,
          vertexCount: draw.vertexCount,
          indexCount: draw.indexCount,
          topology: draw.batchKey.topology,
        })),
      ).toEqual(
        before.meshDraws.map((draw) => ({
          mesh: draw.mesh,
          material: draw.material,
          vertexCount: draw.vertexCount,
          indexCount: draw.indexCount,
          topology: draw.batchKey.topology,
        })),
      );
      expect(
        after.bounds.map((bounds) => ({
          localAabb: bounds.localAabb,
          worldAabb: bounds.worldAabb,
          localSphere: bounds.localSphere,
          worldSphere: bounds.worldSphere,
        })),
      ).toEqual(
        before.bounds.map((bounds) => ({
          localAabb: bounds.localAabb,
          worldAabb: bounds.worldAabb,
          localSphere: bounds.localSphere,
          worldSphere: bounds.worldSphere,
        })),
      );
      expect(restored.assets.entries).toEqual(repeated.assets.entries);
    } finally {
      session.dispose();
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);

  it("publishes the factory, facade options and recipe through reference discovery", async () => {
    const exports = await discoverPackageExportInfo(process.cwd());
    const sources = await collectCandidateSources(process.cwd(), exports);
    for (const file of [
      "packages/render/src/mesh/primitives-triangle-list.ts",
      "packages/render/src/mesh/triangle-list-types.ts",
    ]) {
      expect(
        sources.find((source) => source.file === file)?.entrypoint,
      ).toContain("@aperture-engine/render");
    }
    expect(
      sources.find(
        (source) =>
          source.file === "packages/app/src/systems/spawn/descriptors.ts",
      )?.entrypoint,
    ).toContain("@aperture-engine/app/systems");
    const documentation = await readFile("docs/AUTHORING.md", "utf8");
    for (const text of [
      "mesh.triangleList",
      "createTriangleListMeshAsset",
      "zero-area",
      "normals",
      "uvs",
    ])
      expect(documentation).toContain(text);
  }, 30_000);
});
