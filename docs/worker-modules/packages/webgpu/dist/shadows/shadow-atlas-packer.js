/**
 * Deterministic shelf packer (PlayCanvas-style budgeted shadow atlas, adapted —
 * see references/engine clustered shadow allocation): sorts requests by
 * priority desc, mapSize desc, shadowId asc, then places each square footprint
 * left-to-right onto horizontal shelves, opening a new shelf when the current
 * row is full. Requests that do not fit the atlas budget are dropped (reported
 * in `dropped`) rather than overlapping an existing region. Pure/headless — no
 * GPU. Every assigned region is in-bounds and non-overlapping by construction.
 */
export function packShadowAtlas(input) {
    const atlasWidth = Math.max(0, Math.floor(input.atlasWidth));
    const atlasHeight = Math.max(0, Math.floor(input.atlasHeight));
    const ordered = [...input.requests].sort(compareRequests);
    const assignments = [];
    const dropped = [];
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
function compareRequests(a, b) {
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
//# sourceMappingURL=shadow-atlas-packer.js.map