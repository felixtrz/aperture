import type {
  RenderSnapshotFamilyChangeCounts,
  RenderSnapshotFamilyChangeKeys,
} from "./snapshot-change-set-types.js";

export type PacketSnapshotKey = string | number;

export interface PacketSnapshot<TPacket> {
  readonly packets: readonly TPacket[];
  readonly signature?: (packet: TPacket) => string;
  readonly equals?: (
    previous: TPacket,
    next: TPacket,
    previousState: unknown,
    nextState: unknown,
  ) => boolean;
  readonly key: (packet: TPacket) => PacketSnapshotKey;
  readonly formatKey?: (key: PacketSnapshotKey) => string;
  readonly state?: unknown;
}

export interface PacketFamilyComparison {
  readonly counts: RenderSnapshotFamilyChangeCounts;
  readonly keys?: RenderSnapshotFamilyChangeKeys;
  readonly rawUnchangedKeys?: readonly PacketSnapshotKey[];
}

export interface ComparePacketFamilyOptions {
  readonly includeKeys?: boolean;
  readonly includeRawUnchangedKeys?: boolean;
  /**
   * Allows the ordered fast path to skip duplicate-key detection for packet
   * families whose keys are already unique by extraction/render-world contract.
   */
  readonly assumeUniqueKeys?: boolean;
  /**
   * Allows the ordered fast path to compare same-key duplicate packets by slot.
   * This is conservative for stable ordered families such as bounds: duplicate
   * reorders can over-report changes, but cannot hide changed or removed work.
   */
  readonly allowOrderedDuplicateKeys?: boolean;
}

export function comparePacketFamily<TPacket>(
  previous: PacketSnapshot<TPacket>,
  next: PacketSnapshot<TPacket>,
  options: ComparePacketFamilyOptions = {},
): PacketFamilyComparison {
  const ordered = compareOrderedUniquePacketFamily(previous, next, options);
  if (ordered !== null) {
    return ordered;
  }

  const previousSingles = new Map<PacketSnapshotKey, TPacket>();
  let previousBuckets: Map<PacketSnapshotKey, TPacket[]> | undefined;
  const includeKeys = options.includeKeys !== false;
  const rawUnchangedKeys: PacketSnapshotKey[] | null =
    options.includeRawUnchangedKeys === true ? [] : null;
  const changedKeys: string[] | null = includeKeys ? [] : null;
  const unchangedKeys: string[] | null = includeKeys ? [] : null;

  for (const packet of previous.packets) {
    const key = previous.key(packet);
    const bucket = previousBuckets?.get(key);
    if (bucket === undefined) {
      const existing = previousSingles.get(key);
      if (existing === undefined && !previousSingles.has(key)) {
        previousSingles.set(key, packet);
      } else {
        previousSingles.delete(key);
        previousBuckets ??= new Map<PacketSnapshotKey, TPacket[]>();
        previousBuckets.set(key, [existing as TPacket, packet]);
      }
    } else {
      bucket.push(packet);
    }
  }

  let changed = 0;
  let unchanged = 0;

  for (const packet of next.packets) {
    const key = next.key(packet);
    const singleExists = previousSingles.has(key);
    const previousSingle = singleExists ? previousSingles.get(key) : undefined;

    if (
      singleExists &&
      packetsEqual(previous, next, previousSingle as TPacket, packet)
    ) {
      unchanged += 1;
      rawUnchangedKeys?.push(key);
      unchangedKeys?.push(formatPacketKey(next, key));
      previousSingles.delete(key);
      continue;
    } else if (singleExists) {
      changed += 1;
      changedKeys?.push(formatPacketKey(next, key));
      previousSingles.delete(key);
      continue;
    }

    const bucket = previousBuckets?.get(key);
    const previousPacketIndex = findEqualPreviousPacketIndex(
      previous,
      next,
      bucket,
      packet,
    );

    if (previousPacketIndex !== -1) {
      unchanged += 1;
      rawUnchangedKeys?.push(key);
      unchangedKeys?.push(formatPacketKey(next, key));
      removePreviousPacket(previousBuckets, key, previousPacketIndex);
    } else if (bucket !== undefined && bucket.length > 0) {
      changed += 1;
      changedKeys?.push(formatPacketKey(next, key));
      removePreviousPacket(previousBuckets, key, 0);
    } else {
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
            removed: remainingPacketKeys(
              previous,
              previousSingles,
              previousBuckets,
            ),
          },
        }
      : {}),
  };
}

function compareOrderedUniquePacketFamily<TPacket>(
  previous: PacketSnapshot<TPacket>,
  next: PacketSnapshot<TPacket>,
  options: ComparePacketFamilyOptions,
): PacketFamilyComparison | null {
  if (previous.packets.length !== next.packets.length) {
    return null;
  }

  const includeKeys = options.includeKeys !== false;
  const rawUnchangedKeys: PacketSnapshotKey[] | null =
    options.includeRawUnchangedKeys === true ? [] : null;
  const changedKeys: string[] | null = includeKeys ? [] : null;
  const unchangedKeys: string[] | null = includeKeys ? [] : null;
  const seenKeys =
    options.assumeUniqueKeys === true ||
    options.allowOrderedDuplicateKeys === true
      ? null
      : new Set<PacketSnapshotKey>();
  let changed = 0;
  let unchanged = 0;

  for (let index = 0; index < next.packets.length; index += 1) {
    const previousPacket = previous.packets[index]!;
    const nextPacket = next.packets[index]!;
    const previousKey = previous.key(previousPacket);
    const nextKey = next.key(nextPacket);

    if (
      previousKey !== nextKey ||
      (seenKeys !== null && seenKeys.has(nextKey))
    ) {
      return null;
    }

    seenKeys?.add(nextKey);

    if (packetsEqual(previous, next, previousPacket, nextPacket)) {
      unchanged += 1;
      rawUnchangedKeys?.push(nextKey);
      unchangedKeys?.push(formatPacketKey(next, nextKey));
    } else {
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

function findEqualPreviousPacketIndex<TPacket>(
  previous: PacketSnapshot<TPacket>,
  next: PacketSnapshot<TPacket>,
  bucket: readonly TPacket[] | undefined,
  packet: TPacket,
): number {
  if (bucket === undefined) {
    return -1;
  }

  return bucket.findIndex((previousPacket) =>
    packetsEqual(previous, next, previousPacket, packet),
  );
}

function removePreviousPacket<TPacket>(
  previousPackets: Map<PacketSnapshotKey, TPacket[]> | undefined,
  key: PacketSnapshotKey,
  index: number,
): void {
  const bucket = previousPackets?.get(key);
  if (bucket === undefined) {
    return;
  }

  bucket.splice(index, 1);
  if (bucket.length === 0) {
    previousPackets?.delete(key);
  }
}

function countRemainingPackets<TPacket>(
  singles: ReadonlyMap<PacketSnapshotKey, TPacket>,
  buckets: ReadonlyMap<PacketSnapshotKey, readonly TPacket[]> | undefined,
): number {
  let count = singles.size;
  for (const bucket of buckets?.values() ?? []) {
    count += bucket.length;
  }

  return count;
}

function remainingPacketKeys<TPacket>(
  snapshot: PacketSnapshot<TPacket>,
  singles: ReadonlyMap<PacketSnapshotKey, TPacket>,
  buckets: ReadonlyMap<PacketSnapshotKey, readonly TPacket[]> | undefined,
): string[] {
  const keys: string[] = [];

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

function formatPacketKey<TPacket>(
  snapshot: PacketSnapshot<TPacket>,
  key: PacketSnapshotKey,
): string {
  return snapshot.formatKey?.(key) ?? String(key);
}

function packetsEqual<TPacket>(
  previous: PacketSnapshot<TPacket>,
  next: PacketSnapshot<TPacket>,
  previousPacket: TPacket,
  nextPacket: TPacket,
): boolean {
  if (next.equals !== undefined) {
    return next.equals(previousPacket, nextPacket, previous.state, next.state);
  }

  if (previous.signature === undefined || next.signature === undefined) {
    return Object.is(previousPacket, nextPacket);
  }

  return previous.signature(previousPacket) === next.signature(nextPacket);
}

export function totalCounts(
  counts: readonly RenderSnapshotFamilyChangeCounts[],
): RenderSnapshotFamilyChangeCounts {
  return counts.reduce(
    (total, current) => ({
      changed: total.changed + current.changed,
      unchanged: total.unchanged + current.unchanged,
      removed: total.removed + current.removed,
    }),
    { changed: 0, unchanged: 0, removed: 0 },
  );
}
