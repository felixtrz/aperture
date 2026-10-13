import { resolveActiveEntity } from "../entities/lookup/resolve.js";
import { AppEntityTags } from "../systems/components.js";
import { PointerInteractionState, sameRef, } from "./pointer-events.js";
const DRAG_TYPES = [
    "dragStart",
    "drag",
    "dragEnd",
];
export function createInteractionAccess(world, options = {}) {
    const state = new PointerInteractionState(options);
    const registrations = new Map();
    function register(types, a, b) {
        const registration = b === undefined
            ? { filter: undefined, callback: a }
            : { filter: a, callback: b };
        for (const type of types) {
            const set = registrations.get(type) ?? new Set();
            set.add(registration);
            registrations.set(type, set);
        }
        return () => {
            for (const type of types) {
                registrations.get(type)?.delete(registration);
            }
        };
    }
    const on = (types) => (a, b) => register(types, a, b);
    let pickLayerMask = null;
    const access = {
        onEnter: on(["enter"]),
        onLeave: on(["leave"]),
        onDown: on(["down"]),
        onUp: on(["up"]),
        onClick: on(["click"]),
        onDrag: on(DRAG_TYPES),
        hoveredEntity: () => state.hoveredEntity,
        setPickLayerMask(layerMask) {
            pickLayerMask = layerMask;
        },
        get pickLayerMask() {
            return pickLayerMask;
        },
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
function matchFilter(world, filter, entity) {
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
function entityHasTag(world, ref, tag) {
    const resolved = resolveActiveEntity(world, ref);
    if (!resolved.ok || !resolved.entity.hasComponent(AppEntityTags)) {
        return false;
    }
    const raw = resolved.entity.getValue(AppEntityTags, "valuesJson");
    if (typeof raw !== "string" || raw.length === 0) {
        return false;
    }
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.includes(tag);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=access.js.map