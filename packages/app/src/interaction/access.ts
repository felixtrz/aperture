import type { EcsWorld } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
import { resolveActiveEntity } from "../entities/lookup/resolve.js";
import { AppEntityTags } from "../systems/components.js";
import {
  PointerInteractionState,
  sameRef,
  type PointerFrameInput,
  type PointerInteractionEvent,
  type PointerInteractionEventType,
  type PointerInteractionStateOptions,
} from "./pointer-events.js";

// M7-T8: the interaction accessor surfaced on ApertureSystemContext. App systems
// register flat per-entity pointer handlers (onEnter/onLeave/onDown/onUp/onClick/
// onDrag) filtered by entity ref, tag, or predicate; the interaction system drives
// processFrame() each frame to run the state machine and dispatch matching events.
// No bubbling/propagation (flat per-entity events) — documented as future work.

export type InteractionFilter =
  | EcsEntityRef
  | { readonly tag: string }
  | ((entity: EcsEntityRef) => boolean);

export type InteractionCallback = (event: PointerInteractionEvent) => void;

export type InteractionUnsubscribe = () => void;

export interface InteractionAccess {
  onEnter(callback: InteractionCallback): InteractionUnsubscribe;
  onEnter(
    filter: InteractionFilter,
    callback: InteractionCallback,
  ): InteractionUnsubscribe;
  onLeave(callback: InteractionCallback): InteractionUnsubscribe;
  onLeave(
    filter: InteractionFilter,
    callback: InteractionCallback,
  ): InteractionUnsubscribe;
  onDown(callback: InteractionCallback): InteractionUnsubscribe;
  onDown(
    filter: InteractionFilter,
    callback: InteractionCallback,
  ): InteractionUnsubscribe;
  onUp(callback: InteractionCallback): InteractionUnsubscribe;
  onUp(
    filter: InteractionFilter,
    callback: InteractionCallback,
  ): InteractionUnsubscribe;
  onClick(callback: InteractionCallback): InteractionUnsubscribe;
  onClick(
    filter: InteractionFilter,
    callback: InteractionCallback,
  ): InteractionUnsubscribe;
  /** Fires for dragStart / drag / dragEnd (discriminate via `event.type`). */
  onDrag(callback: InteractionCallback): InteractionUnsubscribe;
  onDrag(
    filter: InteractionFilter,
    callback: InteractionCallback,
  ): InteractionUnsubscribe;
  /** The entity currently under the pointer (null when nothing is hit). */
  hoveredEntity(): EcsEntityRef | null;
}

export interface InteractionRuntime extends InteractionAccess {
  processFrame(input: PointerFrameInput): readonly PointerInteractionEvent[];
}

interface Registration {
  readonly filter: InteractionFilter | undefined;
  readonly callback: InteractionCallback;
}

const DRAG_TYPES: readonly PointerInteractionEventType[] = [
  "dragStart",
  "drag",
  "dragEnd",
];

export function createInteractionAccess(
  world: EcsWorld,
  options: PointerInteractionStateOptions = {},
): InteractionRuntime {
  const state = new PointerInteractionState(options);
  const registrations = new Map<
    PointerInteractionEventType,
    Set<Registration>
  >();

  function register(
    types: readonly PointerInteractionEventType[],
    a: InteractionFilter | InteractionCallback,
    b: InteractionCallback | undefined,
  ): InteractionUnsubscribe {
    const registration: Registration =
      b === undefined
        ? { filter: undefined, callback: a as InteractionCallback }
        : { filter: a as InteractionFilter, callback: b };

    for (const type of types) {
      const set = registrations.get(type) ?? new Set<Registration>();
      set.add(registration);
      registrations.set(type, set);
    }

    return () => {
      for (const type of types) {
        registrations.get(type)?.delete(registration);
      }
    };
  }

  const on =
    (types: readonly PointerInteractionEventType[]) =>
    (
      a: InteractionFilter | InteractionCallback,
      b?: InteractionCallback,
    ): InteractionUnsubscribe =>
      register(types, a, b);

  const access: InteractionRuntime = {
    onEnter: on(["enter"]),
    onLeave: on(["leave"]),
    onDown: on(["down"]),
    onUp: on(["up"]),
    onClick: on(["click"]),
    onDrag: on(DRAG_TYPES),
    hoveredEntity: () => state.hoveredEntity,
    processFrame(input) {
      const events = state.update(input);
      for (const event of events) {
        const set = registrations.get(event.type);
        if (set === undefined) {
          continue;
        }
        for (const registration of set) {
          if (matchFilter(world, registration.filter, event.entity)) {
            registration.callback(event);
          }
        }
      }
      return events;
    },
  };

  return access;
}

function matchFilter(
  world: EcsWorld,
  filter: InteractionFilter | undefined,
  entity: EcsEntityRef,
): boolean {
  if (filter === undefined) {
    return true;
  }
  if (typeof filter === "function") {
    return filter(entity);
  }
  if ("tag" in filter) {
    return entityHasTag(world, entity, filter.tag);
  }
  return sameRef(filter, entity);
}

function entityHasTag(
  world: EcsWorld,
  ref: EcsEntityRef,
  tag: string,
): boolean {
  const resolved = resolveActiveEntity(world, ref);
  if (!resolved.ok || !resolved.entity.hasComponent(AppEntityTags)) {
    return false;
  }
  const raw = resolved.entity.getValue(AppEntityTags, "valuesJson");
  if (typeof raw !== "string" || raw.length === 0) {
    return false;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.includes(tag);
  } catch {
    return false;
  }
}
