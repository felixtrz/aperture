import { describe, expect, it } from "vitest";

import {
  BRDF_LUT_DEFAULT_SAMPLE_COUNT,
  createBrdfLutComputeDispatchSize,
  createBrdfLutComputePipeline,
  createStandardTextureVariantShader,
  integrateEnvironmentBrdf,
  withStandardIblPipelineKeys,
  type StandardTextureShaderFeatures,
} from "@aperture-engine/webgpu/test-support";

const BASE_FEATURES: StandardTextureShaderFeatures = {
  baseColorTexture: false,
  metallicRoughnessTexture: false,
  normalTexture: false,
  occlusionTexture: false,
  emissiveTexture: false,
};

describe("environment-BRDF (DFG) integration", () => {
  it("integrates the split-sum scale/bias corners against known reference points", () => {
    // A perfect mirror (roughness=0) at normal incidence reflects the full
    // prefiltered radiance with no Fresnel edge contribution: scale~1, bias~0.
    const mirror = integrateEnvironmentBrdf(
      1.0,
      0.0,
      BRDF_LUT_DEFAULT_SAMPLE_COUNT,
    );
    expect(mirror.scale).toBeGreaterThan(0.97);
    expect(mirror.scale).toBeLessThanOrEqual(1.0001);
    expect(mirror.bias).toBeLessThan(0.02);

    // At grazing incidence on a mid-rough surface the Fresnel/horizon (F90)
    // term is non-trivial: bias > 0 (edge brightening present).
    const grazing = integrateEnvironmentBrdf(
      0.05,
      0.5,
      BRDF_LUT_DEFAULT_SAMPLE_COUNT,
    );
    expect(grazing.bias).toBeGreaterThan(0.05);

    // The horizon term is strongest at grazing angles: grazing bias dominates
    // the facing bias for the same roughness.
    const facing = integrateEnvironmentBrdf(
      0.95,
      0.5,
      BRDF_LUT_DEFAULT_SAMPLE_COUNT,
    );
    expect(grazing.bias).toBeGreaterThan(facing.bias);

    // Energy is bounded in [0, 1] across the LUT domain.
    for (const ndotv of [0.05, 0.4, 0.95]) {
      for (const roughness of [0.05, 0.5, 0.95]) {
        const { scale, bias } = integrateEnvironmentBrdf(ndotv, roughness, 512);
        expect(scale).toBeGreaterThanOrEqual(0);
        expect(scale).toBeLessThanOrEqual(1.0001);
        expect(bias).toBeGreaterThanOrEqual(0);
        expect(bias).toBeLessThanOrEqual(1.0001);
      }
    }
  });

  it("builds an rg16float compute pipeline whose WGSL integrates the DFG", () => {
    const calls: string[] = [];
    const device = {
      createShaderModule: (descriptor: unknown) => {
        calls.push((descriptor as { code: string }).code);
        return { module: true };
      },
      createBindGroupLayout: () => ({ layout: true }),
      createPipelineLayout: () => ({ pipelineLayout: true }),
      createComputePipeline: () => ({ pipeline: true }),
    };

    const result = createBrdfLutComputePipeline({ device });

    expect(result.valid).toBe(true);
    expect(result.resource?.storageFormat).toBe("rg16float");
    expect(result.diagnostics).toHaveLength(0);

    const code = calls[0] ?? "";
    expect(code).toContain("texture_storage_2d<rg16float, write>");
    expect(code).toContain("fn integrateBrdf(");
    expect(code).toContain("importanceSampleGGX");
    expect(code).toContain("hammersley");
  });

  it("degrades gracefully when the device cannot create compute pipelines", () => {
    const result = createBrdfLutComputePipeline({ device: {} });

    expect(result.valid).toBe(false);
    expect(result.resource).toBeNull();
    expect(result.diagnostics[0]?.code).toBe(
      "brdfLutComputePipeline.createShaderModuleUnavailable",
    );
  });

  it("dispatches one workgroup per 8x8 tile of the square LUT", () => {
    expect(createBrdfLutComputeDispatchSize({ size: 256 })).toEqual({
      x: 32,
      y: 32,
      z: 1,
    });
  });
});

describe("iblSpecularBrdf shader variant", () => {
  it("emits the analytic split-sum DFG term and drops the proof roughness fudge", () => {
    const shader = createStandardTextureVariantShader({
      ...BASE_FEATURES,
      iblDiffuse: true,
      iblSpecularBrdf: true,
    });

    expect(shader.label).toBe(
      "aperture/standard-mesh-diffuse-specular-ibl-brdf",
    );
    // Module-scope analytic environment BRDF helper is injected.
    expect(shader.code).toContain("fn environmentBrdfApprox(");
    // Split-sum specular term: prefiltered * (F0 * scale + bias).
    expect(shader.code).toContain("specularIblBrdf");
    expect(shader.code).toContain(
      "environmentBrdfApprox(roughness, brdfNdotV)",
    );
    // Reuses the specular IBL cube at group(3) binding(7).
    expect(shader.code).toContain(
      "@group(3) @binding(7) var standardSpecularIblTexture: texture_cube<f32>;",
    );
    // The hand-tuned proof fudge must NOT be present in the BRDF variant.
    expect(shader.code).not.toContain("(1.0 - roughness * 0.5)");
  });

  it("keeps the legacy iblSpecularProof variant intact as a fallback", () => {
    const shader = createStandardTextureVariantShader({
      ...BASE_FEATURES,
      iblDiffuse: true,
      iblSpecularProof: true,
    });

    expect(shader.label).toBe(
      "aperture/standard-mesh-diffuse-specular-ibl-proof",
    );
    expect(shader.code).toContain("(1.0 - roughness * 0.5)");
    expect(shader.code).not.toContain("environmentBrdfApprox");
  });

  it("supersedes the proof pipeline key with iblSpecularBrdf when the LUT is ready", () => {
    const snapshot = {
      frame: 0,
      meshDraws: [
        {
          batchKey: { pipelineKey: "standard|metallicRoughnessTexture" },
          sortKey: { pipelineKey: "standard|metallicRoughnessTexture" },
        },
      ],
    } as unknown as Parameters<typeof withStandardIblPipelineKeys>[0];

    const brdf = withStandardIblPipelineKeys(
      snapshot,
      true,
      true,
    ) as unknown as {
      meshDraws: { batchKey: { pipelineKey: string } }[];
    };
    const key = brdf.meshDraws[0]?.batchKey.pipelineKey ?? "";

    expect(key).toContain("iblDiffuse");
    expect(key).toContain("iblSpecularBrdf");
    expect(key).not.toContain("iblSpecularProof");
  });
});
