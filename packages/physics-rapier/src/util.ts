import type RAPIER from "@dimforge/rapier3d-compat";

export function requireWorld(
  world: RAPIER.World | null,
  initialized: boolean,
): RAPIER.World {
  if (!initialized || world === null) {
    throw new Error("Rapier physics backend must be initialized before use.");
  }

  return world;
}

export function requireEventQueue(
  eventQueue: RAPIER.EventQueue | null,
  initialized: boolean,
): RAPIER.EventQueue {
  if (!initialized || eventQueue === null) {
    throw new Error("Rapier physics backend must be initialized before use.");
  }

  return eventQueue;
}

export function freeRapierObject(value: unknown): void {
  const free = (value as { readonly free?: unknown }).free;

  if (typeof free === "function") {
    free.call(value);
  }
}

export function performanceNow(): number {
  return typeof performance === "undefined" ? 0 : performance.now();
}

export function finitePositive(
  value: number | undefined,
  fallback: number,
): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

export function finiteNonNegative(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}
