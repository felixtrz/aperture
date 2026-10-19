import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { createApertureHeadlessFailureStatus } from "@aperture-engine/app/headless";
import {
  createSystem,
  material,
  mesh,
  type SphereMeshDescriptorOptions,
} from "@aperture-engine/app/systems";
import { type MeshAsset } from "@aperture-engine/render";
import { createMeshHandle } from "@aperture-engine/simulation";
import { createHeadlessSessionController } from "../../packages/cli/src/headless/session-controller.js";

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

describe("app sphere option diagnostics", () => {
  it("rejects direct factory controls at the facade and lists its accepted options", () => {
    const options = { radius: 1.15, widthSegments: 7, heightSegments: 5 };
    expect(() => mesh.sphere(options)).toThrow(
      expect.objectContaining({
        name: "ApertureSystemError",
        code: "aperture.spawn.invalidSphereMesh",
        detail: { path: "widthSegments" },
        message: expect.stringContaining('"widthSegments", "heightSegments"'),
        suggestedFix: expect.stringContaining(
          "Accepted mesh.sphere() options: radius, segments.",
        ),
      }),
    );
  });

  it.each([null, [], "sphere", false, 0])(
    "rejects malformed runtime options before the facade copies them: %j",
    (options) => {
      expect(() =>
        mesh.sphere(options as unknown as SphereMeshDescriptorOptions),
      ).toThrow(
        expect.objectContaining({
          code: "aperture.spawn.invalidSphereMesh",
          detail: { path: "options" },
        }),
      );
    },
  );

  it("rejects raw JSON descriptors transactionally and extracts a corrected same-key retry", async () => {
    const scene = await app();
    try {
      for (const key of [
        "widthSegments",
        "heightSegments",
        "label",
        "segements",
        "__proto__",
        "constructor",
        "toString",
      ]) {
        const options: SphereMeshDescriptorOptions = JSON.parse(
          `{"radius":1.15,"${key}":7}`,
        );
        expect(() =>
          scene.context.spawn.mesh({
            key: "sphere",
            mesh: { kind: "sphere", options },
            material: material.standard(),
          }),
        ).toThrow(
          expect.objectContaining({
            code: "aperture.spawn.invalidSphereMesh",
            detail: { path: key },
          }),
        );
        expect(scene.lowLevel.assets.createManifestReport().total).toBe(0);
      }
      for (const options of [null, [], undefined, false]) {
        expect(() =>
          scene.context.spawn.mesh({
            key: "sphere",
            mesh: {
              kind: "sphere",
              options: options as unknown as SphereMeshDescriptorOptions,
            },
            material: material.standard(),
          }),
        ).toThrow(
          expect.objectContaining({
            code: "aperture.spawn.invalidSphereMesh",
            detail: { path: "options" },
          }),
        );
        expect(scene.lowLevel.assets.createManifestReport().total).toBe(0);
      }
      scene.context.spawn.camera({
        key: "camera",
        camera: { frustumCulling: false },
        transform: { translation: [0, 2, 8], lookAt: [0, 0, 0] },
      });
      scene.context.spawn.mesh({
        key: "sphere",
        mesh: mesh.sphere({ radius: 1.15, segments: 7 }),
        material: material.standard(),
      });
      const snapshot = scene.extract();
      expect(snapshot.meshDraws).toHaveLength(1);
      expect(snapshot.meshDraws[0]?.indexCount).toBe(252);
      expect(snapshot.bounds[0]?.localAabb.max[1]).toBeCloseTo(1.15, 6);
    } finally {
      await scene.dispose();
    }
  });

  it("reports authored sphere option errors through headless CPU startup", async () => {
    let session:
      | Awaited<ReturnType<typeof createHeadlessSessionController>>
      | undefined;
    try {
      session = await createHeadlessSessionController({
        config: defineApertureConfig({ mode: "headless" }),
        systems: [
          {
            default: class InvalidSphereScene extends createSystem() {
              override init(): void {
                const options = {
                  radius: 1.15,
                  widthSegments: 7,
                  heightSegments: 5,
                };
                this.spawn.mesh({
                  key: "sphere",
                  mesh: mesh.sphere(options),
                  material: material.standard(),
                });
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
      expect.fail("Unsupported sphere options must fail before extraction.");
    } catch (error) {
      expect(error).toMatchObject({
        code: "aperture.spawn.invalidSphereMesh",
        stack: expect.stringContaining("InvalidSphereScene.init"),
      });
      expect(createApertureHeadlessFailureStatus(error)).toMatchObject({
        status: "failed",
        diagnostics: [
          {
            code: "aperture.spawn.invalidSphereMesh",
            severity: "error",
            data: { path: "widthSegments" },
            message: expect.stringContaining(
              '"widthSegments", "heightSegments"',
            ),
            suggestedFix: expect.stringContaining(
              "segments for both width and height subdivisions",
            ),
          },
        ],
      });
    } finally {
      session?.dispose();
    }
  }, 60_000);

  // Recorded from the existing facade before validation; its defaults and
  // non-finite fallbacks differ from the direct render factory's defaults.
  const existingBuffers: readonly {
    name: string;
    options?: SphereMeshDescriptorOptions;
    sha256: string;
  }[] = [
    {
      name: "defaults",
      sha256:
        "f36c9ad8b98b6be04ed2a5e4f931f401830f25478ba9176977a4cd55e401643c",
    },
    {
      name: "shared segment control",
      options: { radius: 1.15, segments: 7 },
      sha256:
        "39e32fbb57675b2ee9039bad042d5063ca4479a51b8b18cb9b0781ceef7f4a3f",
    },
    {
      name: "radius fallback and fractional segments",
      options: { radius: -1, segments: 7.9 },
      sha256:
        "27cbb75624bf502aa634fc0cf7a0c8bcbf2c309f9f7a5939ad31241bc827b53d",
    },
    {
      name: "non-finite radius and segments",
      options: { radius: Infinity, segments: NaN },
      sha256:
        "f36c9ad8b98b6be04ed2a5e4f931f401830f25478ba9176977a4cd55e401643c",
    },
    {
      name: "low segment clamp",
      options: { radius: 2, segments: 1 },
      sha256:
        "807144548aa99935e3a15781eb0d3ccbf7613ba7708efe65104ac36ac9b2dd19",
    },
    {
      name: "high segment clamp",
      options: { radius: 2, segments: 129 },
      sha256:
        "c498f733aaf85c9fd8d2e20cfc1749488f3863bb26e0ce1c49b8446af67fa159",
    },
  ];
  it.each(existingBuffers)(
    "preserves existing facade bytes: $name",
    async ({ options, sha256 }) => {
      const scene = await app();
      try {
        scene.context.spawn.mesh({
          key: "sphere",
          mesh: mesh.sphere(options),
          material: material.standard(),
        });
        const entry = scene.lowLevel.assets.get<"mesh", MeshAsset>(
          createMeshHandle("sphere.mesh"),
        );
        expect(entry?.status).toBe("ready");
        const source = entry!.asset!;
        const hash = createHash("sha256");
        for (const data of [
          ...source.vertexStreams.map((stream) => stream.data),
          source.indexBuffer!.data,
        ]) {
          hash.update(
            new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
          );
        }
        expect(hash.digest("hex")).toBe(sha256);
      } finally {
        await scene.dispose();
      }
    },
  );

  it("preserves the descriptor copy contract and accepts inherited metadata", () => {
    const options = { radius: 2, segments: 7 };
    const descriptor = mesh.sphere(options);
    options.radius = 99;
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(Object.isFrozen(descriptor.options)).toBe(false);
    expect(descriptor).toEqual({
      kind: "sphere",
      options: { radius: 2, segments: 7 },
    });
    for (const prototype of [null, { note: "inherited metadata" }]) {
      const input = Object.assign(Object.create(prototype) as object, options);
      expect(mesh.sphere(input)).toEqual(mesh.sphere(options));
    }
  });
});
