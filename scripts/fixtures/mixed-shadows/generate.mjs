import { writeFile } from "node:fs/promises";
import { createApertureHeadlessRunner } from "../../../packages/app/dist/headless.js";
import { disposeApertureApp } from "../../../packages/app/dist/advanced.js";
import { defineApertureConfig } from "../../../packages/app/dist/config.js";
import {
  createSystem,
  mesh,
  material,
} from "../../../packages/app/dist/systems.js";
import {
  createApertureSnapshotBundle,
  preflightApertureSnapshotBundle,
} from "../../../packages/cli/dist/headless/bundle.js";
const outputPath = process.argv[2];
if (!outputPath) throw Error("Provide an output JSON path");
const cases = [
  ["baseline", {}],
  ["cached", {}],
  ...[0, 1, 2].map((i) => ["point-" + i + "-unshadowed", { disabled: i }]),
  ["sun-unshadowed", { sunDisabled: true }],
  ["caster-moved", { casterMoved: true }],
  ["light-moved", { lightMoved: true }],
  ["resized", { mapSize: 256 }],
  ["one-point", { pointCount: 1 }],
  ["revisit", {}],
  ["point-bias", { bias: 0.02 }],
  ["normal-bias", { normalBias: 0.08 }],
  ["spot-mixed", { spot: true }],
  ["ibl", { ibl: true }],
  ["directional-only", { pointCount: 0 }],
  ["point-only", { pointCount: 1, sun: false }],
  ["spot-only", { pointCount: 0, sun: false, spot: true }],
  ["fill-before", { ownerProof: true, fillFirst: true }],
  ["fill-after", { ownerProof: true }],
  [
    "fill-before-sun-off",
    { ownerProof: true, fillFirst: true, sunDisabled: true },
  ],
  ["fill-after-sun-off", { ownerProof: true, sunDisabled: true }],
  [
    "fill-before-soft-sun",
    { ownerProof: true, fillFirst: true, sunStrength: 0.35 },
  ],
  ["fill-after-soft-sun", { ownerProof: true, sunStrength: 0.35 }],
];
const fixtures = [];
for (const [name, p] of cases) {
  class Fixture extends createSystem({ priority: 0 }) {
    init() {
      const mat = material.standard({
        baseColor: [0.65, 0.65, 0.65, 1],
        roughness: 1,
        metallic: 0,
      });
      this.spawn.mesh({
        key: "ground",
        mesh: mesh.box({ size: [11, 0.1, 8] }),
        material: mat,
        castShadow: false,
        receiveShadow: true,
        transform: { translation: [0, -0.05, 0] },
      });
      for (let i = 0; i < 3; i++)
        this.spawn.mesh({
          key: "blocker-" + i,
          mesh: mesh.box({ size: [0.6, 1.5, 0.6] }),
          material: mat,
          castShadow: true,
          receiveShadow: true,
          transform: {
            translation: [
              (i - 1) * 3 + (p.casterMoved && i === 1 ? 0.8 : 0),
              0.75,
              0,
            ],
          },
        });
      for (let i = 0; i < (p.pointCount ?? 3); i++)
        this.spawn.light({
          key: "point-" + i,
          kind: "point",
          color: [
            [1, 0, 0, 1],
            [0, 1, 0, 1],
            [0, 0, 1, 1],
          ][i],
          intensity: p.ownerProof ? 0 : 18,
          light: { range: 6 },
          transform: {
            translation: [
              (i - 1) * 3 + (p.lightMoved && i === 1 ? 1 : 0),
              3,
              2,
            ],
          },
          shadow: {
            mapSize: p.mapSize ?? 192,
            bias: p.bias ?? 0.0005,
            normalBias: p.normalBias ?? 0.01,
            strength: p.disabled === i ? 0 : 1,
            filterRadius: 0,
            shadowType: 0,
          },
        });
      const spawnFill = () =>
        this.spawn.light({
          key: "directional-fill",
          kind: "directional",
          color: [0, 1, 1, 1],
          intensity: 0.7,
          light: { range: 500 },
          transform: { translation: [6, 9, -5], lookAt: [0, 0, 0] },
        });
      if (p.ownerProof && p.fillFirst) spawnFill();
      if (p.sun !== false)
        this.spawn.light({
          key: "sun",
          kind: "directional",
          color: p.ownerProof ? [1, 0, 0, 1] : [1, 1, 1, 1],
          intensity: 0.8,
          transform: { translation: [-6, 9, 5], lookAt: [0, 0, 0] },
          shadow: {
            mapSize: 512,
            cascadeCount: 1,
            orthographicSize: 15,
            center: [0, 0, 0],
            lightDistance: 20,
            near: 0.1,
            far: 40,
            bias: 0.0005,
            normalBias: 0.01,
            strength: p.sunDisabled ? 0 : (p.sunStrength ?? 1),
            filterRadius: 0,
            shadowType: 0,
          },
        });
      if (p.ownerProof && !p.fillFirst) spawnFill();
      this.spawn.light({
        key: "ambient",
        kind: "ambient",
        color: [1, 1, 1, 1],
        intensity: 0.06,
      });
      if (p.spot)
        this.spawn.light({
          key: "spot",
          kind: "spot",
          color: [1, 1, 1, 1],
          intensity: 0.1,
          light: { range: 4 },
          transform: { translation: [0, 4, 0], lookAt: [0, 0, 0] },
          shadow: { mapSize: 128 },
        });
      this.spawn.camera({
        key: "camera",
        transform: { translation: [0, 14, 8], lookAt: [0, 0, 0] },
        fovYDegrees: 42,
        camera: {
          aspect: 4 / 3,
          near: 0.1,
          far: 50,
          clearColor: [0.08, 0.08, 0.08, 1],
        },
      });
    }
  }
  const runner = await createApertureHeadlessRunner({
    config: defineApertureConfig({
      mode: "headless",
      render: {
        defaultCamera: false,
        defaultLight: false,
        defaultEnvironment: p.ibl === true,
        tonemap: "none",
        sampleCount: 1,
      },
    }),
    systems: [{ default: Fixture }],
  });
  try {
    const { snapshot } = runner.step(1 / 60, 0);
    const bundle = createApertureSnapshotBundle({
      snapshot,
      assets: runner.app.lowLevel.assets,
      options: {
        createdBy: "Controlled mixed-shadow regression",
        allowPlaceholders: false,
        renderTarget: {
          width: 800,
          height: 600,
          colorSpace: "srgb",
          sampleCount: 1,
          toneMapping: "none",
        },
      },
    });
    const preflight = preflightApertureSnapshotBundle(bundle);
    if (!preflight.ok) throw Error(JSON.stringify(preflight));
    fixtures.push({ name, bundle });
  } finally {
    await disposeApertureApp(runner.app);
  }
}
await writeFile(outputPath, JSON.stringify(fixtures));
