import type { EcsEntityRef } from "../config.js";

// M7-T8: headless/worker-safe pointer-on-object event state machine. It consumes
// the already-forwarded primary-pointer state (position/pressed) plus the per-frame
// picking result (hit entity + world point) and synthesizes flat per-entity events
// with cross-frame state: enter/leave (edge-triggered against the previous hovered
// entity), down/up, click (down+up over the same entity with sub-threshold movement)
// and drag (down + movement past the threshold; dragStart/drag/dragEnd with a
// world-space delta). No DOM listeners — pure ECS/interaction state. Click-vs-drag is
// discriminated by movement in normalized pointer space (frame-rate independent).

export type PointerInteractionEventType =
  | "enter"
  | "leave"
  | "down"
  | "up"
  | "click"
  | "dragStart"
  | "drag"
  | "dragEnd";

export interface PointerInteractionEvent {
  readonly type: PointerInteractionEventType;
  readonly entity: EcsEntityRef;
  readonly position: readonly [number, number];
  /**
   * World-space picking point for this frame — the hit entity's bounding-box entry
   * point, refined to the triangle-mesh surface when the entity uses
   * `Pickable.precision: "visual-mesh"`.
   */
  readonly point?: readonly [number, number, number];
  /** World-space delta from the drag origin (drag / dragEnd only). */
  readonly delta?: readonly [number, number, number];
}

export interface PointerFrameInput {
  readonly position: readonly [number, number];
  readonly pressed: boolean;
  readonly time: number;
  /** The entity under the pointer this frame (null when nothing is hit). */
  readonly hitEntity: EcsEntityRef | null;
  /**
   * World-space point for this frame — the hit entity's bounding-box entry point,
   * refined to the mesh surface for `Pickable.precision: "visual-mesh"` entities.
   */
  readonly worldPoint: readonly [number, number, number] | null;
}

export interface PointerInteractionStateOptions {
  /** Normalized pointer-space movement that promotes a press into a drag. */
  readonly dragThreshold?: number;
}

interface DownState {
  readonly entity: EcsEntityRef;
  readonly position: readonly [number, number];
  readonly point: readonly [number, number, number] | null;
  dragging: boolean;
}

const DEFAULT_DRAG_THRESHOLD = 0.02;

export class PointerInteractionState {
  readonly #dragThreshold: number;
  #hovered: EcsEntityRef | null = null;
  #pressed = false;
  #down: DownState | null = null;

  constructor(options: PointerInteractionStateOptions = {}) {
    this.#dragThreshold = options.dragThreshold ?? DEFAULT_DRAG_THRESHOLD;
  }

  get hoveredEntity(): EcsEntityRef | null {
    return this.#hovered;
  }

  update(input: PointerFrameInput): PointerInteractionEvent[] {
    const events: PointerInteractionEvent[] = [];
    const hovered = input.hitEntity;

    // Enter/leave — edge-triggered against the previous frame's hovered entity.
    if (!sameRef(hovered, this.#hovered)) {
      if (this.#hovered !== null) {
        events.push({
          type: "leave",
          entity: this.#hovered,
          position: input.position,
        });
      }
      if (hovered !== null) {
        events.push(
          withPoint(
            { type: "enter", entity: hovered, position: input.position },
            input.worldPoint,
          ),
        );
      }
      this.#hovered = hovered;
    }

    // Press edge -> down (over a hit) or a no-op press (no down target).
    if (input.pressed && !this.#pressed) {
      this.#pressed = true;
      if (hovered !== null) {
        events.push(
          withPoint(
            { type: "down", entity: hovered, position: input.position },
            input.worldPoint,
          ),
        );
        this.#down = {
          entity: hovered,
          position: input.position,
          point: input.worldPoint,
          dragging: false,
        };
      } else {
        this.#down = null;
      }
    } else if (input.pressed && this.#pressed && this.#down !== null) {
      // Held — promote to drag once movement passes the threshold.
      const moved = distance2(input.position, this.#down.position);
      if (this.#down.dragging) {
        events.push(
          dragEvent("drag", this.#down, input.position, input.worldPoint),
        );
      } else if (moved >= this.#dragThreshold) {
        this.#down.dragging = true;
        events.push(
          withPoint(
            {
              type: "dragStart",
              entity: this.#down.entity,
              position: input.position,
            },
            this.#down.point,
          ),
        );
        events.push(
          dragEvent("drag", this.#down, input.position, input.worldPoint),
        );
      }
    }

    // Release edge -> up + (click | dragEnd).
    if (!input.pressed && this.#pressed) {
      this.#pressed = false;
      const down = this.#down;
      if (down !== null) {
        events.push(
          withPoint(
            { type: "up", entity: down.entity, position: input.position },
            input.worldPoint,
          ),
        );
        if (down.dragging) {
          events.push(
            dragEvent("dragEnd", down, input.position, input.worldPoint),
          );
        } else if (sameRef(hovered, down.entity)) {
          events.push(
            withPoint(
              { type: "click", entity: down.entity, position: input.position },
              input.worldPoint,
            ),
          );
        }
        this.#down = null;
      }
    }

    return events;
  }
}

export function sameRef(
  a: EcsEntityRef | null,
  b: EcsEntityRef | null,
): boolean {
  return (
    a !== null &&
    b !== null &&
    a.index === b.index &&
    a.generation === b.generation
  );
}

function withPoint(
  event: PointerInteractionEvent,
  point: readonly [number, number, number] | null,
): PointerInteractionEvent {
  return point === null ? event : { ...event, point };
}

function dragEvent(
  type: "drag" | "dragEnd",
  down: DownState,
  position: readonly [number, number],
  worldPoint: readonly [number, number, number] | null,
): PointerInteractionEvent {
  const event: PointerInteractionEvent = {
    type,
    entity: down.entity,
    position,
  };
  if (worldPoint === null) {
    return event;
  }
  const delta: [number, number, number] =
    down.point === null
      ? [0, 0, 0]
      : [
          worldPoint[0] - down.point[0],
          worldPoint[1] - down.point[1],
          worldPoint[2] - down.point[2],
        ];
  return { ...event, point: worldPoint, delta };
}

function distance2(
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
