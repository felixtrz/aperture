import { describe, expect, it } from "vitest";

import {
  createIdentityLutStripData,
  createWebGpuLutColorGradePostEffect,
  createWebGpuMotionBlurPostEffect,
  createWebGpuOutlinePostEffect,
  createWebGpuOutlineSelectionMaskIdValues,
  outlineSelectedRenderIds,
  createWebGpuSsaoPostEffect,
  lutPostEffectWgsl,
  reshapeLutStripToVolume,
  motionBlurPostEffectWgsl,
  outlineIdentityWgsl,
  outlinePostEffectWgsl,
  WEBGPU_OUTLINE_MASK_SELECTED_ID,
} from "@aperture-engine/webgpu/test-support";

// The SSAO default pipeline key MUST stay byte-identical after the E4 tail work
// (the GTAO integration mode was deferred — see docs/DECISIONS.md — so SSAO is
// unchanged). This literal pins the pre-E4 value so a future SSAO edit is loud.
const DEFAULT_SSAO_PIPELINE_KEY =
  "webgpu-post-ssao|rgba8unorm|depthSamples:1|radius:9.000|intensity:1.350|bias:0.00080|range:0.0750|near:0.1000|far:1000.000|fovY:1.0472|samples:12|minAngle:5.00|power:1.000|random:0.0000|appliesTo:composite";

function postTexture(label: string) {
  return {
    texture: { createView: () => ({ label }) },
    width: 32,
    height: 16,
    format: "rgba8unorm",
    label,
  };
}

function postDepthTexture(label: string, sampleCount = 1) {
  return {
    texture: { createView: () => ({ label }) },
    width: 32,
    height: 16,
    format: "depth24plus",
    sampleCount,
    label,
  };
}

function postDevice() {
  return {
    createShaderModule: () => ({}),
    createRenderPipeline: () => ({ getBindGroupLayout: () => ({}) }),
    createSampler: () => ({}),
    createBindGroup: (descriptor: unknown) => descriptor,
  };
}

function lutDevice(writes: string[]) {
  return {
    ...postDevice(),
    createTexture: (descriptor: { readonly label?: string }) => ({
      label: descriptor.label,
      createView: () => ({ label: descriptor.label }),
    }),
    queue: {
      writeTexture: () => {
        writes.push("writeTexture");
      },
    },
  };
}

function prepareOptions(extra: Record<string, unknown>) {
  return {
    device: postDevice(),
    input: postTexture("scene"),
    outputFormat: "rgba8unorm",
    width: 32,
    height: 16,
    frame: 1,
    passIndex: 0,
    isLast: true,
    label: "test",
    ...extra,
  } as never;
}

describe("motion blur post effect (E4)", () => {
  it("requires motion vectors and decodes the velocity field in WGSL", () => {
    const effect = createWebGpuMotionBlurPostEffect({
      intensity: 1,
      samples: 8,
    });
    expect(effect.requiresMotionVectors).toBe(true);
    const wgsl = motionBlurPostEffectWgsl({
      intensity: 1,
      samples: 8,
      maxVelocity: 0.1,
    });
    expect(wgsl).toContain("const SAMPLE_COUNT: u32 = 8u;");
    expect(wgsl).toContain("encodedMotion * 2.0 - vec2f(1.0)");
    expect(wgsl).toContain("motionVectorTexture");
  });

  it("prepares a full-screen draw sampling color + motion vectors", () => {
    const effect = createWebGpuMotionBlurPostEffect();
    const prepared = effect.prepare(
      prepareOptions({ motionVector: postTexture("motion") }),
    );
    expect(prepared.diagnostics).toEqual([]);
    expect(prepared.commands.map((c) => c.kind)).toEqual([
      "setPipeline",
      "setBindGroup",
      "draw",
    ]);
  });

  it("diagnoses (no commands) when motion vectors are unavailable", () => {
    const effect = createWebGpuMotionBlurPostEffect();
    const prepared = effect.prepare(prepareOptions({}));
    expect(prepared.commands).toEqual([]);
    expect(prepared.diagnostics[0]?.code).toBe(
      "webGpuPostPass.motionVectorTextureUnavailable",
    );
  });
});

describe("LUT color grade post effect (E4)", () => {
  it("builds an identity strip of the expected size + endpoints", () => {
    const data = createIdentityLutStripData(2);
    expect(data.length).toBe(2 * 2 * 2 * 4);
    // (r=0,g=0,b=0) tile 0, texel (0,0) → black; (r=1,g=1,b=1) → white.
    expect([data[0], data[1], data[2], data[3]]).toEqual([0, 0, 0, 255]);
    // Slice b=1 is at tileX = 1*2 = 2; texel (x=2+1, y=1) is the white corner.
    const white = ((1 * (2 * 2) + (2 + 1)) * 4) as number;
    expect([data[white], data[white + 1], data[white + 2]]).toEqual([
      255, 255, 255,
    ]);
  });

  it("samples a real texture_3d LUT with hardware trilinear filtering in WGSL", () => {
    // E5: the LUT migrated from a 2D strip + manual textureLoad to a real
    // texture_3d volume sampled with textureSampleLevel (hardware trilinear).
    const wgsl = lutPostEffectWgsl({ size: 16, intensity: 1 });
    expect(wgsl).toContain("fn sampleLut(");
    expect(wgsl).toContain("var lutTexture: texture_3d<f32>;");
    expect(wgsl).toContain("textureSampleLevel(lutTexture");
    expect(wgsl).not.toContain("textureLoad(lutTexture");
    expect(wgsl).toContain("const LUT_SIZE: f32 = 16.000000;");
  });

  it("reshapes an identity LUT strip into a dense N^3 volume", () => {
    // The strip endpoints (black at r=g=b=0, white at r=g=b=N-1) must land at
    // the matching volume corners after reshape.
    const strip = createIdentityLutStripData(2);
    const volume = reshapeLutStripToVolume(strip, 2);
    expect(volume.length).toBe(2 * 2 * 2 * 4);
    expect([volume[0], volume[1], volume[2], volume[3]]).toEqual([
      0, 0, 0, 255,
    ]);
    // (r=1,g=1,b=1) → volume offset (1*4 + 1*2 + 1)*4 = last texel.
    const white = (1 * 4 + 1 * 2 + 1) * 4;
    expect([volume[white], volume[white + 1], volume[white + 2]]).toEqual([
      255, 255, 255,
    ]);
  });

  it("prepares a draw + uploads the LUT volume when the device can write", () => {
    const writes: string[] = [];
    const effect = createWebGpuLutColorGradePostEffect({ size: 8 });
    const prepared = effect.prepare(
      prepareOptions({ device: lutDevice(writes) }),
    );
    expect(prepared.diagnostics).toEqual([]);
    expect(prepared.commands.map((c) => c.kind)).toEqual([
      "setPipeline",
      "setBindGroup",
      "draw",
    ]);
    expect(writes).toEqual(["writeTexture"]);
  });

  it("diagnoses LUT data whose length does not match the cube size", () => {
    const effect = createWebGpuLutColorGradePostEffect({
      size: 4,
      data: [1, 2, 3],
    });
    const prepared = effect.prepare(prepareOptions({ device: lutDevice([]) }));
    expect(prepared.commands).toEqual([]);
    expect(prepared.diagnostics[0]?.code).toBe("webGpuPostPass.lutDataInvalid");
  });
});

describe("outline post effect (E4, AC2)", () => {
  it("requires the selection mask and edge-detects it in WGSL", () => {
    const effect = createWebGpuOutlinePostEffect();
    expect(effect.requiresSelectionMask).toBe(true);
    const wgsl = outlinePostEffectWgsl({
      color: [1, 0.5, 0],
      thickness: 2,
      opacity: 1,
      fillOpacity: 0,
    });
    expect(wgsl).toContain(
      `const SELECTED_ID: u32 = ${WEBGPU_OUTLINE_MASK_SELECTED_ID}u;`,
    );
    expect(wgsl).toContain("selectionMask");
    expect(wgsl).toContain("neighborSelected");
  });

  it("prepares a 3-binding outline draw when a mask is supplied", () => {
    const effect = createWebGpuOutlinePostEffect();
    let entryCount = 0;
    const device = {
      ...postDevice(),
      createBindGroup: (descriptor: { entries: unknown[] }) => {
        entryCount = descriptor.entries.length;
        return descriptor;
      },
    };
    const prepared = effect.prepare(
      prepareOptions({ device, selectionMask: postTexture("mask") }),
    );
    expect(prepared.diagnostics).toEqual([]);
    expect(prepared.commands.map((c) => c.kind)).toEqual([
      "setPipeline",
      "setBindGroup",
      "draw",
    ]);
    expect(entryCount).toBe(3);
  });

  it("degrades to an identity copy (2 bindings) when no mask is supplied", () => {
    const effect = createWebGpuOutlinePostEffect();
    let entryCount = 0;
    const device = {
      ...postDevice(),
      createBindGroup: (descriptor: { entries: unknown[] }) => {
        entryCount = descriptor.entries.length;
        return descriptor;
      },
    };
    const prepared = effect.prepare(prepareOptions({ device }));
    expect(prepared.diagnostics).toEqual([]);
    expect(prepared.commands.map((c) => c.kind)).toEqual([
      "setPipeline",
      "setBindGroup",
      "draw",
    ]);
    expect(entryCount).toBe(2);
    expect(outlineIdentityWgsl()).toContain("textureSample(inputTexture");
  });

  it("maps a selection of stable entity ids to the matching draw render ids", () => {
    const selectedEntity = { index: 7, generation: 1 };
    const otherEntity = { index: 9, generation: 1 };
    // createStableRenderId(entity) = (generation << 24) | index, >>> 0.
    const stableId = (((1 & 0xff) << 24) | (7 & 0x00ffffff)) >>> 0;
    const snapshot = {
      meshDraws: [
        { entity: selectedEntity, renderId: 100 },
        { entity: otherEntity, renderId: 200 },
      ],
    };
    const renderIds = outlineSelectedRenderIds(
      snapshot as never,
      new Set([stableId]),
    );
    expect([...renderIds]).toEqual([100]);
  });

  it("marks the selected draw's instances in the mask id storage", () => {
    // The storage is indexed by the draw commands' firstInstance (draw-order
    // transform packing), 1 for a selected draw's instances and 0 otherwise.
    const commands = [
      { kind: "setPipeline", renderId: 100, pipelineKey: "k", pipeline: {} },
      {
        kind: "draw",
        renderId: 100,
        vertexCount: 3,
        instanceCount: 1,
        firstVertex: 0,
        firstInstance: 0,
      },
      {
        kind: "draw",
        renderId: 200,
        vertexCount: 3,
        instanceCount: 1,
        firstVertex: 0,
        firstInstance: 1,
      },
    ];
    const { ids, selectedDraws } = createWebGpuOutlineSelectionMaskIdValues(
      commands as never,
      new Set([100]),
    );
    expect(selectedDraws).toBe(1);
    expect(ids[0]).toBe(WEBGPU_OUTLINE_MASK_SELECTED_ID);
    expect(ids[1]).toBe(0);
  });
});

describe("SSAO byte-identity after E4 (GTAO deferred)", () => {
  // The E4 tail deliberately does NOT touch SSAO — the GTAO integration mode was
  // deferred (docs/DECISIONS.md). This pins the default pipeline key so any
  // future SSAO change is caught, keeping the pre-E4 post stack byte-identical.
  it("keeps the default (ssao) pipeline key byte-identical to pre-E4", () => {
    const effect = createWebGpuSsaoPostEffect();
    const prepared = effect.prepare(
      prepareOptions({ depth: postDepthTexture("scene-depth") }),
    );
    const setPipeline = prepared.commands.find(
      (command) => command.kind === "setPipeline",
    ) as { readonly pipelineKey: string } | undefined;
    expect(setPipeline?.pipelineKey).toBe(DEFAULT_SSAO_PIPELINE_KEY);
  });
});
