import { describe, expect, it } from "vitest";

import { defineApertureConfig, input } from "@aperture-engine/app/config";
import {
  createGeneratedInputEventMessage,
  createInputSummary,
  drainGeneratedInputEventMessagesForFrame,
  isGeneratedInputEventMessage,
  type ApertureGeneratedInputEvent,
  type ApertureGeneratedInputEventMessage,
} from "../../packages/app/src/input/events.js";
import {
  advanceInputResource,
  createInputResource,
  type InputResourceBase,
} from "../../packages/app/src/input/state.js";

// AI-56 frame-stamping half (readiness roadmap R2.1): the same recorded
// event list applied twice must yield identical input state per frame, and
// future-stamped events must wait for exactly their frame.

function key(code: string, pressed: boolean): ApertureGeneratedInputEvent {
  return { kind: "keyboard", code, pressed };
}

function message(
  event: ApertureGeneratedInputEvent,
  frame?: number,
): ApertureGeneratedInputEventMessage {
  return createGeneratedInputEventMessage(event, frame);
}

function createResource(): InputResourceBase {
  return createInputResource(
    defineApertureConfig({
      mode: "headless",
      input: {
        actions: {
          jump: input.button([input.key("Space")]),
          throttle: input.axis1d([input.keyboard1d({ positive: ["KeyW"] })]),
        },
      },
    }),
  );
}

describe("frame-stamped input messages", () => {
  it("stamps and validates the optional frame field", () => {
    const unstamped = message(key("Space", true));
    const stamped = message(key("Space", true), 7);

    expect(unstamped.frame).toBeUndefined();
    expect(stamped.frame).toBe(7);
    expect(isGeneratedInputEventMessage(unstamped)).toBe(true);
    expect(isGeneratedInputEventMessage(stamped)).toBe(true);

    expect(isGeneratedInputEventMessage({ ...stamped, frame: -1 })).toBe(false);
    expect(isGeneratedInputEventMessage({ ...stamped, frame: 1.5 })).toBe(
      false,
    );
    expect(isGeneratedInputEventMessage({ ...stamped, frame: "2" })).toBe(
      false,
    );
  });

  it("validates wheel events through the same stamped-message path", () => {
    const wheel: ApertureGeneratedInputEvent = {
      kind: "wheel",
      deltaX: 2,
      deltaY: -3.5,
    };
    const unstamped = message(wheel);
    const stamped = message(wheel, 4);

    expect(isGeneratedInputEventMessage(unstamped)).toBe(true);
    expect(isGeneratedInputEventMessage(stamped)).toBe(true);
    expect(stamped.frame).toBe(4);

    // The frame-stamp validation applies to wheel messages unchanged.
    expect(isGeneratedInputEventMessage({ ...stamped, frame: -1 })).toBe(false);
    expect(isGeneratedInputEventMessage({ ...stamped, frame: 2.5 })).toBe(
      false,
    );

    // Wheel payloads must carry finite numeric deltas.
    expect(
      isGeneratedInputEventMessage({
        ...stamped,
        event: { kind: "wheel", deltaX: Number.NaN, deltaY: 0 },
      }),
    ).toBe(false);
    expect(
      isGeneratedInputEventMessage({
        ...stamped,
        event: { kind: "wheel", deltaY: 1 },
      }),
    ).toBe(false);
    expect(
      isGeneratedInputEventMessage({
        ...stamped,
        event: { kind: "wheel", deltaX: "2", deltaY: 1 },
      }),
    ).toBe(false);
  });

  it("drains a stamped wheel event at exactly its frame into the per-frame delta", () => {
    const resource = createResource();
    const pending = [message({ kind: "wheel", deltaX: 0, deltaY: 24 }, 2)];

    advanceInputResource(
      resource,
      drainGeneratedInputEventMessagesForFrame(pending, 1),
    );
    expect(resource.wheel.deltaY.value).toBe(0);
    expect(pending).toHaveLength(1);

    advanceInputResource(
      resource,
      drainGeneratedInputEventMessagesForFrame(pending, 2),
    );
    expect(resource.wheel.deltaY.value).toBe(24);
    expect(pending).toHaveLength(0);

    advanceInputResource(
      resource,
      drainGeneratedInputEventMessagesForFrame(pending, 3),
    );
    expect(resource.wheel.deltaY.value).toBe(0);
  });

  it("drains unstamped and due events in arrival order, keeping future events queued", () => {
    const pending = [
      message(key("KeyA", true)),
      message(key("KeyB", true), 2),
      message(key("KeyC", true), 1),
      message(key("KeyD", true)),
    ];

    const frameOne = drainGeneratedInputEventMessagesForFrame(pending, 1);
    expect(
      frameOne.map((event) => (event as { readonly code?: string }).code),
    ).toEqual(["KeyA", "KeyC", "KeyD"]);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.frame).toBe(2);

    const frameTwo = drainGeneratedInputEventMessagesForFrame(pending, 2);
    expect(
      frameTwo.map((event) => (event as { readonly code?: string }).code),
    ).toEqual(["KeyB"]);
    expect(pending).toHaveLength(0);

    expect(drainGeneratedInputEventMessagesForFrame(pending, 3)).toEqual([]);
  });

  it("drains stale-stamped events immediately so late deliveries are never dropped", () => {
    const pending = [message(key("Space", true), 1)];

    expect(drainGeneratedInputEventMessagesForFrame(pending, 5)).toHaveLength(
      1,
    );
    expect(pending).toHaveLength(0);
  });

  it("replays a recorded sequence into identical per-frame input state", () => {
    // A small recording: press W on frame 1, press Space on frame 2, release
    // both on frame 4 (frame 3 has no input).
    const recording: readonly ApertureGeneratedInputEventMessage[] = [
      message(key("KeyW", true), 1),
      message(key("Space", true), 2),
      message(key("KeyW", false), 4),
      message(key("Space", false), 4),
    ];

    const run = (): string[] => {
      const resource = createResource();
      const pending = [...recording];
      const summaries: string[] = [];

      for (let frame = 1; frame <= 5; frame += 1) {
        advanceInputResource(
          resource,
          drainGeneratedInputEventMessagesForFrame(pending, frame),
        );
        summaries.push(JSON.stringify(createInputSummary(resource)));
      }

      expect(pending).toHaveLength(0);
      return summaries;
    };

    const first = run();
    const second = run();

    expect(second).toEqual(first);

    // The recording is actually expressed in the state: throttle engages on
    // frame 1, jump on frame 2, both release on frame 4.
    const frames = first.map(
      (summary) =>
        JSON.parse(summary) as {
          readonly actions: Record<
            string,
            { readonly pressed?: boolean; readonly value?: number }
          >;
        },
    );
    expect(frames[0]?.actions["throttle"]?.value).toBe(1);
    expect(frames[0]?.actions["jump"]?.pressed).toBe(false);
    expect(frames[1]?.actions["jump"]?.pressed).toBe(true);
    expect(frames[2]?.actions["jump"]?.pressed).toBe(true);
    expect(frames[3]?.actions["jump"]?.pressed).toBe(false);
    expect(frames[3]?.actions["throttle"]?.value).toBe(0);
  });
});
