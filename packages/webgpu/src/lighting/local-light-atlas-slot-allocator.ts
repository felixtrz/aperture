export interface LocalLightAtlasSlotRequest {
  readonly allocationKey: string;
  readonly lightId: number;
  readonly shadowId: number;
  readonly width: number;
  readonly height: number;
  readonly priority?: number;
}

export interface LocalLightAtlasSlotRegion {
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
}

export interface LocalLightAtlasSlotTile extends LocalLightAtlasSlotRegion {
  readonly allocationKey: string;
  readonly lightId: number;
  readonly shadowId: number;
  readonly slotIndex: number;
  readonly reused: boolean;
}

export interface LocalLightAtlasStoredSlot extends LocalLightAtlasSlotRegion {
  readonly allocationKey: string;
  readonly lightId: number;
  readonly shadowId: number;
  readonly lastUsedGeneration: number;
}

export interface LocalLightAtlasSlotAllocatorState {
  atlasWidth: number;
  atlasHeight: number;
  generation: number;
  maxStaleGenerations: number;
  slots: LocalLightAtlasStoredSlot[];
}

export interface LocalLightAtlasSlotAllocatorOptions {
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  readonly maxStaleGenerations?: number;
}

export interface LocalLightAtlasSlotAllocationDiagnostic {
  readonly code:
    | "localLightAtlasSlot.invalidRequest"
    | "localLightAtlasSlot.slotUnavailable";
  readonly allocationKey: string;
  readonly message: string;
}

export interface LocalLightAtlasSlotAllocationReport {
  readonly ready: boolean;
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  readonly generation: number;
  readonly requestedSlotCount: number;
  readonly assignedSlotCount: number;
  readonly storedSlotCount: number;
  readonly reusedSlotCount: number;
  readonly reassignedSlotCount: number;
  readonly staleSlotCount: number;
  readonly evictedSlotCount: number;
  readonly tiles: readonly LocalLightAtlasSlotTile[];
  readonly diagnostics: readonly LocalLightAtlasSlotAllocationDiagnostic[];
}

interface NormalizedSlotRequest extends LocalLightAtlasSlotRequest {
  readonly order: number;
  readonly priority: number;
}

interface PendingSlotAssignment {
  readonly request: NormalizedSlotRequest;
  readonly tile: LocalLightAtlasSlotTile;
}

export function createLocalLightAtlasSlotAllocatorState(
  options: LocalLightAtlasSlotAllocatorOptions,
): LocalLightAtlasSlotAllocatorState {
  return {
    atlasWidth: normalizeAtlasExtent(options.atlasWidth),
    atlasHeight: normalizeAtlasExtent(options.atlasHeight),
    generation: 0,
    maxStaleGenerations: Math.max(0, options.maxStaleGenerations ?? 1),
    slots: [],
  };
}

export function allocateLocalLightAtlasSlots(options: {
  readonly state: LocalLightAtlasSlotAllocatorState;
  readonly requests: readonly LocalLightAtlasSlotRequest[];
}): LocalLightAtlasSlotAllocationReport {
  const state = options.state;
  const generation = state.generation + 1;
  const diagnostics: LocalLightAtlasSlotAllocationDiagnostic[] = [];
  const normalized = normalizeRequests(
    options.requests,
    state.atlasWidth,
    state.atlasHeight,
    diagnostics,
  );
  const previousSlots = [...state.slots];
  const previousSlotByKey = new Map(
    previousSlots.map((slot) => [slot.allocationKey, slot]),
  );
  const assigned: PendingSlotAssignment[] = [];
  const assignedKeys = new Set<string>();
  const evictedKeys = new Set<string>();
  let reusedSlotCount = 0;
  let reassignedSlotCount = 0;

  const sortedRequests = [...normalized].sort(compareSlotRequests);

  for (const request of sortedRequests) {
    const previous = previousSlotByKey.get(request.allocationKey);

    if (
      previous !== undefined &&
      previous.width === request.width &&
      previous.height === request.height &&
      regionFits(previous, state) &&
      !regionsOverlapAny(previous, assigned.map((entry) => entry.tile))
    ) {
      assigned.push({
        request,
        tile: tileFromRegion(request, previous, assigned.length, true),
      });
      assignedKeys.add(request.allocationKey);
      reusedSlotCount += 1;
    }
  }

  for (const request of sortedRequests) {
    if (assignedKeys.has(request.allocationKey)) {
      continue;
    }

    const occupied = assigned.map((entry) => entry.tile);
    const staleSlot = previousSlots.find(
      (slot) =>
        !assignedKeys.has(slot.allocationKey) &&
        slot.allocationKey !== request.allocationKey &&
        slot.width === request.width &&
        slot.height === request.height &&
        regionFits(slot, state) &&
        !regionsOverlapAny(slot, occupied),
    );
    const region =
      staleSlot ?? firstAvailableRegion(request, state, occupied);

    if (region === null) {
      diagnostics.push({
        code: "localLightAtlasSlot.slotUnavailable",
        allocationKey: request.allocationKey,
        message: `Local light atlas slot '${request.allocationKey}' could not fit ${request.width}x${request.height} in ${state.atlasWidth}x${state.atlasHeight}.`,
      });
      continue;
    }

    if (previousSlotByKey.has(request.allocationKey)) {
      evictedKeys.add(request.allocationKey);
    }

    if (staleSlot !== undefined) {
      evictedKeys.add(staleSlot.allocationKey);
    }

    assigned.push({
      request,
      tile: tileFromRegion(request, region, assigned.length, false),
    });
    assignedKeys.add(request.allocationKey);
    reassignedSlotCount += 1;
  }

  const assignedTiles = assigned
    .sort((a, b) => a.request.order - b.request.order)
    .map((entry, slotIndex) => ({ ...entry.tile, slotIndex }));
  const assignedRegions = assignedTiles.map((tile) => tile);
  const nextSlots: LocalLightAtlasStoredSlot[] = assignedTiles.map((tile) => ({
    allocationKey: tile.allocationKey,
    lightId: tile.lightId,
    shadowId: tile.shadowId,
    originX: tile.originX,
    originY: tile.originY,
    width: tile.width,
    height: tile.height,
    lastUsedGeneration: generation,
  }));
  let staleSlotCount = 0;
  let evictedSlotCount = evictedKeys.size;

  for (const slot of previousSlots) {
    if (
      assignedKeys.has(slot.allocationKey) ||
      evictedKeys.has(slot.allocationKey)
    ) {
      continue;
    }

    if (
      generation - slot.lastUsedGeneration <= state.maxStaleGenerations &&
      regionFits(slot, state) &&
      !regionsOverlapAny(slot, assignedRegions)
    ) {
      nextSlots.push(slot);
      staleSlotCount += 1;
    } else {
      evictedSlotCount += 1;
    }
  }

  state.generation = generation;
  state.slots = nextSlots;

  return {
    ready:
      diagnostics.length === 0 &&
      assignedTiles.length === normalized.length &&
      normalized.length === options.requests.length,
    atlasWidth: state.atlasWidth,
    atlasHeight: state.atlasHeight,
    generation,
    requestedSlotCount: options.requests.length,
    assignedSlotCount: assignedTiles.length,
    storedSlotCount: nextSlots.length,
    reusedSlotCount,
    reassignedSlotCount,
    staleSlotCount,
    evictedSlotCount,
    tiles: assignedTiles,
    diagnostics,
  };
}

function normalizeAtlasExtent(value: number): number {
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function normalizeRequests(
  requests: readonly LocalLightAtlasSlotRequest[],
  atlasWidth: number,
  atlasHeight: number,
  diagnostics: LocalLightAtlasSlotAllocationDiagnostic[],
): readonly NormalizedSlotRequest[] {
  const normalized: NormalizedSlotRequest[] = [];

  requests.forEach((request, order) => {
    const width = Math.round(request.width);
    const height = Math.round(request.height);

    if (
      request.allocationKey.length === 0 ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      width > atlasWidth ||
      height > atlasHeight
    ) {
      diagnostics.push({
        code: "localLightAtlasSlot.invalidRequest",
        allocationKey: request.allocationKey,
        message: `Local light atlas slot '${request.allocationKey}' has invalid ${request.width}x${request.height} request for ${atlasWidth}x${atlasHeight}.`,
      });
      return;
    }

    normalized.push({
      ...request,
      width,
      height,
      order,
      priority: request.priority ?? Math.max(width, height),
    });
  });

  return normalized;
}

function compareSlotRequests(
  a: NormalizedSlotRequest,
  b: NormalizedSlotRequest,
): number {
  return (
    b.priority - a.priority ||
    b.width * b.height - a.width * a.height ||
    a.allocationKey.localeCompare(b.allocationKey)
  );
}

function tileFromRegion(
  request: NormalizedSlotRequest,
  region: LocalLightAtlasSlotRegion,
  slotIndex: number,
  reused: boolean,
): LocalLightAtlasSlotTile {
  return {
    allocationKey: request.allocationKey,
    lightId: request.lightId,
    shadowId: request.shadowId,
    slotIndex,
    originX: region.originX,
    originY: region.originY,
    width: region.width,
    height: region.height,
    reused,
  };
}

function firstAvailableRegion(
  request: NormalizedSlotRequest,
  state: Pick<LocalLightAtlasSlotAllocatorState, "atlasWidth" | "atlasHeight">,
  occupied: readonly LocalLightAtlasSlotRegion[],
): LocalLightAtlasSlotRegion | null {
  const candidateXs = uniqueSorted([
    0,
    ...occupied.map((region) => region.originX + region.width),
  ]);
  const candidateYs = uniqueSorted([
    0,
    ...occupied.map((region) => region.originY + region.height),
  ]);

  for (const originY of candidateYs) {
    for (const originX of candidateXs) {
      const region = {
        originX,
        originY,
        width: request.width,
        height: request.height,
      };

      if (regionFits(region, state) && !regionsOverlapAny(region, occupied)) {
        return region;
      }
    }
  }

  return null;
}

function uniqueSorted(values: readonly number[]): readonly number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function regionFits(
  region: LocalLightAtlasSlotRegion,
  state: Pick<LocalLightAtlasSlotAllocatorState, "atlasWidth" | "atlasHeight">,
): boolean {
  return (
    region.originX >= 0 &&
    region.originY >= 0 &&
    region.width > 0 &&
    region.height > 0 &&
    region.originX + region.width <= state.atlasWidth &&
    region.originY + region.height <= state.atlasHeight
  );
}

function regionsOverlapAny(
  region: LocalLightAtlasSlotRegion,
  others: readonly LocalLightAtlasSlotRegion[],
): boolean {
  return others.some((other) => regionsOverlap(region, other));
}

function regionsOverlap(
  a: LocalLightAtlasSlotRegion,
  b: LocalLightAtlasSlotRegion,
): boolean {
  return (
    a.originX < b.originX + b.width &&
    a.originX + a.width > b.originX &&
    a.originY < b.originY + b.height &&
    a.originY + a.height > b.originY
  );
}
