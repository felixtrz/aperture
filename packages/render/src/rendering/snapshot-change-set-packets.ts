import { assetHandleKey } from "@aperture-engine/simulation";
import type {
  BoundsPacket,
  BatchCompatibilityKey,
  EnvironmentPacket,
  LightPacket,
  MeshDrawPacket,
  ProceduralSkyPacket,
  RenderEntityRef,
  RenderSnapshot,
  RenderSortKey,
  RuntimeUniformPacket,
  ShadowRequestPacket,
  ViewPacket,
} from "./snapshot.js";
import type {
  PacketSnapshot,
  PacketSnapshotKey,
} from "./snapshot-change-set-compare.js";

export function viewPackets(
  snapshot: RenderSnapshot | null | undefined,
): PacketSnapshot<ViewPacket> {
  return {
    packets: snapshot?.views ?? [],
    state: snapshot ?? null,
    key: (view) => view.viewId,
    formatKey: (key) => `view:${String(key)}`,
    equals: viewPacketsEqual,
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
  return meshDrawPacketFamily(snapshot, snapshot?.meshDraws ?? [], "mesh-draw");
}

export function shadowCasterDrawPackets(
  snapshot: RenderSnapshot | null | undefined,
): PacketSnapshot<MeshDrawPacket> {
  return meshDrawPacketFamily(
    snapshot,
    snapshot?.shadowCasterDraws ?? [],
    "shadow-caster-draw",
  );
}

function meshDrawPacketFamily(
  snapshot: RenderSnapshot | null | undefined,
  packets: readonly MeshDrawPacket[],
  keyPrefix: string,
): PacketSnapshot<MeshDrawPacket> {
  return {
    packets,
    state: snapshot ?? null,
    key: (draw) => draw.renderId,
    formatKey: (key) => `${keyPrefix}:${String(key)}`,
    equals: meshDrawPacketsEqual,
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
    state: snapshot ?? null,
    key: (light) => light.lightId,
    formatKey: (key) => `light:${String(key)}`,
    equals: lightPacketsEqual,
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
    key: (environment) => environment.environmentId,
    formatKey: (key) => `environment:${String(key)}`,
    equals: environmentPacketsEqual,
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

export function proceduralSkyPackets(
  snapshot: RenderSnapshot | null | undefined,
): PacketSnapshot<ProceduralSkyPacket> {
  return {
    packets: snapshot?.proceduralSkies ?? [],
    key: (sky) => sky.skyId,
    formatKey: (key) => `procedural-sky:${String(key)}`,
    equals: proceduralSkyPacketsEqual,
    signature: stableStringify,
  };
}

export function runtimeUniformPackets(
  snapshot: RenderSnapshot | null | undefined,
): PacketSnapshot<RuntimeUniformPacket> {
  return {
    packets: snapshot?.runtimeUniforms ?? [],
    key: (uniform) => uniform.key,
    formatKey: (key) => `runtime-uniform:${String(key)}`,
    equals: runtimeUniformPacketsEqual,
    signature: stableStringify,
  };
}

export function shadowRequestPackets(
  snapshot: RenderSnapshot | null | undefined,
): PacketSnapshot<ShadowRequestPacket> {
  return {
    packets: snapshot?.shadowRequests ?? [],
    key: (request) => request.shadowId,
    formatKey: (key) => `shadow-request:${String(key)}`,
    equals: shadowRequestPacketsEqual,
    signature: stableStringify,
  };
}

export function boundsPackets(
  snapshot: RenderSnapshot | null | undefined,
): PacketSnapshot<BoundsPacket> {
  return {
    packets: snapshot?.bounds ?? [],
    key: boundsPacketKey,
    formatKey: formatBoundsPacketKey,
    equals: boundsPacketsEqual,
    signature: stableStringify,
  };
}

const BOUNDS_ENTITY_KEY_GENERATION_STRIDE = 1_000_000;

function boundsPacketKey(bounds: BoundsPacket): PacketSnapshotKey {
  // Particle burst bounds currently use a synthetic entity with no stable
  // source id. Keep those slot-qualified until burst bounds carry emitter
  // identity; normal ECS entity bounds need stable keys because culling can
  // shift boundsId between snapshots.
  if (bounds.entity.index < 0) {
    return `bounds:${bounds.entity.index}:${bounds.entity.generation}:${bounds.boundsId}`;
  }

  const packed =
    bounds.entity.index * BOUNDS_ENTITY_KEY_GENERATION_STRIDE +
    bounds.entity.generation;

  if (
    bounds.entity.generation >= 0 &&
    bounds.entity.generation < BOUNDS_ENTITY_KEY_GENERATION_STRIDE &&
    Number.isSafeInteger(packed)
  ) {
    return packed;
  }

  return `bounds:${bounds.entity.index}:${bounds.entity.generation}`;
}

function formatBoundsPacketKey(key: PacketSnapshotKey): string {
  if (typeof key !== "number") {
    return key;
  }

  const entityIndex = Math.trunc(key / BOUNDS_ENTITY_KEY_GENERATION_STRIDE);
  const entityGeneration = key % BOUNDS_ENTITY_KEY_GENERATION_STRIDE;

  return `bounds:${entityIndex}:${entityGeneration}`;
}

function viewPacketsEqual(
  previous: ViewPacket,
  next: ViewPacket,
  previousState: unknown,
  nextState: unknown,
): boolean {
  const previousSnapshot = snapshotState(previousState);
  const nextSnapshot = snapshotState(nextState);

  return (
    previous.viewId === next.viewId &&
    entityRefsEqual(previous.camera, next.camera) &&
    previous.priority === next.priority &&
    previous.layerMask === next.layerMask &&
    vecEqual(previous.viewport, next.viewport, 4) &&
    vecEqual(previous.scissor, next.scissor, 4) &&
    vecEqual(previous.clearColor, next.clearColor, 4) &&
    previous.clearDepth === next.clearDepth &&
    previous.clearStencil === next.clearStencil &&
    nullableHandlesEqual(previous.renderTarget, next.renderTarget) &&
    numericRangeEqual(
      previousSnapshot?.viewMatrices,
      previous.viewMatrixOffset,
      nextSnapshot?.viewMatrices,
      next.viewMatrixOffset,
      16,
    ) &&
    numericRangeEqual(
      previousSnapshot?.viewMatrices,
      previous.projectionMatrixOffset,
      nextSnapshot?.viewMatrices,
      next.projectionMatrixOffset,
      16,
    ) &&
    numericRangeEqual(
      previousSnapshot?.viewMatrices,
      previous.viewProjectionMatrixOffset,
      nextSnapshot?.viewMatrices,
      next.viewProjectionMatrixOffset,
      16,
    )
  );
}

function meshDrawPacketsEqual(
  previous: MeshDrawPacket,
  next: MeshDrawPacket,
  previousState: unknown,
  nextState: unknown,
): boolean {
  const previousSnapshot = snapshotState(previousState);
  const nextSnapshot = snapshotState(nextState);

  return (
    previous.renderId === next.renderId &&
    entityRefsEqual(previous.entity, next.entity) &&
    handlesEqual(previous.mesh, next.mesh) &&
    handlesEqual(previous.material, next.material) &&
    previous.submesh === next.submesh &&
    previous.materialSlot === next.materialSlot &&
    previous.vertexStart === next.vertexStart &&
    previous.vertexCount === next.vertexCount &&
    previous.indexStart === next.indexStart &&
    previous.indexCount === next.indexCount &&
    previous.instanceAttributePacketIndex ===
      next.instanceAttributePacketIndex &&
    previous.boneMatrixOffset === next.boneMatrixOffset &&
    previous.boneMatrixCount === next.boneMatrixCount &&
    previous.morphDeltaOffset === next.morphDeltaOffset &&
    previous.morphTargetCount === next.morphTargetCount &&
    previous.morphWeightOffset === next.morphWeightOffset &&
    previous.morphVertexCount === next.morphVertexCount &&
    previous.layerMask === next.layerMask &&
    previous.castsShadow === next.castsShadow &&
    previous.receivesShadow === next.receivesShadow &&
    previous.occlusionQuery === next.occlusionQuery &&
    meshDrawSortKeysEqual(previous.sortKey, next.sortKey) &&
    batchKeysEqual(previous.batchKey, next.batchKey) &&
    numericRangeEqual(
      previousSnapshot?.transforms,
      previous.worldTransformOffset,
      nextSnapshot?.transforms,
      next.worldTransformOffset,
      16,
    ) &&
    optionalNumericRangeEqual(
      previousSnapshot?.instanceTints,
      previous.instanceTintOffset,
      nextSnapshot?.instanceTints,
      next.instanceTintOffset,
      4,
    )
  );
}

function lightPacketsEqual(
  previous: LightPacket,
  next: LightPacket,
  previousState: unknown,
  nextState: unknown,
): boolean {
  const previousSnapshot = snapshotState(previousState);
  const nextSnapshot = snapshotState(nextState);

  return (
    previous.lightId === next.lightId &&
    entityRefsEqual(previous.entity, next.entity) &&
    previous.kind === next.kind &&
    previous.shape === next.shape &&
    vecEqual(previous.color, next.color, 4) &&
    previous.intensity === next.intensity &&
    previous.range === next.range &&
    previous.innerConeAngle === next.innerConeAngle &&
    previous.outerConeAngle === next.outerConeAngle &&
    previous.width === next.width &&
    previous.height === next.height &&
    nullableHandlesEqual(previous.cookieTexture, next.cookieTexture) &&
    nullableHandlesEqual(previous.cookieSampler, next.cookieSampler) &&
    previous.cookieIntensity === next.cookieIntensity &&
    previous.layerMask === next.layerMask &&
    numericRangeEqual(
      previousSnapshot?.transforms,
      previous.worldTransformOffset,
      nextSnapshot?.transforms,
      next.worldTransformOffset,
      16,
    )
  );
}

function environmentPacketsEqual(
  previous: EnvironmentPacket,
  next: EnvironmentPacket,
): boolean {
  return (
    previous.environmentId === next.environmentId &&
    nullableHandlesEqual(previous.handle, next.handle) &&
    vecEqual(previous.color, next.color, 4) &&
    previous.intensity === next.intensity &&
    previous.layerMask === next.layerMask
  );
}

function proceduralSkyPacketsEqual(
  previous: ProceduralSkyPacket,
  next: ProceduralSkyPacket,
): boolean {
  return (
    previous.skyId === next.skyId &&
    entityRefsEqual(previous.entity, next.entity) &&
    previous.model === next.model &&
    previous.priority === next.priority &&
    vecEqual(previous.topColor, next.topColor, 3) &&
    vecEqual(previous.horizonColor, next.horizonColor, 3) &&
    vecEqual(previous.bottomColor, next.bottomColor, 3) &&
    previous.horizonPosition === next.horizonPosition &&
    previous.horizonSoftness === next.horizonSoftness &&
    previous.intensity === next.intensity &&
    vecEqual(previous.sunDirection, next.sunDirection, 3) &&
    vecEqual(previous.sunColor, next.sunColor, 3) &&
    previous.sunRadius === next.sunRadius &&
    previous.sunGlow === next.sunGlow &&
    previous.ditherStrength === next.ditherStrength &&
    previous.layerMask === next.layerMask
  );
}

function runtimeUniformPacketsEqual(
  previous: RuntimeUniformPacket,
  next: RuntimeUniformPacket,
): boolean {
  return (
    previous.uniformId === next.uniformId &&
    entityRefsEqual(previous.entity, next.entity) &&
    previous.key === next.key &&
    previous.version === next.version &&
    stableStringify(previous.values) === stableStringify(next.values)
  );
}

function shadowRequestPacketsEqual(
  previous: ShadowRequestPacket,
  next: ShadowRequestPacket,
): boolean {
  return (
    previous.shadowId === next.shadowId &&
    previous.lightId === next.lightId &&
    previous.lightKind === next.lightKind &&
    previous.cascadeCount === next.cascadeCount &&
    previous.casterLayerMask === next.casterLayerMask &&
    previous.receiverLayerMask === next.receiverLayerMask &&
    previous.shadowType === next.shadowType &&
    previous.strength === next.strength &&
    previous.filterRadius === next.filterRadius &&
    previous.slopeBias === next.slopeBias &&
    previous.depthBias === next.depthBias &&
    previous.normalBias === next.normalBias &&
    previous.mapSize === next.mapSize &&
    optionalVecEqual(previous.center, next.center, 3) &&
    previous.orthographicSize === next.orthographicSize &&
    previous.near === next.near &&
    previous.far === next.far &&
    previous.lightDistance === next.lightDistance
  );
}

function boundsPacketsEqual(
  previous: BoundsPacket,
  next: BoundsPacket,
): boolean {
  return (
    entityRefsEqual(previous.entity, next.entity) &&
    vecEqual(previous.localAabb.min, next.localAabb.min, 3) &&
    vecEqual(previous.localAabb.max, next.localAabb.max, 3) &&
    vecEqual(previous.worldAabb.min, next.worldAabb.min, 3) &&
    vecEqual(previous.worldAabb.max, next.worldAabb.max, 3) &&
    vecEqual(previous.localSphere.center, next.localSphere.center, 3) &&
    previous.localSphere.radius === next.localSphere.radius &&
    vecEqual(previous.worldSphere.center, next.worldSphere.center, 3) &&
    previous.worldSphere.radius === next.worldSphere.radius
  );
}

function snapshotState(state: unknown): RenderSnapshot | null {
  return typeof state === "object" && state !== null
    ? (state as RenderSnapshot)
    : null;
}

function entityRefsEqual(a: RenderEntityRef, b: RenderEntityRef): boolean {
  return a.index === b.index && a.generation === b.generation;
}

function handlesEqual(
  a: Parameters<typeof assetHandleKey>[0],
  b: Parameters<typeof assetHandleKey>[0],
): boolean {
  return assetHandleKey(a) === assetHandleKey(b);
}

function nullableHandlesEqual(
  a: Parameters<typeof assetHandleKey>[0] | null | undefined,
  b: Parameters<typeof assetHandleKey>[0] | null | undefined,
): boolean {
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }

  return handlesEqual(a, b);
}

function meshDrawSortKeysEqual(a: RenderSortKey, b: RenderSortKey): boolean {
  return (
    a.queue === b.queue &&
    a.viewId === b.viewId &&
    a.layer === b.layer &&
    a.order === b.order &&
    a.pipelineKey === b.pipelineKey &&
    a.materialKey === b.materialKey &&
    a.meshKey === b.meshKey &&
    (a.queue === "transparent" || b.queue === "transparent"
      ? a.depth === b.depth
      : true) &&
    a.stableId === b.stableId
  );
}

function batchKeysEqual(
  a: BatchCompatibilityKey,
  b: BatchCompatibilityKey,
): boolean {
  return (
    a.pipelineKey === b.pipelineKey &&
    a.materialKey === b.materialKey &&
    a.meshLayoutKey === b.meshLayoutKey &&
    a.topology === b.topology &&
    a.instanced === b.instanced &&
    a.skinned === b.skinned &&
    a.morphed === b.morphed
  );
}

function optionalNumericRangeEqual(
  a: Float32Array | undefined,
  aOffset: number | undefined,
  b: Float32Array | undefined,
  bOffset: number | undefined,
  length: number,
): boolean {
  if (aOffset === undefined || bOffset === undefined) {
    return aOffset === bOffset;
  }

  return numericRangeEqual(a, aOffset, b, bOffset, length);
}

function numericRangeEqual(
  a: Float32Array | undefined,
  aOffset: number,
  b: Float32Array | undefined,
  bOffset: number,
  length: number,
): boolean {
  const aValid =
    a !== undefined && aOffset >= 0 && aOffset + length <= a.length;
  const bValid =
    b !== undefined && bOffset >= 0 && bOffset + length <= b.length;

  if (!aValid || !bValid) {
    return aValid === bValid;
  }

  for (let index = 0; index < length; index += 1) {
    if (a[aOffset + index] !== b[bOffset + index]) {
      return false;
    }
  }

  return true;
}

function optionalVecEqual(
  a: ArrayLike<number> | undefined,
  b: ArrayLike<number> | undefined,
  length: number,
): boolean {
  if (a === undefined || b === undefined) {
    return a === b;
  }

  return vecEqual(a, b, length);
}

function vecEqual(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  length: number,
): boolean {
  if (a.length < length || b.length < length) {
    return false;
  }

  for (let index = 0; index < length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
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
