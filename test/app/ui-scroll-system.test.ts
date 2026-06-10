import { describe, expect, it } from "vitest";
import { createParent, type Entity } from "@aperture-engine/simulation";
import {
  UiNode,
  UiPanel,
  UiScreen,
  UiScroll,
  createUiNode,
  createUiPanel,
  createUiScreen,
  createUiScroll,
} from "@aperture-engine/render";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, Parent } from "@aperture-engine/app/systems";
import {
  createApertureHeadlessRunner,
  type ApertureHeadlessRunner,
} from "@aperture-engine/app/headless";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";
import type { UiScrollInput } from "@aperture-engine/render";
import {
  advanceInputResource,
  type ApertureGeneratedInputEvent,
} from "../../packages/app/src/input/state.js";

// AI-47: the worker-side UiScroll wheel/drag mapping system. The scene is a
// 400x300 UiScreen with a 200x100 column scroll panel at (100, 50) holding
// three 60px-tall items — 180px of content in a 100px viewport, so the
// clamped scroll range is [0, 80]. Pointer/wheel input flows through
// advanceInputResource exactly like the generated worker's per-frame drain.

interface ScrollSceneRefs {
  panel: Entity | null;
}

const SCREEN = { width: 400, height: 300 } as const;
const PANEL = { x: 100, y: 50, width: 200, height: 100 } as const;
const ITEM_COUNT = 3;
const ITEM_HEIGHT = 60;
const MAX_SCROLL_Y = ITEM_COUNT * ITEM_HEIGHT - PANEL.height; // 180 content - 100 viewport = 80

/** Normalized pointer position over the middle of the scroll panel. */
const OVER_PANEL: readonly [number, number] = [0.5, 1 / 3];
/** Normalized pointer position outside every UI rect. */
const OFF_PANEL: readonly [number, number] = [0.05, 0.05];

function scrollScene(
  refs: ScrollSceneRefs,
  scroll: UiScrollInput = {},
): ApertureSystemModule {
  return {
    default: class UiScrollSceneSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        const screen = this.createEntity();
        screen.addComponent(UiScreen, createUiScreen(SCREEN));

        const panel = this.createEntity();
        panel.addComponent(Parent, createParent(screen));
        panel.addComponent(
          UiNode,
          createUiNode({ ...PANEL, layoutMode: "column" }),
        );
        panel.addComponent(UiPanel, createUiPanel());
        panel.addComponent(UiScroll, createUiScroll(scroll));

        for (let index = 0; index < ITEM_COUNT; index += 1) {
          const item = this.createEntity();
          item.addComponent(Parent, createParent(panel));
          item.addComponent(UiNode, createUiNode({ height: ITEM_HEIGHT }));
          item.addComponent(UiPanel, createUiPanel());
        }

        refs.panel = panel;
      }
    },
  };
}

async function createScrollRunner(
  scroll: UiScrollInput = {},
): Promise<{ runner: ApertureHeadlessRunner; refs: ScrollSceneRefs }> {
  const refs: ScrollSceneRefs = { panel: null };
  const runner = await createApertureHeadlessRunner({
    config: defineApertureConfig({
      mode: "headless",
      systems: [],
      render: { defaultCamera: false, defaultLight: false },
    }),
    systems: [scrollScene(refs, scroll)],
  });

  return { runner, refs };
}

function stepWithInput(
  runner: ApertureHeadlessRunner,
  events: readonly ApertureGeneratedInputEvent[],
): void {
  // Mirror the generated worker loop: the per-frame input drain advances the
  // resource, then the app steps (which runs the interaction + scroll frame).
  advanceInputResource(runner.app.context.input, events);
  runner.step(1 / 60, 0);
}

function pointerAt(
  position: readonly [number, number],
  pressed?: boolean,
): ApertureGeneratedInputEvent {
  return {
    kind: "pointer",
    pointer: "primary",
    position,
    ...(pressed === undefined ? {} : { pressed }),
  };
}

function wheel(deltaX: number, deltaY: number): ApertureGeneratedInputEvent {
  return { kind: "wheel", deltaX, deltaY };
}

function offsetOf(refs: ScrollSceneRefs): readonly number[] {
  const panel = refs.panel;
  if (panel === null) {
    throw new Error("scroll scene did not capture the panel entity");
  }
  return Array.from(panel.getVectorView(UiScroll, "offset"));
}

describe("UiScroll wheel/drag mapping system (AI-47)", () => {
  it("advances the hovered scroll node's offset by the wheel delta and clamps to the content bound", async () => {
    const { runner, refs } = await createScrollRunner();

    expect(offsetOf(refs)).toEqual([0, 0]);

    // A downward wheel delta over the node maps 1:1 into the offset.
    stepWithInput(runner, [pointerAt(OVER_PANEL), wheel(0, 30)]);
    expect(offsetOf(refs)).toEqual([0, 30]);

    // A large delta clamps to content height - viewport height, not beyond.
    stepWithInput(runner, [wheel(0, 500)]);
    expect(offsetOf(refs)).toEqual([0, MAX_SCROLL_Y]);

    // Scrolling back up clamps at zero (no negative overscroll), and a
    // horizontal delta with no horizontal overflow stays clamped at zero.
    stepWithInput(runner, [wheel(50, -500)]);
    expect(offsetOf(refs)).toEqual([0, 0]);
  });

  it("ignores wheel deltas when the pointer is not over the scroll node", async () => {
    const { runner, refs } = await createScrollRunner();

    stepWithInput(runner, [pointerAt(OFF_PANEL), wheel(0, 40)]);

    expect(offsetOf(refs)).toEqual([0, 0]);
    expect(
      runner.app.context.diagnostics
        .list()
        .filter((d) => d.code === "aperture.interaction.uiScrollDisabled"),
    ).toEqual([]);
  });

  it("forwards wheel events but never mutates a disabled scroll node (loud-but-inert)", async () => {
    const { runner, refs } = await createScrollRunner({ enabled: false });

    stepWithInput(runner, [pointerAt(OVER_PANEL), wheel(0, 25)]);

    // The event is forwarded: the resource reports the per-frame delta...
    expect(runner.app.context.input.wheel.deltaY.value).toBe(25);
    // ...but the disabled node's offset never drifts, loudly:
    expect(offsetOf(refs)).toEqual([0, 0]);
    expect(runner.app.context.diagnostics.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "aperture.interaction.uiScrollDisabled",
          severity: "warning",
          data: expect.objectContaining({ gesture: "wheel" }),
        }),
      ]),
    );

    // The diagnostic reports once per node instead of spamming every frame.
    stepWithInput(runner, [wheel(0, 25)]);
    expect(offsetOf(refs)).toEqual([0, 0]);
    expect(
      runner.app.context.diagnostics
        .list()
        .filter((d) => d.code === "aperture.interaction.uiScrollDisabled"),
    ).toHaveLength(1);
  });

  it("maps an active pointer drag onto the offset with the same clamp", async () => {
    const { runner, refs } = await createScrollRunner();

    // Press over the panel: the drag arms but nothing moved yet.
    stepWithInput(runner, [pointerAt([0.5, 0.4], true)]);
    expect(offsetOf(refs)).toEqual([0, 0]);

    // Dragging the content upward by 0.1 of the 300px screen scrolls 30px.
    stepWithInput(runner, [pointerAt([0.5, 0.3])]);
    expect(offsetOf(refs)).toEqual([0, 30]);

    // Continuing past the content bound clamps at the max scroll.
    stepWithInput(runner, [pointerAt([0.5, 0.0])]);
    expect(offsetOf(refs)).toEqual([0, MAX_SCROLL_Y]);

    // Releasing ends the gesture; further movement no longer scrolls.
    stepWithInput(runner, [pointerAt([0.5, 0.2], false)]);
    stepWithInput(runner, [pointerAt([0.5, 0.6])]);
    expect(offsetOf(refs)).toEqual([0, MAX_SCROLL_Y]);

    // A drag that starts outside the panel never grabs it, even when the
    // pointer later crosses the panel while pressed.
    stepWithInput(runner, [pointerAt(OFF_PANEL, true)]);
    stepWithInput(runner, [pointerAt(OVER_PANEL)]);
    expect(offsetOf(refs)).toEqual([0, MAX_SCROLL_Y]);
  });
});
