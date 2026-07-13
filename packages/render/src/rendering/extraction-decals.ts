import {
  assetHandleKey,
  Enabled,
  type AssetRegistry,
  type EcsWorld,
  type Entity,
  transformPoint,
  type Aabb,
  type BoundingSphere,
  type Mat4,
  WorldTransform,
} from "@aperture-engine/simulation";
import {
  Decal,
  RenderLayer,
  RenderOrder,
  Visibility,
  validateDecalInput,
} from "./index.js";
import {
  createRenderSortKey,
  createStableRenderId,
  type BoundsPacket,
  type DecalPacket,
  type DecalSnapshotReport,
  type RenderDiagnostic,
} from "./snapshot.js";
import {
  computeViewDepth,
  firstMatchingSortView,
  isVisibleInAnyMatchingView,
  type ViewCullContext,
} from "./extraction-culling.js";
import {
  validateSamplerAssetState,
  validateTextureAssetState,
} from "./extraction-asset-validation.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import { decalInput } from "./extraction-inputs.js";
import { pushMatrix, readWorldMatrix } from "./extraction-matrices.js";

/**
 * Fallback live-decal cap used only when no live decal declares one (every
 * decal authored through `createDecal` carries a `capacity`, so this is a
 * belt-and-suspenders floor).
 */
export const DEFAULT_DECAL_CAPACITY = 256;

/**
 * Internal candidate carrying everything needed to emit a {@link DecalPacket}
 * plus the `sequence`/`capacity` fields the oldest-first cap consumes before a
 * packet is built.
 */
interface DecalCandidate {
  readonly entity: Entity;
  readonly input: ReturnType<typeof decalInput>;
  readonly worldMatrix: Mat4;
  readonly boundsPacket: BoundsPacket;
  readonly width: number;
  readonly height: number;
  readonly color: readonly [number, number, number, number];
  readonly depthOffset: number;
  readonly capacity: number;
  readonly sequence: number;
  readonly layerMask: number;
  readonly stableId: number;
  readonly sortViewId: number;
  readonly sortDepth: number;
  readonly order: number;
}

export interface DecalSelectionResult<T> {
  readonly rendered: readonly T[];
  readonly evicted: number;
}

/**
 * Oldest-first (ring-buffer) live-decal cap: keep the newest `capacity` records
 * by `sequence`, evicting the rest. Ties break by original order (stable) so a
 * deterministic candidate list yields a deterministic survivor set. Exported so
 * the cap/eviction policy is unit-testable in isolation.
 */
export function selectRenderedDecals<T extends { readonly sequence: number }>(
  records: readonly T[],
  capacity: number,
): DecalSelectionResult<T> {
  const effectiveCapacity = Math.max(1, Math.trunc(capacity));
  const indexed = records.map((record, index) => ({ record, index }));

  indexed.sort(
    (a, b) => a.record.sequence - b.record.sequence || a.index - b.index,
  );

  if (indexed.length <= effectiveCapacity) {
    return { rendered: indexed.map((entry) => entry.record), evicted: 0 };
  }

  const evicted = indexed.length - effectiveCapacity;

  return {
    rendered: indexed.slice(evicted).map((entry) => entry.record),
    evicted,
  };
}

export interface ExtractDecalsResult {
  readonly decals: DecalPacket[];
  readonly report?: DecalSnapshotReport;
}

export function extractDecals(
  world: EcsWorld,
  assets: AssetRegistry,
  transforms: number[],
  bounds: BoundsPacket[],
  diagnostics: RenderDiagnostic[],
  cameraLayerMask: number,
  viewCullContexts: readonly ViewCullContext[],
): ExtractDecalsResult {
  const query = world.queryManager.registerQuery({ required: [Decal] });
  const candidates: DecalCandidate[] = [];

  for (const entity of sortedEntities(query.entities)) {
    if (
      entity.hasComponent(Enabled) &&
      entity.getValue(Enabled, "value") === false
    ) {
      diagnostics.push(diagnostic("render.disabled", entity));
      continue;
    }

    if (
      entity.hasComponent(Visibility) &&
      entity.getValue(Visibility, "visible") === false
    ) {
      diagnostics.push(diagnostic("render.invisible", entity));
      continue;
    }

    if (entity.getValue(Decal, "visible") === false) {
      diagnostics.push(diagnostic("render.invisible", entity));
      continue;
    }

    if (!entity.hasComponent(WorldTransform)) {
      diagnostics.push(diagnostic("render.missingWorldTransform", entity));
      continue;
    }

    const input = decalInput(entity);
    const validation = validateDecalInput(input);

    if (!validation.valid) {
      for (const decalDiagnostic of validation.diagnostics) {
        diagnostics.push(diagnostic(`render.${decalDiagnostic.code}`, entity));
      }
      continue;
    }

    const layerMask = entity.hasComponent(RenderLayer)
      ? (entity.getValue(RenderLayer, "mask") ?? 1)
      : 1;

    if (layerMask === 0) {
      diagnostics.push(diagnostic("render.zeroLayerMask", entity));
      continue;
    }

    if (cameraLayerMask !== 0 && (layerMask & cameraLayerMask) === 0) {
      diagnostics.push(diagnostic("render.layerMismatch", entity));
      continue;
    }

    if (
      !validateTextureAssetState(input.texture, assets, entity, diagnostics)
    ) {
      continue;
    }

    if (
      input.sampler !== undefined &&
      input.sampler !== null &&
      !validateSamplerAssetState(input.sampler, assets, entity, diagnostics)
    ) {
      continue;
    }

    const worldMatrix = readWorldMatrix(entity);
    const width = entity.getValue(Decal, "width") ?? 1;
    const height = entity.getValue(Decal, "height") ?? 1;
    const boundsPacket = createDecalBoundsPacket(
      entity,
      worldMatrix,
      width,
      height,
    );

    if (
      !isVisibleInAnyMatchingView(
        boundsPacket.worldAabb,
        layerMask,
        viewCullContexts,
      )
    ) {
      continue;
    }

    const colorView = entity.getVectorView(Decal, "color");
    const opacity = entity.getValue(Decal, "opacity") ?? 1;
    const sortView = firstMatchingSortView(layerMask, viewCullContexts);

    candidates.push({
      entity,
      input,
      worldMatrix,
      boundsPacket,
      width,
      height,
      color: [
        colorView[0] ?? 1,
        colorView[1] ?? 1,
        colorView[2] ?? 1,
        (colorView[3] ?? 1) * Math.max(0, opacity),
      ],
      depthOffset: Math.max(0, entity.getValue(Decal, "depthBias") ?? 0.02),
      capacity: Math.max(
        1,
        entity.getValue(Decal, "capacity") ?? DEFAULT_DECAL_CAPACITY,
      ),
      sequence: entity.getValue(Decal, "sequence") ?? 0,
      layerMask,
      stableId: createStableRenderId(entityRef(entity)),
      sortViewId: sortView?.viewId ?? 0,
      sortDepth:
        sortView === undefined
          ? 0
          : computeViewDepth(
              sortView.viewMatrix,
              boundsPacket.worldSphere.center,
            ),
      order: entity.hasComponent(RenderOrder)
        ? (entity.getValue(RenderOrder, "value") ?? 0)
        : 0,
    });
  }

  if (candidates.length === 0) {
    return { decals: [] };
  }

  const capacity = candidates.reduce(
    (max, candidate) => Math.max(max, candidate.capacity),
    1,
  );
  const selection = selectRenderedDecals(candidates, capacity);
  const decals: DecalPacket[] = [];

  for (const candidate of selection.rendered) {
    const textureKey = assetHandleKey(candidate.input.texture);
    const worldTransformOffset = pushMatrix(transforms, candidate.worldMatrix);
    const boundsIndex = bounds.length;

    bounds.push({ ...candidate.boundsPacket, boundsId: boundsIndex });
    decals.push({
      renderId: candidate.stableId,
      entity: entityRef(candidate.entity),
      texture: candidate.input.texture,
      ...(candidate.input.sampler === undefined ||
      candidate.input.sampler === null
        ? {}
        : { sampler: candidate.input.sampler }),
      color: candidate.color,
      width: candidate.width,
      height: candidate.height,
      depthOffset: candidate.depthOffset,
      worldTransformOffset,
      boundsIndex,
      layerMask: candidate.layerMask,
      sortKey: createRenderSortKey({
        queue: "transparent",
        viewId: candidate.sortViewId,
        layer: candidate.layerMask,
        order: candidate.order,
        depth: candidate.sortDepth,
        pipelineKey: "decal-projected",
        materialKey: textureKey,
        meshKey: "decal-quad",
        stableId: candidate.stableId,
      }),
    });
  }

  return {
    decals,
    report: {
      capacity,
      live: decals.length,
      evicted: selection.evicted,
      submitted: candidates.length,
    },
  };
}

function createDecalBoundsPacket(
  entity: Entity,
  worldMatrix: Mat4,
  width: number,
  height: number,
): BoundsPacket {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const radius = Math.hypot(halfWidth, halfHeight);
  const center = transformPoint(worldMatrix, [0, 0, 0]);
  const localAabb: Aabb = {
    min: [-halfWidth, -halfHeight, -0.001],
    max: [halfWidth, halfHeight, 0.001],
  };
  const worldAabb: Aabb = {
    min: [center[0] - radius, center[1] - radius, center[2] - radius],
    max: [center[0] + radius, center[1] + radius, center[2] + radius],
  };
  const localSphere: BoundingSphere = {
    center: [0, 0, 0],
    radius,
  };

  return {
    boundsId: 0,
    entity: entityRef(entity),
    localAabb,
    worldAabb,
    localSphere,
    worldSphere: { center, radius },
  };
}
