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
import type { PacketSnapshot } from "./snapshot-change-set-compare.js";

export function viewPackets(
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

export function meshDrawPackets(
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

export function lightPackets(
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

export function environmentPackets(
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

export function shadowRequestPackets(
  snapshot: RenderSnapshot | null | undefined,
): PacketSnapshot<ShadowRequestPacket> {
  return {
    packets: snapshot?.shadowRequests ?? [],
    key: (request) => `shadow-request:${request.shadowId}`,
    signature: stableStringify,
  };
}

export function boundsPackets(
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
