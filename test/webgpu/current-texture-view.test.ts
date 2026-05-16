import { describe, expect, it } from "vitest";

import { createCurrentTextureColorTarget } from "@aperture-engine/webgpu";

describe("current texture view acquisition", () => {
  it("creates color attachment target inputs from current texture views", () => {
    const view = { label: "view" };

    expect(
      createCurrentTextureColorTarget({
        context: { getCurrentTexture: () => ({ createView: () => view }) },
        clearColor: [0, 0, 0, 1],
        loadOp: "clear",
      }),
    ).toEqual({
      valid: true,
      target: {
        view,
        clearColor: [0, 0, 0, 1],
        loadOp: "clear",
      },
      diagnostics: [],
    });
  });

  it("diagnoses missing current textures", () => {
    expect(
      createCurrentTextureColorTarget({
        context: { getCurrentTexture: () => null },
      }),
    ).toMatchObject({
      valid: false,
      target: null,
      diagnostics: [{ code: "currentTextureView.missingCurrentTexture" }],
    });
  });

  it("diagnoses missing texture view support", () => {
    expect(
      createCurrentTextureColorTarget({
        context: { getCurrentTexture: () => ({}) },
      }),
    ).toMatchObject({
      valid: false,
      target: null,
      diagnostics: [{ code: "currentTextureView.missingTextureView" }],
    });
  });
});
