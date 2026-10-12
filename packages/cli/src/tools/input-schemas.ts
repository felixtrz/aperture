import { ApertureCliError } from "../errors.js";
import { schemaFailure } from "./schema-validation.js";

const axis = { type: "number", minimum: -1, maximum: 1 };
const stick = {
  type: "object",
  properties: { x: axis, y: axis },
  minProperties: 1,
  additionalProperties: false,
};

export function actionProperties(): Record<string, unknown> {
  return {
    action: { type: "string", minLength: 1 },
    pressed: { type: "boolean" },
    value: axis,
    x: axis,
    y: axis,
  };
}

export function gamepadProperties(): Record<string, unknown> {
  return {
    index: { type: "integer", minimum: 0 },
    mapping: { type: "string" },
    id: { type: "string" },
    connected: { type: "boolean" },
    button: {
      enum: [
        "south",
        "east",
        "west",
        "north",
        "leftBumper",
        "rightBumper",
        "select",
        "start",
        "leftStick",
        "rightStick",
        "dpadUp",
        "dpadDown",
        "dpadLeft",
        "dpadRight",
        "home",
        "leftTrigger",
        "rightTrigger",
      ],
    },
    pressed: { type: "boolean" },
    touched: { type: "boolean" },
    value: { type: "number", minimum: 0, maximum: 1 },
    axes: {
      anyOf: [
        { type: "array", maxItems: 4, items: axis },
        {
          type: "object",
          properties: {
            left: stick,
            right: stick,
            leftStick: stick,
            rightStick: stick,
          },
          additionalProperties: false,
        },
      ],
    },
    left: stick,
    right: stick,
    leftStick: stick,
    rightStick: stick,
  };
}

export function inputInjectionProperties(): Record<string, unknown> {
  const { action: _action, ...values } = actionProperties();
  return {
    pointer: {
      type: "object",
      description:
        "Primary pointer in normalized canvas coordinates [0,1], top-left origin.",
      properties: {
        position: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          items: { type: "number", minimum: 0, maximum: 1 },
        },
        pressed: { type: "boolean" },
      },
      minProperties: 1,
      additionalProperties: false,
    },
    actions: {
      type: "object",
      description:
        "Configured action name to boolean, axis1d number, or {pressed,value,x,y}.",
      minProperties: 1,
      additionalProperties: {
        anyOf: [
          { type: "boolean" },
          axis,
          {
            type: "object",
            properties: values,
            minProperties: 1,
            additionalProperties: false,
          },
        ],
      },
    },
    gamepad: {
      type: "object",
      properties: gamepadProperties(),
      additionalProperties: false,
    },
  };
}

/** Reject malformed composite input before any event can be queued. */
export function assertInputInjection(payload: Record<string, unknown>): void {
  const failure = schemaFailure(payload, {
    type: "object",
    properties: {
      ...inputInjectionProperties(),
      target: { enum: ["headed", "headless"] },
      appRoot: { type: "string" },
    },
    additionalProperties: false,
  });
  if (
    failure !== null ||
    !["pointer", "actions", "gamepad"].some((key) =>
      Object.hasOwn(payload, key),
    )
  ) {
    throw new ApertureCliError(
      "aperture.input.invalidInjection",
      `${failure ?? "input_inject requires pointer, actions, or gamepad."} Use input_get_state to discover configured actions; pass pointer: {position:[x,y],pressed}, actions: {name:value}, or gamepad: {left:{x,y}}.`,
    );
  }
}
