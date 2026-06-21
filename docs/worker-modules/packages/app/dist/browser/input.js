import { createGeneratedInputEventMessage, } from "../input.js";
export const APERTURE_GENERATED_VIRTUAL_INPUT_EVENT = "aperture.generated.virtualAction";
export function dispatchApertureInputAction(action, input = true, scope = globalThis) {
    const detail = typeof input === "boolean"
        ? { action, pressed: input }
        : typeof input === "number"
            ? { action, value: input }
            : { action, ...input };
    scope.dispatchEvent(new CustomEvent(APERTURE_GENERATED_VIRTUAL_INPUT_EVENT, {
        detail,
    }));
}
export function installGeneratedInputForwarding(canvas, worker, status, config) {
    if (!canvas.hasAttribute("tabindex")) {
        canvas.tabIndex = 0;
    }
    canvas.addEventListener("pointermove", (event) => {
        forwardInput(worker, status, {
            kind: "pointer",
            pointer: "primary",
            position: pointerPosition(canvas, event),
        });
    });
    canvas.addEventListener("pointerdown", (event) => {
        const pointer = pointerNameFromButton(event.button);
        if (pointer === null) {
            return;
        }
        canvas.focus();
        safelySetPointerCapture(canvas, event.pointerId);
        forwardInput(worker, status, {
            kind: "pointer",
            pointer,
            position: pointerPosition(canvas, event),
            pressed: true,
        });
    });
    canvas.addEventListener("pointerup", (event) => {
        const pointer = pointerNameFromButton(event.button);
        if (pointer === null) {
            return;
        }
        safelyReleasePointerCapture(canvas, event.pointerId);
        forwardInput(worker, status, {
            kind: "pointer",
            pointer,
            position: pointerPosition(canvas, event),
            pressed: false,
        });
    });
    const releasePointer = (event) => {
        const position = pointerPosition(canvas, event);
        for (const pointer of GENERATED_POINTER_BUTTONS) {
            forwardInput(worker, status, {
                kind: "pointer",
                pointer,
                position,
                pressed: false,
            });
        }
    };
    canvas.addEventListener("pointercancel", releasePointer);
    canvas.addEventListener("pointerleave", releasePointer);
    canvas.addEventListener("lostpointercapture", releasePointer);
    canvas.addEventListener("wheel", (event) => {
        // The wheel drives in-app scroll/zoom (worker-side UiScroll mapping),
        // so keep the page from scrolling underneath the canvas.
        event.preventDefault();
        forwardInput(worker, status, {
            kind: "wheel",
            deltaX: wheelDeltaPixels(event.deltaX, event.deltaMode),
            deltaY: wheelDeltaPixels(event.deltaY, event.deltaMode),
        });
    }, { passive: false });
    window.addEventListener("keydown", (event) => {
        if (event.repeat) {
            return;
        }
        forwardInput(worker, status, {
            kind: "keyboard",
            key: event.code || event.key,
            pressed: true,
        });
    });
    window.addEventListener("keyup", (event) => {
        forwardInput(worker, status, {
            kind: "keyboard",
            key: event.code || event.key,
            pressed: false,
        });
    });
    window.addEventListener(APERTURE_GENERATED_VIRTUAL_INPUT_EVENT, (event) => {
        const inputEvent = virtualActionEventFromDetail(event.detail);
        if (inputEvent === null) {
            return;
        }
        forwardInput(worker, status, inputEvent);
    });
    window.addEventListener("blur", () => {
        forwardInputReset(worker, status, "window-blur");
    });
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            forwardInputReset(worker, status, "document-hidden");
        }
    });
    installGeneratedGamepadPolling(worker, status, config);
}
function safelySetPointerCapture(canvas, pointerId) {
    try {
        canvas.setPointerCapture?.(pointerId);
    }
    catch {
        // Pointer capture can be rejected for synthetic, already-released, or
        // pointer-lock-transition events. Input forwarding must still continue.
    }
}
function safelyReleasePointerCapture(canvas, pointerId) {
    try {
        canvas.releasePointerCapture?.(pointerId);
    }
    catch {
        // Release is best-effort for the same browser paths as capture.
    }
}
const GENERATED_POINTER_BUTTONS = [
    "primary",
    "secondary",
    "middle",
];
function pointerNameFromButton(button) {
    switch (button) {
        case 0:
            return "primary";
        case 1:
            return "middle";
        case 2:
            return "secondary";
        default:
            return null;
    }
}
function forwardInput(worker, status, event) {
    worker.postMessage(createGeneratedInputEventMessage(event));
    status.forwardedInputEvents += 1;
    status.lastInputEvent = event;
}
function forwardInputReset(worker, status, reason) {
    status.lastInputReset = reason;
    forwardInput(worker, status, {
        kind: "reset",
        reason,
    });
}
function installGeneratedGamepadPolling(worker, status, config) {
    if (typeof navigator.getGamepads !== "function") {
        return;
    }
    let lastConnected = 0;
    let polling = false;
    const shouldListen = configUsesGamepads(config);
    const startPolling = () => {
        if (polling) {
            return;
        }
        polling = true;
        requestAnimationFrame(poll);
    };
    const poll = () => {
        const gamepads = browserGamepadSnapshots();
        const shouldForward = gamepads.length > 0 || lastConnected > 0;
        status.connectedGamepads = gamepads.length;
        if (shouldForward) {
            forwardInput(worker, status, {
                kind: "gamepad",
                replace: true,
                gamepads,
            });
            status.forwardedInputFrames += 1;
        }
        lastConnected = gamepads.length;
        if (gamepads.length === 0) {
            polling = false;
            armGamepadConnectedListener();
            return;
        }
        requestAnimationFrame(poll);
    };
    const armGamepadConnectedListener = () => {
        window.addEventListener("gamepadconnected", startPolling, {
            once: true,
        });
    };
    if (!shouldListen) {
        return;
    }
    if (browserGamepadSnapshots().length > 0) {
        startPolling();
    }
    else {
        armGamepadConnectedListener();
    }
}
function browserGamepadSnapshots() {
    return [...navigator.getGamepads()]
        .filter((gamepad) => gamepad !== null)
        .map((gamepad) => ({
        index: gamepad.index,
        id: gamepad.id,
        mapping: gamepad.mapping,
        connected: gamepad.connected,
        buttons: gamepad.buttons.map((button) => ({
            pressed: button.pressed,
            touched: button.touched,
            value: button.value,
        })),
        axes: [...gamepad.axes],
    }));
}
function virtualActionEventFromDetail(detail) {
    if (!isRecord(detail)) {
        return null;
    }
    const action = stringFromValue(detail["action"]);
    if (action === undefined) {
        return null;
    }
    const x = numberFromValue(detail["x"]);
    const y = numberFromValue(detail["y"]);
    return {
        kind: "virtualAction",
        action,
        source: stringFromValue(detail["source"]) ?? "browser",
        ...(typeof detail["pressed"] === "boolean"
            ? { pressed: detail["pressed"] }
            : {}),
        ...(typeof detail["value"] === "boolean" ||
            typeof detail["value"] === "number"
            ? { value: detail["value"] }
            : {}),
        ...(x === undefined ? {} : { x }),
        ...(y === undefined ? {} : { y }),
    };
}
function configUsesGamepads(config) {
    for (const descriptor of Object.values(config.input?.actions ?? {})) {
        const bindings = Array.isArray(descriptor)
            ? descriptor
            : "bindings" in descriptor
                ? descriptor.bindings
                : [];
        if (bindings.some((binding) => "gamepad" in binding ||
            ("kind" in binding && binding.kind.startsWith("gamepad")))) {
            return true;
        }
    }
    return false;
}
// Browsers report wheel travel in pixels, lines, or pages depending on the
// device/platform (WheelEvent.deltaMode). The worker only ever sees pixel
// deltas, so normalize the unit here — the sample values stay raw otherwise.
const WHEEL_LINE_DELTA_PIXELS = 16;
const WHEEL_PAGE_DELTA_PIXELS = 800;
function wheelDeltaPixels(delta, deltaMode) {
    if (!Number.isFinite(delta)) {
        return 0;
    }
    if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
        return delta * WHEEL_LINE_DELTA_PIXELS;
    }
    if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        return delta * WHEEL_PAGE_DELTA_PIXELS;
    }
    return delta;
}
function pointerPosition(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const x = rect.width <= 0 ? 0 : (event.clientX - rect.left) / rect.width;
    const y = rect.height <= 0 ? 0 : (event.clientY - rect.top) / rect.height;
    return [clamp01(x), clamp01(y)];
}
function clamp01(value) {
    return Math.min(1, Math.max(0, value));
}
function stringFromValue(value) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
function numberFromValue(value) {
    return Number.isFinite(value) ? value : undefined;
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
//# sourceMappingURL=input.js.map