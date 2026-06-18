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
}

export interface ComparePacketFamilyOptions {
  readonly includeKeys?: boolean;
}

export function comparePacketFamily<TPacket>(
  previous: PacketSnapshot<TPacket>,
  next: PacketSnapshot<TPacket>,
  options: ComparePacketFamilyOptions = {},
): PacketFamilyComparison {
  const previousPackets = new Map<PacketSnapshotKey, TPacket[]>();
  const includeKeys = options.includeKeys !== false;
  const changedKeys: string[] | null = includeKeys ? [] : null;
  const unchangedKeys: string[] | null = includeKeys ? [] : null;

  for (const packet of previous.packets) {
    const key = previous.key(packet);
    const bucket = previousPackets.get(key);
    if (bucket === undefined) {
      previousPackets.set(key, [packet]);
    } else {
      bucket.push(packet);
    }
  }

  let changed = 0;
  let unchanged = 0;

  for (const packet of next.packets) {
    const key = next.key(packet);
    const bucket = previousPackets.get(key);
    const previousPacketIndex = findEqualPreviousPacketIndex(
      previous,
      next,
      bucket,
      packet,
    );

    if (previousPacketIndex !== -1) {
      unchanged += 1;
      unchangedKeys?.push(formatPacketKey(next, key));
      removePreviousPacket(previousPackets, key, previousPacketIndex);
    } else if (bucket !== undefined && bucket.length > 0) {
      changed += 1;
      changedKeys?.push(formatPacketKey(next, key));
      removePreviousPacket(previousPackets, key, 0);
    } else {
      changed += 1;
      changedKeys?.push(formatPacketKey(next, key));
    }
  }

  return {
    counts: {
      changed,
      unchanged,
      removed: countRemainingPackets(previousPackets),
    },
    ...(includeKeys
      ? {
          keys: {
            changed: changedKeys ?? [],
            unchanged: unchangedKeys ?? [],
            removed: remainingPacketKeys(previous, previousPackets),
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
  previousPackets: Map<PacketSnapshotKey, TPacket[]>,
  key: PacketSnapshotKey,
  index: number,
): void {
  const bucket = previousPackets.get(key);
  if (bucket === undefined) {
    return;
  }

  bucket.splice(index, 1);
  if (bucket.length === 0) {
    previousPackets.delete(key);
  }
}

function countRemainingPackets<TPacket>(
  packets: ReadonlyMap<PacketSnapshotKey, readonly TPacket[]>,
): number {
  let count = 0;
  for (const bucket of packets.values()) {
    count += bucket.length;
  }

  return count;
}

function remainingPacketKeys<TPacket>(
  snapshot: PacketSnapshot<TPacket>,
  packets: ReadonlyMap<PacketSnapshotKey, readonly TPacket[]>,
): string[] {
  const keys: string[] = [];
  for (const [key, bucket] of packets) {
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
