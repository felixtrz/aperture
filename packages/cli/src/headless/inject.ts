import type { InputSignals } from "@aperture-engine/app/systems";
import type { ApertureGeneratedInputEvent } from "@aperture-engine/app/input";
import { ApertureCliError } from "../errors.js";

// A single timed input mutation applied before a fixed step. `atFrame` selects
// which step it runs before (0-indexed); omit it for frame 0.
export interface ApertureHeadlessInjectStep {
  readonly atFrame?: number;
  readonly pointer?: {
    readonly position?: readonly [number, number];
    readonly pressed?: boolean;
  };
  /** Button action name → pressed state. */
  readonly actions?: Readonly<Record<string, boolean>>;
}

export function parseApertureHeadlessInject(
  raw: string,
): ApertureHeadlessInjectStep[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error: unknown) {
    throw new ApertureCliError(
      "aperture.headless.invalidInject",
      `Inject file must be valid JSON. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const steps = Array.isArray(parsed) ? parsed : [parsed];

  return steps.map((step, index) => validateInjectStep(step, index));
}

export function parseApertureHeadlessInjectStep(
  value: unknown,
  index = 0,
): ApertureHeadlessInjectStep {
  return validateInjectStep(value, index);
}

export function applyApertureHeadlessInjectStep(
  input: InputSignals,
  step: ApertureHeadlessInjectStep,
): void {
  if (step.pointer?.position !== undefined) {
    input.pointer.primary.position.value = [
      step.pointer.position[0],
      step.pointer.position[1],
    ];
  }

  if (step.pointer?.pressed !== undefined) {
    input.pointer.primary.pressed.value = step.pointer.pressed;
  }

  if (step.actions !== undefined) {
    assertInjectActionsDriveButtons(input, step.actions);
    for (const [name, pressed] of Object.entries(step.actions)) {
      const action = input.actions[name];
      if (action?.kind === "button") {
        action.pressed.value = pressed;
      }
    }
  }
}

/**
 * Validate that every injected action exists and is a button. Inject only
 * carries pressed/released semantics, so an axis/analog action would be
 * silently ignored downstream — fail loudly instead (#69), matching the
 * diagnostic the interactive input_action_set path already emits.
 */
export function assertInjectActionsDriveButtons(
  input: Pick<InputSignals, "actions">,
  actions: Readonly<Record<string, boolean>>,
): void {
  for (const name of Object.keys(actions)) {
    const action = input.actions[name];

    if (action === undefined) {
      throw new ApertureCliError(
        "aperture.headless.invalidInject",
        `Unknown input action '${name}'. Available actions: ${
          Object.keys(input.actions).join(", ") || "(none)"
        }.`,
      );
    }

    if (action.kind !== "button") {
      throw new ApertureCliError(
        "aperture.headless.invalidInject",
        `Input action '${name}' is a ${action.kind} action; inject only drives button actions as pressed/released. ` +
          `Drive an axis/analog action with the 'input_action_set' tool ({ action: '${name}', x, y }) ` +
          `or hold it via 'input_gamepad_set'.`,
      );
    }
  }
}

export function createApertureHeadlessInjectEvents(
  step: ApertureHeadlessInjectStep,
): ApertureGeneratedInputEvent[] {
  const events: ApertureGeneratedInputEvent[] = [];

  if (step.pointer !== undefined) {
    events.push({
      kind: "pointer",
      pointer: "primary",
      ...(step.pointer.position === undefined
        ? {}
        : { position: step.pointer.position }),
      ...(step.pointer.pressed === undefined
        ? {}
        : { pressed: step.pointer.pressed }),
    });
  }

  if (step.actions !== undefined) {
    for (const [action, pressed] of Object.entries(step.actions)) {
      events.push({
        kind: "virtualAction",
        action,
        pressed,
      });
    }
  }

  return events;
}

function validateInjectStep(
  value: unknown,
  index: number,
): ApertureHeadlessInjectStep {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApertureCliError(
      "aperture.headless.invalidInject",
      `Inject step ${index} must be a JSON object.`,
    );
  }

  const record = value as Record<string, unknown>;
  const step: {
    atFrame?: number;
    pointer?: { position?: readonly [number, number]; pressed?: boolean };
    actions?: Record<string, boolean>;
  } = {};

  if (record["atFrame"] !== undefined) {
    if (
      typeof record["atFrame"] !== "number" ||
      !Number.isInteger(record["atFrame"]) ||
      record["atFrame"] < 0
    ) {
      throw new ApertureCliError(
        "aperture.headless.invalidInject",
        `Inject step ${index} 'atFrame' must be a non-negative integer.`,
      );
    }

    step.atFrame = record["atFrame"];
  }

  if (record["pointer"] !== undefined) {
    step.pointer = validateInjectPointer(record["pointer"], index);
  }

  if (record["actions"] !== undefined) {
    step.actions = validateInjectActions(record["actions"], index);
  }

  return step;
}

function validateInjectPointer(
  value: unknown,
  index: number,
): { position?: readonly [number, number]; pressed?: boolean } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApertureCliError(
      "aperture.headless.invalidInject",
      `Inject step ${index} 'pointer' must be an object.`,
    );
  }

  const record = value as Record<string, unknown>;
  const pointer: { position?: readonly [number, number]; pressed?: boolean } =
    {};

  if (record["position"] !== undefined) {
    const position = record["position"];

    if (
      !Array.isArray(position) ||
      position.length !== 2 ||
      typeof position[0] !== "number" ||
      typeof position[1] !== "number"
    ) {
      throw new ApertureCliError(
        "aperture.headless.invalidInject",
        `Inject step ${index} 'pointer.position' must be a [x, y] number pair.`,
      );
    }

    pointer.position = [position[0], position[1]];
  }

  if (record["pressed"] !== undefined) {
    if (typeof record["pressed"] !== "boolean") {
      throw new ApertureCliError(
        "aperture.headless.invalidInject",
        `Inject step ${index} 'pointer.pressed' must be a boolean.`,
      );
    }

    pointer.pressed = record["pressed"];
  }

  return pointer;
}

function validateInjectActions(
  value: unknown,
  index: number,
): Record<string, boolean> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApertureCliError(
      "aperture.headless.invalidInject",
      `Inject step ${index} 'actions' must be an object of action → boolean.`,
    );
  }

  const actions: Record<string, boolean> = {};

  for (const [name, pressed] of Object.entries(value)) {
    if (typeof pressed !== "boolean") {
      throw new ApertureCliError(
        "aperture.headless.invalidInject",
        `Inject step ${index} action '${name}' must be a boolean.`,
      );
    }

    actions[name] = pressed;
  }

  return actions;
}
