import type { ShadowAtlasRegion } from "./shadow-map-descriptor.js";

/**
 * A single shadow's atlas request: a square footprint of `mapSize` texels with
 * an optional `priority` (higher packs first; ties broken by larger mapSize then
 * lower shadowId for determinism).
 */
export interface ShadowAtlasRequest {
  readonly shadowId: number;
  readonly mapSize: number;
  readonly priority?: number;
}

export interface ShadowAtlasAssignment {
  readonly shadowId: number;
  readonly region: ShadowAtlasRegion;
}

export interface ShadowAtlasPackResult {
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  /** Assignments in deterministic pack order. */
  readonly assignments: readonly ShadowAtlasAssignment[];
  /** Shadow ids that did not fit the atlas budget (dropped deterministically). */
  readonly dropped: readonly number[];
}

export interface ShadowAtlasPackInput {
  readonly requests: readonly ShadowAtlasRequest[];
  readonly atlasWidth: number;
  readonly atlasHeight: number;
}

/**
 * Deterministic shelf packer for a budgeted shadow atlas: sorts requests by
 * priority desc, mapSize desc, shadowId asc, then places each square footprint
 * left-to-right onto horizontal shelves, opening a new shelf when the current
 * row is full. Requests that do not fit the atlas budget are dropped (reported
 * in `dropped`) rather than overlapping an existing region. Pure/headless — no
 * GPU. Every assigned region is in-bounds and non-overlapping by construction.
 */
export function packShadowAtlas(
  input: ShadowAtlasPackInput,
): ShadowAtlasPackResult {
  const atlasWidth = Math.max(0, Math.floor(input.atlasWidth));
  const atlasHeight = Math.max(0, Math.floor(input.atlasHeight));

  const ordered = [...input.requests].sort(compareRequests);
  const assignments: ShadowAtlasAssignment[] = [];
  const dropped: number[] = [];

  let shelfX = 0;
  let shelfY = 0;
  let shelfHeight = 0;

  for (const request of ordered) {
    const size = Math.max(0, Math.floor(request.mapSize));

    if (size <= 0 || size > atlasWidth || size > atlasHeight) {
      dropped.push(request.shadowId);
      continue;
    }

    // Open a new shelf when the current row cannot fit this footprint.
    if (shelfX + size > atlasWidth) {
      shelfY += shelfHeight;
      shelfX = 0;
      shelfHeight = 0;
    }

    if (shelfY + size > atlasHeight) {
      dropped.push(request.shadowId);
      continue;
    }

    assignments.push({
      shadowId: request.shadowId,
      region: {
        originX: shelfX,
        originY: shelfY,
        width: size,
        height: size,
      },
    });

    shelfX += size;
    shelfHeight = Math.max(shelfHeight, size);
  }

  return { atlasWidth, atlasHeight, assignments, dropped };
}

function compareRequests(a: ShadowAtlasRequest, b: ShadowAtlasRequest): number {
  const priorityA = a.priority ?? 0;
  const priorityB = b.priority ?? 0;

  if (priorityA !== priorityB) {
    return priorityB - priorityA;
  }

  if (a.mapSize !== b.mapSize) {
    return b.mapSize - a.mapSize;
  }

  return a.shadowId - b.shadowId;
}
