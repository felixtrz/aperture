import { describe, expect, it } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import {
  InstanceTint,
  color,
  material,
  mesh,
  type MaterialHandle,
  type MeshAsset,
} from "@aperture-engine/app/systems";
import {
  createCapsuleMeshAsset,
  createConeMeshAsset,
  createCylinderMeshAsset,
  validateMaterialAsset,
  validateMeshAsset,
  type StandardMaterialAsset,
  type UnlitMaterialAsset,
} from "@aperture-engine/render";
import {
  createMaterialHandle,
  createMeshHandle,
  resolveWorldTransforms,
} from "@aperture-engine/simulation";

// Acceptance for the three.js-parity authoring surface: the gaps two
// independent agents hit when authoring the same scenes in three.js and in
// Aperture (docs/AGENT_THREEJS_GAP.md).

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

type Scene = Awaited<ReturnType<typeof app>>;

function sourceMaterial<T>(scene: Scene, id: string): T {
  const entry = scene.lowLevel.assets.get<"material", T>(
    createMaterialHandle(id),
  );
  expect(entry?.status).toBe("ready");
  return entry!.asset!;
}

function sourceMesh(scene: Scene, id: string): MeshAsset {
  const entry = scene.lowLevel.assets.get<"mesh", MeshAsset>(
    createMeshHandle(id),
  );
  expect(entry?.status).toBe("ready");
  return entry!.asset!;
}

function errorCode(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

describe("material surface options", () => {
  it("turns opacity into a valid alpha-blend render state", async () => {
    const scene = await app();
    try {
      scene.context.spawn.mesh({
        key: "lake",
        mesh: mesh.plane({ size: 4 }),
        material: material.standard({
          baseColor: [0.1, 0.3, 0.5, 1],
          roughness: 0.1,
          opacity: 0.6,
          doubleSided: true,
        }),
      });
      const asset = sourceMaterial<StandardMaterialAsset>(
        scene,
        "lake.material",
      );

      expect(asset.baseColorFactor[3]).toBeCloseTo(0.6);
      expect(asset.renderState).toMatchObject({
        alphaMode: "blend",
        blend: { preset: "alpha" },
        depth: { test: true, write: false, compare: "less" },
        cullMode: "none",
      });
      expect(validateMaterialAsset(asset).valid).toBe(true);
    } finally {
      await scene.dispose();
    }
  });

  it("treats a translucent baseColor alpha as blending and honors explicit modes", async () => {
    const scene = await app();
    try {
      scene.context.spawn.mesh({
        key: "glass",
        mesh: mesh.box(),
        material: material.standard({ baseColor: [0.6, 0.8, 1, 0.3] }),
      });
      scene.context.spawn.mesh({
        key: "leaves",
        mesh: mesh.plane(),
        material: material.standard({
          alphaMode: "mask",
          alphaCutoff: 0.4,
          doubleSided: true,
        }),
      });
      scene.context.spawn.mesh({
        key: "solid",
        mesh: mesh.box(),
        material: material.standard({
          baseColor: [1, 1, 1, 0.5],
          alphaMode: "opaque",
        }),
      });

      expect(
        sourceMaterial<StandardMaterialAsset>(scene, "glass.material")
          .renderState.alphaMode,
      ).toBe("blend");
      expect(
        sourceMaterial<StandardMaterialAsset>(scene, "leaves.material")
          .renderState,
      ).toMatchObject({
        alphaMode: "mask",
        alphaCutoff: 0.4,
        cullMode: "none",
      });
      expect(
        sourceMaterial<StandardMaterialAsset>(scene, "solid.material")
          .renderState,
      ).toMatchObject({ alphaMode: "opaque", depth: { write: true } });
    } finally {
      await scene.dispose();
    }
  });

  it("supports opacity on unlit materials and keeps defaults untouched", async () => {
    const scene = await app();
    try {
      scene.context.spawn.mesh({
        key: "glow",
        mesh: mesh.sphere(),
        material: material.unlit({ baseColor: [1, 0.6, 0.2, 1], opacity: 0.5 }),
      });
      scene.context.spawn.mesh({
        key: "plain",
        mesh: mesh.box(),
        material: material.standard(),
      });
      const glow = sourceMaterial<UnlitMaterialAsset>(scene, "glow.material");

      expect(glow.renderState.alphaMode).toBe("blend");
      expect(glow.baseColorFactor[3]).toBeCloseTo(0.5);
      expect(validateMaterialAsset(glow).valid).toBe(true);
      expect(
        sourceMaterial<StandardMaterialAsset>(scene, "plain.material")
          .renderState,
      ).toMatchObject({
        alphaMode: "opaque",
        cullMode: "back",
        blend: { preset: "none" },
      });
    } finally {
      await scene.dispose();
    }
  });

  it("rejects out-of-range surface values with a structured diagnostic", async () => {
    const scene = await app();
    try {
      for (const options of [
        { opacity: 1.5 },
        { opacity: Number.NaN },
        { alphaCutoff: -0.1 },
        { alphaMode: "additive" as "blend" },
      ]) {
        expect(
          errorCode(() =>
            scene.context.spawn.mesh({
              key: "bad",
              mesh: mesh.box(),
              material: material.standard(options),
            }),
          ),
        ).toBe("aperture.spawn.invalidMaterialSurface");
      }
    } finally {
      await scene.dispose();
    }
  });
});

describe("shared materials and meshes", () => {
  it("shares one created material across many meshes and retints them together", async () => {
    const scene = await app();
    try {
      const bark: MaterialHandle = scene.context.materials.create(
        "bark",
        material.standard({ baseColor: color.hex("#5b3a24"), roughness: 0.9 }),
      );
      const trunk = scene.context.meshes.create(
        "trunk",
        mesh.cylinder({ radiusTop: 0.1, radiusBottom: 0.2, height: 2 }),
      );
      for (let index = 0; index < 5; index += 1) {
        scene.context.spawn.mesh({
          key: `tree.${index}`,
          mesh: trunk,
          material: bark,
          transform: { translation: [index * 2, 1, 0] },
        });
      }
      resolveWorldTransforms(scene.lowLevel.world);
      const snapshot = scene.extract();
      const report = scene.lowLevel.assets.createManifestReport();

      expect(report.byKind.material).toBe(1);
      expect(report.byKind.mesh).toBe(1);
      expect(snapshot.meshDraws).toHaveLength(5);
      expect(
        new Set(snapshot.meshDraws.map((draw) => draw.material.id)),
      ).toEqual(new Set(["bark"]));

      const before = scene.lowLevel.assets.get(bark)!.version;
      const result = scene.context.materials.set(bark, {
        baseColorFactor: [0.2, 0.2, 0.2, 1],
      });
      expect(result.ok).toBe(true);
      expect(scene.lowLevel.assets.get(bark)!.version).toBe(before + 1);

      // Re-creating under the same id publishes a new version, not a new asset.
      scene.context.materials.create("bark", material.standard());
      expect(scene.lowLevel.assets.createManifestReport().byKind.material).toBe(
        1,
      );
    } finally {
      await scene.dispose();
    }
  });

  it("publishes primitive descriptors through meshes.publish and dynamic meshes", async () => {
    const scene = await app();
    try {
      const flag = scene.context.meshes.dynamic("flag", {
        initial: mesh.plane({ size: [2, 1], subdivisions: 4 }),
      });
      const first = flag.get()!;
      const published = flag.publish(
        mesh.triangleList({
          positions: [
            [0, 0, 0],
            [1, 0, 0.2],
            [0, 1, 0],
          ],
        }),
      );

      expect(validateMeshAsset(first).valid).toBe(true);
      expect(published.version).toBeGreaterThan(1);
      expect(flag.get()!.vertexStreams[0]!.vertexCount).toBe(3);
      expect(
        scene.context.meshes.publish("rock", mesh.sphere({ segments: 6 }))
          .handle,
      ).toEqual(createMeshHandle("rock"));
    } finally {
      await scene.dispose();
    }
  });
});

describe("per-entity tint", () => {
  it("tints entities that share one material and lets systems change it", async () => {
    const scene = await app();
    try {
      scene.context.spawn.camera({
        key: "camera.main",
        transform: { translation: [0, 2, 10], lookAt: [0, 0, 0] },
      });
      const paint = scene.context.materials.create(
        "car.paint",
        material.standard({ roughness: 0.4 }),
      );
      const body = scene.context.meshes.create("car.body", mesh.box());
      const red = scene.context.spawn.mesh({
        key: "car.red",
        mesh: body,
        material: paint,
        tint: color.hex("#c0392b"),
      });
      scene.context.spawn.mesh({
        key: "car.plain",
        mesh: body,
        material: paint,
        transform: { translation: [3, 0, 0] },
      });
      resolveWorldTransforms(scene.lowLevel.world);
      const first = scene.extract();
      const tinted = first.meshDraws.find(
        (draw) => draw.entity.index === red.index,
      )!;
      const plain = first.meshDraws.find(
        (draw) => draw.entity.index !== red.index,
      )!;

      expect(tinted.instanceTintOffset).toBeDefined();
      expect(plain.instanceTintOffset).toBeUndefined();
      expect(
        Array.from(
          first.instanceTints!.slice(
            tinted.instanceTintOffset!,
            tinted.instanceTintOffset! + 4,
          ),
        ),
      ).toEqual(color.hex("#c0392b").map((value) => Math.fround(value)));

      red.getVectorView(InstanceTint, "color").set([0.2, 0.4, 0.9, 0.5]);
      const second = scene.extract();
      const updated = second.meshDraws.find(
        (draw) => draw.entity.index === red.index,
      )!;
      expect(
        Array.from(
          second.instanceTints!.slice(
            updated.instanceTintOffset!,
            updated.instanceTintOffset! + 4,
          ),
        ),
      ).toEqual([0.2, 0.4, 0.9, 0.5].map((value) => Math.fround(value)));
    } finally {
      await scene.dispose();
    }
  });
});

describe("geometry parity", () => {
  it("exposes tapered cylinders and height on cylinder/cone/capsule", async () => {
    const scene = await app();
    try {
      scene.context.spawn.mesh({
        key: "trunk",
        mesh: mesh.cylinder({
          radiusTop: 0.1,
          radiusBottom: 0.25,
          height: 3,
          segments: 6,
          heightSegments: 2,
        }),
        material: material.standard(),
      });
      scene.context.spawn.mesh({
        key: "pine",
        mesh: mesh.cone({ radius: 1, height: 2, depth: 9, segments: 7 }),
        material: material.standard(),
      });
      scene.context.spawn.mesh({
        key: "pill",
        mesh: mesh.capsule({ radius: 0.2, height: 1 }),
        material: material.standard(),
      });

      expect(sourceMesh(scene, "trunk.mesh")).toEqual(
        createCylinderMeshAsset({
          radius: 0.5,
          radiusTop: 0.1,
          radiusBottom: 0.25,
          height: 3,
          radialSegments: 6,
          heightSegments: 2,
        }),
      );
      // height wins over the legacy depth alias.
      expect(sourceMesh(scene, "pine.mesh")).toEqual(
        createConeMeshAsset({ radius: 1, height: 2, radialSegments: 7 }),
      );
      expect(sourceMesh(scene, "pill.mesh")).toEqual(
        createCapsuleMeshAsset({ radius: 0.2, height: 1, radialSegments: 32 }),
      );
    } finally {
      await scene.dispose();
    }
  });

  it("merges a multi-colored prop into one draw with vertex colors", async () => {
    const scene = await app();
    try {
      scene.context.spawn.camera({
        key: "camera.main",
        transform: { translation: [0, 2, 8], lookAt: [0, 1, 0] },
      });
      scene.context.spawn.mesh({
        key: "tree",
        mesh: mesh.merge([
          {
            mesh: mesh.cylinder({
              radiusTop: 0.1,
              radiusBottom: 0.15,
              height: 1,
            }),
            transform: { translation: [0, 0.5, 0] },
            color: color.hex("#6b4a2a"),
          },
          {
            mesh: mesh.cone({ radius: 0.8, height: 1.6, segments: 7 }),
            transform: {
              translation: [0, 1.8, 0],
              rotationEulerDegrees: [0, 20, 0],
            },
            color: [0.1, 0.35, 0.12],
          },
          {
            mesh: mesh.merge([{ mesh: mesh.sphere({ radius: 0.2 }) }]),
            transform: { translation: [0, 2.7, 0], scale: [1, 0.8, 1] },
          },
        ]),
        material: material.standard({ roughness: 0.8 }),
      });
      resolveWorldTransforms(scene.lowLevel.world);
      const snapshot = scene.extract();
      const merged = sourceMesh(scene, "tree.mesh");

      expect(snapshot.meshDraws).toHaveLength(1);
      expect(snapshot.meshDraws[0]!.batchKey.meshLayoutKey).toContain(
        "COLOR_0",
      );
      expect(validateMeshAsset(merged)).toEqual({
        valid: true,
        diagnostics: [],
      });
      expect(merged.localAabb?.max[1]).toBeCloseTo(2.7 + 0.2 * 0.8, 4);
    } finally {
      await scene.dispose();
    }
  });

  it("rejects line parts in merges with a part path", async () => {
    const scene = await app();
    try {
      expect(
        errorCode(() =>
          scene.context.spawn.mesh({
            key: "bad.merge",
            mesh: mesh.merge([
              { mesh: mesh.box() },
              {
                mesh: mesh.lineList({
                  positions: [
                    [0, 0, 0],
                    [1, 0, 0],
                  ],
                }),
              },
            ]),
            material: material.standard(),
          }),
        ),
      ).toBe("aperture.spawn.invalidMergeMesh");
      expect(
        errorCode(() =>
          scene.context.spawn.mesh({
            key: "empty.merge",
            mesh: mesh.merge([]),
            material: material.standard(),
          }),
        ),
      ).toBe("aperture.spawn.invalidMergeMesh");
    } finally {
      await scene.dispose();
    }
  });
});

describe("color helpers", () => {
  it("decodes sRGB swatches to linear like three.js Color", () => {
    expect(color.hex("#ffffff")).toEqual([1, 1, 1, 1]);
    expect(color.hex(0x000000)).toEqual([0, 0, 0, 1]);
    expect(color.hex("#f80")).toEqual(color.hex("#ff8800"));
    expect(color.hex(0xff8800)).toEqual(color.hex("ff8800"));
    // sRGB 0x80 (~0.502) is ~0.2159 linear, not 0.5.
    expect(color.hex(0x808080)[0]).toBeCloseTo(0.21586, 4);
    expect(color.hex("#ff000080")[3]).toBeCloseTo(128 / 255);
    expect(color.hex("#ff0000", 0.25)[3]).toBe(0.25);
    expect(color.srgb(0.5, 0.5, 0.5)[1]).toBeCloseTo(0.214, 3);
  });

  it("rejects malformed input with a structured diagnostic", () => {
    for (const run of [
      () => color.hex("#12345"),
      () => color.hex("green"),
      () => color.hex(0x1000000),
      () => color.hex("#fff", 2),
      () => color.srgb(Number.NaN, 0, 0),
    ]) {
      expect(errorCode(run)).toBe("aperture.color.invalid");
    }
  });
});
