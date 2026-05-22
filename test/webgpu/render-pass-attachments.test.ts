import { describe, expect, it } from "vitest";

import { createRenderPassAttachmentPlan } from "@aperture-engine/webgpu";

describe("render pass attachment descriptor planning", () => {
  it("plans color-only attachments", () => {
    const view = { label: "color" };

    expect(
      createRenderPassAttachmentPlan({
        colorTargets: [{ view, clearColor: [0.1, 0.2, 0.3, 1] }],
      }),
    ).toEqual({
      valid: true,
      diagnostics: [],
      plan: {
        colorAttachments: [
          {
            view,
            clearValue: { r: 0.1, g: 0.2, b: 0.3, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      },
    });
  });

  it("plans multiple color attachments in target order", () => {
    const albedo = { label: "albedo" };
    const entityId = { label: "entity-id" };

    expect(
      createRenderPassAttachmentPlan({
        colorTargets: [
          {
            view: albedo,
            clearColor: [0, 0, 0, 1],
            loadOp: "clear",
            storeOp: "store",
          },
          {
            view: entityId,
            clearColor: [0, 0, 0, 0],
            loadOp: "clear",
            storeOp: "discard",
          },
        ],
      }).plan,
    ).toEqual({
      colorAttachments: [
        {
          view: albedo,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
        {
          view: entityId,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "discard",
        },
      ],
    });
  });

  it("plans color and depth attachments", () => {
    const color = { label: "color" };
    const depth = { label: "depth" };

    expect(
      createRenderPassAttachmentPlan({
        colorTargets: [{ view: color, loadOp: "load" }],
        depthTarget: { view: depth, depthClearValue: 1 },
      }).plan,
    ).toEqual({
      colorAttachments: [{ view: color, loadOp: "load", storeOp: "store" }],
      depthStencilAttachment: {
        view: depth,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });
  });

  it("diagnoses missing color targets", () => {
    expect(
      createRenderPassAttachmentPlan({ colorTargets: [] }).diagnostics,
    ).toMatchObject([{ code: "renderPassAttachment.missingColorTarget" }]);
    expect(
      createRenderPassAttachmentPlan({ colorTargets: [{ view: null }] })
        .diagnostics,
    ).toMatchObject([
      { code: "renderPassAttachment.missingColorTarget", targetIndex: 0 },
    ]);
  });

  it("diagnoses invalid color clear tuples", () => {
    expect(
      createRenderPassAttachmentPlan({
        colorTargets: [{ view: {}, clearColor: [0, 1, Number.NaN, 1] }],
      }).diagnostics,
    ).toMatchObject([
      { code: "renderPassAttachment.invalidClearColor", targetIndex: 0 },
    ]);
  });

  it("diagnoses invalid depth clear values", () => {
    expect(
      createRenderPassAttachmentPlan({
        colorTargets: [{ view: {} }],
        depthTarget: { view: {}, depthClearValue: 2 },
      }).diagnostics,
    ).toMatchObject([{ code: "renderPassAttachment.invalidDepthClear" }]);
  });
});
