import type { EcsWorld, Entity } from "@aperture-engine/simulation";
import {
  UiNode,
  UiScroll,
  type UiNodePacket,
  type UiRectPacket,
} from "@aperture-engine/render";
import type { EcsEntityRef } from "../config.js";
import { resolveActiveEntity } from "../entities/lookup/resolve.js";
import type { ApertureSystemContext } from "../systems/context.js";

// AI-47: the worker-side UiScroll wheel/drag mapping system. It runs inside the
// per-frame interaction driver (interaction/system.ts), reads the input
// resource's per-frame wheel delta plus the active primary-pointer drag, and
// writes a clamped UiScroll.offset on the hovered scroll node — the single ECS
// source of truth the render extraction (extraction-ui.ts readScrollOffset)
// already consumes. PlayCanvas semantics: per-frame wheel delta, offsets
// clamped to [0, maxScroll] (SCROLL_MODE_CLAMP); inertia decay is left out so
// the mapping stays a pure function of this frame's inputs (deterministic
// replay). Invariant 5: a gesture over a disabled scroll node mutates nothing
// and emits a structured diagnostic instead of silently drifting the offset.

export const UI_SCROLL_DISABLED_DIAGNOSTIC =
  "aperture.interaction.uiScrollDisabled";

type UiScrollGesture = "wheel" | "drag";

interface UiScrollDragState {
  readonly entity: EcsEntityRef;
  readonly screenId: number;
  /** Normalized pointer position the last applied drag step ended at. */
  readonly position: readonly [number, number];
}

interface UiScrollFrameState {
  pointerWasPressed: boolean;
  drag: UiScrollDragState | null;
  /** Entities already reported via the disabled diagnostic (warn once). */
  readonly warnedDisabled: Set<string>;
}

interface UiScrollLayoutIndex {
  readonly screens: Map<number, UiNodePacket>;
  readonly childrenByUiId: Map<number, UiNodePacket[]>;
  readonly byEntityKey: Map<string, UiNodePacket>;
  readonly nodes: readonly UiNodePacket[];
}

type UiScrollFrameContext = Pick<
  ApertureSystemContext,
  "world" | "input" | "diagnostics"
>;

const frameStates = new WeakMap<object, UiScrollFrameState>();

/**
 * Maps this frame's wheel delta and active pointer drag onto the hovered
 * UiScroll node's offset. Called by the interaction driver with the UI layout
 * it already extracted; worker-side ECS mutation only.
 */
export function runUiScrollFrame(
  context: UiScrollFrameContext,
  nodes: readonly UiNodePacket[],
): void {
  const world = context.world as EcsWorld;
  const state = frameStateFor(world);
  const position = context.input.pointer.primary.position.value;
  const pressed = context.input.pointer.primary.pressed.value;
  const wheelX = context.input.wheel.deltaX.value;
  const wheelY = context.input.wheel.deltaY.value;
  const pressEdge = pressed && !state.pointerWasPressed;
  state.pointerWasPressed = pressed;

  if (!pressed) {
    state.drag = null;
  }

  const hasWheel = wheelX !== 0 || wheelY !== 0;

  // Steady-state frames (no wheel travel, no press edge, no active drag) skip
  // the layout indexing entirely.
  if (!hasWheel && !pressEdge && state.drag === null) {
    return;
  }

  const layout = indexUiScrollLayout(nodes);

  if (hasWheel) {
    const hovered = topmostScrollNodeAt(world, layout, position);
    if (hovered !== null) {
      applyScrollDelta(world, context, layout, hovered, [wheelX, wheelY], {
        gesture: "wheel",
        state,
      });
    }
  }

  if (pressEdge) {
    const hovered = topmostScrollNodeAt(world, layout, position);
    state.drag =
      hovered === null
        ? null
        : {
            entity: hovered.entity,
            screenId: hovered.screenId,
            position,
          };
    return;
  }

  if (state.drag === null) {
    return;
  }

  const screen = layout.screens.get(state.drag.screenId);
  const packet = layout.byEntityKey.get(entityKey(state.drag.entity));

  if (screen === undefined || packet === undefined) {
    // The screen or scroll node is no longer extracted (destroyed or hidden);
    // the gesture simply ends.
    state.drag = null;
    return;
  }

  // The scrolled content follows the pointer: moving the pointer up scrolls
  // the content down (offset grows). Normalized pointer travel maps to screen
  // pixels through the owning UiScreen rect.
  const dragX = (state.drag.position[0] - position[0]) * screen.rect.width;
  const dragY = (state.drag.position[1] - position[1]) * screen.rect.height;

  if (dragX !== 0 || dragY !== 0) {
    applyScrollDelta(world, context, layout, packet, [dragX, dragY], {
      gesture: "drag",
      state,
    });
  }

  state.drag = { ...state.drag, position };
}

function frameStateFor(world: object): UiScrollFrameState {
  const existing = frameStates.get(world);

  if (existing !== undefined) {
    return existing;
  }

  const created: UiScrollFrameState = {
    pointerWasPressed: false,
    drag: null,
    warnedDisabled: new Set<string>(),
  };

  frameStates.set(world, created);
  return created;
}

function indexUiScrollLayout(
  nodes: readonly UiNodePacket[],
): UiScrollLayoutIndex {
  const screens = new Map<number, UiNodePacket>();
  const childrenByUiId = new Map<number, UiNodePacket[]>();
  const byEntityKey = new Map<string, UiNodePacket>();

  for (const node of nodes) {
    byEntityKey.set(entityKey(node.entity), node);

    if (node.kind === "screen") {
      screens.set(node.screenId, node);
    }

    if (node.parentUiId !== null) {
      const siblings = childrenByUiId.get(node.parentUiId) ?? [];
      siblings.push(node);
      childrenByUiId.set(node.parentUiId, siblings);
    }
  }

  return { screens, childrenByUiId, byEntityKey, nodes };
}

/**
 * The topmost (highest stack index) extracted node under the pointer whose
 * entity carries a UiScroll component. Disabled scroll nodes are still
 * candidates so a gesture over them is reported loud instead of falling
 * through to a node underneath.
 */
function topmostScrollNodeAt(
  world: EcsWorld,
  layout: UiScrollLayoutIndex,
  position: readonly [number, number],
): UiNodePacket | null {
  let best: UiNodePacket | null = null;

  for (const node of layout.nodes) {
    if (node.kind === "screen") {
      continue;
    }

    if (best !== null && node.stackIndex <= best.stackIndex) {
      continue;
    }

    const screen = layout.screens.get(node.screenId);

    if (screen === undefined) {
      continue;
    }

    const point = {
      x: screen.rect.x + position[0] * screen.rect.width,
      y: screen.rect.y + position[1] * screen.rect.height,
    };

    if (!pointInRect(point, node.rect) || !pointInRect(point, node.clip)) {
      continue;
    }

    const resolved = resolveActiveEntity(world, node.entity);

    if (resolved.ok && resolved.entity.hasComponent(UiScroll)) {
      best = node;
    }
  }

  return best;
}

function applyScrollDelta(
  world: EcsWorld,
  context: UiScrollFrameContext,
  layout: UiScrollLayoutIndex,
  packet: UiNodePacket,
  delta: readonly [number, number],
  options: { readonly gesture: UiScrollGesture; state: UiScrollFrameState },
): void {
  const resolved = resolveActiveEntity(world, packet.entity);

  if (!resolved.ok || !resolved.entity.hasComponent(UiScroll)) {
    return;
  }

  const entity = resolved.entity;

  if (entity.getValue(UiScroll, "enabled") === false) {
    warnDisabledOnce(context, options.state, packet.entity, options.gesture);
    return;
  }

  const offset = entity.getVectorView(UiScroll, "offset");
  const currentX = finiteOrZero(offset[0]);
  const currentY = finiteOrZero(offset[1]);
  const max = computeMaxScroll(entity, packet, layout);
  const nextX = clamp(currentX + finiteOrZero(delta[0]), 0, max[0]);
  const nextY = clamp(currentY + finiteOrZero(delta[1]), 0, max[1]);

  if (nextX !== currentX || nextY !== currentY) {
    offset[0] = nextX;
    offset[1] = nextY;
  }
}

/**
 * PlayCanvas SCROLL_MODE_CLAMP equivalent: the offset stays within
 * [0, contentExtent - viewport]. The content extent is the union of the
 * scroll node's extracted subtree rects with the current scroll shift undone;
 * descendants that clip their own children contribute only their own rect.
 */
function computeMaxScroll(
  entity: Entity,
  packet: UiNodePacket,
  layout: UiScrollLayoutIndex,
): readonly [number, number] {
  const padding = readPadding(entity);
  const viewportWidth = Math.max(
    0,
    packet.rect.width - padding[1] - padding[3],
  );
  const viewportHeight = Math.max(
    0,
    packet.rect.height - padding[0] - padding[2],
  );
  const extent = subtreeExtent(layout, packet.uiId);

  if (extent === null) {
    return [0, 0];
  }

  // Child rects were laid out shifted by -scrollOffset (the offset the layout
  // was extracted with); undo that shift to recover the unscrolled content
  // edges relative to the content origin.
  const contentWidth =
    extent.maxX + packet.scrollOffset[0] - (packet.rect.x + padding[3]);
  const contentHeight =
    extent.maxY + packet.scrollOffset[1] - (packet.rect.y + padding[0]);

  return [
    Math.max(0, contentWidth - viewportWidth),
    Math.max(0, contentHeight - viewportHeight),
  ];
}

function subtreeExtent(
  layout: UiScrollLayoutIndex,
  uiId: number,
): { readonly maxX: number; readonly maxY: number } | null {
  const children = layout.childrenByUiId.get(uiId);

  if (children === undefined || children.length === 0) {
    return null;
  }

  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const visit = (node: UiNodePacket): void => {
    maxX = Math.max(maxX, node.rect.x + node.rect.width);
    maxY = Math.max(maxY, node.rect.y + node.rect.height);

    // A descendant that clips its children (clip:true or its own enabled
    // scroll) bounds its subtree to its own rect, so stop descending.
    if (node.clipsChildren) {
      return;
    }

    for (const child of layout.childrenByUiId.get(node.uiId) ?? []) {
      visit(child);
    }
  };

  for (const child of children) {
    visit(child);
  }

  return { maxX, maxY };
}

function warnDisabledOnce(
  context: UiScrollFrameContext,
  state: UiScrollFrameState,
  entity: EcsEntityRef,
  gesture: UiScrollGesture,
): void {
  const key = entityKey(entity);

  if (state.warnedDisabled.has(key)) {
    return;
  }

  state.warnedDisabled.add(key);
  context.diagnostics.warn(UI_SCROLL_DISABLED_DIAGNOSTIC, {
    entity: { index: entity.index, generation: entity.generation },
    gesture,
    suggestedFix:
      "Set UiScroll.enabled to true on the node (or remove its UiScroll component) to make it scrollable.",
  });
}

function entityKey(entity: EcsEntityRef): string {
  return `${entity.index}:${entity.generation}`;
}

function pointInRect(
  point: { readonly x: number; readonly y: number },
  rect: UiRectPacket,
): boolean {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.width &&
    point.y <= rect.y + rect.height
  );
}

function readPadding(
  entity: Entity,
): readonly [number, number, number, number] {
  if (!entity.hasComponent(UiNode)) {
    return [0, 0, 0, 0];
  }

  const value = entity.getVectorView(UiNode, "padding");

  return [
    Math.max(0, finiteOrZero(value[0])),
    Math.max(0, finiteOrZero(value[1])),
    Math.max(0, finiteOrZero(value[2])),
    Math.max(0, finiteOrZero(value[3])),
  ];
}

function finiteOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
