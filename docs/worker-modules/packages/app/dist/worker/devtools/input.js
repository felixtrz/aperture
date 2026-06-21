import { applyGeneratedInputEvent, createInputSummary, } from "../../input.js";
import { booleanFromValue, gamepadAxesFromPayload, isRecord, jsonSafeRecord, numberFromValue, standardGamepadButtonIndex, stringFromValue, } from "../payload.js";
export function callInputDevtoolsTool(app, tool, payload, options = {}) {
    if (tool === "input_action_set") {
        return callInputActionTool(app, payload, options);
    }
    if (tool === "input_gamepad_set") {
        return callInputGamepadTool(app, payload, options);
    }
    if (tool === "input_get_state") {
        return {
            ok: true,
            result: createInputSummary(app.context.input),
        };
    }
    if (tool === "input_reset") {
        applyOrEnqueueInputEvent(app, { kind: "reset", reason: "devtools" }, options);
        return {
            ok: true,
            result: createInputSummary(app.context.input),
        };
    }
    return null;
}
function callInputActionTool(app, payload, options) {
    const record = isRecord(payload) ? payload : {};
    const actionName = stringFromValue(record["action"]) ?? stringFromValue(record["name"]);
    if (actionName === undefined) {
        return {
            ok: false,
            diagnostics: [
                {
                    code: "aperture.input.actionMissing",
                    severity: "error",
                    message: "input_action_set requires an action name.",
                    data: jsonSafeRecord(record),
                    suggestedFix: "Pass { action: '<name>', pressed: true } using an action from aperture.config.ts.",
                },
            ],
        };
    }
    const action = app.context.input.actions[actionName];
    if (action === undefined) {
        return {
            ok: false,
            diagnostics: [
                {
                    code: "aperture.input.actionNotFound",
                    severity: "error",
                    message: `Input action '${actionName}' is not defined in aperture.config.ts.`,
                    data: {
                        action: actionName,
                        available: Object.keys(app.context.input.actions),
                    },
                    suggestedFix: "Use one of the configured input action names or add the action to aperture.config.ts.",
                },
            ],
        };
    }
    const value = numberFromValue(record["value"]);
    const pressed = booleanFromValue(record["pressed"]) ??
        (value === undefined && action.kind === "button" ? true : undefined);
    const x = numberFromValue(record["x"]);
    const y = numberFromValue(record["y"]);
    applyOrEnqueueInputEvent(app, {
        kind: "virtualAction",
        action: actionName,
        source: "devtools",
        ...(pressed === undefined ? {} : { pressed }),
        ...(value === undefined ? {} : { value }),
        ...(x === undefined ? {} : { x }),
        ...(y === undefined ? {} : { y }),
    }, options);
    return {
        ok: true,
        result: {
            action: actionName,
            queued: options.enqueueInputEvent !== undefined,
            ...(action.kind === "button"
                ? {
                    pressed: action.pressed.value,
                    value: action.value.value ? 1 : 0,
                }
                : action.kind === "axis1d"
                    ? { value: action.value.value }
                    : { x: action.x.value, y: action.y.value }),
            input: createInputSummary(app.context.input),
        },
    };
}
function callInputGamepadTool(app, payload, options) {
    const record = isRecord(payload) ? payload : {};
    const index = Math.max(0, Math.floor(numberFromValue(record["index"]) ?? 0));
    const mapping = stringFromValue(record["mapping"]) ?? "standard";
    const buttons = Array.from({ length: 17 }, () => ({
        pressed: false,
        touched: false,
        value: 0,
    }));
    const button = stringFromValue(record["button"]);
    if (button !== undefined) {
        const buttonIndex = standardGamepadButtonIndex(button);
        if (buttonIndex === null) {
            return {
                ok: false,
                diagnostics: [
                    {
                        code: "aperture.input.unsupportedGamepadButton",
                        severity: "error",
                        message: `Unsupported standard gamepad button '${button}'.`,
                        data: { button },
                        suggestedFix: "Use a standard gamepad button such as south, east, west, north, leftBumper, rightBumper, select, start, or dpadUp.",
                    },
                ],
            };
        }
        const value = numberFromValue(record["value"]);
        const pressed = booleanFromValue(record["pressed"]) ??
            (value === undefined ? true : value > 0);
        buttons[buttonIndex] = {
            pressed,
            touched: booleanFromValue(record["touched"]) ?? pressed,
            value: value ?? (pressed ? 1 : 0),
        };
    }
    applyOrEnqueueInputEvent(app, {
        kind: "gamepad",
        replace: false,
        gamepads: [
            {
                index,
                id: stringFromValue(record["id"]) ?? `devtools-gamepad-${index}`,
                mapping,
                connected: booleanFromValue(record["connected"]) ?? true,
                buttons,
                axes: gamepadAxesFromPayload(record),
            },
        ],
    }, options);
    const summary = createInputSummary(app.context.input);
    return {
        ok: summary.diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
        result: {
            index,
            input: summary,
        },
        diagnostics: summary.diagnostics,
    };
}
function applyOrEnqueueInputEvent(app, event, options) {
    if (options.enqueueInputEvent !== undefined) {
        options.enqueueInputEvent(event);
        return;
    }
    applyGeneratedInputEvent({
        signals: app.context.input,
        config: app.config,
        event,
    });
}
//# sourceMappingURL=input.js.map