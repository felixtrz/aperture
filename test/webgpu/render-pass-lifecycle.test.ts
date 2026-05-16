import { describe, expect, it } from "vitest";

import {
  beginPlannedRenderPass,
  endPlannedRenderPass,
  type RenderPassAttachmentDescriptorPlan,
} from "@aperture-engine/webgpu";

describe("render pass lifecycle helpers", () => {
  it("begins render passes through an injected command encoder", () => {
    const pass = { end: () => {} };
    const descriptors: unknown[] = [];
    const plan = attachmentPlan();
    const result = beginPlannedRenderPass({
      encoder: {
        beginRenderPass: (descriptor) => {
          descriptors.push(descriptor);
          return pass;
        },
      },
      plan,
    });

    expect(result).toEqual({ valid: true, pass, diagnostics: [] });
    expect(descriptors).toEqual([plan]);
  });

  it("diagnoses null plans and missing begin support", () => {
    expect(
      beginPlannedRenderPass({
        encoder: { beginRenderPass: () => ({}) },
        plan: null,
      }),
    ).toMatchObject({
      valid: false,
      pass: null,
      diagnostics: [{ code: "renderPassLifecycle.nullAttachmentPlan" }],
    });
    expect(
      beginPlannedRenderPass({ encoder: {}, plan: attachmentPlan() }),
    ).toMatchObject({
      valid: false,
      pass: null,
      diagnostics: [{ code: "renderPassLifecycle.missingBeginRenderPass" }],
    });
  });

  it("ends render passes through an injected pass encoder", () => {
    const events: string[] = [];

    expect(endPlannedRenderPass({ end: () => events.push("end") })).toEqual({
      valid: true,
      ended: true,
      diagnostics: [],
    });
    expect(events).toEqual(["end"]);
  });

  it("diagnoses missing end support", () => {
    expect(endPlannedRenderPass({})).toMatchObject({
      valid: false,
      ended: false,
      diagnostics: [{ code: "renderPassLifecycle.missingEnd" }],
    });
  });
});

function attachmentPlan(): RenderPassAttachmentDescriptorPlan {
  return {
    colorAttachments: [
      {
        view: {},
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
      },
    ],
  };
}
