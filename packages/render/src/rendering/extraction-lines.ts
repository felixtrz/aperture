import {
  Enabled,
  transformPoint,
  WorldTransform,
  type AssetRegistry,
  type EcsWorld,
  type Entity,
  type Aabb,
  type BoundingSphere,
  type Mat4,
} from "@aperture-engine/simulation";
import { Line, RenderLayer, RenderOrder, Visibility } from "./index.js";
import { validateLineInput } from "./authoring-validation.js";
import {
  createRenderSortKey,
  createStableRenderId,
  type BoundsPacket,
  type LinePacket,
  type LineSnapshotReport,
  type RenderDiagnostic,
} from "./snapshot.js";
import {
  computeViewDepth,
  firstMatchingSortView,
  isVisibleInAnyMatchingView,
  type ViewCullContext,
} from "./extraction-culling.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import { lineInput } from "./extraction-inputs.js";
import { pushMatrix, readWorldMatrix } from "./extraction-matrices.js";

export interface ExtractLinesResult {
  readonly lines: LinePacket[];
  readonly report?: LineSnapshotReport;
}

/**
 * Extract fat-line (Line2-style) packets (E1). Each {@link Line} entity's
 * polyline vertices are copied (local space) into the shared `lineVertices`
 * accumulator and referenced by a {@link LinePacket} slice. Invalid geometry is
 * rejected with a structured diagnostic and no packet, so a bad polyline never
 * becomes a raw WebGPU validation error.
 */
export function extractLines(
  world: EcsWorld,
  _assets: AssetRegistry,
  transforms: number[],
  lineVertices: number[],
  bounds: BoundsPacket[],
  diagnostics: RenderDiagnostic[],
  cameraLayerMask: number,
  viewCullContexts: readonly ViewCullContext[],
): ExtractLinesResult {
  const query = world.queryManager.registerQuery({ required: [Line] });
  const lines: LinePacket[] = [];
  let segments = 0;
  let vertices = 0;

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

    if (entity.getValue(Line, "visible") === false) {
      diagnostics.push(diagnostic("render.invisible", entity));
      continue;
    }

    if (!entity.hasComponent(WorldTransform)) {
      diagnostics.push(diagnostic("render.missingWorldTransform", entity));
      continue;
    }

    const input = lineInput(entity);
    const validation = validateLineInput(input);

    if (!validation.valid) {
      for (const lineDiagnostic of validation.diagnostics) {
        diagnostics.push(diagnostic(`render.${lineDiagnostic.code}`, entity));
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

    const positions = input.positions as Float32Array;
    const vertexCount = Math.floor(positions.length / 3);
    const worldMatrix = readWorldMatrix(entity);
    const boundsPacket = createPolylineBoundsPacket(
      entity,
      worldMatrix,
      positions,
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

    const colorView = entity.getVectorView(Line, "color");
    const sortView = firstMatchingSortView(layerMask, viewCullContexts);
    const stableId = createStableRenderId(entityRef(entity));
    const worldTransformOffset = pushMatrix(transforms, worldMatrix);
    const vertexOffset = lineVertices.length / 3;

    for (let index = 0; index < vertexCount * 3; index += 1) {
      lineVertices.push(positions[index] ?? 0);
    }

    const boundsIndex = bounds.length;
    bounds.push({ ...boundsPacket, boundsId: boundsIndex });

    lines.push({
      renderId: stableId,
      entity: entityRef(entity),
      vertexOffset,
      vertexCount,
      color: [
        colorView[0] ?? 1,
        colorView[1] ?? 1,
        colorView[2] ?? 1,
        colorView[3] ?? 1,
      ],
      width: Math.max(0, entity.getValue(Line, "width") ?? 2),
      dashSize: Math.max(0, entity.getValue(Line, "dashSize") ?? 0),
      gapSize: Math.max(0, entity.getValue(Line, "gapSize") ?? 0),
      dashOffset: entity.getValue(Line, "dashOffset") ?? 0,
      worldTransformOffset,
      boundsIndex,
      layerMask,
      sortKey: createRenderSortKey({
        queue: "transparent",
        viewId: sortView?.viewId ?? 0,
        layer: layerMask,
        order: entity.hasComponent(RenderOrder)
          ? (entity.getValue(RenderOrder, "value") ?? 0)
          : 0,
        depth:
          sortView === undefined
            ? 0
            : computeViewDepth(
                sortView.viewMatrix,
                boundsPacket.worldSphere.center,
              ),
        pipelineKey: "fat-line",
        materialKey: "fat-line",
        meshKey: "fat-line-segment",
        stableId,
      }),
    });
    segments += Math.max(0, vertexCount - 1);
    vertices += vertexCount;
  }

  if (lines.length === 0) {
    return { lines: [] };
  }

  return { lines, report: { lines: lines.length, segments, vertices } };
}

function createPolylineBoundsPacket(
  entity: Entity,
  worldMatrix: Mat4,
  positions: Float32Array,
): BoundsPacket {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  const vertexCount = Math.floor(positions.length / 3);

  for (let index = 0; index < vertexCount; index += 1) {
    const x = positions[index * 3] ?? 0;
    const y = positions[index * 3 + 1] ?? 0;
    const z = positions[index * 3 + 2] ?? 0;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  const localAabb: Aabb = {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
  };
  const localCenter: [number, number, number] = [
    (minX + maxX) * 0.5,
    (minY + maxY) * 0.5,
    (minZ + maxZ) * 0.5,
  ];
  const localRadius = Math.hypot(
    maxX - localCenter[0],
    maxY - localCenter[1],
    maxZ - localCenter[2],
  );
  const localSphere: BoundingSphere = {
    center: localCenter,
    radius: localRadius,
  };
  const center = transformPoint(worldMatrix, localCenter);
  const scale = Math.max(
    columnLength(worldMatrix, 0),
    columnLength(worldMatrix, 1),
    columnLength(worldMatrix, 2),
  );
  const radius = localRadius * scale;
  const worldAabb: Aabb = {
    min: [center[0] - radius, center[1] - radius, center[2] - radius],
    max: [center[0] + radius, center[1] + radius, center[2] + radius],
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

function columnLength(matrix: Mat4, column: number): number {
  const base = column * 4;
  return Math.hypot(
    matrix[base] ?? 0,
    matrix[base + 1] ?? 0,
    matrix[base + 2] ?? 0,
  );
}
