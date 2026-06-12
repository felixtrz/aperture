import { describe, expect, it } from "vitest";

import {
  createDebugNormalRenderPipelineResource,
  createMatcapRenderPipelineResource,
  createOutputColorSpacePipelineKey,
  createTonemapPipelineKey,
  createUnlitRenderPipelineResource,
  DEBUG_NORMAL_MESH_WGSL,
  MATCAP_MESH_WGSL,
  UNLIT_MESH_WGSL,
  type BatchCompatibilityKey,
  type WebGpuRenderPipelineCreateDescriptor,
  type WebGpuShaderCreateDescriptor,
} from "@aperture-engine/webgpu/test-support";

// AI-17: the three motion-vector-capable built-in mesh families (unlit / matcap /
// debug-normal) compose the shared output stage on their base color shader BEFORE
// the motion-vector variant. These headless tests prove (AC#2) the constructor
// wraps the WGSL + tokenizes the cache key when the stage is requested, stays
// byte-identical on the none + linear HDR-scene-buffer path, and composes
// correctly with the motion-vector struct output (color@0 + motion@1).

interface MeshFamilyFixture {
  readonly name: string;
  readonly wgsl: string;
  readonly batchKey: BatchCompatibilityKey;
  readonly create: (options: {
    readonly device: unknown;
    readonly colorFormat: string;
    readonly depthFormat?: string;
    readonly batchKey: BatchCompatibilityKey;
    readonly tonemap?: string;
    readonly outputColorSpace?: string;
    readonly motionVectorColorFormat?: string;
  }) => Promise<{
    readonly valid: boolean;
    readonly resource: { readonly cacheKey: string } | null;
    readonly diagnostics: readonly unknown[];
  }>;
}

const UNLIT_BATCH_KEY: BatchCompatibilityKey = {
  pipelineKey: "unlit|opaque|back|less|none",
  materialKey: "material:white",
  meshLayoutKey: "primitive-interleaved",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

const MATCAP_BATCH_KEY: BatchCompatibilityKey = {
  pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
  materialKey: "material:studio-matcap",
  meshLayoutKey: "primitive-interleaved",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

const DEBUG_NORMAL_BATCH_KEY: BatchCompatibilityKey = {
  pipelineKey: "debug-normal|opaque|back|less|none",
  materialKey: "material:debug-normals",
  meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

const FAMILIES: readonly MeshFamilyFixture[] = [
  {
    name: "unlit",
    wgsl: UNLIT_MESH_WGSL,
    batchKey: UNLIT_BATCH_KEY,
    create: createUnlitRenderPipelineResource as MeshFamilyFixture["create"],
  },
  {
    name: "matcap",
    wgsl: MATCAP_MESH_WGSL,
    batchKey: MATCAP_BATCH_KEY,
    create: createMatcapRenderPipelineResource as MeshFamilyFixture["create"],
  },
  {
    name: "debug-normal",
    wgsl: DEBUG_NORMAL_MESH_WGSL,
    batchKey: DEBUG_NORMAL_BATCH_KEY,
    create:
      createDebugNormalRenderPipelineResource as MeshFamilyFixture["create"],
  },
];

function recordingDevice() {
  const shaderCodes: string[] = [];
  const device = {
    createShaderModule(descriptor: WebGpuShaderCreateDescriptor) {
      shaderCodes.push(descriptor.code);
      return { compilationInfo: async () => ({ messages: [] }) };
    },
    createRenderPipeline(_descriptor: WebGpuRenderPipelineCreateDescriptor) {
      return { kind: "mesh-render-pipeline" };
    },
  };
  return { device, shaderCodes };
}

describe.each(FAMILIES)(
  "$name mesh family output stage (AI-17)",
  ({ wgsl, batchKey, create }) => {
    it("is byte-identical on the none + linear HDR-scene-buffer path", async () => {
      const { device, shaderCodes } = recordingDevice();
      const result = await create({
        device,
        colorFormat: "rgba16float",
        depthFormat: "depth24plus",
        batchKey,
        tonemap: "none",
        outputColorSpace: "linear",
      });

      expect(result.valid).toBe(true);
      expect(shaderCodes).toHaveLength(1);
      // The base shader WGSL is emitted verbatim: no wrapper, no stage functions.
      expect(shaderCodes[0]).toContain(wgsl);
      expect(shaderCodes[0]).not.toContain("apertureOutputStageInner");
      expect(shaderCodes[0]).not.toContain("apertureOutputTonemap");
    });

    it("wraps the fragment output + tokenizes the cache key when requested", async () => {
      const { device, shaderCodes } = recordingDevice();
      const result = await create({
        device,
        colorFormat: "bgra8unorm",
        depthFormat: "depth24plus",
        batchKey,
        tonemap: "aces",
        outputColorSpace: "srgb",
      });

      expect(result.valid).toBe(true);
      expect(shaderCodes).toHaveLength(1);
      const code = shaderCodes[0] ?? "";
      // Original entry renamed to a plain (non-entry) helper returning vec4f —
      // crucially WITHOUT @location, which Dawn rejects on non-entry returns.
      expect(code).toContain(
        "fn apertureOutputStageInner(input: VertexOutput) -> vec4f",
      );
      expect(code).not.toContain(
        "fn apertureOutputStageInner(input: VertexOutput) -> @location(0) vec4f",
      );
      expect(code).toContain(
        "apertureOutputColorSpace(apertureOutputTonemap(apertureFragment.rgb))",
      );
      // exactly one @fragment entry survives the rename + rewrap.
      expect(code.match(/@fragment/g)).toHaveLength(1);

      const cacheKey = result.resource?.cacheKey ?? "";
      expect(cacheKey).toContain(createTonemapPipelineKey("aces"));
      expect(cacheKey).toContain(createOutputColorSpacePipelineKey("srgb"));
    });

    it("composes the output stage under the motion-vector struct output", async () => {
      const { device, shaderCodes } = recordingDevice();
      const result = await create({
        device,
        colorFormat: "rgba8unorm",
        depthFormat: "depth24plus",
        batchKey,
        tonemap: "aces",
        outputColorSpace: "srgb",
        motionVectorColorFormat: "rgba16float",
      });

      expect(result.valid).toBe(true);
      const code = shaderCodes[0] ?? "";
      // The MV variant renames the output-stage wrapper entry to fs_main_color and
      // packs the (already tonemapped/encoded) color into location 0 alongside the
      // motion vector at location 1 — so both must be present and composed.
      expect(code).toContain("struct MotionVectorFragmentOutput");
      expect(code).toContain("fn fs_main_color(input: VertexOutput) -> vec4f");
      expect(code).toContain(
        "apertureOutputColorSpace(apertureOutputTonemap(apertureFragment.rgb))",
      );
      expect(code).toContain("output.color = fs_main_color(input);");
      // Structural invariants beyond a single literal (the real WGSL-validity
      // proof is the Dawn compile gate, scripts/webgpu-shader-compile-check.mjs):
      // exactly one @fragment entry survives (the MV fs_main, not the renamed
      // color helper or the inner helper), no @location lands on a non-entry
      // return, and braces stay balanced so a truncated/duplicated body fails.
      expect(code.match(/@fragment/g)).toHaveLength(1);
      expect(code).not.toMatch(/fn \w+\([^)]*\) -> @location\(0\) vec4f/);
      expect(countChar(code, "{")).toBe(countChar(code, "}"));
    });
  },
);

function countChar(text: string, char: string): number {
  let count = 0;
  for (const c of text) {
    if (c === char) {
      count += 1;
    }
  }
  return count;
}
