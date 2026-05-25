import { signal as createSignal, type Signal } from "@preact/signals-core";
import type {
  ApertureConfig,
  InputActionBinding,
  PointerBinding,
} from "./config.js";
import type { InputSignals } from "./systems.js";

export const APERTURE_GENERATED_INPUT_EVENT =
  "aperture.generated.inputEvent" as const;

export type ApertureGeneratedPointerName = "primary" | "secondary" | "middle";

export interface ApertureGeneratedPointerInputEvent {
  readonly kind: "pointer";
  readonly pointer: ApertureGeneratedPointerName;
  readonly position?: readonly [number, number];
  readonly pressed?: boolean;
}

export interface ApertureGeneratedKeyboardInputEvent {
  readonly kind: "keyboard";
  readonly key: string;
  readonly pressed: boolean;
}

export type ApertureGeneratedInputEvent =
  | ApertureGeneratedPointerInputEvent
  | ApertureGeneratedKeyboardInputEvent;

export interface ApertureGeneratedInputEventMessage {
  readonly type: typeof APERTURE_GENERATED_INPUT_EVENT;
  readonly event: ApertureGeneratedInputEvent;
}

export interface ApertureInputSummary {
  readonly actions: Record<
    string,
    {
      readonly pressed: boolean;
      readonly value: number;
    }
  >;
  readonly pointer: {
    readonly primary: {
      readonly position: readonly [number, number];
      readonly pressed: boolean;
    };
  };
  readonly keyboard: Record<string, boolean>;
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

  const event = value.event;
  if (!isRecord(event)) {
    return false;
  }

  if (event.kind === "pointer") {
    return (
      isPointerName(event.pointer) &&
      (event.position === undefined || isPosition(event.position)) &&
      (event.pressed === undefined || typeof event.pressed === "boolean")
    );
  }

  return (
    event.kind === "keyboard" &&
    typeof event.key === "string" &&
    event.key.length > 0 &&
    typeof event.pressed === "boolean"
  );
}

export function applyGeneratedInputEvent(input: {
  readonly signals: InputSignals;
  readonly config: ApertureConfig;
  readonly event: ApertureGeneratedInputEvent;
}): void {
  if (input.event.kind === "pointer") {
    applyPointerInputEvent(input.signals, input.config, input.event);
    return;
  }

  applyKeyboardInputEvent(input.signals, input.config, input.event);
}

export function createInputSummary(input: InputSignals): ApertureInputSummary {
  const actions: ApertureInputSummary["actions"] = {};

  for (const [name, signals] of Object.entries(input.actions)) {
    actions[name] = {
      pressed: signals.pressed.value,
      value: signals.value.value,
    };
  }

  const keyboard: Record<string, boolean> = {};
  for (const [key, signal] of Object.entries(input.keyboard)) {
    keyboard[key] = signal.value;
  }

  return {
    actions,
    pointer: {
      primary: {
        position: input.pointer.primary.position.value,
        pressed: input.pointer.primary.pressed.value,
      },
    },
    keyboard,
  };
}

function applyPointerInputEvent(
  input: InputSignals,
  config: ApertureConfig,
  event: ApertureGeneratedPointerInputEvent,
): void {
  if (event.pointer !== "primary") {
    return;
  }

  if (event.position !== undefined) {
    input.pointer.primary.position.value = [
      event.position[0],
      event.position[1],
    ];
  }

  if (event.pressed !== undefined) {
    input.pointer.primary.pressed.value = event.pressed;
  }

  if (event.pressed === undefined) {
    return;
  }

  for (const [name, bindings] of Object.entries(config.input?.actions ?? {})) {
    if (!bindings.some((binding) => isMatchingPointerBinding(binding, event))) {
      continue;
    }

    const action = input.actions[name];
    if (action === undefined) {
      continue;
    }

    action.pressed.value = event.pressed;
    action.value.value = event.pressed ? 1 : 0;
  }
}

function applyKeyboardInputEvent(
  input: InputSignals,
  config: ApertureConfig,
  event: ApertureGeneratedKeyboardInputEvent,
): void {
  const keyboard = input.keyboard as Record<string, Signal<boolean>>;
  const keySignal = keyboard[event.key] ?? createSignal(false);
  keyboard[event.key] = keySignal;
  keySignal.value = event.pressed;

  for (const [name, bindings] of Object.entries(config.input?.actions ?? {})) {
    if (
      !bindings.some((binding) => isMatchingKeyboardBinding(binding, event))
    ) {
      continue;
    }

    const action = input.actions[name];
    if (action === undefined) {
      continue;
    }

    action.pressed.value = event.pressed;
    action.value.value = event.pressed ? 1 : 0;
  }
}

function isMatchingPointerBinding(
  binding: InputActionBinding,
  event: ApertureGeneratedPointerInputEvent,
): binding is PointerBinding {
  return "pointer" in binding && binding.pointer === event.pointer;
}

function isMatchingKeyboardBinding(
  binding: InputActionBinding,
  event: ApertureGeneratedKeyboardInputEvent,
): boolean {
  return "keyboard" in binding && binding.keyboard === event.key;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
