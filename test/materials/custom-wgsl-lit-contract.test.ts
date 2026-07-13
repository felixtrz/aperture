import { describe, expect, it } from "vitest";

import {
  APERTURE_LIT_BINDING_METADATA,
  APERTURE_LIT_CONTRACT_VERSION,
  APERTURE_LIT_LIGHT_FLOAT_STRIDE,
  APERTURE_LIT_LIGHT_KIND_IDS,
  APERTURE_LIT_LIGHT_METADATA_STRIDE,
  APERTURE_LIT_PIPELINE_FEATURE,
  APERTURE_LIT_WGSL_HEADER,
  createCustomWgslMaterialAsset,
  createMaterialPipelineKeyInput,
  createPreparedCustomWgslMaterial,
  validateCustomMaterialSource,
  wgslSourceDeclaresLitBindGroup,
  type CustomWgslMaterialAsset,
} from "@aperture-engine/render";
import {
  PACKED_LIGHT_FLOAT_STRIDE,
  PACKED_LIGHT_METADATA_STRIDE,
  PackedLightKindId,
} from "@aperture-engine/webgpu/test-support";

// A1 (three.js parity plan): the opt-in `lighting: "lit"` contract for custom
// WGSL materials — validation, prepared-material flow, pipeline-key
// participation (absent/"unlit" => byte-identical keys to the pre-A1
// algorithm), and packing-constant sync with the WebGPU backend.

const SPHERE_WGSL = [
  "struct V { p: vec4f }",
  "@vertex fn vs_main() -> @builtin(position) vec4f { return vec4f(0); }",
  "@fragment fn fs_main() -> @location(0) vec4f { return vec4f(1); }",
  "",
].join("\n");

// Byte-for-byte the key the pre-A1 algorithm produced for this source
// (computed against packages/render/dist BEFORE this change landed): the
// `lit:` segment participates only when lighting is "lit".
const BASELINE_PIPELINE_KEY =
  "example/lit-sphere|shader:4d33afb2|vs:vs_main|fs:fs_main|instance-attributes:none|features:|specialization:5465b825|bindings:|opaque|back|less|none";

function sphereMaterial(
  lighting?: CustomWgslMaterialAsset["lighting"],
  code: string = SPHERE_WGSL,
): CustomWgslMaterialAsset {
  return createCustomWgslMaterialAsset({
    familyKey: "example/lit-sphere",
    label: "Lit Sphere",
    shader: { kind: "inline-wgsl", code },
    entryPoints: { vertex: "vs_main", fragment: "fs_main" },
    ...(lighting === undefined ? {} : { lighting }),
    bindings: [],
  });
}

function prepared(
  lighting?: CustomWgslMaterialAsset["lighting"],
): ReturnType<typeof createPreparedCustomWgslMaterial> {
  return createPreparedCustomWgslMaterial({
    source: sphereMaterial(lighting),
    assetKey: "material:lit-sphere",
    shaderCode: SPHERE_WGSL,
    shaderSourceKey: "inline:material:lit-sphere:source",
  });
}

describe("custom WGSL lit contract (lighting: 'lit')", () => {
  it("accepts lit and unlit lighting modes", () => {
    for (const lighting of [undefined, "unlit", "lit"] as const) {
      const diagnostics = validateCustomMaterialSource(
        sphereMaterial(lighting),
      );

      expect(
        diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
      ).toEqual([]);
    }
  });

  it("rejects an invalid lighting value", () => {
    const diagnostics = validateCustomMaterialSource(
      sphereMaterial("glossy" as CustomWgslMaterialAsset["lighting"]),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "customMaterialSource.invalidLighting",
        severity: "error",
      }),
    );
  });

  it("rejects lit materials whose inline WGSL declares @group(3)", () => {
    const code = `${SPHERE_WGSL}\n@group(3) @binding(0) var<storage, read> mine: array<f32>;\n`;

    expect(wgslSourceDeclaresLitBindGroup(code)).toBe(true);

    const diagnostics = validateCustomMaterialSource(
      sphereMaterial("lit", code),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "customMaterialSource.litReservedBindGroup",
        severity: "error",
      }),
    );
    // The same source stays valid when it does NOT opt into the lit contract
    // (group(3) is reserved but unenforced for unlit materials, as today).
    expect(
      validateCustomMaterialSource(sphereMaterial(undefined, code)).filter(
        (diagnostic) => diagnostic.severity === "error",
      ),
    ).toEqual([]);
  });

  it("keeps the pipeline key byte-identical when lighting is absent or unlit", () => {
    const absent = prepared();

    expect(absent.pipelineKey).toBe(BASELINE_PIPELINE_KEY);
    expect(absent.pipelineKey).not.toContain("lit:");
    expect(absent.lighting).toBeUndefined();
    expect("lighting" in absent).toBe(false);
    expect(absent.shader.code).toBe(SPHERE_WGSL);

    const unlit = prepared("unlit");

    expect(unlit.pipelineKey).toBe(BASELINE_PIPELINE_KEY);
    expect("lighting" in unlit).toBe(false);
    expect(unlit.shader.code).toBe(SPHERE_WGSL);
  });

  it("folds the lit contract version into the pipeline key and prepends the header", () => {
    const lit = prepared("lit");

    expect(lit.lighting).toBe("lit");
    expect(lit.pipelineKey).not.toBe(BASELINE_PIPELINE_KEY);
    expect(lit.pipelineKey.split("|")).toContain(
      `lit:v${APERTURE_LIT_CONTRACT_VERSION}`,
    );
    expect(APERTURE_LIT_PIPELINE_FEATURE).toBe(
      `lit:v${APERTURE_LIT_CONTRACT_VERSION}`,
    );
    // The header participates in the shader hash, so a contract-header change
    // rebuilds lit pipelines; the user source follows it unchanged.
    expect(lit.shader.code.startsWith(APERTURE_LIT_WGSL_HEADER)).toBe(true);
    expect(lit.shader.code.endsWith(SPHERE_WGSL)).toBe(true);
  });

  it("adds the lit feature to the extraction pipeline key input only when lit", () => {
    const unlitInput = createMaterialPipelineKeyInput(sphereMaterial());
    const litInput = createMaterialPipelineKeyInput(sphereMaterial("lit"));

    expect(unlitInput.features).not.toContain(APERTURE_LIT_PIPELINE_FEATURE);
    expect(litInput.features).toContain(APERTURE_LIT_PIPELINE_FEATURE);
  });

  it("keeps the WGSL header constants in sync with the WebGPU light packing", () => {
    expect(APERTURE_LIT_LIGHT_FLOAT_STRIDE).toBe(PACKED_LIGHT_FLOAT_STRIDE);
    expect(APERTURE_LIT_LIGHT_METADATA_STRIDE).toBe(
      PACKED_LIGHT_METADATA_STRIDE,
    );
    expect(APERTURE_LIT_LIGHT_KIND_IDS).toEqual({
      ambient: PackedLightKindId.Ambient,
      directional: PackedLightKindId.Directional,
      point: PackedLightKindId.Point,
      spot: PackedLightKindId.Spot,
      environment: PackedLightKindId.Environment,
      rectArea: PackedLightKindId.RectArea,
    });
    // The header inlines the same numbers.
    expect(APERTURE_LIT_WGSL_HEADER).toContain(
      `const APERTURE_LIT_LIGHT_FLOAT_STRIDE: u32 = ${PACKED_LIGHT_FLOAT_STRIDE}u;`,
    );
    expect(APERTURE_LIT_WGSL_HEADER).toContain(
      `const APERTURE_LIT_LIGHT_METADATA_STRIDE: u32 = ${PACKED_LIGHT_METADATA_STRIDE}u;`,
    );
  });

  it("declares every contract binding exactly once in the header", () => {
    const bindings = APERTURE_LIT_BINDING_METADATA.map(
      (binding) => binding.binding,
    );

    expect(bindings).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

    for (const binding of APERTURE_LIT_BINDING_METADATA) {
      const declarations = APERTURE_LIT_WGSL_HEADER.split(
        `@group(3) @binding(${binding.binding})`,
      );

      expect(declarations).toHaveLength(2);
      expect(declarations[1]).toContain(binding.name);
    }
  });

  it("exposes the documented helper entry points", () => {
    for (const helper of [
      "fn apertureCountLights()",
      "fn apertureEvaluateLight(",
      "fn apertureEvaluateLightSurface(",
      "fn apertureDirectionalShadow(",
      "fn apertureSampleIblIrradiance(",
      "fn apertureSampleIblSpecular(",
      "fn apertureEnvironmentBrdf(",
      "fn apertureApplyFog(",
      "fn apertureLinearToSrgb(",
    ]) {
      expect(APERTURE_LIT_WGSL_HEADER).toContain(helper);
    }
  });
});
