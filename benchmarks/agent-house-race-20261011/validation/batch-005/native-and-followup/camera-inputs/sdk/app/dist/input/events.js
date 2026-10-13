import { advanceInputResource, createInputResourceSummary, } from "./state.js";
const APERTURE_GENERATED_INPUT_EVENT = "aperture.generated.inputEvent";
export function createGeneratedInputEventMessage(event, frame) {
    return {
        type: APERTURE_GENERATED_INPUT_EVENT,
        event,
        ...(frame === undefined ? {} : { frame }),
    };
}
export function isGeneratedInputEventMessage(value) {
    if (!isRecord(value) || value.type !== APERTURE_GENERATED_INPUT_EVENT) {
        return false;
    }
    if (value.frame !== undefined &&
        (typeof value.frame !== "number" ||
            !Number.isInteger(value.frame) ||
            value.frame < 0)) {
        return false;
    }
    return isGeneratedInputEvent(value.event);
}
/**
 * Deterministic per-frame drain: removes and returns (in arrival order) the
 * queued events that apply to `frame` — unstamped live events plus events
 * stamped with `frame <= current`. Future-stamped events stay queued so a
 * replay applies each event at exactly its recorded frame.
 */
export function drainGeneratedInputEventMessagesForFrame(pending, frame) {
    const drained = [];
    let writeIndex = 0;
    for (const message of pending) {
        if (message.frame === undefined || message.frame <= frame) {
            drained.push(message.event);
        }
        else {
            pending[writeIndex] = message;
            writeIndex += 1;
        }
    }
    pending.length = writeIndex;
    return drained;
}
export function applyGeneratedInputEvent(input) {
    void input.config;
    advanceInputResource(input.signals, [input.event]);
}
export function advanceGeneratedInputFrame(input) {
    void input.config;
    advanceInputResource(input.signals, input.events ?? []);
}
export function createInputSummary(input) {
    return createInputResourceSummary(input);
}
function isGeneratedInputEvent(value) {
    if (!isRecord(value)) {
        return false;
    }
    switch (value.kind) {
        case "pointer":
            return isGeneratedPointerInputEvent(value);
        case "keyboard":
            return isGeneratedKeyboardInputEvent(value);
        case "wheel":
            return isGeneratedWheelInputEvent(value);
        case "gamepad":
            return isGeneratedGamepadInputEvent(value);
        case "virtualAction":
            return isGeneratedVirtualActionInputEvent(value);
        case "reset":
            return (value.reason === undefined ||
                (typeof value.reason === "string" && value.reason.length > 0));
        case "batch":
            return (Array.isArray(value.events) &&
                value.events.every((event) => isGeneratedInputEvent(event)));
        default:
            return false;
    }
}
function isGeneratedPointerInputEvent(value) {
    if (!isRecord(value)) {
        return false;
    }
    return (isPointerName(value.pointer) &&
        (value.position === undefined || isPosition(value.position)) &&
        (value.pressed === undefined || typeof value.pressed === "boolean"));
}
function isGeneratedKeyboardInputEvent(value) {
    if (!isRecord(value)) {
        return false;
    }
    return ((typeof value.key === "string" ||
        typeof value.code === "string" ||
        value.key === undefined ||
        value.code === undefined) &&
        (typeof value.key === "string" || typeof value.code === "string") &&
        typeof value.pressed === "boolean");
}
function isGeneratedWheelInputEvent(value) {
    if (!isRecord(value)) {
        return false;
    }
    return isFiniteNumber(value.deltaX) && isFiniteNumber(value.deltaY);
}
function isGeneratedGamepadInputEvent(value) {
    if (!isRecord(value)) {
        return false;
    }
    return (Array.isArray(value.gamepads) &&
        value.gamepads.every((snapshot) => isGamepadSnapshot(snapshot)) &&
        (value.replace === undefined || typeof value.replace === "boolean"));
}
function isGeneratedVirtualActionInputEvent(value) {
    if (!isRecord(value)) {
        return false;
    }
    return (typeof value.action === "string" &&
        value.action.length > 0 &&
        (value.source === undefined || typeof value.source === "string") &&
        (value.pressed === undefined || typeof value.pressed === "boolean") &&
        (value.value === undefined ||
            typeof value.value === "boolean" ||
            isFiniteNumber(value.value)) &&
        (value.x === undefined || isFiniteNumber(value.x)) &&
        (value.y === undefined || isFiniteNumber(value.y)));
}
function isGamepadSnapshot(value) {
    if (!isRecord(value)) {
        return false;
    }
    return (Number.isInteger(value.index) &&
        Number(value.index) >= 0 &&
        (value.id === undefined || typeof value.id === "string") &&
        (value.mapping === undefined || typeof value.mapping === "string") &&
        (value.connected === undefined || typeof value.connected === "boolean") &&
        (value.buttons === undefined ||
            (Array.isArray(value.buttons) &&
                value.buttons.every((button) => isGamepadButtonSnapshot(button)))) &&
        (value.axes === undefined ||
            (Array.isArray(value.axes) && value.axes.every(isFiniteNumber))));
}
function isGamepadButtonSnapshot(value) {
    return (isRecord(value) &&
        (value.pressed === undefined || typeof value.pressed === "boolean") &&
        (value.touched === undefined || typeof value.touched === "boolean") &&
        (value.value === undefined || isFiniteNumber(value.value)));
}
function isPointerName(value) {
    return value === "primary" || value === "secondary" || value === "middle";
}
function isPosition(value) {
    return (Array.isArray(value) &&
        value.length === 2 &&
        value.every((entry) => typeof entry === "number" && Number.isFinite(entry)));
}
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
//# sourceMappingURL=events.js.map