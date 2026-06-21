export function createLocalLightAtlasSlotAllocatorState(options) {
    return {
        atlasWidth: normalizeAtlasExtent(options.atlasWidth),
        atlasHeight: normalizeAtlasExtent(options.atlasHeight),
        generation: 0,
        maxStaleGenerations: Math.max(0, options.maxStaleGenerations ?? 1),
        slots: [],
    };
}
export function allocateLocalLightAtlasSlots(options) {
    const state = options.state;
    const generation = state.generation + 1;
    const diagnostics = [];
    const normalized = normalizeRequests(options.requests, state.atlasWidth, state.atlasHeight, diagnostics);
    const previousSlots = [...state.slots];
    const previousSlotByKey = new Map(previousSlots.map((slot) => [slot.allocationKey, slot]));
    const assigned = [];
    const assignedKeys = new Set();
    const evictedKeys = new Set();
    let reusedSlotCount = 0;
    let reassignedSlotCount = 0;
    const sortedRequests = [...normalized].sort(compareSlotRequests);
    for (const request of sortedRequests) {
        const previous = previousSlotByKey.get(request.allocationKey);
        if (previous !== undefined &&
            previous.width === request.width &&
            previous.height === request.height &&
            regionFits(previous, state) &&
            !regionsOverlapAny(previous, assigned.map((entry) => entry.tile))) {
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
        const staleSlot = previousSlots.find((slot) => !assignedKeys.has(slot.allocationKey) &&
            slot.allocationKey !== request.allocationKey &&
            slot.width === request.width &&
            slot.height === request.height &&
            regionFits(slot, state) &&
            !regionsOverlapAny(slot, occupied));
        const region = staleSlot ?? firstAvailableRegion(request, state, occupied);
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
    const nextSlots = assignedTiles.map((tile) => ({
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
        if (assignedKeys.has(slot.allocationKey) ||
            evictedKeys.has(slot.allocationKey)) {
            continue;
        }
        if (generation - slot.lastUsedGeneration <= state.maxStaleGenerations &&
            regionFits(slot, state) &&
            !regionsOverlapAny(slot, assignedRegions)) {
            nextSlots.push(slot);
            staleSlotCount += 1;
        }
        else {
            evictedSlotCount += 1;
        }
    }
    state.generation = generation;
    state.slots = nextSlots;
    return {
        ready: diagnostics.length === 0 &&
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
function normalizeAtlasExtent(value) {
    return Number.isInteger(value) && value > 0 ? value : 1;
}
function normalizeRequests(requests, atlasWidth, atlasHeight, diagnostics) {
    const normalized = [];
    requests.forEach((request, order) => {
        const width = Math.round(request.width);
        const height = Math.round(request.height);
        if (request.allocationKey.length === 0 ||
            !Number.isInteger(width) ||
            !Number.isInteger(height) ||
            width <= 0 ||
            height <= 0 ||
            width > atlasWidth ||
            height > atlasHeight) {
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
function compareSlotRequests(a, b) {
    return (b.priority - a.priority ||
        b.width * b.height - a.width * a.height ||
        a.allocationKey.localeCompare(b.allocationKey));
}
function tileFromRegion(request, region, slotIndex, reused) {
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
function firstAvailableRegion(request, state, occupied) {
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
function uniqueSorted(values) {
    return [...new Set(values)].sort((a, b) => a - b);
}
function regionFits(region, state) {
    return (region.originX >= 0 &&
        region.originY >= 0 &&
        region.width > 0 &&
        region.height > 0 &&
        region.originX + region.width <= state.atlasWidth &&
        region.originY + region.height <= state.atlasHeight);
}
function regionsOverlapAny(region, others) {
    return others.some((other) => regionsOverlap(region, other));
}
function regionsOverlap(a, b) {
    return (a.originX < b.originX + b.width &&
        a.originX + a.width > b.originX &&
        a.originY < b.originY + b.height &&
        a.originY + a.height > b.originY);
}
//# sourceMappingURL=local-light-atlas-slot-allocator.js.map