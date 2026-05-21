import { assetHandleKey } from "@aperture-engine/simulation";
import type {
  BoundsPacket,
  EnvironmentPacket,
  LightPacket,
  MeshDrawPacket,
  RenderSnapshot,
  ShadowRequestPacket,
  ViewPacket,
} from "./snapshot.js";

export const RENDER_SNAPSHOT_CHANGE_SET_FAMILIES = [
  "views",
  "meshDraws",
  "lights",
  "environments",
  "shadowRequests",
  "bounds",
] as const;

export type RenderSnapshotChangeSetFamily =
  (typeof RENDER_SNAPSHOT_CHANGE_SET_FAMILIES)[number];

export interface RenderSnapshotFamilyChangeCounts {
  readonly changed: number;
  readonly unchanged: number;
  readonly removed: number;
}

export interface RenderSnapshotChangeSet {
  readonly previousFrame: number | null;
  readonly frame: number;
  readonly views: RenderSnapshotFamilyChangeCounts;
  readonly meshDraws: RenderSnapshotFamilyChangeCounts;
  readonly lights: RenderSnapshotFamilyChangeCounts;
  readonly environments: RenderSnapshotFamilyChangeCounts;
  readonly shadowRequests: RenderSnapshotFamilyChangeCounts;
  readonly bounds: RenderSnapshotFamilyChangeCounts;
  readonly total: RenderSnapshotFamilyChangeCounts;
}

interface PacketSnapshot<TPacket> {
  readonly packets: readonly TPacket[];
  readonly signature: (packet: TPacket) => string;
  readonly key: (packet: TPacket) => string;
}

export function createRenderSnapshotChangeSet(
  previous: RenderSnapshot | null | undefined,
  next: RenderSnapshot,
): RenderSnapshotChangeSet {
  const views = comparePacketFamily(viewPackets(previous), viewPackets(next));
  const meshDraws = comparePacketFamily(
    meshDrawPackets(previous),
    meshDrawPackets(next),
  );
  const lights = comparePacketFamily(
    lightPackets(previous),
    lightPackets(next),
  );
  const environments = comparePacketFamily(
    environmentPackets(previous),
    environmentPackets(next),
  );
  const shadowRequests = comparePacketFamily(
    shadowRequestPackets(previous),
    shadowRequestPackets(next),
  );
  const bounds = comparePacketFamily(
    boundsPackets(previous),
    boundsPackets(next),
  );

  return {
    previousFrame: previous?.frame ?? null,
    frame: next.frame,
    views,
    meshDraws,
    lights,
    environments,
    shadowRequests,
    bounds,
    total: totalCounts([
      views,
      meshDraws,
      lights,
      environments,
      shadowRequests,
      bounds,
    ]),
  };
}

function comparePacketFamily<TPacket>(
  previous: PacketSnapshot<TPacket>,
  next: PacketSnapshot<TPacket>,
): RenderSnapshotFamilyChangeCounts {
  const previousSignatures = new Map<string, string>();

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
    } else {
      changed += 1;
    }

    previousSignatures.delete(key);
  }

  return {
    changed,
    unchanged,
    removed: previousSignatures.size,
  };
}

function viewPackets(
  snapshot: RenderSnapshot | null | undefined,
): PacketSnapshot<ViewPacket> {
  return {
    packets: snapshot?.views ?? [],
    key: (view) => `view:${view.viewId}`,
    signature: (view) =>
      stableStringify({
        view: viewSignaturePacket(view),
        viewMatrix: matrixAt(snapshot?.viewMatrices, view.viewMatrixOffset),
        projectionMatrix: matrixAt(
          snapshot?.viewMatrices,
          view.projectionMatrixOffset,
        ),
        viewProjectionMatrix: matrixAt(
          snapshot?.viewMatrices,
          view.viewProjectionMatrixOffset,
        ),
      }),
  };
}

function meshDrawPackets(
  snapshot: RenderSnapshot | null | undefined,
): PacketSnapshot<MeshDrawPacket> {
  return {
    packets: snapshot?.meshDraws ?? [],
    key: (draw) => `mesh-draw:${draw.renderId}`,
    signature: (draw) =>
      stableStringify({
        draw: meshDrawSignaturePacket(draw),
        worldTransform: matrixAt(
          snapshot?.transforms,
          draw.worldTransformOffset,
        ),
        instanceTint:
          draw.instanceTintOffset === undefined
            ? null
            : vec4At(snapshot?.instanceTints, draw.instanceTintOffset),
      }),
  };
}

function lightPackets(
  snapshot: RenderSnapshot | null | undefined,
): PacketSnapshot<LightPacket> {
  return {
    packets: snapshot?.lights ?? [],
    key: (light) => `light:${light.lightId}`,
    signature: (light) =>
      stableStringify({
        light: lightSignaturePacket(light),
        worldTransform: matrixAt(
          snapshot?.transforms,
          light.worldTransformOffset,
        ),
      }),
  };
}

function environmentPackets(
  snapshot: RenderSnapshot | null | undefined,
): PacketSnapshot<EnvironmentPacket> {
  return {
    packets: snapshot?.environments ?? [],
    key: (environment) => `environment:${environment.environmentId}`,
    signature: (environment) =>
      stableStringify({
        ...environment,
        handle:
          environment.handle === null
            ? null
            : assetHandleKey(environment.handle),
      }),
  };
}

function shadowRequestPackets(
  snapshot: RenderSnapshot | null | undefined,
): PacketSnapshot<ShadowRequestPacket> {
  return {
    packets: snapshot?.shadowRequests ?? [],
    key: (request) => `shadow-request:${request.shadowId}`,
    signature: stableStringify,
  };
}

function boundsPackets(
  snapshot: RenderSnapshot | null | undefined,
): PacketSnapshot<BoundsPacket> {
  return {
    packets: snapshot?.bounds ?? [],
    key: (bounds) =>
      `bounds:${bounds.entity.index}:${bounds.entity.generation}`,
    signature: stableStringify,
  };
}

function viewSignaturePacket(
  view: ViewPacket,
): Omit<
  ViewPacket,
  "viewMatrixOffset" | "projectionMatrixOffset" | "viewProjectionMatrixOffset"
> {
  const {
    viewMatrixOffset: _viewMatrixOffset,
    projectionMatrixOffset: _projectionMatrixOffset,
    viewProjectionMatrixOffset: _viewProjectionMatrixOffset,
    ...packet
  } = view;

  return packet;
}

function meshDrawSignaturePacket(draw: MeshDrawPacket): Omit<
  MeshDrawPacket,
  "worldTransformOffset" | "instanceTintOffset" | "boundsIndex"
> & {
  readonly hasInstanceTint: boolean;
} {
  const {
    worldTransformOffset: _worldTransformOffset,
    instanceTintOffset,
    boundsIndex: _boundsIndex,
    ...packet
  } = draw;

  return {
    ...packet,
    hasInstanceTint: instanceTintOffset !== undefined,
  };
}

function lightSignaturePacket(
  light: LightPacket,
): Omit<LightPacket, "worldTransformOffset"> {
  const { worldTransformOffset: _worldTransformOffset, ...packet } = light;

  return packet;
}

function matrixAt(
  values: Float32Array | undefined,
  offset: number,
): readonly number[] {
  return numericSlice(values, offset, 16);
}

function vec4At(
  values: Float32Array | undefined,
  offset: number,
): readonly number[] {
  return numericSlice(values, offset, 4);
}

function numericSlice(
  values: Float32Array | undefined,
  offset: number,
  length: number,
): readonly number[] {
  if (values === undefined || offset < 0 || offset + length > values.length) {
    return [];
  }

  return Array.from(values.subarray(offset, offset + length));
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

function totalCounts(
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
