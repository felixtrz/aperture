export function tuple3(
  value: readonly [number, number, number],
): [number, number, number] {
  return [value[0], value[1], value[2]];
}

export function tuple4(
  value: readonly [number, number, number, number],
): [number, number, number, number] {
  return [value[0], value[1], value[2], value[3]];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isTuple3(
  value: unknown,
): value is readonly [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

export function isTuple4(
  value: unknown,
): value is readonly [number, number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}
