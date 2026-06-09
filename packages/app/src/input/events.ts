import type { ApertureConfig } from "../config.js";
import {
  advanceInputResource,
  createInputResourceSummary,
  type ApertureGeneratedGamepadInputEvent,
  type ApertureGeneratedGamepadSnapshot,
  type ApertureGeneratedInputEvent,
  type ApertureGeneratedKeyboardInputEvent,
  type ApertureGeneratedPointerInputEvent,
  type ApertureGeneratedPointerName,
  type ApertureGeneratedVirtualActionInputEvent,
  type ApertureInputSummary,
  type InputResourceBase,
} from "./state.js";

const APERTURE_GENERATED_INPUT_EVENT =
  "aperture.generated.inputEvent" as const;

export type { ApertureGeneratedInputEvent, ApertureInputSummary };

export interface ApertureGeneratedInputEventMessage {
  readonly type: typeof APERTURE_GENERATED_INPUT_EVENT;
  readonly event: ApertureGeneratedInputEvent;
}

export function createGeneratedInputEventMessage(
  event: ApertureGeneratedInputEvent,
): ApertureGeneratedInputEventMessage {
  return {
    type: APERTURE_GENERATED_INPUT_EVENT,
    event,
  };
}

export function isGeneratedInputEventMessage(
  value: unknown,
): value is ApertureGeneratedInputEventMessage {
  if (!isRecord(value) || value.type !== APERTURE_GENERATED_INPUT_EVENT) {
    return false;
  }

  return isGeneratedInputEvent(value.event);
}

export function applyGeneratedInputEvent(input: {
  readonly signals: InputResourceBase;
  readonly config: ApertureConfig;
  readonly event: ApertureGeneratedInputEvent;
}): void {
  void input.config;
  advanceInputResource(input.signals, [input.event]);
}

export function advanceGeneratedInputFrame(input: {
  readonly signals: InputResourceBase;
  readonly config: ApertureConfig;
  readonly events?: readonly ApertureGeneratedInputEvent[];
}): void {
  void input.config;
  advanceInputResource(input.signals, input.events ?? []);
}

export function createInputSummary(
  input: InputResourceBase,
): ApertureInputSummary {
  return createInputResourceSummary(input);
}

function isGeneratedInputEvent(
  value: unknown,
): value is ApertureGeneratedInputEvent {
  if (!isRecord(value)) {
    return false;
  }

  switch (value.kind) {
    case "pointer":
      return isGeneratedPointerInputEvent(value);
    case "keyboard":
      return isGeneratedKeyboardInputEvent(value);
    case "gamepad":
      return isGeneratedGamepadInputEvent(value);
    case "virtualAction":
      return isGeneratedVirtualActionInputEvent(value);
    case "reset":
      return (
        value.reason === undefined ||
        (typeof value.reason === "string" && value.reason.length > 0)
      );
    case "batch":
      return (
        Array.isArray(value.events) &&
        value.events.every((event) => isGeneratedInputEvent(event))
      );
    default:
      return false;
  }
}

function isGeneratedPointerInputEvent(
  value: unknown,
): value is ApertureGeneratedPointerInputEvent {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPointerName(value.pointer) &&
    (value.position === undefined || isPosition(value.position)) &&
    (value.pressed === undefined || typeof value.pressed === "boolean")
  );
}

function isGeneratedKeyboardInputEvent(
  value: unknown,
): value is ApertureGeneratedKeyboardInputEvent {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (typeof value.key === "string" ||
      typeof value.code === "string" ||
      value.key === undefined ||
      value.code === undefined) &&
    (typeof value.key === "string" || typeof value.code === "string") &&
    typeof value.pressed === "boolean"
  );
}

function isGeneratedGamepadInputEvent(
  value: unknown,
): value is ApertureGeneratedGamepadInputEvent {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.gamepads) &&
    value.gamepads.every((snapshot) => isGamepadSnapshot(snapshot)) &&
    (value.replace === undefined || typeof value.replace === "boolean")
  );
}

function isGeneratedVirtualActionInputEvent(
  value: unknown,
): value is ApertureGeneratedVirtualActionInputEvent {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.action === "string" &&
    value.action.length > 0 &&
    (value.source === undefined || typeof value.source === "string") &&
    (value.pressed === undefined || typeof value.pressed === "boolean") &&
    (value.value === undefined ||
      typeof value.value === "boolean" ||
      isFiniteNumber(value.value)) &&
    (value.x === undefined || isFiniteNumber(value.x)) &&
    (value.y === undefined || isFiniteNumber(value.y))
  );
}

function isGamepadSnapshot(
  value: unknown,
): value is ApertureGeneratedGamepadSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isInteger(value.index) &&
    Number(value.index) >= 0 &&
    (value.id === undefined || typeof value.id === "string") &&
    (value.mapping === undefined || typeof value.mapping === "string") &&
    (value.connected === undefined || typeof value.connected === "boolean") &&
    (value.buttons === undefined ||
      (Array.isArray(value.buttons) &&
        value.buttons.every((button) => isGamepadButtonSnapshot(button)))) &&
    (value.axes === undefined ||
      (Array.isArray(value.axes) && value.axes.every(isFiniteNumber)))
  );
}

function isGamepadButtonSnapshot(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.pressed === undefined || typeof value.pressed === "boolean") &&
    (value.touched === undefined || typeof value.touched === "boolean") &&
    (value.value === undefined || isFiniteNumber(value.value))
  );
}

function isPointerName(value: unknown): value is ApertureGeneratedPointerName {
  return value === "primary" || value === "secondary" || value === "middle";
}

function isPosition(value: unknown): value is readonly [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
