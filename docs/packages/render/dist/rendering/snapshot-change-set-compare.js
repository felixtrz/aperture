export function comparePacketFamily(previous, next, options = {}) {
    const ordered = compareOrderedUniquePacketFamily(previous, next, options);
    if (ordered !== null) {
        return ordered;
    }
    const previousSingles = new Map();
    let previousBuckets;
    const includeKeys = options.includeKeys !== false;
    const rawUnchangedKeys = options.includeRawUnchangedKeys === true ? [] : null;
    const changedKeys = includeKeys ? [] : null;
    const unchangedKeys = includeKeys ? [] : null;
    for (const packet of previous.packets) {
        const key = previous.key(packet);
        const bucket = previousBuckets?.get(key);
        if (bucket === undefined) {
            const existing = previousSingles.get(key);
            if (existing === undefined && !previousSingles.has(key)) {
                previousSingles.set(key, packet);
            }
            else {
                previousSingles.delete(key);
                previousBuckets ??= new Map();
                previousBuckets.set(key, [existing, packet]);
            }
        }
        else {
            bucket.push(packet);
        }
    }
    let changed = 0;
    let unchanged = 0;
    for (const packet of next.packets) {
        const key = next.key(packet);
        const singleExists = previousSingles.has(key);
        const previousSingle = singleExists ? previousSingles.get(key) : undefined;
        if (singleExists &&
            packetsEqual(previous, next, previousSingle, packet)) {
            unchanged += 1;
            rawUnchangedKeys?.push(key);
            unchangedKeys?.push(formatPacketKey(next, key));
            previousSingles.delete(key);
            continue;
        }
        else if (singleExists) {
            changed += 1;
            changedKeys?.push(formatPacketKey(next, key));
            previousSingles.delete(key);
            continue;
        }
        const bucket = previousBuckets?.get(key);
        const previousPacketIndex = findEqualPreviousPacketIndex(previous, next, bucket, packet);
        if (previousPacketIndex !== -1) {
            unchanged += 1;
            rawUnchangedKeys?.push(key);
            unchangedKeys?.push(formatPacketKey(next, key));
            removePreviousPacket(previousBuckets, key, previousPacketIndex);
        }
        else if (bucket !== undefined && bucket.length > 0) {
            changed += 1;
            changedKeys?.push(formatPacketKey(next, key));
            removePreviousPacket(previousBuckets, key, 0);
        }
        else {
            changed += 1;
            changedKeys?.push(formatPacketKey(next, key));
        }
    }
    return {
        counts: {
            changed,
            unchanged,
            removed: countRemainingPackets(previousSingles, previousBuckets),
        },
        ...(rawUnchangedKeys === null
            ? {}
            : { rawUnchangedKeys: rawUnchangedKeys }),
        ...(includeKeys
            ? {
                keys: {
                    changed: changedKeys ?? [],
                    unchanged: unchangedKeys ?? [],
                    removed: remainingPacketKeys(previous, previousSingles, previousBuckets),
                },
            }
            : {}),
    };
}
function compareOrderedUniquePacketFamily(previous, next, options) {
    if (previous.packets.length !== next.packets.length) {
        return null;
    }
    const includeKeys = options.includeKeys !== false;
    const rawUnchangedKeys = options.includeRawUnchangedKeys === true ? [] : null;
    const changedKeys = includeKeys ? [] : null;
    const unchangedKeys = includeKeys ? [] : null;
    const seenKeys = options.assumeUniqueKeys === true ||
        options.allowOrderedDuplicateKeys === true
        ? null
        : new Set();
    let changed = 0;
    let unchanged = 0;
    for (let index = 0; index < next.packets.length; index += 1) {
        const previousPacket = previous.packets[index];
        const nextPacket = next.packets[index];
        const previousKey = previous.key(previousPacket);
        const nextKey = next.key(nextPacket);
        if (previousKey !== nextKey ||
            (seenKeys !== null && seenKeys.has(nextKey))) {
            return null;
        }
        seenKeys?.add(nextKey);
        if (packetsEqual(previous, next, previousPacket, nextPacket)) {
            unchanged += 1;
            rawUnchangedKeys?.push(nextKey);
            unchangedKeys?.push(formatPacketKey(next, nextKey));
        }
        else {
            changed += 1;
            changedKeys?.push(formatPacketKey(next, nextKey));
        }
    }
    return {
        counts: {
            changed,
            unchanged,
            removed: 0,
        },
        ...(rawUnchangedKeys === null
            ? {}
            : { rawUnchangedKeys: rawUnchangedKeys }),
        ...(includeKeys
            ? {
                keys: {
                    changed: changedKeys ?? [],
                    unchanged: unchangedKeys ?? [],
                    removed: [],
                },
            }
            : {}),
    };
}
function findEqualPreviousPacketIndex(previous, next, bucket, packet) {
    if (bucket === undefined) {
        return -1;
    }
    return bucket.findIndex((previousPacket) => packetsEqual(previous, next, previousPacket, packet));
}
function removePreviousPacket(previousPackets, key, index) {
    const bucket = previousPackets?.get(key);
    if (bucket === undefined) {
        return;
    }
    bucket.splice(index, 1);
    if (bucket.length === 0) {
        previousPackets?.delete(key);
    }
}
function countRemainingPackets(singles, buckets) {
    let count = singles.size;
    for (const bucket of buckets?.values() ?? []) {
        count += bucket.length;
    }
    return count;
}
function remainingPacketKeys(snapshot, singles, buckets) {
    const keys = [];
    for (const key of singles.keys()) {
        keys.push(formatPacketKey(snapshot, key));
    }
    for (const [key, bucket] of buckets ?? []) {
        for (let index = 0; index < bucket.length; index += 1) {
            keys.push(formatPacketKey(snapshot, key));
        }
    }
    return keys;
}
function formatPacketKey(snapshot, key) {
    return snapshot.formatKey?.(key) ?? String(key);
}
function packetsEqual(previous, next, previousPacket, nextPacket) {
    if (next.equals !== undefined) {
        return next.equals(previousPacket, nextPacket, previous.state, next.state);
    }
    if (previous.signature === undefined || next.signature === undefined) {
        return Object.is(previousPacket, nextPacket);
    }
    return previous.signature(previousPacket) === next.signature(nextPacket);
}
export function totalCounts(counts) {
    return counts.reduce((total, current) => ({
        changed: total.changed + current.changed,
        unchanged: total.unchanged + current.unchanged,
        removed: total.removed + current.removed,
    }), { changed: 0, unchanged: 0, removed: 0 });
}
//# sourceMappingURL=snapshot-change-set-compare.js.map