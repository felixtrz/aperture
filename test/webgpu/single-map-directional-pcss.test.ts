import { makeOrthographic } from "@aperture-engine/simulation";
import {
  createStandardTextureVariantShader,
  STANDARD_SHADOW_RECEIVER_MESH_WGSL,
} from "@aperture-engine/webgpu/test-support";
import { describe, expect, it } from "vitest";

const noTextures = {
  baseColorTexture: false,
  metallicRoughnessTexture: false,
  normalTexture: false,
  occlusionTexture: false,
  emissiveTexture: false,
} as const;

function shaderFunction(code: string, name: string): string {
  const start = code.indexOf(`fn ${name}(`);
  expect(start, `function ${name} exists`).toBeGreaterThanOrEqual(0);
  const end = code.indexOf("\n}", start);
  return code.slice(start, end + 2);
}

describe("single-map directional PCSS", () => {
  it.each([false, true])(
    "explicitly dispatches type 2 through blocker search (directional+point=%s)",
    (directionalPointShadowMap) => {
      const code = createStandardTextureVariantShader({
        ...noTextures,
        shadowMap: true,
        ...(directionalPointShadowMap
          ? {
              pointShadowMap: true,
              directionalPointShadowMap: true,
              clusteredLocalLights: true,
              clusteredLocalLightPointArrayShadows: true,
            }
          : {}),
      }).code;
      const dispatch = shaderFunction(
        code,
        "sampleSpotShadowFactorWithMatrixBase",
      );
      expect(dispatch).toContain("if (filterType == 2u)");
      expect(dispatch).toContain(
        "rawVisibility = sampleDirectionalShadowPcss(",
      );
      expect(dispatch).toContain("directionalShadowMatrices[matrixBaseIndex]");
      expect(dispatch).toContain("else if (filterType == 1u)");
      expect(dispatch).toContain(
        "rawVisibility = sampleDirectionalShadowPcfSoft(",
      );
      expect(dispatch).toContain(
        "rawVisibility = sampleDirectionalShadowPcf3x3(",
      );
      const pcss = shaderFunction(code, "sampleDirectionalShadowPcss");
      expect(pcss).toContain("textureLoad(directionalShadowMap, coord, 0)");
      expect(pcss).toContain("if (occluderDepth < receiverDepth)");
      expect(pcss).toContain("if (blockerCount == 0.0) {\n    return 1.0;");
      expect(pcss).toContain("blockerSum / blockerCount");
      expect(pcss).toContain(
        "DIRECTIONAL_PCSS_DISK[sampleIndex] * variableRadius",
      );
      expect(pcss).toContain(
        "sampleDirectionalPcssBilinear(sampleUv, receiverDepth, shadowMapSize)",
      );
      expect(pcss).not.toContain("/ max(averageBlockerDepth");
    },
  );

  it("leaves perspective spot, local arrays, and cascaded algorithms separate", () => {
    for (const extra of [
      { spotShadowMap: true },
      { spotShadowMap: true, clusteredLocalLightArrayShadows: true },
      { clusteredLocalLightArrayShadows: true },
      { cascadedShadowMap: true },
      { pointShadowMap: true },
    ]) {
      const code = createStandardTextureVariantShader({
        ...noTextures,
        shadowMap: true,
        ...extra,
      }).code;
      expect(code).not.toContain("DIRECTIONAL_PCSS_DISK");
      expect(code).not.toContain("sampleDirectionalPcssBilinear");
    }
  });

  it("retains hard center loads, type-1 weighted gather, and the bias floor", () => {
    const code = STANDARD_SHADOW_RECEIVER_MESH_WGSL;
    const pcf = shaderFunction(code, "sampleDirectionalShadowPcf3x3");
    expect(pcf).toContain("if (filterRadius <= 0.0)");
    expect(pcf).toContain(
      "return select(0.0, 1.0, receiverDepth <= sampledDepth)",
    );
    const soft = shaderFunction(code, "sampleDirectionalShadowPcfSoft");
    expect(soft.match(/textureGatherCompare\(/g)).toHaveLength(4);
    expect(soft).not.toContain("filterRadius");
    expect(code).toContain(
      "return max(shadowDepthBias(shadowLightIndex), STANDARD_SHADOW_DEPTH_BIAS)",
    );
    expect(shaderFunction(code, "sampleDirectionalShadowFactor")).toContain(
      "filterType == 0u",
    );
  });

  it("bounds sampling and protects projection degeneracy", () => {
    const code = STANDARD_SHADOW_RECEIVER_MESH_WGSL;
    const pcss = shaderFunction(code, "sampleDirectionalShadowPcss");
    expect(pcss).toContain("depthScale > 0.000001 && depthScale < 1000000.0");
    expect(pcss).toContain(
      "footprintScale > 0.000001 && footprintScale < 1000000.0",
    );
    expect(pcss).toContain(
      "return sampleDirectionalShadowPcf3x3(shadowUv, receiverDepth, 0.0)",
    );
    expect(pcss).toContain("clamp(filterRadiusTexels, 1.0, 16.0)");
    expect(pcss).toContain("sampleIndex <= 32u");
    expect(pcss).toContain("sampleIndex < 32u");
    expect(pcss).toContain("vec2i(0), maxCoord");
    expect(pcss).toContain(
      "let variableRadius = maxRadius * clamp(separation * 12.0, 0.0, 1.0)",
    );
    const disk = code.match(/const DIRECTIONAL_PCSS_DISK:[\s\S]*?\n\);/)?.[0];
    expect(disk).toBeDefined();
    const points = [...disk!.matchAll(/vec2f\(([-\d.]+), ([-\d.]+)\)/g)];
    expect(points).toHaveLength(32);
    for (const point of points) {
      expect(Math.hypot(Number(point[1]), Number(point[2]))).toBeLessThan(1);
    }
  });

  it("ties the emitted orthographic formula to clip-range-invariant contact response", () => {
    const code = shaderFunction(
      STANDARD_SHADOW_RECEIVER_MESH_WGSL,
      "sampleDirectionalShadowPcss",
    );
    expect(code).toContain(
      "max(receiverDepth - averageBlockerDepth, 0.0) * footprintScale / depthScale",
    );
    const response = (
      near: number,
      far: number,
      distance: number,
      gap: number,
    ): number => {
      const matrix = makeOrthographic(-7, 7, -7, 7, near, far);
      const depthScale = Math.hypot(matrix[2]!, matrix[6]!, matrix[10]!);
      const footprintScale =
        0.5 * Math.hypot(matrix[0]!, matrix[4]!, matrix[8]!);
      const receiver = (distance + gap - near) / (far - near);
      const blocker = (distance - near) / (far - near);
      const separation =
        (Math.max(receiver - blocker, 0) * footprintScale) / depthScale;
      return 6 * Math.min(1, Math.max(0, separation * 12));
    };
    for (const gap of [0, 0.02, 0.2, 0.8, 2]) {
      const original = response(0.1, 45, 20, gap);
      expect(response(5, 100, 30, gap)).toBeCloseTo(original, 5);
      expect(response(0.01, 1000, 100, gap)).toBeCloseTo(original, 5);
    }
    expect(response(0.1, 45, 20, 0)).toBe(0);
    expect(response(0.1, 45, 20, 0.2)).toBeGreaterThan(
      response(0.1, 45, 20, 0.02),
    );
    expect(response(0.1, 45, 20, 0.8)).toBeGreaterThan(
      response(0.1, 45, 20, 0.2),
    );
    expect(response(0.1, 45, 20, 2)).toBe(6);
  });
});
