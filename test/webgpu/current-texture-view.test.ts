import { describe, expect, it } from "vitest";

import {
  createCurrentTextureColorTarget,
  createOffscreenColorTarget,
} from "@aperture-engine/webgpu";

describe("current texture view acquisition", () => {
  it("creates color attachment target inputs from current texture views", () => {
    const view = { label: "view" };
    const texture = { createView: () => view };

    expect(
      createCurrentTextureColorTarget({
        context: { getCurrentTexture: () => texture },
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
      texture,
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

  it("creates color attachment target inputs from off-screen texture views", () => {
    const view = { label: "offscreen-view" };
    const texture = { createView: () => view };

    expect(
      createOffscreenColorTarget({
        texture,
        clearColor: [0.25, 0.5, 0.75, 1],
        loadOp: "clear",
        storeOp: "store",
      }),
    ).toEqual({
      valid: true,
      texture,
      target: {
        view,
        clearColor: [0.25, 0.5, 0.75, 1],
        loadOp: "clear",
        storeOp: "store",
      },
      diagnostics: [],
    });
  });

  it("diagnoses missing off-screen textures", () => {
    expect(createOffscreenColorTarget({ texture: null })).toMatchObject({
      valid: false,
      target: null,
      diagnostics: [{ code: "currentTextureView.missingTexture" }],
    });
  });
});
