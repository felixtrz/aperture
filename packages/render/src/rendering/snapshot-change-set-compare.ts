import type {
  RenderSnapshotFamilyChangeCounts,
  RenderSnapshotFamilyChangeKeys,
} from "./snapshot-change-set-types.js";

export interface PacketSnapshot<TPacket> {
  readonly packets: readonly TPacket[];
  readonly signature: (packet: TPacket) => string;
  readonly key: (packet: TPacket) => string;
}

export interface PacketFamilyComparison {
  readonly counts: RenderSnapshotFamilyChangeCounts;
  readonly keys: RenderSnapshotFamilyChangeKeys;
}

export function comparePacketFamily<TPacket>(
  previous: PacketSnapshot<TPacket>,
  next: PacketSnapshot<TPacket>,
): PacketFamilyComparison {
  const previousSignatures = new Map<string, string>();
  const changedKeys: string[] = [];
  const unchangedKeys: string[] = [];

  for (const packet of previous.packets) {
    previousSignatures.set(previous.key(packet), previous.signature(packet));
  }

  let changed = 0;
  let unchanged = 0;

  for (const packet of next.packets) {
    const key = next.key(packet);
    const previousSignature = previousSignatures.get(key);

    if (
      previousSignature !== undefined &&
      previousSignature === next.signature(packet)
    ) {
      unchanged += 1;
      unchangedKeys.push(key);
    } else {
      changed += 1;
      changedKeys.push(key);
    }

    previousSignatures.delete(key);
  }

  return {
    counts: {
      changed,
      unchanged,
      removed: previousSignatures.size,
    },
    keys: {
      changed: changedKeys,
      unchanged: unchangedKeys,
      removed: [...previousSignatures.keys()],
    },
  };
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
