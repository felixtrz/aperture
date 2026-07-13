import { describe, expect, it } from "vitest";

import {
  createWebGpuDepthStencilDescriptor,
  createWebGpuDepthStencilStateKey,
  pipelineKeyDeclaresStencil,
  resolveWebGpuPipelineRenderState,
  stencilDepthFormatDiagnostic,
  stencilReferenceFromPipelineKey,
} from "../../packages/webgpu/src/materials/core/material-render-state.js";
import {
  isStencilCapableDepthFormat,
  WEBGPU_APP_STENCIL_DEPTH_FORMAT,
} from "../../packages/webgpu/src/resources/textures/depth-texture-resource.js";
import { webGpuAppSceneDepthFormat } from "../../packages/webgpu/src/app/scene-depth-format.js";
import {
  createStandardPipelineDescriptorPlan,
  type BatchCompatibilityKey,
} from "@aperture-engine/webgpu/test-support";
import type { RenderSnapshot } from "@aperture-engine/render";

// D1: the WebGPU backend reconstructs stencil state from the material pipeline
// key (like it does for frontFace/depthBias) and selects a stencil-capable
// depth attachment per frame.

const STENCIL_KEY =
  "standard|stencil:255:255:1:equal:keep:keep:replace:equal:keep:keep:replace|opaque|back|less|none";
const NON_STENCIL_KEY = "standard|opaque|back|less|none";

describe("WebGPU stencil render-state parsing (D1)", () => {
  it("reconstructs the full stencil state from the pipeline key", () => {
    const rs = resolveWebGpuPipelineRenderState(
      STENCIL_KEY,
      WEBGPU_APP_STENCIL_DEPTH_FORMAT,
    );

    expect(rs.stencil).toEqual({
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
    });
  });

  it("resolves a non-stencil key to a null stencil state", () => {
    expect(
      resolveWebGpuPipelineRenderState(NON_STENCIL_KEY, "depth24plus").stencil,
    ).toBeNull();
    expect(pipelineKeyDeclaresStencil(NON_STENCIL_KEY)).toBe(false);
    expect(pipelineKeyDeclaresStencil(STENCIL_KEY)).toBe(true);
  });

  it("exposes the dynamic stencil reference (setStencilReference)", () => {
    expect(stencilReferenceFromPipelineKey(STENCIL_KEY)).toBe(1);
    expect(stencilReferenceFromPipelineKey(NON_STENCIL_KEY)).toBeNull();
    expect(stencilReferenceFromPipelineKey(undefined)).toBeNull();
  });
});

describe("WebGPU depth-stencil descriptor (D1)", () => {
  it("emits stencil faces + masks on a stencil-capable format", () => {
    const rs = resolveWebGpuPipelineRenderState(
      STENCIL_KEY,
      WEBGPU_APP_STENCIL_DEPTH_FORMAT,
    );

    expect(
      createWebGpuDepthStencilDescriptor(WEBGPU_APP_STENCIL_DEPTH_FORMAT, rs),
    ).toEqual({
      format: "depth24plus-stencil8",
      depthWriteEnabled: true,
      depthCompare: "less",
      stencilFront: {
        compare: "equal",
        failOp: "keep",
        depthFailOp: "keep",
        passOp: "replace",
      },
      stencilBack: {
        compare: "equal",
        failOp: "keep",
        depthFailOp: "keep",
        passOp: "replace",
      },
      stencilReadMask: 255,
      stencilWriteMask: 255,
    });
    expect(
      createWebGpuDepthStencilStateKey(WEBGPU_APP_STENCIL_DEPTH_FORMAT, rs),
    ).toMatchObject({ stencilReadMask: 255, stencilWriteMask: 255 });
  });

  it("keeps NON-stencil descriptors byte-identical (no stencil fields), on either format", () => {
    const rs = resolveWebGpuPipelineRenderState(NON_STENCIL_KEY, "depth24plus");

    // Pre-D1 shape — unchanged.
    expect(createWebGpuDepthStencilDescriptor("depth24plus", rs)).toEqual({
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    });
    // A non-stencil material coexisting in a stencil frame differs ONLY in the
    // attachment format; it carries no stencil fields.
    expect(
      createWebGpuDepthStencilDescriptor(WEBGPU_APP_STENCIL_DEPTH_FORMAT, rs),
    ).toEqual({
      format: "depth24plus-stencil8",
      depthWriteEnabled: true,
      depthCompare: "less",
    });
  });

  it("drops stencil fields (degrades) when a stencil material lands on a depth-only format", () => {
    const rs = resolveWebGpuPipelineRenderState(STENCIL_KEY, "depth24plus");

    expect(createWebGpuDepthStencilDescriptor("depth24plus", rs)).toEqual({
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    });
  });
});

describe("stencil-on-format-without-stencil diagnostic (D1)", () => {
  it("fires for a stencil material on a depth-only format", () => {
    const rs = resolveWebGpuPipelineRenderState(STENCIL_KEY, "depth24plus");

    expect(stencilDepthFormatDiagnostic(rs, "depth24plus")).toEqual({
      code: "material.stencilRequiresStencilFormat",
      message: expect.stringContaining(
        "no stencil aspect",
      ) as unknown as string,
    });
  });

  it("stays silent for stencil-on-stencil-format and for non-stencil materials", () => {
    const stencilRs = resolveWebGpuPipelineRenderState(
      STENCIL_KEY,
      WEBGPU_APP_STENCIL_DEPTH_FORMAT,
    );
    const plainRs = resolveWebGpuPipelineRenderState(
      NON_STENCIL_KEY,
      "depth24plus",
    );

    expect(
      stencilDepthFormatDiagnostic(stencilRs, WEBGPU_APP_STENCIL_DEPTH_FORMAT),
    ).toBeNull();
    expect(stencilDepthFormatDiagnostic(plainRs, "depth24plus")).toBeNull();
  });

  it("is surfaced by the standard pipeline descriptor plan (refuses to build)", () => {
    const batchKey: BatchCompatibilityKey = {
      pipelineKey: STENCIL_KEY,
      materialKey: "material:stencil",
      meshLayoutKey: "primitive-interleaved",
      topology: "triangle-list",
      instanced: false,
      skinned: false,
      morphed: false,
    };

    const bad = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      batchKey,
    });
    expect(bad.valid).toBe(false);
    expect(bad.diagnostics.map((d) => d.code)).toContain(
      "material.stencilRequiresStencilFormat",
    );

    const good = createStandardPipelineDescriptorPlan({
      colorFormat: "bgra8unorm",
      depthFormat: WEBGPU_APP_STENCIL_DEPTH_FORMAT,
      batchKey,
    });
    expect(good.valid).toBe(true);
    expect(good.plan?.descriptor).toMatchObject({
      depthStencil: {
        format: "depth24plus-stencil8",
        stencilFront: { compare: "equal", passOp: "replace" },
        stencilReadMask: 255,
      },
    });
  });
});

describe("per-frame scene depth format selection (D1)", () => {
  it("is depth24plus by default and stencil-capable when a draw uses stencil", () => {
    expect(isStencilCapableDepthFormat("depth24plus")).toBe(false);
    expect(isStencilCapableDepthFormat(WEBGPU_APP_STENCIL_DEPTH_FORMAT)).toBe(
      true,
    );

    const nonStencilSnapshot = {
      meshDraws: [{ batchKey: { pipelineKey: NON_STENCIL_KEY } }],
    } as unknown as RenderSnapshot;
    const stencilSnapshot = {
      meshDraws: [
        { batchKey: { pipelineKey: NON_STENCIL_KEY } },
        { batchKey: { pipelineKey: STENCIL_KEY } },
      ],
    } as unknown as RenderSnapshot;

    expect(webGpuAppSceneDepthFormat(nonStencilSnapshot)).toBe("depth24plus");
    expect(webGpuAppSceneDepthFormat(stencilSnapshot)).toBe(
      "depth24plus-stencil8",
    );
  });
});
