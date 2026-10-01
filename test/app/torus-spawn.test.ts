import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import {
  createSystem,
  material,
  mesh,
  type TorusMeshDescriptorOptions,
} from "@aperture-engine/app/systems";
import {
  createTorusMeshAsset,
  validateMeshAsset,
  type MeshAsset,
} from "@aperture-engine/render";
import {
  createMeshHandle,
  resolveWorldTransforms,
} from "@aperture-engine/simulation";
import { createHeadlessSessionController } from "../../packages/cli/src/headless/session-controller.js";
import {
  collectCandidateSources,
  discoverPackageExportInfo,
} from "../../packages/cli/src/reference/source-collection.js";
import { preflightApertureSnapshotBundle } from "../../packages/cli/src/headless/bundle.js";

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
  expect(entry?.asset).not.toBeNull();
  return entry!.asset!;
}

const cases: readonly { name: string; options: TorusMeshDescriptorOptions }[] =
  [
    { name: "defaults", options: {} },
    {
      name: "low-poly controls",
      options: {
        label: "Low-poly ring",
        majorRadius: 2,
        tubeRadius: 0.5,
        radialSegments: 8,
        tubeSegments: 4,
      },
    },
    {
      name: "invalid radii retain factory fallbacks",
      options: { majorRadius: -1, tubeRadius: 0 },
    },
    {
      name: "non-finite radii and segments",
      options: {
        majorRadius: Infinity,
        tubeRadius: NaN,
        radialSegments: NaN,
        tubeSegments: Infinity,
      },
    },
    {
      name: "segment limits",
      options: { radialSegments: 1, tubeSegments: 129 },
    },
    {
      name: "fractional segments",
      options: { radialSegments: 7.9, tubeSegments: 5.5 },
    },
  ];

describe("app torus descriptor", () => {
  it.each(cases)(
    "reuses exact existing factory output: $name",
    async ({ options }) => {
      const scene = await app();
      try {
        scene.context.spawn.mesh({
          key: "ring",
          mesh: mesh.torus(options),
          material: material.standard(),
        });
        const source = sourceMesh(scene, "ring");
        expect(source).toEqual(createTorusMeshAsset(options));
        expect(validateMeshAsset(source)).toEqual({
          valid: true,
          diagnostics: [],
        });
        expect(Math.max(...source.indexBuffer!.data)).toBeLessThan(
          source.vertexStreams[0]!.vertexCount,
        );
      } finally {
        await scene.dispose();
      }
    },
  );

  it("uses the factory defaults when called without arguments", async () => {
    const scene = await app();
    try {
      scene.context.spawn.mesh({
        key: "default.ring",
        mesh: mesh.torus(),
        material: material.standard(),
      });
      const source = sourceMesh(scene, "default.ring");
      expect(source).toEqual(createTorusMeshAsset());
      expect(source.vertexStreams[0]!.vertexCount).toBe(33 * 13);
      expect(source.indexBuffer!.data).toHaveLength(32 * 12 * 6);
      expect(source.localAabb).toEqual({
        min: [-1, -0.25, -1],
        max: [1, 0.25, 1],
      });
    } finally {
      await scene.dispose();
    }
  });

  it("freezes the descriptor shell and copies options using the existing descriptor contract", () => {
    const options = {
      majorRadius: 2,
      tubeRadius: 0.5,
      radialSegments: 8,
      tubeSegments: 4,
    };
    const descriptor = mesh.torus(options);
    options.majorRadius = 99;
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(Object.isFrozen(descriptor.options)).toBe(
      Object.isFrozen(mesh.sphere().options),
    );
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual({
      kind: "torus",
      options: {
        majorRadius: 2,
        tubeRadius: 0.5,
        radialSegments: 8,
        tubeSegments: 4,
      },
    });
  });

  it("preserves distinct keyed parameters and the existing asset-handle identity model", async () => {
    const scene = await app();
    try {
      scene.context.spawn.mesh({
        key: "ring.small",
        mesh: mesh.torus({ majorRadius: 1, tubeRadius: 0.2 }),
        material: material.standard(),
      });
      const first = sourceMesh(scene, "ring.small");
      scene.context.spawn.mesh({
        key: "ring.large",
        mesh: mesh.torus({ majorRadius: 3, tubeRadius: 0.4 }),
        material: material.standard(),
      });
      expect(sourceMesh(scene, "ring.small")).toBe(first);
      expect(first).toEqual(
        createTorusMeshAsset({ majorRadius: 1, tubeRadius: 0.2 }),
      );
      expect(sourceMesh(scene, "ring.large")).toEqual(
        createTorusMeshAsset({ majorRadius: 3, tubeRadius: 0.4 }),
      );
      expect(scene.lowLevel.assets.createManifestReport().byKind.mesh).toBe(2);
    } finally {
      await scene.dispose();
    }
  });

  it("extracts a transformed grouped torus through the existing triangle-list path", async () => {
    const scene = await app();
    try {
      scene.context.spawn.camera({
        key: "camera.main",
        transform: { translation: [0, 2, 8], lookAt: [0, 0, 0] },
      });
      const group = scene.context.spawn.group({
        key: "assembly",
        transform: { translation: [1, 0, 0], scale: [1.5, 1.5, 1.5] },
      });
      scene.context.spawn.mesh({
        key: "assembly.ring",
        mesh: mesh.torus({ radialSegments: 8, tubeSegments: 4 }),
        material: material.standard(),
        transform: { parent: group, rotationEulerDegrees: [90, 0, 0] },
      });
      resolveWorldTransforms(scene.lowLevel.world);
      const snapshot = scene.extract();
      expect(snapshot.meshDraws).toHaveLength(1);
      expect(snapshot.meshDraws[0]).toMatchObject({
        mesh: createMeshHandle("assembly.ring.mesh"),
        indexCount: 8 * 4 * 6,
        batchKey: { topology: "triangle-list" },
      });
      expect(snapshot.bounds).toHaveLength(1);
      expect(snapshot.bounds[0]?.worldAabb.min[0]).toBeCloseTo(-0.5, 5);
      expect(snapshot.bounds[0]?.worldAabb.max[0]).toBeCloseTo(2.5, 5);
    } finally {
      await scene.dispose();
    }
  });

  it("creates closure-complete deterministic torus bundles through headless authoring", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "aperture-torus-bundle-"),
    );
    const session = await createHeadlessSessionController({
      config: defineApertureConfig({
        mode: "headless",
        render: {
          defaultCamera: false,
          defaultLight: false,
          defaultEnvironment: false,
        },
      }),
      systems: [
        {
          default: class TorusScene extends createSystem() {
            override init(): void {
              const group = this.spawn.group({
                key: "assembly",
                transform: { translation: [1, 0, 0] },
              });
              this.spawn.mesh({
                key: "ring",
                mesh: mesh.torus({
                  label: "Band",
                  majorRadius: 1.2,
                  tubeRadius: 0.35,
                  radialSegments: 16,
                  tubeSegments: 6,
                }),
                material: material.standard(),
                transform: { parent: group },
              });
              this.spawn.light({ kind: "directional", intensity: 3 });
            }
          },
        },
      ],
      seed: 42,
      assetMode: "strict",
      root: process.cwd(),
      publicDir: "public",
      allowHttpAssets: false,
      determinism: "off",
    });
    try {
      const capture = async (name: string) => {
        expect(session.callTool({ name: "camera_create_agent" }).ok).toBe(true);
        expect(
          session.callTool({
            name: "camera_frame_entities",
            arguments: { subjects: [{ key: "assembly" }] },
          }).ok,
        ).toBe(true);
        const out = path.join(root, name);
        await session.createBundle({ out, digest: true });
        const bundle = JSON.parse(await readFile(out, "utf8")) as {
          digest: { hash: string };
          assets: {
            entries: readonly { handle: { kind: string; id: string } }[];
          };
        };
        expect(preflightApertureSnapshotBundle(bundle).ok).toBe(true);
        expect(
          bundle.assets.entries.some(
            (entry) =>
              entry.handle.kind === "mesh" && entry.handle.id === "ring.mesh",
          ),
        ).toBe(true);
        return bundle;
      };
      const first = await capture("first.json");
      await session.reset({ seed: 42 });
      const repeated = await capture("repeated.json");
      expect(repeated.digest.hash).toBe(first.digest.hash);
    } finally {
      session.dispose();
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);
  it("keeps the facade types and recipe in the curated reference source surface", async () => {
    const exports = await discoverPackageExportInfo(process.cwd());
    const sources = await collectCandidateSources(process.cwd(), exports);
    expect(
      sources.find((source) => source.file === "docs/AUTHORING.md")
        ?.sourceCategory,
    ).toBe("docs");
    for (const file of [
      "packages/app/src/systems/spawn/descriptors.ts",
      "packages/app/src/systems.ts",
    ]) {
      expect(
        sources.find((source) => source.file === file)?.entrypoint,
      ).toContain("@aperture-engine/app/systems");
    }
    expect(
      sources.find(
        (source) => source.file === "packages/render/src/mesh/types.ts",
      )?.entrypoint,
    ).toContain("@aperture-engine/render");
    const documentation = await readFile(
      path.resolve("docs/AUTHORING.md"),
      "utf8",
    );
    for (const name of [
      "mesh.torus",
      "majorRadius",
      "tubeRadius",
      "radialSegments",
      "tubeSegments",
    ])
      expect(documentation).toContain(name);
  }, 30_000);
});
