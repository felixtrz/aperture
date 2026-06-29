import { jsonSafeValue } from "../internal/json-safe.js";

export { jsonSafeValue } from "../internal/json-safe.js";

export function tuple3FromValue(
  value: unknown,
): readonly [number, number, number] | null {
  return Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
    ? [value[0] as number, value[1] as number, value[2] as number]
    : null;
}

export function tuple4FromValue(
  value: unknown,
): readonly [number, number, number, number] | null {
  return Array.isArray(value) &&
    value.length === 4 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
    ? [
        value[0] as number,
        value[1] as number,
        value[2] as number,
        value[3] as number,
      ]
    : null;
}

export function tuple3FromView(
  view: ArrayLike<number>,
): readonly [number, number, number] {
  return [view[0] ?? 0, view[1] ?? 0, view[2] ?? 0];
}

export function tuple4FromView(
  view: ArrayLike<number>,
): readonly [number, number, number, number] {
  return [view[0] ?? 0, view[1] ?? 0, view[2] ?? 0, view[3] ?? 0];
}

export function jsonSafeRecord(
  value: unknown,
): Readonly<Record<string, unknown>> {
  const safe = jsonSafeValue(value);
  return isRecord(safe) ? safe : {};
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function stringFromValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function stringArrayFromValue(
  value: unknown,
): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const strings = value.filter(
    (entry): entry is string => typeof entry === "string",
  );
  return strings.length === 0 ? undefined : strings;
}

export function standardGamepadButtonIndex(button: string): number | null {
  const indices: Readonly<Record<string, number>> = {
    south: 0,
    east: 1,
    west: 2,
    north: 3,
    leftBumper: 4,
    rightBumper: 5,
    leftTrigger: 6,
    rightTrigger: 7,
    select: 8,
    start: 9,
    leftStick: 10,
    rightStick: 11,
    dpadUp: 12,
    dpadDown: 13,
    dpadLeft: 14,
    dpadRight: 15,
    home: 16,
  };

  return indices[button] ?? null;
}

export function gamepadAxesFromPayload(
  record: Record<string, unknown>,
): readonly number[] {
  const directAxes = Array.isArray(record["axes"]) ? record["axes"] : [];
  const axes = [0, 0, 0, 0];

  for (let index = 0; index < axes.length; index += 1) {
    axes[index] = numberFromValue(directAxes[index]) ?? axes[index] ?? 0;
  }

  const axesRecord = isRecord(record["axes"]) ? record["axes"] : {};
  const leftStick =
    nestedRecord(record, "leftStick") ??
    nestedRecord(record, "left") ??
    nestedRecord(axesRecord, "leftStick") ??
    nestedRecord(axesRecord, "left");
  const rightStick =
    nestedRecord(record, "rightStick") ??
    nestedRecord(record, "right") ??
    nestedRecord(axesRecord, "rightStick") ??
    nestedRecord(axesRecord, "right");

  if (leftStick !== null) {
    axes[0] = numberFromValue(leftStick["x"]) ?? axes[0] ?? 0;
    axes[1] = numberFromValue(leftStick["y"]) ?? axes[1] ?? 0;
  }

  if (rightStick !== null) {
    axes[2] = numberFromValue(rightStick["x"]) ?? axes[2] ?? 0;
    axes[3] = numberFromValue(rightStick["y"]) ?? axes[3] ?? 0;
  }

  return axes;
}

function nestedRecord(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = record[key];
  return isRecord(value) ? value : null;
}

export function numberFromValue(value: unknown): number | undefined {
  return Number.isFinite(value) ? (value as number) : undefined;
}

export function booleanFromValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
