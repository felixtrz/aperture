const DEFAULT_DRAG_THRESHOLD = 0.02;
export class PointerInteractionState {
    #dragThreshold;
    #hovered = null;
    #pressed = false;
    #down = null;
    constructor(options = {}) {
        this.#dragThreshold = options.dragThreshold ?? DEFAULT_DRAG_THRESHOLD;
    }
    get hoveredEntity() {
        return this.#hovered;
    }
    update(input) {
        const events = [];
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
                events.push(withPoint({ type: "enter", entity: hovered, position: input.position }, input.worldPoint));
            }
            this.#hovered = hovered;
        }
        // Press edge -> down (over a hit) or a no-op press (no down target).
        if (input.pressed && !this.#pressed) {
            this.#pressed = true;
            if (hovered !== null) {
                events.push(withPoint({ type: "down", entity: hovered, position: input.position }, input.worldPoint));
                this.#down = {
                    entity: hovered,
                    position: input.position,
                    point: input.worldPoint,
                    dragging: false,
                };
            }
            else {
                this.#down = null;
            }
        }
        else if (input.pressed && this.#pressed && this.#down !== null) {
            // Held — promote to drag once movement passes the threshold.
            const moved = distance2(input.position, this.#down.position);
            if (this.#down.dragging) {
                events.push(dragEvent("drag", this.#down, input.position, input.worldPoint));
            }
            else if (moved >= this.#dragThreshold) {
                this.#down.dragging = true;
                events.push(withPoint({
                    type: "dragStart",
                    entity: this.#down.entity,
                    position: input.position,
                }, this.#down.point));
                events.push(dragEvent("drag", this.#down, input.position, input.worldPoint));
            }
        }
        // Release edge -> up + (click | dragEnd).
        if (!input.pressed && this.#pressed) {
            this.#pressed = false;
            const down = this.#down;
            if (down !== null) {
                events.push(withPoint({ type: "up", entity: down.entity, position: input.position }, input.worldPoint));
                if (down.dragging) {
                    events.push(dragEvent("dragEnd", down, input.position, input.worldPoint));
                }
                else if (sameRef(hovered, down.entity)) {
                    events.push(withPoint({ type: "click", entity: down.entity, position: input.position }, input.worldPoint));
                }
                this.#down = null;
            }
        }
        return events;
    }
}
export function sameRef(a, b) {
    return (a !== null &&
        b !== null &&
        a.index === b.index &&
        a.generation === b.generation);
}
function withPoint(event, point) {
    return point === null ? event : { ...event, point };
}
function dragEvent(type, down, position, worldPoint) {
    const event = {
        type,
        entity: down.entity,
        position,
    };
    if (worldPoint === null) {
        return event;
    }
    const delta = down.point === null
        ? [0, 0, 0]
        : [
            worldPoint[0] - down.point[0],
            worldPoint[1] - down.point[1],
            worldPoint[2] - down.point[2],
        ];
    return { ...event, point: worldPoint, delta };
}
function distance2(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
//# sourceMappingURL=pointer-events.js.map