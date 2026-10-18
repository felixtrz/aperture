import { describe, expect, it } from "vitest";
import { resolvePlanarReflectionOptions } from "@aperture-engine/render";
import { createEmptyRenderSnapshot } from "../../packages/webgpu/src/app/snapshot.js";
import {
  composeTrsMatrix,
  invertMat4,
  makeOrthographic,
  makePerspective,
  multiplyMat4,
} from "@aperture-engine/simulation";
import { createPlanarReflectionView } from "../../packages/webgpu/src/app/planar-reflection-view.js";
import { renderBundleTargetFromRenderDefaults } from "@aperture-engine/cli";

function clip(matrix: ArrayLike<number>, p: number[]): number[] {
  return [0, 1, 2, 3].map((row) =>
    [0, 1, 2, 3].reduce(
      (sum, col) => sum + matrix[col * 4 + row]! * p[col]!,
      0,
    ),
  );
}
describe("planar reflection camera and portable options", () => {
  for (const projection of [
    makeOrthographic(-4, 4, -3, 3, 0.1, 100),
    makePerspective(1, 4 / 3, 0.1, 100),
  ]) {
    it(`clips below the plane and preserves its projective correspondence (${projection[15] === 1 ? "orthographic" : "perspective"})`, () => {
      const camera = invertMat4(
        composeTrsMatrix([0, 4, 7], [-0.258819, 0, 0, 0.965926]),
      )!;
      const matrices = new Float32Array(48);
      matrices.set(camera);
      matrices.set(projection, 16);
      matrices.set(multiplyMat4(projection, camera), 32);
      const source = {
        ...createEmptyRenderSnapshot(0),
        views: [
          {
            viewId: 0,
            camera: { index: 0, generation: 0 },
            priority: 0,
            layerMask: 1,
            viewMatrixOffset: 0,
            projectionMatrixOffset: 16,
            viewProjectionMatrixOffset: 32,
            viewport: [0, 0, 1, 1] as const,
            scissor: [0, 0, 1, 1] as const,
            clearColor: [0, 0, 0, 1] as const,
            clearDepth: 1,
            clearStencil: 0,
            renderTarget: null,
          },
        ],
        viewMatrices: matrices,
      };
      const saved = matrices.slice();
      const result = createPlanarReflectionView(source, 0, 0.01);
      const above = clip(result.reflectionViewProjection, [0, 1, 0, 1]);
      const below = clip(result.reflectionViewProjection, [0, -1, 0, 1]);
      expect(above[2]).toBeGreaterThan(0);
      expect(below[2]).toBeLessThan(0);
      const p = [1, 0, 1, 1];
      const main = clip(matrices.subarray(32), p),
        reflection = clip(result.reflectionViewProjection, p);
      expect(reflection[0]! / reflection[3]!).toBeCloseTo(
        -main[0]! / main[3]!,
        5,
      );
      expect(reflection[1]! / reflection[3]!).toBeCloseTo(
        main[1]! / main[3]!,
        5,
      );
      expect(source.viewMatrices).toEqual(saved);
      expect(result.snapshot.viewMatrices).not.toBe(source.viewMatrices);
    });
  }
  it("validates untrusted settings and preserves them in CPU bundle extraction", () => {
    expect(() => resolvePlanarReflectionOptions({ strength: NaN })).toThrow(
      "strength",
    );
    expect(() =>
      resolvePlanarReflectionOptions({ resolutionScale: 0 }),
    ).toThrow("resolutionScale");
    for (const tint of [
      [1, 0],
      [1, NaN, 0],
      [1, -1, 0],
      [1, 2, 0],
      [1, undefined, 0],
    ])
      expect(() =>
        resolvePlanarReflectionOptions({
          tint: tint as [number, number, number],
        }),
      ).toThrow("tint");
    const tint: [number, number, number] = [0.2, 0.7, 0.8];
    const resolved = resolvePlanarReflectionOptions({ tint });
    tint[0] = 1;
    expect(resolved.tint).toEqual([0.2, 0.7, 0.8]);
    expect(resolved.distortionFrequency).toBe(1);
    for (const distortionFrequency of [0, -1, NaN, Infinity, 33, null, "6"])
      expect(() =>
        resolvePlanarReflectionOptions({
          distortionFrequency: distortionFrequency as number,
        }),
      ).toThrow("distortionFrequency");
    expect(
      renderBundleTargetFromRenderDefaults({
        tonemap: "none",
        planarReflection: {
          height: 2,
          tint: [0.2, 0.7, 0.8],
          distortionFrequency: 6,
        },
      }),
    ).toMatchObject({
      exposure: 1,
      planarReflection: {
        height: 2,
        strength: 0.25,
        tint: [0.2, 0.7, 0.8],
        distortionFrequency: 6,
      },
    });
    expect(() =>
      createPlanarReflectionView(createEmptyRenderSnapshot(0), 0, 0.01),
    ).toThrow("one camera");
  });
});
