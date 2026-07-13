import { describe, expect, it } from "vitest";

import {
  createCustomWgslMaterialAsset,
  createMaterialPipelineKeyInput,
  createPreparedCustomWgslMaterial,
  customWgslColorTargetsPipelineKeySegment,
  parseWgslFragmentOutputLocations,
  validateCustomMaterialSource,
  type CustomWgslColorTargetDeclaration,
  type CustomWgslMaterialAsset,
} from "@aperture-engine/render";
import { createRenderTargetHandle } from "@aperture-engine/simulation";

// B3 (three.js parity plan): MRT authoring for custom WGSL materials — the
// colorTargets declaration (formats + write masks + facade render-target
// pairing), fragment @location output validation against it (structured
// diagnostics, never device errors), and pipeline-key participation ONLY
// when declared (materials without colorTargets keep byte-identical keys).

const SINGLE_TARGET_WGSL = `
struct VertexInput {
  @location(0) position: vec3f,
};

@vertex
fn vs_main(input: VertexInput) -> @builtin(position) vec4f {
  return vec4f(input.position, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return vec4f(1.0, 0.0, 1.0, 1.0);
}
`;

const GBUFFER_WGSL = `
struct GBufferOutput {
  @location(0) albedo: vec4f,
  @location(1) normal: vec4f,
  @location(2) id: vec4f,
};

@vertex
fn vs_main(@location(0) position: vec3f) -> @builtin(position) vec4f {
  return vec4f(position, 1.0);
}

@fragment
fn fs_main() -> GBufferOutput {
  var output: GBufferOutput;
  output.albedo = vec4f(1.0);
  output.normal = vec4f(0.5);
  output.id = vec4f(0.25);
  return output;
}
`;

const GBUFFER_COLOR_TARGETS: readonly CustomWgslColorTargetDeclaration[] = [
  { format: "swapchain" },
  {
    format: "rgba8unorm",
    renderTarget: createRenderTargetHandle("gbuffer.normal"),
  },
  {
    format: "rgba8unorm",
    writeMask: "rgb",
    renderTarget: createRenderTargetHandle("gbuffer.id"),
  },
];

// Byte-for-byte the key the pre-B3 algorithm produced for this source
// (computed against the pre-change customWgslMaterialPipelineKey): the
// `color-targets:` segment participates only when colorTargets is declared.
const BASELINE_PIPELINE_KEY =
  "test/key-stability|shader:7edd5b5b|vs:vs_main|fs:fs_main|instance-attributes:none|features:|specialization:5465b825|bindings:|opaque|back|less|none";

function material(
  overrides: {
    readonly colorTargets?: CustomWgslMaterialAsset["colorTargets"];
    readonly code?: string;
    readonly familyKey?: string;
    readonly renderState?: CustomWgslMaterialAsset["renderState"] | object;
  } = {},
): CustomWgslMaterialAsset {
  return createCustomWgslMaterialAsset({
    familyKey: overrides.familyKey ?? "test/key-stability",
    label: "Key Stability",
    shader: {
      kind: "inline-wgsl",
      code: overrides.code ?? SINGLE_TARGET_WGSL,
    },
    entryPoints: { vertex: "vs_main", fragment: "fs_main" },
    ...(overrides.colorTargets === undefined
      ? {}
      : { colorTargets: overrides.colorTargets }),
    ...(overrides.renderState === undefined
      ? {}
      : { renderState: overrides.renderState }),
    bindings: [],
  });
}

function diagnosticsFor(source: CustomWgslMaterialAsset): readonly string[] {
  return validateCustomMaterialSource(source, {
    expectedFamily: source.familyKey,
  }).map((diagnostic) => diagnostic.code);
}

describe("colorTargets declaration validation (B3)", () => {
  it("accepts a well-formed G-buffer declaration", () => {
    const diagnostics = validateCustomMaterialSource(
      material({ code: GBUFFER_WGSL, colorTargets: GBUFFER_COLOR_TARGETS }),
    );

    expect(diagnostics).toEqual([]);
  });

  it("rejects empty declarations and more than four targets", () => {
    expect(diagnosticsFor(material({ colorTargets: [] }))).toContain(
      "customMaterialSource.invalidColorTargets",
    );

    const five = [
      { format: "swapchain" },
      ...Array.from({ length: 4 }, (_, index) => ({
        format: "rgba8unorm" as const,
        renderTarget: createRenderTargetHandle(`extra.${String(index)}`),
      })),
    ] as CustomWgslMaterialAsset["colorTargets"];
    expect(diagnosticsFor(material({ colorTargets: five }))).toContain(
      "customMaterialSource.invalidColorTargets",
    );
  });

  it("rejects unknown formats and write masks", () => {
    expect(
      diagnosticsFor(
        material({
          code: GBUFFER_WGSL,
          colorTargets: [
            { format: "swapchain" },
            {
              format: "r32float" as never,
              renderTarget: createRenderTargetHandle("bad.format"),
            },
            {
              format: "rgba8unorm",
              renderTarget: createRenderTargetHandle("ok"),
            },
          ],
        }),
      ),
    ).toContain("customMaterialSource.invalidColorTargets");

    expect(
      diagnosticsFor(
        material({
          code: GBUFFER_WGSL,
          colorTargets: [
            { format: "swapchain", writeMask: "red" as never },
            ...GBUFFER_COLOR_TARGETS.slice(1),
          ],
        }),
      ),
    ).toContain("customMaterialSource.invalidColorTargets");
  });

  it("pins target 0 to the pass color: no renderTarget pairing, format 'swapchain'", () => {
    expect(
      diagnosticsFor(
        material({
          code: GBUFFER_WGSL,
          colorTargets: [
            {
              format: "swapchain",
              renderTarget: createRenderTargetHandle("own.target"),
            },
            ...GBUFFER_COLOR_TARGETS.slice(1),
          ],
        }),
      ),
    ).toContain("customMaterialSource.invalidColorTargets");

    expect(
      diagnosticsFor(
        material({
          code: GBUFFER_WGSL,
          colorTargets: [
            { format: "rgba8unorm" },
            ...GBUFFER_COLOR_TARGETS.slice(1),
          ],
        }),
      ),
    ).toContain("customMaterialSource.invalidColorTargets");
  });

  it("requires a render-target pairing for every extra target and rejects duplicates", () => {
    expect(
      diagnosticsFor(
        material({
          code: GBUFFER_WGSL,
          colorTargets: [
            { format: "swapchain" },
            { format: "rgba8unorm" },
            ...GBUFFER_COLOR_TARGETS.slice(2),
          ],
        }),
      ),
    ).toContain("customMaterialSource.invalidColorTargets");

    expect(
      diagnosticsFor(
        material({
          code: GBUFFER_WGSL,
          colorTargets: [
            { format: "swapchain" },
            {
              format: "rgba8unorm",
              renderTarget: createRenderTargetHandle("same.target"),
            },
            {
              format: "rgba8unorm",
              renderTarget: createRenderTargetHandle("same.target"),
            },
          ],
        }),
      ),
    ).toContain("customMaterialSource.invalidColorTargets");
  });
});

describe("fragment @location outputs vs the declaration (B3)", () => {
  it("rejects a single-output fragment declared with three targets", () => {
    const diagnostics = validateCustomMaterialSource(
      material({ colorTargets: GBUFFER_COLOR_TARGETS }),
    );

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "customMaterialSource.colorTargetMismatch",
    );
    expect(
      diagnostics.find(
        (diagnostic) =>
          diagnostic.code === "customMaterialSource.colorTargetMismatch",
      )?.message,
    ).toContain("@location(0)");
  });

  it("rejects a multi-output fragment WITHOUT a colorTargets declaration (would be a device error today)", () => {
    expect(diagnosticsFor(material({ code: GBUFFER_WGSL }))).toContain(
      "customMaterialSource.colorTargetMismatch",
    );
  });

  it("accepts a struct-return fragment whose locations exactly match the declaration", () => {
    expect(
      diagnosticsFor(
        material({ code: GBUFFER_WGSL, colorTargets: GBUFFER_COLOR_TARGETS }),
      ),
    ).toEqual([]);
  });

  it("parses inline and struct fragment outputs (builtins ignored) and returns null when unparseable", () => {
    expect(
      parseWgslFragmentOutputLocations(SINGLE_TARGET_WGSL, "fs_main"),
    ).toEqual([0]);
    expect(parseWgslFragmentOutputLocations(GBUFFER_WGSL, "fs_main")).toEqual([
      0, 1, 2,
    ]);

    const withBuiltin = `
struct Output {
  @location(0) color: vec4f,
  @builtin(frag_depth) depth: f32,
  @location(1) extra: vec4f,
};
@fragment fn fs_main() -> Output { var o: Output; return o; }
`;
    expect(parseWgslFragmentOutputLocations(withBuiltin, "fs_main")).toEqual([
      0, 1,
    ]);

    expect(
      parseWgslFragmentOutputLocations(SINGLE_TARGET_WGSL, "missing_entry"),
    ).toBeNull();
  });
});

describe("pipeline-key participation (byte-identity rule)", () => {
  it("keeps the pre-B3 key byte-identical for materials without colorTargets", () => {
    const prepared = createPreparedCustomWgslMaterial({
      source: material(),
      assetKey: "material:test/key-stability",
      shaderCode: SINGLE_TARGET_WGSL,
      shaderSourceKey: "inline:test",
    });

    expect(prepared.pipelineKey).toBe(BASELINE_PIPELINE_KEY);
    expect(prepared.pipeline.colorTargets).toBeUndefined();
  });

  it("threads the stencil token into the PREPARED custom-WGSL key only when authored (D1)", () => {
    // Non-stencil ⇒ byte-identical to the baseline (no token).
    const plain = createPreparedCustomWgslMaterial({
      source: material({ renderState: {} }),
      assetKey: "material:test/key-stability",
      shaderCode: SINGLE_TARGET_WGSL,
      shaderSourceKey: "inline:test",
    });
    expect(plain.pipelineKey).toBe(BASELINE_PIPELINE_KEY);

    // Stencil ⇒ the token sits BEFORE the trailing render-state segments so the
    // backend reconstructs the state from the key.
    const stenciled = createPreparedCustomWgslMaterial({
      source: material({
        renderState: {
          stencil: {
            readMask: 255,
            writeMask: 255,
            reference: 1,
            front: {
              compare: "equal",
              failOp: "keep",
              depthFailOp: "keep",
              passOp: "replace",
            },
            back: {
              compare: "equal",
              failOp: "keep",
              depthFailOp: "keep",
              passOp: "replace",
            },
          },
        },
      }),
      assetKey: "material:test/key-stability",
      shaderCode: SINGLE_TARGET_WGSL,
      shaderSourceKey: "inline:test",
    });
    expect(stenciled.pipelineKey).toContain(
      "|stencil:255:255:1:equal:keep:keep:replace:equal:keep:keep:replace|opaque|back|less|none",
    );
    // Removing the token yields the byte-identical non-stencil key.
    expect(stenciled.pipelineKey.replace(/\|stencil:[^|]*/, "")).toBe(
      BASELINE_PIPELINE_KEY,
    );
  });

  it("adds the color-targets segment (formats + masks, no handle ids) only when declared", () => {
    const prepared = createPreparedCustomWgslMaterial({
      source: material({
        code: GBUFFER_WGSL,
        colorTargets: GBUFFER_COLOR_TARGETS,
      }),
      assetKey: "material:test/key-stability",
      shaderCode: GBUFFER_WGSL,
      shaderSourceKey: "inline:test",
    });

    expect(prepared.pipelineKey).toContain(
      "|color-targets:swapchain/all+rgba8unorm/all+rgba8unorm/rgb|",
    );
    expect(prepared.pipelineKey).not.toContain("gbuffer.normal");
    // Normalized declaration carried for the pipeline descriptor + frame.
    expect(prepared.pipeline.colorTargets).toEqual([
      { format: "swapchain", writeMask: "all" },
      {
        format: "rgba8unorm",
        writeMask: "all",
        renderTarget: { kind: "render-target", id: "gbuffer.normal" },
      },
      {
        format: "rgba8unorm",
        writeMask: "rgb",
        renderTarget: { kind: "render-target", id: "gbuffer.id" },
      },
    ]);
  });

  it("keeps createMaterialPipelineKeyInput features unchanged unless declared", () => {
    const undeclared = createMaterialPipelineKeyInput(material());
    expect(
      undeclared.features.some((feature) =>
        feature.startsWith("color-targets:"),
      ),
    ).toBe(false);

    const declared = createMaterialPipelineKeyInput(
      material({ code: GBUFFER_WGSL, colorTargets: GBUFFER_COLOR_TARGETS }),
    );
    expect(declared.features).toContain(
      "color-targets:swapchain/all+rgba8unorm/all+rgba8unorm/rgb",
    );
  });

  it("emits no segment for undeclared targets", () => {
    expect(customWgslColorTargetsPipelineKeySegment(undefined)).toBeNull();
    expect(customWgslColorTargetsPipelineKeySegment([])).toBeNull();
  });
});
