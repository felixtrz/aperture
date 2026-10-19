import { describe, expect, it } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { createSystem } from "@aperture-engine/app/systems";
import {
  analyzeLightingHealth,
  lightingHealthInputFingerprint,
  lightingHealthReportToJsonValue,
  type RenderSnapshot,
  type ViewPacket,
} from "@aperture-engine/render";
import { AssetRegistry } from "@aperture-engine/simulation";

const output = {
  tonemap: "aces",
  exposure: 1,
  hdr: true,
  colorSpace: "srgb",
} as const;
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
// A 3-4-5 triangle: toward-light elevation has sin=3/5, cos=4/5.
const sun = [1, 0, 0, 0, 0, 0.8, -0.6, 0, 0, 0.6, 0.8, 0, 8, 9, 10, 1];

describe("directional lighting evidence", () => {
  it("reports an independent 3-4-5 light and horizontal-ground shadow construction", () => {
    const report = analyze(scene());
    const light = report.lighting.directionalGeometry[0]!;
    expect(light.status).toBe("ready");
    expectVector(light.towardLightWorld, [0, 0.6, 0.8]);
    expect(light.worldElevationDegrees).toBeCloseTo(36.86989765, 5);
    expect(light.intensity).toBe(4);
    expect(light.color).toEqual([1, 0.9, 0.8, 1]);
    expect(light.groundShadow.status).toBe("ready");
    expectVector(light.groundShadow.displacementWorldPerUnitHeight, [
      0,
      0,
      -4 / 3,
    ]);
    const camera = light.cameras[0]!;
    expectVector(camera.towardLightCamera, [0, 0.6, 0.8]);
    expect(camera.angleFromCameraAxisDegrees).toBeCloseTo(36.86989765, 5);
    // A horizontal camera sees this ground displacement along its view axis.
    expect(camera.groundShadowCameraPlanePerUnitHeight).toEqual([0, 0]);
    expect(report.warnings).toEqual([]);
  });

  it("uses ECS-resolved parent rotations and camera roll for both projection kinds", async () => {
    const app = await createApertureApp({
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
          default: class LightingScene extends createSystem() {
            override init(): void {
              const parent = this.spawn.group({
                key: "parent",
                transform: {
                  translation: [5, 10, 2],
                  rotationEulerDegrees: [0, 90, 0],
                },
              });
              this.spawn.light({
                key: "sun",
                kind: "directional",
                intensity: 3,
                transform: {
                  parent,
                  rotationEulerDegrees: [-36.86989765, 0, 0],
                },
              });
              for (const projection of [
                "orthographic",
                "perspective",
              ] as const) {
                this.spawn.camera({
                  key: projection,
                  transform: {
                    parent,
                    translation: [0, 7, 0],
                    rotationEulerDegrees: [-90, 0, 90],
                  },
                  camera: {
                    projection,
                    orthographicHeight: 10,
                    near: 0.1,
                    far: 100,
                  },
                });
              }
            }
          },
        },
      ],
    });
    try {
      app.step(1 / 60, 0);
      const snapshot = app.extract(1);
      const report = analyzeLightingHealth({
        snapshot,
        assets: app.context.assetsRegistry,
        output,
      });
      const light = report.lighting.directionalGeometry[0]!;
      // Parent yaw moves the unparented +Z component to world +X.
      expectVector(light.towardLightWorld, [0.8, 0.6, 0]);
      expectVector(light.groundShadow.displacementWorldPerUnitHeight, [
        -4 / 3,
        0,
        0,
      ]);
      expect(light.cameras).toHaveLength(2);
      for (const camera of light.cameras) {
        // This rolled downward camera has right=-X, up=+Z, backward=+Y.
        expect(camera.status).toBe("ready");
        expectVector(camera.towardLightCamera, [-0.8, 0, 0.6]);
        expect(camera.angleFromCameraAxisDegrees).toBeCloseTo(53.13010235, 5);
        expectVector(camera.groundShadowCameraPlanePerUnitHeight, [4 / 3, 0]);
      }
      expect(report.warnings).toEqual([]);
    } finally {
      await app.dispose();
    }
  });

  it("reports no cameras explicitly and keeps nondirectional lights out of geometry", () => {
    const snapshot = scene();
    const light = analyze({ ...snapshot, views: [] }).lighting
      .directionalGeometry[0]!;
    expect(light.cameraStatus).toBe("no-cameras");
    expect(light.cameras).toEqual([]);
    expect(light.towardLightWorld).not.toBeNull();
    expect(
      analyze({
        ...snapshot,
        lights: [{ ...snapshot.lights[0]!, kind: "point" }],
      }).lighting.directionalGeometry,
    ).toEqual([]);
  });

  it.each([-1, 0.5, 16, NaN, Infinity])(
    "does not invent a direction for invalid transform offset %s",
    (offset) => {
      const snapshot = scene();
      const light = analyze({
        ...snapshot,
        lights: [{ ...snapshot.lights[0]!, worldTransformOffset: offset }],
      }).lighting.directionalGeometry[0]!;
      expect(light.status).toBe("invalid-light-transform");
      expect(light.towardLightWorld).toBeNull();
      expect(light.worldElevationDegrees).toBeNull();
      expect(light.groundShadow).toEqual({
        status: "invalid-light-transform",
        displacementWorldPerUnitHeight: null,
      });
      expect(light.cameras[0]!.status).toBe("invalid-light-transform");
      expect(light.cameras[0]!.towardLightCamera).toBeNull();
    },
  );

  it.each([
    [0, 0],
    [8, NaN],
    [10, Infinity],
    [15, 0],
    [10, 1e-6],
  ])(
    "handles singular/nonfinite/fallback light matrices (%s, %s)",
    (index, value) => {
      const snapshot = scene();
      if (index === 10 && value === 1e-6) {
        snapshot.transforms[8] = 0;
        snapshot.transforms[9] = 0;
      }
      snapshot.transforms[index] = value;
      const light = analyze(snapshot).lighting.directionalGeometry[0]!;
      expect(light.status).toBe("invalid-light-transform");
      expect(light.towardLightWorld).toBeNull();
    },
  );

  it("keeps valid light geometry when a camera matrix is missing, singular or sheared", () => {
    for (const scenario of [
      "missing",
      "singular",
      "nonfinite",
      "sheared",
    ] as const) {
      const snapshot = scene();
      if (scenario === "missing") snapshot.viewMatrices.fill(0);
      if (scenario === "singular") snapshot.viewMatrices[0] = 0;
      if (scenario === "nonfinite") snapshot.viewMatrices[12] = NaN;
      if (scenario === "sheared") snapshot.viewMatrices[4] = 0.25;
      const light = analyze(snapshot).lighting.directionalGeometry[0]!;
      expect(light.status).toBe("ready");
      const camera = light.cameras[0]!;
      expect(camera.status).toBe(
        scenario === "sheared"
          ? "non-orthogonal-camera-basis"
          : "invalid-camera-transform",
      );
      expect(camera.towardLightCamera).toBeNull();
      expect(camera.angleFromCameraAxisDegrees).toBeNull();
      expect(camera.groundShadowCameraPlanePerUnitHeight).toBeNull();
    }
    const snapshot = scene();
    expect(
      analyze({ ...snapshot, viewMatrices: new Float32Array() }).lighting
        .directionalGeometry[0]!.cameras[0]!.status,
    ).toBe("invalid-camera-transform");
  });

  it("normalizes orthogonal camera scale while retaining the resolved axes", () => {
    const snapshot = scene();
    snapshot.viewMatrices[0] = 0.5;
    snapshot.viewMatrices[5] = 0.25;
    snapshot.viewMatrices[10] = 2;
    const camera =
      analyze(snapshot).lighting.directionalGeometry[0]!.cameras[0]!;
    expect(camera.status).toBe("ready");
    expectVector(camera.towardLightCamera, [0, 0.6, 0.8]);
  });

  it("returns null ground shadow for light at/below the horizon, without warnings", () => {
    for (const y of [0, -0.6]) {
      const snapshot = scene();
      snapshot.transforms.set(identity);
      snapshot.transforms[9] = y;
      const report = analyze(snapshot);
      const light = report.lighting.directionalGeometry[0]!;
      expect(light.status).toBe("ready");
      expect(light.groundShadow).toEqual({
        status: "light-at-or-below-horizon",
        displacementWorldPerUnitHeight: null,
      });
      expect(light.cameras[0]!.status).toBe("ready");
      expect(light.cameras[0]!.groundShadowCameraPlanePerUnitHeight).toBeNull();
      expect(report.warnings).toEqual([]);
    }
  });

  it("has stable sorted records, finite JSON and deeply independent copies", () => {
    const snapshot = scene();
    const firstLight = snapshot.lights[0]!;
    const firstView = snapshot.views[0]!;
    const report = analyze({
      ...snapshot,
      lights: [
        {
          ...firstLight,
          lightId: 9,
          intensity: Infinity,
          color: [NaN, 1, 1, 1],
        },
        firstLight,
      ],
      views: [{ ...firstView, viewId: 9 }, firstView],
    });
    expect(
      report.lighting.directionalGeometry.map((light) => light.lightId),
    ).toEqual([1, 9]);
    const copy = lightingHealthReportToJsonValue(report);
    expect(copy).toEqual(report);
    expect(JSON.parse(JSON.stringify(copy))).toEqual(copy);
    const light = copy.lighting.directionalGeometry[0]!;
    expect(light.cameras.map((camera) => camera.viewId)).toEqual([1, 9]);
    const original = report.lighting.directionalGeometry[0]!;
    const camera = light.cameras[0]!;
    (light.towardLightWorld as unknown as number[])[0] = 99;
    (light.color as unknown as number[])[0] = 99;
    (
      light.groundShadow.displacementWorldPerUnitHeight as unknown as number[]
    )[0] = 99;
    (camera.towardLightCamera as unknown as number[])[0] = 99;
    (camera.groundShadowCameraPlanePerUnitHeight as unknown as number[])[0] =
      99;
    (light.entity as { index: number }).index = 99;
    (camera.camera as { index: number }).index = 99;
    expect(original.towardLightWorld![0]).toBe(0);
    expect(original.color![0]).toBe(1);
    expect(original.groundShadow.displacementWorldPerUnitHeight![0]).toBe(0);
    expect(original.cameras[0]!.towardLightCamera![0]).toBe(0);
    expect(original.cameras[0]!.groundShadowCameraPlanePerUnitHeight![0]).toBe(
      0,
    );
    expect(original.entity.index).toBe(1);
    expect(original.cameras[0]!.camera.index).toBe(2);
    expect(copy.lighting.directionalGeometry[1]!.intensity).toBeNull();
    expect(copy.lighting.directionalGeometry[1]!.color).toBeNull();
    expect(report.warnings).toEqual([]);
  });

  it("invalidates on every consumed light/view edit, including sub-micro changes", () => {
    const assets = new AssetRegistry();
    const baseline = scene();
    const original = lightingHealthInputFingerprint(baseline, assets);
    const changed: RenderSnapshot[] = [];
    for (const index of [8, 9, 10, 12, 15]) {
      const snapshot = scene();
      snapshot.transforms[index] =
        snapshot.transforms[index]! + (index === 8 ? 1e-8 : 0.125);
      changed.push(snapshot);
    }
    for (const index of [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 15]) {
      const snapshot = scene();
      snapshot.viewMatrices[index] =
        snapshot.viewMatrices[index]! + (index === 1 ? 1e-8 : 0.125);
      changed.push(snapshot);
    }
    const light = baseline.lights[0]!;
    for (const patch of [
      { lightId: 8 },
      { entity: { index: 4, generation: 2 } },
      { intensity: 4 + 1e-8 },
      { color: [1, 0.9, 0.8 + 1e-8, 1] as const },
      { worldTransformOffset: -1 },
    ])
      changed.push({ ...baseline, lights: [{ ...light, ...patch }] });
    const view = baseline.views[0]!;
    for (const patch of [
      { viewId: 8 },
      { camera: { index: 4, generation: 2 } },
      { viewMatrixOffset: -1 },
    ])
      changed.push({ ...baseline, views: [{ ...view, ...patch }] });
    changed.push({ ...baseline, views: [] });
    for (const snapshot of changed) {
      expect(lightingHealthInputFingerprint(snapshot, assets)).not.toBe(
        original,
      );
    }
    expect(
      lightingHealthInputFingerprint(
        { ...baseline, frame: 9, time: 8 },
        assets,
      ),
    ).toBe(original);
    // Projection does not affect these basis components or camera-plane units.
    expect(
      lightingHealthInputFingerprint(
        { ...baseline, views: [{ ...view, projectionMatrixOffset: 48 }] },
        assets,
      ),
    ).toBe(original);
    const unrelatedTransforms = new Float32Array(32);
    unrelatedTransforms.set(baseline.transforms);
    unrelatedTransforms[31] = 42;
    expect(
      lightingHealthInputFingerprint(
        { ...baseline, transforms: unrelatedTransforms },
        assets,
      ),
    ).toBe(original);
    const moved = scene();
    moved.transforms.set(identity);
    expect(
      analyze(moved).lighting.directionalGeometry[0]!.towardLightWorld,
    ).toEqual([0, 0, 1]);
    expect(analyze(moved)).not.toEqual(analyze(baseline));
  });
});

function analyze(snapshot: RenderSnapshot) {
  return analyzeLightingHealth({
    snapshot,
    assets: new AssetRegistry(),
    output,
  });
}

function expectVector(
  actual: readonly number[] | null,
  expected: readonly number[],
) {
  expect(actual).not.toBeNull();
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, index) =>
    expect(actual![index]).toBeCloseTo(value, 5),
  );
}

function scene(): RenderSnapshot {
  const view: ViewPacket = {
    viewId: 1,
    camera: { index: 2, generation: 0 },
    priority: 0,
    layerMask: 1,
    viewMatrixOffset: 0,
    projectionMatrixOffset: 0,
    viewProjectionMatrixOffset: 0,
    viewport: [0, 0, 1, 1],
    scissor: [0, 0, 1, 1],
    clearColor: [0, 0, 0, 1],
    clearDepth: 1,
    clearStencil: 0,
    renderTarget: null,
  };
  return {
    frame: 1,
    views: [view],
    meshDraws: [],
    lights: [
      {
        lightId: 1,
        entity: { index: 1, generation: 0 },
        kind: "directional",
        color: [1, 0.9, 0.8, 1],
        intensity: 4,
        range: 0,
        innerConeAngle: 0,
        outerConeAngle: 0,
        worldTransformOffset: 0,
        layerMask: 1,
      },
    ],
    environments: [],
    shadowRequests: [],
    bounds: [],
    diagnostics: [],
    transforms: new Float32Array(sun),
    viewMatrices: new Float32Array(identity),
    report: {
      views: 1,
      meshDraws: 0,
      lights: 1,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}
