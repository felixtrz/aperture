import { describe, expect, it } from "vitest";

import {
  APERTURE_LIT_PIPELINE_FEATURE,
  APERTURE_LIT_WGSL_HEADER,
  APERTURE_SKINNED_BIND_GROUP,
  APERTURE_SKINNED_BINDING,
  APERTURE_SKINNED_CONTRACT_VERSION,
  APERTURE_SKINNED_JOINTS_LOCATION,
  APERTURE_SKINNED_PIPELINE_FEATURE,
  APERTURE_SKINNED_WEIGHTS_LOCATION,
  APERTURE_SKINNED_WGSL_HEADER,
  createCustomWgslMaterialAsset,
  createMaterialPipelineKeyInput,
  createPreparedCustomWgslMaterial,
  validateCustomMaterialSource,
  wgslSourceDeclaresSkinnedBindGroup,
  wgslSourceDeclaresSkinnedReservedSymbol,
  type CustomWgslMaterialAsset,
} from "@aperture-engine/render";
import {
  STANDARD_SKINNING_JOINTS_LOCATION,
  STANDARD_SKINNING_WEIGHTS_LOCATION,
} from "@aperture-engine/webgpu/test-support";

// F3 (three.js parity plan): the opt-in `skinned: true` contract for custom
// WGSL materials — validation, prepared-material flow (header prepend +
// pipeline-key participation, absent => byte-identical keys to the pre-F3
// algorithm), skinned+lit composition, and location-constant sync with the
// WebGPU standard skinned vertex layout.

const SKIN_WGSL = [
  "struct V { p: vec4f }",
  "@vertex fn vs_main() -> @builtin(position) vec4f {",
  "  let s = apertureSkin(vec3f(0.0), vec3f(0.0, 1.0, 0.0), vec4u(0u), vec4f(1.0, 0.0, 0.0, 0.0));",
  "  return vec4f(s.position, 1.0);",
  "}",
  "@fragment fn fs_main() -> @location(0) vec4f { return vec4f(1); }",
  "",
].join("\n");

// Byte-for-byte the key the pre-F3 algorithm produced for this source (the
// `skinned:` segment participates only when `skinned: true`).
const BASELINE_PIPELINE_KEY =
  "example/skinned-strip|shader:70fb7563|vs:vs_main|fs:fs_main|instance-attributes:none|features:|specialization:5465b825|bindings:|opaque|back|less|none";

function skinMaterial(
  overrides: {
    readonly skinned?: boolean;
    readonly lighting?: CustomWgslMaterialAsset["lighting"];
    readonly code?: string;
  } = {},
): CustomWgslMaterialAsset {
  return createCustomWgslMaterialAsset({
    familyKey: "example/skinned-strip",
    label: "Skinned Strip",
    shader: { kind: "inline-wgsl", code: overrides.code ?? SKIN_WGSL },
    entryPoints: { vertex: "vs_main", fragment: "fs_main" },
    ...(overrides.skinned === undefined ? {} : { skinned: overrides.skinned }),
    ...(overrides.lighting === undefined
      ? {}
      : { lighting: overrides.lighting }),
    bindings: [],
  });
}

function prepared(overrides: {
  readonly skinned?: boolean;
  readonly lighting?: CustomWgslMaterialAsset["lighting"];
  readonly code?: string;
}): ReturnType<typeof createPreparedCustomWgslMaterial> {
  const code = overrides.code ?? SKIN_WGSL;

  return createPreparedCustomWgslMaterial({
    source: skinMaterial(overrides),
    assetKey: "material:skinned-strip",
    shaderCode: code,
    shaderSourceKey: "inline:material:skinned-strip:source",
  });
}

describe("custom WGSL skinning contract (skinned: true)", () => {
  it("accepts skinned true/false/absent", () => {
    for (const skinned of [undefined, false, true] as const) {
      const diagnostics = validateCustomMaterialSource(
        skinMaterial(skinned === undefined ? {} : { skinned }),
      );

      expect(
        diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
      ).toEqual([]);
    }
  });

  it("rejects a non-boolean skinned value", () => {
    const diagnostics = validateCustomMaterialSource(
      skinMaterial({
        skinned: "yes" as unknown as boolean,
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "customMaterialSource.invalidSkinned",
        severity: "error",
      }),
    );
  });

  it("rejects a skinned material that declares the reserved @group(1) @binding(1)", () => {
    const code = `${SKIN_WGSL}\n@group(1) @binding(1) var<storage, read> mine: array<f32>;\n`;

    expect(wgslSourceDeclaresSkinnedBindGroup(code)).toBe(true);
    // The user's own @group(1) @binding(0) world transforms are NOT flagged.
    expect(
      wgslSourceDeclaresSkinnedBindGroup(
        "@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;",
      ),
    ).toBe(false);

    const diagnostics = validateCustomMaterialSource(
      skinMaterial({ skinned: true, code }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "customMaterialSource.skinnedReservedBindGroup",
        severity: "error",
      }),
    );
    // A non-skinned material with the same source stays valid (the binding is
    // reserved but unenforced when the material does not opt into skinning).
    expect(
      validateCustomMaterialSource(
        skinMaterial({ skinned: false, code }),
      ).filter((diagnostic) => diagnostic.severity === "error"),
    ).toEqual([]);
  });

  it("rejects a skinned material that redeclares a reserved skinning symbol", () => {
    const code = `${SKIN_WGSL}\nfn apertureSkinMatrix(a: vec4u, b: vec4f) -> mat4x4f { return mat4x4f(); }\n`;

    expect(wgslSourceDeclaresSkinnedReservedSymbol(code)).toBe(
      "apertureSkinMatrix",
    );
    // A CALL of the helper is not a redeclaration.
    expect(wgslSourceDeclaresSkinnedReservedSymbol(SKIN_WGSL)).toBeNull();

    const diagnostics = validateCustomMaterialSource(
      skinMaterial({ skinned: true, code }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "customMaterialSource.skinnedReservedSymbol",
        severity: "error",
      }),
    );
  });

  it("keeps the pipeline key byte-identical when skinned is absent or false", () => {
    const absent = prepared({});

    expect(absent.pipelineKey).toBe(BASELINE_PIPELINE_KEY);
    expect(absent.pipelineKey).not.toContain("skinned:");
    expect(absent.skinned).toBeUndefined();
    expect("skinned" in absent).toBe(false);
    expect(absent.shader.code).toBe(SKIN_WGSL);

    const notSkinned = prepared({ skinned: false });

    expect(notSkinned.pipelineKey).toBe(BASELINE_PIPELINE_KEY);
    expect("skinned" in notSkinned).toBe(false);
    expect(notSkinned.shader.code).toBe(SKIN_WGSL);
  });

  it("folds the skinning contract version into the pipeline key and prepends the header", () => {
    const skinned = prepared({ skinned: true });

    expect(skinned.skinned).toBe(true);
    expect(skinned.pipelineKey).not.toBe(BASELINE_PIPELINE_KEY);
    expect(skinned.pipelineKey.split("|")).toContain(
      `skinned:v${APERTURE_SKINNED_CONTRACT_VERSION}`,
    );
    expect(APERTURE_SKINNED_PIPELINE_FEATURE).toBe(
      `skinned:v${APERTURE_SKINNED_CONTRACT_VERSION}`,
    );
    // The header participates in the shader hash, so a contract-header change
    // rebuilds skinned pipelines; the user source follows it unchanged.
    expect(skinned.shader.code.startsWith(APERTURE_SKINNED_WGSL_HEADER)).toBe(
      true,
    );
    expect(skinned.shader.code.endsWith(SKIN_WGSL)).toBe(true);
  });

  it("adds the skinned feature to the extraction pipeline key input only when skinned", () => {
    const plain = createMaterialPipelineKeyInput(skinMaterial({}));
    const skinnedInput = createMaterialPipelineKeyInput(
      skinMaterial({ skinned: true }),
    );

    expect(plain.features).not.toContain(APERTURE_SKINNED_PIPELINE_FEATURE);
    expect(skinnedInput.features).toContain(APERTURE_SKINNED_PIPELINE_FEATURE);
  });

  it("composes skinned + lit: both headers prepended, both feature tokens present, no group collision", () => {
    const litSkinned = prepared({ skinned: true, lighting: "lit" });

    expect(litSkinned.skinned).toBe(true);
    expect(litSkinned.lighting).toBe("lit");
    // Both contract headers are prepended (skinning first, then lighting).
    expect(litSkinned.shader.code).toContain(APERTURE_SKINNED_WGSL_HEADER);
    expect(litSkinned.shader.code).toContain(APERTURE_LIT_WGSL_HEADER);
    // Both feature tokens participate in the pipeline key.
    const segments = litSkinned.pipelineKey.split("|");
    expect(segments).toContain(APERTURE_SKINNED_PIPELINE_FEATURE);
    expect(segments).toContain(APERTURE_LIT_PIPELINE_FEATURE);
    // No collision: the skin palette rides @group(1) @binding(1) (inside the
    // transforms group), while the lit contract owns @group(3).
    expect(APERTURE_SKINNED_BIND_GROUP).toBe(1);
    expect(APERTURE_SKINNED_BINDING).toBe(1);
    expect(APERTURE_LIT_PIPELINE_FEATURE).not.toBe(
      APERTURE_SKINNED_PIPELINE_FEATURE,
    );
  });

  it("keeps the reserved vertex-attribute locations in sync with the standard skinned layout", () => {
    expect(APERTURE_SKINNED_JOINTS_LOCATION).toBe(
      STANDARD_SKINNING_JOINTS_LOCATION,
    );
    expect(APERTURE_SKINNED_WEIGHTS_LOCATION).toBe(
      STANDARD_SKINNING_WEIGHTS_LOCATION,
    );
    expect(APERTURE_SKINNED_JOINTS_LOCATION).toBe(8);
    expect(APERTURE_SKINNED_WEIGHTS_LOCATION).toBe(9);
  });

  it("exposes the documented skinning helper entry points in the header", () => {
    for (const helper of [
      "@group(1) @binding(1) var<storage, read> apertureSkinJointMatrices",
      "fn apertureSkinMatrix(",
      "fn apertureSkinPosition(",
      "fn apertureSkinDirection(",
      "struct ApertureSkinnedVertex",
      "fn apertureSkin(",
    ]) {
      expect(APERTURE_SKINNED_WGSL_HEADER).toContain(helper);
    }
  });
});
