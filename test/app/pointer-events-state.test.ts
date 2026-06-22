import { describe, expect, it } from "vitest";
import {
  PointerInteractionState,
  type PointerFrameInput,
} from "@aperture-engine/app/systems";

// M7-T8 Done-when #3: the pointer-event state machine discriminates click vs drag
// by movement threshold and edge-triggers enter/leave (no re-emit while hovered).

const refA = { index: 1, generation: 0 };
const refB = { index: 2, generation: 0 };
const point: readonly [number, number, number] = [0, 0, 0];

function frame(over: typeof refA | null): PointerFrameInput {
  return {
    position: [0.5, 0.5],
    pressed: false,
    time: 0,
    hitEntity: over,
    worldPoint: over === null ? null : point,
  };
}

function types(events: readonly { readonly type: string }[]): string[] {
  return events.map((event) => event.type);
}

describe("pointer interaction state machine (M7-T8)", () => {
  it("edge-triggers enter/leave and does not re-emit while the same entity stays hovered", () => {
    const state = new PointerInteractionState();

    expect(types(state.update(frame(refA)))).toEqual(["enter"]);
    // Same entity across frames -> no re-emit.
    expect(types(state.update(frame(refA)))).toEqual([]);
    // Hovered entity changes -> leave old, enter new.
    expect(types(state.update(frame(refB)))).toEqual(["leave", "enter"]);
    // Moving off everything -> leave only.
    expect(types(state.update(frame(null)))).toEqual(["leave"]);
    expect(types(state.update(frame(null)))).toEqual([]);
  });

  it("fires click for a sub-threshold press+release over the same entity", () => {
    const state = new PointerInteractionState({ dragThreshold: 0.05 });
    state.update(frame(refA));

    expect(
      types(
        state.update({
          position: [0.5, 0.5],
          pressed: true,
          time: 0.1,
          hitEntity: refA,
          worldPoint: point,
        }),
      ),
    ).toEqual(["down"]);

    const release = state.update({
      position: [0.51, 0.5],
      pressed: false,
      time: 0.2,
      hitEntity: refA,
      worldPoint: point,
    });
    expect(types(release)).toEqual(["up", "click"]);
    const click = release.find((event) => event.type === "click");
    expect(click?.entity).toEqual(refA);
  });

  it("fires dragStart/drag/dragEnd (and NOT click) once movement passes the threshold", () => {
    const state = new PointerInteractionState({ dragThreshold: 0.05 });
    state.update(frame(refA));
    state.update({
      position: [0.5, 0.5],
      pressed: true,
      time: 0.1,
      hitEntity: refA,
      worldPoint: point,
    });

    // Moved 0.1 in x (> 0.05) -> dragStart + drag.
    expect(
      types(
        state.update({
          position: [0.6, 0.5],
          pressed: true,
          time: 0.2,
          hitEntity: refA,
          worldPoint: [0.1, 0, 0],
        }),
      ),
    ).toEqual(["dragStart", "drag"]);

    // Drag off the entity -> leave + drag (still dragging the down target).
    expect(
      types(
        state.update({
          position: [0.7, 0.5],
          pressed: true,
          time: 0.3,
          hitEntity: null,
          worldPoint: null,
        }),
      ),
    ).toEqual(["leave", "drag"]);

    // Release -> up + dragEnd, never click.
    const release = state.update({
      position: [0.7, 0.5],
      pressed: false,
      time: 0.4,
      hitEntity: null,
      worldPoint: null,
    });
    expect(types(release)).toEqual(["up", "dragEnd"]);
    expect(types(release)).not.toContain("click");
  });
});
