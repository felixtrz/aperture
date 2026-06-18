import type {
  RenderSnapshotFamilyChangeCounts,
  RenderSnapshotFamilyChangeKeys,
} from "./snapshot-change-set-types.js";

export interface PacketSnapshot<TPacket> {
  readonly packets: readonly TPacket[];
  readonly signature?: (packet: TPacket) => string;
  readonly equals?: (
    previous: TPacket,
    next: TPacket,
    previousState: unknown,
    nextState: unknown,
  ) => boolean;
  readonly key: (packet: TPacket) => string;
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
  const previousPackets = new Map<string, TPacket>();
  const includeKeys = options.includeKeys !== false;
  const changedKeys: string[] | null = includeKeys ? [] : null;
  const unchangedKeys: string[] | null = includeKeys ? [] : null;

  for (const packet of previous.packets) {
    previousPackets.set(previous.key(packet), packet);
  }

  let changed = 0;
  let unchanged = 0;

  for (const packet of next.packets) {
    const key = next.key(packet);
    const previousPacket = previousPackets.get(key);

    if (
      previousPacket !== undefined &&
      packetsEqual(previous, next, previousPacket, packet)
    ) {
      unchanged += 1;
      unchangedKeys?.push(key);
    } else {
      changed += 1;
      changedKeys?.push(key);
    }

    previousPackets.delete(key);
  }

  return {
    counts: {
      changed,
      unchanged,
      removed: previousPackets.size,
    },
    ...(includeKeys
      ? {
          keys: {
            changed: changedKeys ?? [],
            unchanged: unchangedKeys ?? [],
            removed: [...previousPackets.keys()],
          },
        }
      : {}),
  };
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
