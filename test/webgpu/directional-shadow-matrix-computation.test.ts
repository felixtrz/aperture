import { makePerspective } from "@aperture-engine/simulation";
import { describe, expect, it } from "vitest";

import {
  createDirectionalShadowMatrixComputationReport,
  createDirectionalShadowViewProjectionPlanReport,
  createShadowMapDescriptorReport,
  createShadowPassPlanReport,
  createShadowTextureResourceReport,
  directionalShadowMatrixComputationReportToJson,
  directionalShadowMatrixComputationReportToJsonValue,
  type LightPacket,
  type ShadowRequestPacket,
} from "@aperture-engine/webgpu/test-support";

describe("directional shadow matrix computation", () => {
  it("computes JSON-safe view/projection matrices from extracted light transforms", () => {
    const report = createDirectionalShadowMatrixComputationReport({
      viewProjection: viewProjection(),
      transforms: identityTransform(),
      center: [0, 0, 0],
      orthographicSize: 10,
      near: 1,
      far: 51,
      lightDistance: 25,
    });
    const json = directionalShadowMatrixComputationReportToJsonValue(report);

    expect(json.ready).toBe(true);
    expect(json.status).toBe("ready");
    expect(json.planCount).toBe(1);
    expect(json.matrixCount).toBe(1);
    expect(json.sections).toEqual({
      viewProjectionPlanning: true,
      transformData: true,
      matrixComputation: true,
      gpuBufferAllocation: false,
      upload: false,
      passSubmission: false,
    });
    expect(json.matrices).toHaveLength(1);
    expect(json.matrices[0]).toMatchObject({
      shadowId: 7,
      lightId: 11,
      planKey: "directional-shadow-view-projection:7:light:11",
      passKey: "shadow-pass:7:light:11",
      matrixKey: "shadow-pass:7:light:11:view-projection",
      lightTransformOffset: 0,
      cascadeIndex: 0,
      cascadeCount: 1,
      cascadeNear: 0,
      cascadeFar: 1,
      center: [0, 0, 0],
      lightDirection: [0, 0, -1],
      lightPosition: [0, 0, 25],
      orthographicSize: 10,
      near: 1,
      far: 51,
    });
    expect(json.matrices[0]?.viewMatrix).toHaveLength(16);
    expect(json.matrices[0]?.projectionMatrix).toHaveLength(16);
    expect(json.matrices[0]?.viewProjectionMatrix).toHaveLength(16);
    expect(json.matrices[0]?.viewProjectionMatrix.every(Number.isFinite)).toBe(
      true,
    );
    expect(json.diagnostics).toEqual([]);
    expect(
      JSON.parse(directionalShadowMatrixComputationReportToJson(report)),
    ).toEqual(json);
    expect(JSON.stringify(json)).not.toMatch(/GPUBuffer|GPUTexture|raw/);
  });

  it("computes one JSON-safe matrix per planned directional cascade", () => {
    const request = { ...shadowRequest(), cascadeCount: 3 };
    const report = createDirectionalShadowMatrixComputationReport({
      viewProjection: viewProjection(request),
      transforms: identityTransform(),
      orthographicSize: 30,
    });
    const json = directionalShadowMatrixComputationReportToJsonValue(report);

    expect(json.ready).toBe(true);
    expect(json.matrixCount).toBe(3);
    expect(json.matrices.map((matrix) => matrix.cascadeIndex)).toEqual([
      0, 1, 2,
    ]);
    expect(json.matrices.map((matrix) => matrix.orthographicSize)).toEqual([
      10, 20, 30,
    ]);
  });

  it("uses an authored fixed directional camera instead of frustum fitting or cascade scaling", () => {
    const request = {
      ...shadowRequest(),
      cascadeCount: 3,
      center: [1, 2, 3] as const,
      orthographicSize: 16,
      near: 0.5,
      far: 60,
      lightDistance: 20,
    };
    const report = createDirectionalShadowMatrixComputationReport({
      viewProjection: frustumFitPlan(request),
      transforms: identityTransform(),
      cameraViewMatrix: translationView(10, 0, 0),
      cameraProjectionMatrix: makePerspective(1.0, 1, 1, 200),
    });

    expect(report.matrixCount).toBe(3);
    expect(report.matrices.map((matrix) => matrix.center)).toEqual([
      [1, 2, 3],
      [1, 2, 3],
      [1, 2, 3],
    ]);
    expect(report.matrices.map((matrix) => matrix.orthographicSize)).toEqual([
      16, 16, 16,
    ]);
    expect(report.matrices.map((matrix) => matrix.near)).toEqual([
      0.5, 0.5, 0.5,
    ]);
    expect(report.matrices.map((matrix) => matrix.far)).toEqual([60, 60, 60]);
    expect(report.matrices.map((matrix) => matrix.lightPosition)).toEqual([
      [1, 2, 23],
      [1, 2, 23],
      [1, 2, 23],
    ]);
  });

  it("frustum-fits a texel-stable extent: identical ortho size and texel-snapped center under camera translation", () => {
    const request = { ...shadowRequest(), cascadeCount: 4 };
    const projection = makePerspective(1.0, 1, 1, 200);
    // Two cameras that differ by a pure X translation (same orientation).
    const cameraA = translationView(0, 0, 0);
    const cameraB = translationView(5.0, 0, 0);

    const reportA = createDirectionalShadowMatrixComputationReport({
      viewProjection: frustumFitPlan(request),
      transforms: directionalDownTransform(),
      cameraViewMatrix: cameraA,
      cameraProjectionMatrix: projection,
    });
    const reportB = createDirectionalShadowMatrixComputationReport({
      viewProjection: frustumFitPlan(request),
      transforms: directionalDownTransform(),
      cameraViewMatrix: cameraB,
      cameraProjectionMatrix: projection,
    });

    expect(reportA.matrixCount).toBe(4);
    expect(reportB.matrixCount).toBe(4);

    const mapSize = 1024;
    for (let cascade = 0; cascade < 4; cascade += 1) {
      const sizeA = reportA.matrices[cascade]!.orthographicSize;
      const sizeB = reportB.matrices[cascade]!.orthographicSize;

      // Extent depends only on the frustum SHAPE, not camera position.
      expect(sizeB).toBe(sizeA);

      // Light points straight down, so the in-plane center maps to world X/Z;
      // both centers must sit on the texel grid (snapped), and their delta is
      // an integer multiple of texelSize = diameter / mapSize.
      const texel = sizeA / mapSize;
      const centerXA = reportA.matrices[cascade]!.center[0];
      const centerXB = reportB.matrices[cascade]!.center[0];
      expect(fractional(centerXA / texel)).toBeLessThan(1e-3);
      expect(fractional(centerXB / texel)).toBeLessThan(1e-3);
      expect(fractional((centerXB - centerXA) / texel)).toBeLessThan(1e-3);
    }

    // The camera moved, so at least one cascade center actually shifted.
    const moved = reportA.matrices.some(
      (matrix, index) =>
        Math.abs(matrix.center[0] - reportB.matrices[index]!.center[0]) > 1e-4,
    );
    expect(moved).toBe(true);
  });

  it("frustum-fits a tighter near cascade than far cascade for a perspective camera", () => {
    const request = { ...shadowRequest(), cascadeCount: 4 };
    const report = createDirectionalShadowMatrixComputationReport({
      viewProjection: frustumFitPlan(request),
      transforms: directionalDownTransform(),
      cameraViewMatrix: translationView(0, 0, 0),
      cameraProjectionMatrix: makePerspective(1.0, 1, 1, 200),
    });

    const sizes = report.matrices.map((matrix) => matrix.orthographicSize);
    expect(sizes).toHaveLength(4);
    // Strictly increasing: each nearer cascade is a tighter fit.
    expect(sizes[0]).toBeLessThan(sizes[1]!);
    expect(sizes[1]).toBeLessThan(sizes[2]!);
    expect(sizes[2]).toBeLessThan(sizes[3]!);
  });

  it("expands frustum-fit depth to include in-plane caster bounds", () => {
    const request = { ...shadowRequest(), cascadeCount: 1 };
    const baseInput = {
      viewProjection: frustumFitPlan(request),
      transforms: directionalDownTransform(),
      cameraViewMatrix: translationView(0, 0, 0),
      cameraProjectionMatrix: makePerspective(1.0, 1, 1, 200),
    } as const;

    const withoutCasterBounds =
      createDirectionalShadowMatrixComputationReport(baseInput);
    const withCasterBounds = createDirectionalShadowMatrixComputationReport({
      ...baseInput,
      casterBounds: [
        {
          passKey: "shadow-pass:7:light:11",
          bounds: [{ min: [-1, 500, -20], max: [1, 510, -10] }],
        },
      ],
    });

    expect(withCasterBounds.matrices[0]?.orthographicSize).toBe(
      withoutCasterBounds.matrices[0]?.orthographicSize,
    );
    expect(withCasterBounds.matrices[0]?.far).toBeGreaterThan(
      withoutCasterBounds.matrices[0]!.far,
    );
    expect(withCasterBounds.matrices[0]?.lightPosition[1]).toBeGreaterThan(
      withoutCasterBounds.matrices[0]!.lightPosition[1],
    );
  });

  it("honors explicit static fallback bounds when frustum fitting is disabled", () => {
    const request = { ...shadowRequest(), cascadeCount: 1 };
    const report = createDirectionalShadowMatrixComputationReport({
      viewProjection: frustumFitPlan(request),
      transforms: directionalDownTransform(),
      cameraViewMatrix: translationView(80, 40, 120),
      cameraProjectionMatrix: makePerspective(1.0, 1, 1, 200),
      center: [9, 1, 0],
      orthographicSize: 4,
      near: 0.2,
      far: 12,
      lightDistance: 8,
      frustumFit: false,
    });

    expect(report.matrixCount).toBe(1);
    expect(report.matrices[0]).toMatchObject({
      center: [9, 1, 0],
      orthographicSize: 4,
      near: 0.2,
      far: 12,
      lightPosition: [9, 9, 0],
    });
  });

  it("falls back to the static-center behavior byte-identically when no camera frustum is supplied", () => {
    const request = { ...shadowRequest(), cascadeCount: 3 };
    const baseInput = {
      viewProjection: viewProjection(request),
      transforms: identityTransform(),
      orthographicSize: 30,
    } as const;

    const withoutCamera =
      createDirectionalShadowMatrixComputationReport(baseInput);
    // Passing explicit-undefined camera fields must be identical to omitting.
    const withUndefinedCamera = createDirectionalShadowMatrixComputationReport({
      ...baseInput,
      cameraViewMatrix: undefined,
      cameraProjectionMatrix: undefined,
    });

    expect(
      directionalShadowMatrixComputationReportToJsonValue(withUndefinedCamera),
    ).toEqual(
      directionalShadowMatrixComputationReportToJsonValue(withoutCamera),
    );
    // Old global-scaled behavior preserved: size = orthographicSize * cascadeFar.
    expect(
      withoutCamera.matrices.map((matrix) => matrix.orthographicSize),
    ).toEqual([10, 20, 30]);
  });

  it("reports missing light transform data", () => {
    const report = createDirectionalShadowMatrixComputationReport({
      viewProjection: viewProjection(),
      transforms: new Float32Array(0),
    });
    const json = directionalShadowMatrixComputationReportToJsonValue(report);

    expect(json).toMatchObject({
      ready: false,
      status: "missing",
      planCount: 1,
      matrixCount: 0,
      sections: {
        viewProjectionPlanning: true,
        transformData: false,
        matrixComputation: false,
      },
      diagnostics: [
        {
          code: "directionalShadowMatrix.missingLightTransform",
          severity: "warning",
          shadowId: 7,
          lightId: 11,
        },
      ],
    });
  });
});

function viewProjection(request: ShadowRequestPacket = shadowRequest()) {
  return createDirectionalShadowViewProjectionPlanReport({
    shadowRequests: [request],
    lights: [light()],
    shadowPassPlan: createShadowPassPlanReport({
      shadowRequests: [request],
      textures: createShadowTextureResourceReport({
        descriptors: createShadowMapDescriptorReport({
          shadowRequests: [request],
          descriptors: [
            {
              shadowId: 7,
              lightId: 11,
              mapSize: 1024,
              depthBias: 0.001,
            },
          ],
        }),
      }),
    }),
  });
}

// A view/projection plan carrying real absolute cascade distances (M4-T2) for a
// 100-unit shadow range, so the frustum-fit path has slices to fit.
function frustumFitPlan(request: ShadowRequestPacket) {
  return createDirectionalShadowViewProjectionPlanReport({
    shadowRequests: [request],
    lights: [light()],
    shadowPassPlan: createShadowPassPlanReport({
      shadowRequests: [request],
      textures: createShadowTextureResourceReport({
        descriptors: createShadowMapDescriptorReport({
          shadowRequests: [request],
          descriptors: [
            { shadowId: 7, lightId: 11, mapSize: 1024, depthBias: 0.001 },
          ],
        }),
      }),
    }),
    shadowMaxDistance: 100,
  });
}

// World->view for a camera at (x,y,z) with identity orientation (looks down -Z).
function translationView(x: number, y: number, z: number): Float32Array {
  // prettier-ignore
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    -x, -y, -z, 1,
  ]);
}

// Light world transform whose -Z column points straight down (direction [0,-1,0]).
function directionalDownTransform(): Float32Array {
  // Column 2 (basis Z) = [0,1,0] so direction = -Z column = [0,-1,0].
  // prettier-ignore
  return new Float32Array([
    1, 0, 0, 0,
    0, 0, 1, 0,
    0, 1, 0, 0,
    0, 0, 0, 1,
  ]);
}

function fractional(value: number): number {
  return Math.abs(value - Math.round(value));
}

function shadowRequest(): ShadowRequestPacket {
  return {
    shadowId: 7,
    lightId: 11,
    casterLayerMask: 1,
    receiverLayerMask: 2,
  };
}

function light(): LightPacket {
  return {
    lightId: 11,
    entity: { index: 1, generation: 0 },
    kind: "directional",
    color: [1, 1, 1, 1],
    intensity: 1,
    range: 0,
    innerConeAngle: 0,
    outerConeAngle: 0,
    worldTransformOffset: 0,
    layerMask: 1,
  };
}

function identityTransform(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
