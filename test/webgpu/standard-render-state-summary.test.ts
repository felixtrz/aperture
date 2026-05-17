import { describe, expect, it } from "vitest";

import {
  createStandardMaterialAsset,
  createStandardMaterialRenderStateSummary,
} from "@aperture-engine/webgpu";

describe("StandardMaterial render-state summary", () => {
  it("summarizes opaque render-state and pipeline tokens without diagnostics", () => {
    const summary = createStandardMaterialRenderStateSummary({
      materialKey: "material:opaque",
      material: createStandardMaterialAsset(),
      pipelineKey: "standard|opaque|back|less|none",
      renderPhase: "opaque",
      depthFormat: "depth24plus",
    });

    expect(summary).toMatchObject({
      materialKey: "material:opaque",
      materialKind: "standard",
      renderPhase: "opaque",
      source: {
        alphaMode: "opaque",
        alphaCutoff: 0.5,
        cullMode: "back",
        depth: { test: true, write: true, compare: "less" },
        blendPreset: "none",
      },
      flags: {
        alphaMask: false,
        alphaBlend: false,
        doubleSided: false,
      },
      pipeline: {
        pipelineKey: "standard|opaque|back|less|none",
        tokens: {
          alphaMode: "opaque",
          cullMode: "back",
          depthCompare: "less",
          blendPreset: "none",
        },
        resolved: {
          alphaMode: "opaque",
          cullMode: "back",
          depthCompare: "less",
          depthWriteEnabled: true,
          blendPreset: "none",
          blendEnabled: false,
        },
      },
      diagnostics: [],
    });
    expect(JSON.stringify(summary)).not.toContain("[object Object]");
  });

  it("summarizes mask alpha cutoff and double-sided culling", () => {
    const summary = createStandardMaterialRenderStateSummary({
      material: createStandardMaterialAsset({
        renderState: {
          alphaMode: "mask",
          alphaCutoff: 0.35,
          cullMode: "none",
        },
      }),
      pipelineKey: "standard|mask|none|less|none",
      renderPhase: "alpha-test",
      depthFormat: "depth24plus",
    });

    expect(summary.source).toMatchObject({
      alphaMode: "mask",
      alphaCutoff: 0.35,
      cullMode: "none",
      blendPreset: "none",
    });
    expect(summary.flags).toEqual({
      alphaMask: true,
      alphaBlend: false,
      doubleSided: true,
    });
    expect(summary.pipeline.resolved).toMatchObject({
      cullMode: "none",
      depthWriteEnabled: true,
      blendEnabled: false,
    });
    expect(summary.diagnostics).toEqual([]);
  });

  it("summarizes correctly authored alpha-blend render state", () => {
    const summary = createStandardMaterialRenderStateSummary({
      material: createStandardMaterialAsset({
        renderState: {
          alphaMode: "blend",
          cullMode: "none",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "alpha" },
        },
      }),
      pipelineKey: "standard|blend|none|less|alpha",
      renderPhase: "transparent",
      depthFormat: "depth24plus",
    });

    expect(summary.flags).toEqual({
      alphaMask: false,
      alphaBlend: true,
      doubleSided: true,
    });
    expect(summary.pipeline.resolved).toMatchObject({
      alphaMode: "blend",
      cullMode: "none",
      depthWriteEnabled: false,
      blendPreset: "alpha",
      blendEnabled: true,
    });
    expect(summary.diagnostics).toEqual([]);
  });

  it("reports invalid alpha and blend authoring diagnostics", () => {
    const summary = createStandardMaterialRenderStateSummary({
      material: createStandardMaterialAsset({
        renderState: {
          alphaMode: "blend",
          alphaCutoff: 1.5,
          depth: { test: true, write: true, compare: "less" },
          blend: { preset: "none" },
        },
      }),
      pipelineKey: "standard|blend|back|less|none",
      renderPhase: "transparent",
      depthFormat: "depth24plus",
    });

    expect(
      summary.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        sourceCode: diagnostic.sourceCode,
        field: diagnostic.field,
      })),
    ).toEqual([
      {
        code: "standardMaterialRenderState.validation",
        sourceCode: "material.invalidAlphaCutoff",
        field: "renderState.alphaCutoff",
      },
      {
        code: "standardMaterialRenderState.validation",
        sourceCode: "material.incompatibleRenderState",
        field: "renderState.depth.write",
      },
      {
        code: "standardMaterialRenderState.validation",
        sourceCode: "material.incompatibleRenderState",
        field: "renderState.blend",
      },
      {
        code: "standardMaterialRenderState.depthWriteMismatch",
        sourceCode: undefined,
        field: "renderState.depth.write",
      },
    ]);
  });

  it("reports source and pipeline-token drift", () => {
    const summary = createStandardMaterialRenderStateSummary({
      material: createStandardMaterialAsset({
        renderState: {
          alphaMode: "mask",
          cullMode: "none",
        },
      }),
      pipelineKey: "standard|opaque|back|less|alpha",
      renderPhase: "opaque",
      depthFormat: "depth24plus",
    });

    expect(summary.diagnostics).toMatchObject([
      {
        code: "standardMaterialRenderState.alphaModeMismatch",
        field: "pipelineKey.alphaMode",
        sourceValue: "mask",
        derivedValue: "opaque",
      },
      {
        code: "standardMaterialRenderState.cullModeMismatch",
        field: "pipelineKey.cullMode",
        sourceValue: "none",
        derivedValue: "back",
      },
      {
        code: "standardMaterialRenderState.blendPresetMismatch",
        field: "pipelineKey.blendPreset",
        sourceValue: "none",
        derivedValue: "alpha",
      },
      {
        code: "standardMaterialRenderState.renderPhaseMismatch",
        field: "renderPhase",
        sourceValue: "mask",
        derivedValue: "opaque",
      },
    ]);
    expect(() => JSON.stringify(summary)).not.toThrow();
  });
});
