import { describe, expect, it } from "vitest";
import {
  createMotionVectorBuiltInShaderVariant,
  createStandardRenderPipelineResource,
  STANDARD_MESH_SHADER,
  type BatchCompatibilityKey,
  type WebGpuShaderCreateDescriptor,
  type WebGpuRenderPipelineCreateDescriptor,
} from "@aperture-engine/webgpu/test-support";
import { findWgslFunctionDeclaration } from "../../packages/webgpu/src/gpu/wgsl-function-declaration.js";

const baseBatch: BatchCompatibilityKey = {
  pipelineKey: "standard|opaque|back|less|none",
  materialKey: "material:surface",
  meshLayoutKey: "primitive-interleaved",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("motion-vector fragment IO composition", () => {
  it.each([
    { name: "plain", features: [] },
    { name: "normal", features: ["normalTexture"] },
    { name: "normal/skinned", features: ["normalTexture", "skinned"] },
    { name: "normal/morphed", features: ["normalTexture", "morphed"] },
    {
      name: "normal/skinned/morphed",
      features: ["normalTexture", "skinned", "morphed"],
    },
    {
      name: "shadow/IBL",
      features: ["shadowMap", "iblDiffuse", "iblSpecularBrdf"],
    },
  ])(
    "composes real StandardMaterial $name pipeline without putting entry IO on helpers",
    async ({ features }) => {
      const codes: string[] = [],
        descriptors: WebGpuRenderPipelineCreateDescriptor[] = [];
      const batchKey = {
        ...baseBatch,
        pipelineKey: [
          "standard",
          ...features,
          "opaque",
          "back",
          "less",
          "none",
        ].join("|"),
        skinned: features.includes("skinned"),
        morphed: features.includes("morphed"),
      };
      const result = await createStandardRenderPipelineResource({
        device: {
          createShaderModule(descriptor: WebGpuShaderCreateDescriptor) {
            codes.push(descriptor.code);
            return { compilationInfo: async () => ({ messages: [] }) };
          },
          createRenderPipeline(
            descriptor: WebGpuRenderPipelineCreateDescriptor,
          ) {
            descriptors.push(descriptor);
            return {};
          },
        },
        batchKey,
        colorFormat: "rgba8unorm",
        depthFormat: "depth24plus",
        motionVectorColorFormat: "rgba16float",
        tonemap: "aces",
        outputColorSpace: "srgb",
      });
      expect(result.valid).toBe(true);
      expect(codes).toHaveLength(1);
      const helper = findWgslFunctionDeclaration(codes[0]!, "fs_main_color")!,
        entry = findWgslFunctionDeclaration(codes[0]!, "fs_main")!;
      expect(helper.parametersSource).toBe(
        "input: VertexOutput, frontFacing: bool",
      );
      expect(helper.attributes).toEqual([]);
      expect(entry.parametersSource).toContain(
        "@builtin(front_facing) frontFacing: bool",
      );
      expect(entry.attributes).toEqual(["fragment"]);
      expect(codes[0]).toContain(
        "output.color = fs_main_color(input, frontFacing);",
      );
      expect(codes[0]).toContain(
        "apertureOutputColorSpace(apertureOutputTonemap",
      );
      expect(codes[0]).toContain("apertureTransformWorldNormal");
      expect(descriptors[0]?.fragment).toMatchObject({
        targets: [{ format: "rgba8unorm" }, { format: "rgba16float" }],
      });
    },
  );

  it("reads nested attribute arguments, generic parameter types and comments without splitting their commas", () => {
    const source = `// fn shaded(bogus: f32) -> vec4f { ignored }
@diagnostic(off, derivative_uniformity)
@fragment fn shaded(
  @location((LOCATION + 1)) @interpolate(perspective, center) uv: vec2f,
  /* nested /* comment */ containing , ) */ @builtin(front_facing) facing: bool,
  values: array<vec4<f32>, 2>,
) -> @location(0) vec4f { return vec4f(1.0); }`;
    const declaration = findWgslFunctionDeclaration(source, "shaded")!;
    expect(declaration.attributes).toEqual(["diagnostic", "fragment"]);
    expect(declaration.helperAttributesSource).toBe(
      "@diagnostic(off, derivative_uniformity)",
    );
    expect(declaration.parameters).toEqual([
      { name: "uv", type: "vec2f" },
      { name: "facing", type: "bool" },
      { name: "values", type: "array < vec4 < f32 > , 2 >" },
    ]);
    expect(source.slice(declaration.bodyStart)).toBe("{ return vec4f(1.0); }");
  });

  it("forwards builtin names in declaration order while preserving public attributes", () => {
    const original = findWgslFunctionDeclaration(
      STANDARD_MESH_SHADER.code,
      "fs_main",
    )!;
    const shader = {
      ...STANDARD_MESH_SHADER,
      code:
        STANDARD_MESH_SHADER.code.slice(0, original.start) +
        "@fragment\nfn fs_main(@builtin(sample_index) sample: u32, surface: VertexOutput, @builtin(front_facing) isFront: bool) -> @location(0) vec4f " +
        STANDARD_MESH_SHADER.code
          .slice(original.bodyStart)
          .replace(/\binput\b/g, "surface")
          .replace(/\bfrontFacing\b/g, "isFront"),
    };
    const result = createMotionVectorBuiltInShaderVariant(shader);
    const helper = findWgslFunctionDeclaration(result.code, "fs_main_color")!,
      entry = findWgslFunctionDeclaration(result.code, "fs_main")!;
    expect(helper.parametersSource).toBe(
      "sample: u32, surface: VertexOutput, isFront: bool",
    );
    expect(entry.parametersSource).toContain(
      "@builtin(sample_index) sample: u32",
    );
    expect(result.code).toContain(
      "output.color = fs_main_color(sample, surface, isFront);",
    );
    expect(result.code).toContain(
      "encodeMotionVector(surface.motionClipPosition, surface.previousMotionClipPosition)",
    );
  });
});
