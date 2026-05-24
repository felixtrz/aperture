import type { LightPacket, RenderSnapshot } from "@aperture-engine/render";
import {
  createWebGpuBuffer,
  type WebGpuBufferDeviceLike,
  type WebGpuBufferFailureReason,
} from "./buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "./mesh-buffer-descriptors.js";

export const CLUSTERED_LOCAL_LIGHT_PIPELINE_FEATURE = "clusteredLocalLights";
export const LOCAL_LIGHT_CLUSTER_MIN_LIGHTS = 16;
export const LOCAL_LIGHT_CLUSTER_PARAMS_BINDING = 16;
export const LOCAL_LIGHT_CLUSTER_CELLS_BINDING = 17;
export const LOCAL_LIGHT_CLUSTER_INDICES_BINDING = 18;
export const LOCAL_LIGHT_CLUSTER_PARAM_FLOATS = 28;
export const DEFAULT_LOCAL_LIGHT_CLUSTER_RESOURCE_KEY =
  "local-light-cluster:main";

export type LocalLightClusterCoordinateSpace = "world" | "view-depth";

export type LocalLightClusterCoordinateSpaceOption =
  | LocalLightClusterCoordinateSpace
  | "auto";

export interface LocalLightClusterDimensions {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface LocalLightClusterBoundsPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface LocalLightClusterDescriptorOptions {
  readonly resourceKey?: string;
  readonly dimensions?: Partial<LocalLightClusterDimensions>;
  readonly minLocalLights?: number;
  readonly maxLightsPerCell?: number;
  readonly coordinateSpace?: LocalLightClusterCoordinateSpaceOption;
  readonly viewId?: number;
  readonly layerMask?: number;
}

export type LocalLightClusterFallbackReason =
  | "no-local-lights"
  | "below-threshold"
  | "missing-transform";

export interface LocalLightClusterDescriptor {
  readonly resourceKey: string;
  readonly enabled: boolean;
  readonly fallbackReason: LocalLightClusterFallbackReason | null;
  readonly totalLights: number;
  readonly totalLocalLights: number;
  readonly clusteredLocalLights: number;
  readonly layerMask: number | null;
  readonly lightSetKey: string;
  readonly coordinateSpace: LocalLightClusterCoordinateSpace;
  readonly viewId: number | null;
  readonly boundsMin: LocalLightClusterBoundsPoint;
  readonly boundsMax: LocalLightClusterBoundsPoint;
  readonly dimensions: LocalLightClusterDimensions;
  readonly cellCount: number;
  readonly populatedCells: number;
  readonly maxLightsPerPopulatedCell: number;
  readonly averageLightsPerPopulatedCell: number;
  readonly totalAssignedLightReferences: number;
  readonly occupancyHash: number;
  readonly overflowedCells: number;
  readonly maxLightsPerCell: number;
  readonly params: Float32Array;
  readonly cells: Uint32Array;
  readonly indices: Uint32Array;
}

export type LocalLightClusterGpuResourceDiagnosticCode =
  "localLightClusterGpuBuffer.creationFailed";

export interface LocalLightClusterGpuResourceDiagnostic {
  readonly code: LocalLightClusterGpuResourceDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuBufferFailureReason;
  readonly resourceKey?: string;
}

export interface LocalLightClusterGpuResource {
  readonly resourceKey: string;
  readonly paramsResourceKey: string;
  readonly cellsResourceKey: string;
  readonly indicesResourceKey: string;
  readonly paramsBuffer: unknown;
  readonly cellsBuffer: unknown;
  readonly indicesBuffer: unknown;
  descriptor: LocalLightClusterDescriptor;
}

export interface CreateLocalLightClusterGpuResourceResult {
  readonly valid: boolean;
  readonly resource: LocalLightClusterGpuResource | null;
  readonly diagnostics: readonly LocalLightClusterGpuResourceDiagnostic[];
}

export interface LocalLightClusterReport {
  readonly enabled: boolean;
  readonly fallbackReason: LocalLightClusterFallbackReason | null;
  readonly totalLights: number;
  readonly totalLocalLights: number;
  readonly clusteredLocalLights: number;
  readonly layerMask: number | null;
  readonly lightSetKey: string;
  readonly coordinateSpace: LocalLightClusterCoordinateSpace;
  readonly viewId: number | null;
  readonly boundsMin: LocalLightClusterBoundsPoint;
  readonly boundsMax: LocalLightClusterBoundsPoint;
  readonly clusterDimensions: LocalLightClusterDimensions;
  readonly cellCount: number;
  readonly populatedCells: number;
  readonly maxLightsPerPopulatedCell: number;
  readonly averageLightsPerPopulatedCell: number;
  readonly totalAssignedLightReferences: number;
  readonly occupancyHash: number;
  readonly overflowedCells: number;
  readonly maxLightsPerCell: number;
  readonly resourceKey: string;
  readonly paramsResourceKey: string;
  readonly cellsResourceKey: string;
  readonly indicesResourceKey: string;
  readonly resourceReuse: {
    readonly buffersCreated: number;
    readonly buffersReused: number;
  };
  readonly routes?: readonly LocalLightClusterReport[];
}

interface LocalLightSphere {
  readonly lightIndex: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
}

interface LocalLightClusterBounds {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
}

interface SelectedLocalLightClusterSpace {
  readonly coordinateSpace: LocalLightClusterCoordinateSpace;
  readonly viewId: number | null;
  readonly viewMatrix: ArrayLike<number>;
  readonly projectionMatrix: ArrayLike<number> | null;
}

const IDENTITY_VIEW_MATRIX = Object.freeze([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
] as const);

export function snapshotShouldUseClusteredLocalLights(
  snapshot: RenderSnapshot,
  minLocalLights = LOCAL_LIGHT_CLUSTER_MIN_LIGHTS,
  layerMask?: number,
): boolean {
  return (
    countLocalLights(snapshot.lights, normalizeLayerMask(layerMask)) >=
    minLocalLights
  );
}

export function createLocalLightClusterDescriptor(
  snapshot: RenderSnapshot,
  options: LocalLightClusterDescriptorOptions = {},
): LocalLightClusterDescriptor {
  const dimensions = normalizeDimensions(options.dimensions);
  const maxLightsPerCell = normalizePositiveInteger(
    options.maxLightsPerCell,
    64,
  );
  const minLocalLights = normalizePositiveInteger(
    options.minLocalLights,
    LOCAL_LIGHT_CLUSTER_MIN_LIGHTS,
  );
  const layerMask = normalizeLayerMask(options.layerMask);
  const totalLocalLights = countLocalLights(snapshot.lights, layerMask);
  const localLights = localLightSpheres(snapshot, layerMask);
  const clusterSpace = selectLocalLightClusterSpace(snapshot, {
    ...(options.coordinateSpace === undefined
      ? {}
      : { coordinateSpace: options.coordinateSpace }),
    ...(options.viewId === undefined ? {} : { viewId: options.viewId }),
    layerMask,
  });
  const lightSetKey = localLightSetKey(snapshot.lights, layerMask);
  const resourceKey =
    options.resourceKey ??
    createLocalLightClusterResourceKey(clusterSpace, lightSetKey);
  const cellCount = dimensions.x * dimensions.y * dimensions.z;
  const empty = () =>
    emptyLocalLightClusterDescriptor({
      resourceKey,
      layerMask,
      lightSetKey,
      dimensions,
      cellCount,
      maxLightsPerCell,
      totalLights: snapshot.lights.length,
      totalLocalLights,
      clusterSpace,
      fallbackReason: localLights.missingTransform
        ? "missing-transform"
        : localLights.spheres.length === 0
          ? "no-local-lights"
          : "below-threshold",
    });

  if (localLights.missingTransform || localLights.spheres.length === 0) {
    return empty();
  }

  if (localLights.spheres.length < minLocalLights) {
    return empty();
  }

  const clusterLights =
    clusterSpace.coordinateSpace === "view-depth"
      ? transformLocalLightSpheres(localLights.spheres, clusterSpace.viewMatrix)
      : localLights.spheres;
  const bounds =
    clusterSpace.coordinateSpace === "view-depth" &&
    clusterSpace.projectionMatrix !== null
      ? viewDepthClusterBounds(clusterLights, clusterSpace.projectionMatrix)
      : localLightBounds(clusterLights);
  const cellSize = {
    x: Math.max((bounds.maxX - bounds.minX) / dimensions.x, 0.0001),
    y: Math.max((bounds.maxY - bounds.minY) / dimensions.y, 0.0001),
    z: Math.max((bounds.maxZ - bounds.minZ) / dimensions.z, 0.0001),
  };
  const params = new Float32Array(LOCAL_LIGHT_CLUSTER_PARAM_FLOATS);
  const cells = new Uint32Array(cellCount * 2);
  const indices = new Uint32Array(Math.max(cellCount * maxLightsPerCell, 1));
  let indexCursor = 0;
  let populatedCells = 0;
  let maxLightsPerPopulatedCell = 0;
  let totalAssignedLightReferences = 0;
  let overflowedCells = 0;

  params.set(
    [
      bounds.minX,
      bounds.minY,
      bounds.minZ,
      clusterSpace.coordinateSpace === "view-depth" ? 1 : 0,
      1 / cellSize.x,
      1 / cellSize.y,
      1 / cellSize.z,
      clusterSpace.viewId ?? -1,
      dimensions.x,
      dimensions.y,
      dimensions.z,
      1,
    ],
    0,
  );
  params.set(clusterSpace.viewMatrix, 12);

  for (let z = 0; z < dimensions.z; z += 1) {
    for (let y = 0; y < dimensions.y; y += 1) {
      for (let x = 0; x < dimensions.x; x += 1) {
        const cellIndex = clusterCellIndex(x, y, z, dimensions);
        const cellLights = localLightsForCell({
          lights: clusterLights,
          x,
          y,
          z,
          bounds,
          cellSize,
          maxLightsPerCell,
        });
        const cellOffset = indexCursor;
        const storedCount = Math.min(cellLights.length, maxLightsPerCell);

        if (cellLights.length > maxLightsPerCell) {
          overflowedCells += 1;
        }

        for (let index = 0; index < storedCount; index += 1) {
          const lightIndex = cellLights[index];

          if (lightIndex !== undefined) {
            indices[indexCursor] = lightIndex;
            indexCursor += 1;
          }
        }

        cells[cellIndex * 2] = cellOffset;
        cells[cellIndex * 2 + 1] = storedCount;

        if (storedCount > 0) {
          populatedCells += 1;
          maxLightsPerPopulatedCell = Math.max(
            maxLightsPerPopulatedCell,
            storedCount,
          );
          totalAssignedLightReferences += storedCount;
        }
      }
    }
  }

  return {
    resourceKey,
    enabled: true,
    fallbackReason: null,
    totalLights: snapshot.lights.length,
    totalLocalLights,
    clusteredLocalLights: clusterLights.length,
    layerMask,
    lightSetKey,
    coordinateSpace: clusterSpace.coordinateSpace,
    viewId: clusterSpace.viewId,
    boundsMin: { x: bounds.minX, y: bounds.minY, z: bounds.minZ },
    boundsMax: { x: bounds.maxX, y: bounds.maxY, z: bounds.maxZ },
    dimensions,
    cellCount,
    populatedCells,
    maxLightsPerPopulatedCell,
    averageLightsPerPopulatedCell:
      populatedCells === 0 ? 0 : totalAssignedLightReferences / populatedCells,
    totalAssignedLightReferences,
    occupancyHash: hashLocalLightClusterCells(cells),
    overflowedCells,
    maxLightsPerCell,
    params,
    cells,
    indices,
  };
}

export function createLocalLightClusterGpuResource(options: {
  readonly device: WebGpuBufferDeviceLike;
  readonly descriptor: LocalLightClusterDescriptor;
}): CreateLocalLightClusterGpuResourceResult {
  const paramsResourceKey = `${options.descriptor.resourceKey}/params`;
  const cellsResourceKey = `${options.descriptor.resourceKey}/cells`;
  const indicesResourceKey = `${options.descriptor.resourceKey}/indices`;
  const usage =
    WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;
  const params = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: paramsResourceKey,
      size: options.descriptor.params.byteLength,
      usage,
      initialData: options.descriptor.params,
    },
  });
  const cells = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: cellsResourceKey,
      size: options.descriptor.cells.byteLength,
      usage,
      initialData: options.descriptor.cells,
    },
  });
  const indices = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: indicesResourceKey,
      size: options.descriptor.indices.byteLength,
      usage,
      initialData: options.descriptor.indices,
    },
  });
  const diagnostics: LocalLightClusterGpuResourceDiagnostic[] = [];

  pushCreationDiagnostic(diagnostics, params, paramsResourceKey);
  pushCreationDiagnostic(diagnostics, cells, cellsResourceKey);
  pushCreationDiagnostic(diagnostics, indices, indicesResourceKey);

  if (!params.ok || !cells.ok || !indices.ok) {
    return { valid: false, resource: null, diagnostics };
  }

  return {
    valid: true,
    resource: {
      resourceKey: options.descriptor.resourceKey,
      paramsResourceKey,
      cellsResourceKey,
      indicesResourceKey,
      paramsBuffer: params.buffer,
      cellsBuffer: cells.buffer,
      indicesBuffer: indices.buffer,
      descriptor: options.descriptor,
    },
    diagnostics,
  };
}

export function localLightClusterReportFromDescriptor(
  descriptor: LocalLightClusterDescriptor,
  options: {
    readonly resource?: LocalLightClusterGpuResource | null;
    readonly buffersCreated?: number;
    readonly buffersReused?: number;
  } = {},
): LocalLightClusterReport {
  const resource = options.resource ?? null;

  return {
    enabled: descriptor.enabled,
    fallbackReason: descriptor.fallbackReason,
    totalLights: descriptor.totalLights,
    totalLocalLights: descriptor.totalLocalLights,
    clusteredLocalLights: descriptor.clusteredLocalLights,
    layerMask: descriptor.layerMask,
    lightSetKey: descriptor.lightSetKey,
    coordinateSpace: descriptor.coordinateSpace,
    viewId: descriptor.viewId,
    boundsMin: { ...descriptor.boundsMin },
    boundsMax: { ...descriptor.boundsMax },
    clusterDimensions: { ...descriptor.dimensions },
    cellCount: descriptor.cellCount,
    populatedCells: descriptor.populatedCells,
    maxLightsPerPopulatedCell: descriptor.maxLightsPerPopulatedCell,
    averageLightsPerPopulatedCell: descriptor.averageLightsPerPopulatedCell,
    totalAssignedLightReferences: descriptor.totalAssignedLightReferences,
    occupancyHash: descriptor.occupancyHash,
    overflowedCells: descriptor.overflowedCells,
    maxLightsPerCell: descriptor.maxLightsPerCell,
    resourceKey: descriptor.resourceKey,
    paramsResourceKey:
      resource?.paramsResourceKey ?? `${descriptor.resourceKey}/params`,
    cellsResourceKey:
      resource?.cellsResourceKey ?? `${descriptor.resourceKey}/cells`,
    indicesResourceKey:
      resource?.indicesResourceKey ?? `${descriptor.resourceKey}/indices`,
    resourceReuse: {
      buffersCreated: options.buffersCreated ?? 0,
      buffersReused: options.buffersReused ?? 0,
    },
  };
}

function emptyLocalLightClusterDescriptor(input: {
  readonly resourceKey: string;
  readonly layerMask: number | null;
  readonly lightSetKey: string;
  readonly dimensions: LocalLightClusterDimensions;
  readonly cellCount: number;
  readonly maxLightsPerCell: number;
  readonly totalLights: number;
  readonly totalLocalLights: number;
  readonly clusterSpace: SelectedLocalLightClusterSpace;
  readonly fallbackReason: LocalLightClusterFallbackReason;
}): LocalLightClusterDescriptor {
  const params = new Float32Array(LOCAL_LIGHT_CLUSTER_PARAM_FLOATS);

  params.set(
    [
      0,
      0,
      0,
      input.clusterSpace.coordinateSpace === "view-depth" ? 1 : 0,
      1,
      1,
      1,
      input.clusterSpace.viewId ?? -1,
      1,
      1,
      1,
      0,
    ],
    0,
  );
  params.set(input.clusterSpace.viewMatrix, 12);

  return {
    resourceKey: input.resourceKey,
    enabled: false,
    fallbackReason: input.fallbackReason,
    totalLights: input.totalLights,
    totalLocalLights: input.totalLocalLights,
    clusteredLocalLights: 0,
    layerMask: input.layerMask,
    lightSetKey: input.lightSetKey,
    coordinateSpace: input.clusterSpace.coordinateSpace,
    viewId: input.clusterSpace.viewId,
    boundsMin: { x: 0, y: 0, z: 0 },
    boundsMax: { x: 1, y: 1, z: 1 },
    dimensions: input.dimensions,
    cellCount: input.cellCount,
    populatedCells: 0,
    maxLightsPerPopulatedCell: 0,
    averageLightsPerPopulatedCell: 0,
    totalAssignedLightReferences: 0,
    occupancyHash: 0,
    overflowedCells: 0,
    maxLightsPerCell: input.maxLightsPerCell,
    params,
    cells: new Uint32Array(Math.max(input.cellCount * 2, 2)),
    indices: new Uint32Array([0]),
  };
}

function normalizeLayerMask(layerMask: number | undefined): number | null {
  if (layerMask === undefined || !Number.isFinite(layerMask)) {
    return null;
  }

  const normalized = Math.trunc(layerMask);

  return normalized === 0 ? null : normalized;
}

function lightMatchesLayer(
  light: Pick<LightPacket, "layerMask">,
  layerMask: number | null,
): boolean {
  return layerMask === null || (light.layerMask & layerMask) !== 0;
}

function localLightSetKey(
  lights: readonly LightPacket[],
  layerMask: number | null,
): string {
  const lightIds: number[] = [];

  for (let index = 0; index < lights.length; index += 1) {
    const light = lights[index];

    if (
      light !== undefined &&
      (light.kind === "point" || light.kind === "spot") &&
      lightMatchesLayer(light, layerMask)
    ) {
      lightIds.push(light.lightId);
    }
  }

  return [
    `layers:${layerMask === null ? "all" : layerMask.toString(16)}`,
    `lights:${lightIds.join(",")}`,
  ].join("|");
}

function createLocalLightClusterResourceKey(
  clusterSpace: SelectedLocalLightClusterSpace,
  lightSetKey: string,
): string {
  const viewKey =
    clusterSpace.viewId === null ? "world" : `view-${clusterSpace.viewId}`;

  return `local-light-cluster:${viewKey}:set-${hashString(lightSetKey).toString(16)}`;
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function countLocalLights(
  lights: readonly LightPacket[],
  layerMask: number | null = null,
): number {
  let count = 0;

  for (const light of lights) {
    if (
      (light.kind === "point" || light.kind === "spot") &&
      lightMatchesLayer(light, layerMask)
    ) {
      count += 1;
    }
  }

  return count;
}

function localLightSpheres(
  snapshot: RenderSnapshot,
  layerMask: number | null,
): {
  readonly spheres: readonly LocalLightSphere[];
  readonly missingTransform: boolean;
} {
  const spheres: LocalLightSphere[] = [];
  let missingTransform = false;

  for (let index = 0; index < snapshot.lights.length; index += 1) {
    const light = snapshot.lights[index];

    if (
      light === undefined ||
      (light.kind !== "point" && light.kind !== "spot") ||
      !lightMatchesLayer(light, layerMask)
    ) {
      continue;
    }

    const matrixOffset = light.worldTransformOffset;

    if (matrixOffset < 0 || matrixOffset + 15 >= snapshot.transforms.length) {
      missingTransform = true;
      continue;
    }

    spheres.push({
      lightIndex: index,
      x: snapshot.transforms[matrixOffset + 12] ?? 0,
      y: snapshot.transforms[matrixOffset + 13] ?? 0,
      z: snapshot.transforms[matrixOffset + 14] ?? 0,
      radius: Math.max(light.range, 0.0001),
    });
  }

  return { spheres, missingTransform };
}

function selectLocalLightClusterSpace(
  snapshot: RenderSnapshot,
  options: Pick<
    LocalLightClusterDescriptorOptions,
    "coordinateSpace" | "viewId"
  > & { readonly layerMask: number | null },
): SelectedLocalLightClusterSpace {
  const requested = options.coordinateSpace ?? "auto";

  if (requested === "world") {
    return worldLocalLightClusterSpace();
  }

  const view = selectLocalLightClusterView(
    snapshot,
    options.viewId,
    options.layerMask,
  );

  if (view === null) {
    return worldLocalLightClusterSpace();
  }

  return {
    coordinateSpace: "view-depth",
    viewId: view.viewId,
    viewMatrix: snapshot.viewMatrices.subarray(
      view.viewMatrixOffset,
      view.viewMatrixOffset + 16,
    ),
    projectionMatrix: snapshot.viewMatrices.subarray(
      view.projectionMatrixOffset,
      view.projectionMatrixOffset + 16,
    ),
  };
}

function worldLocalLightClusterSpace(): SelectedLocalLightClusterSpace {
  return {
    coordinateSpace: "world",
    viewId: null,
    viewMatrix: IDENTITY_VIEW_MATRIX,
    projectionMatrix: null,
  };
}

function selectLocalLightClusterView(
  snapshot: RenderSnapshot,
  viewId: number | undefined,
  layerMask: number | null,
): RenderSnapshot["views"][number] | null {
  let selected: RenderSnapshot["views"][number] | null = null;

  for (const view of snapshot.views) {
    if (viewId !== undefined && view.viewId !== viewId) {
      continue;
    }

    if (
      viewId === undefined &&
      layerMask !== null &&
      (view.layerMask & layerMask) === 0
    ) {
      continue;
    }

    if (
      hasMatrixRange(snapshot.viewMatrices, view.viewMatrixOffset) &&
      hasMatrixRange(snapshot.viewMatrices, view.projectionMatrixOffset)
    ) {
      if (viewId !== undefined) {
        return view;
      }

      if (
        selected === null ||
        view.priority > selected.priority ||
        (view.priority === selected.priority && view.viewId < selected.viewId)
      ) {
        selected = view;
      }
    }
  }

  return selected;
}

function transformLocalLightSpheres(
  spheres: readonly LocalLightSphere[],
  matrix: ArrayLike<number>,
): readonly LocalLightSphere[] {
  const transformed: LocalLightSphere[] = [];

  for (const sphere of spheres) {
    transformed.push({
      lightIndex: sphere.lightIndex,
      ...transformPoint(matrix, sphere.x, sphere.y, sphere.z),
      radius: sphere.radius,
    });
  }

  return transformed;
}

function localLightBounds(
  lights: readonly LocalLightSphere[],
): LocalLightClusterBounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const light of lights) {
    minX = Math.min(minX, light.x - light.radius);
    minY = Math.min(minY, light.y - light.radius);
    minZ = Math.min(minZ, light.z - light.radius);
    maxX = Math.max(maxX, light.x + light.radius);
    maxY = Math.max(maxY, light.y + light.radius);
    maxZ = Math.max(maxZ, light.z + light.radius);
  }

  const padding = 0.001;

  return {
    minX: minX - padding,
    minY: minY - padding,
    minZ: minZ - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
    maxZ: maxZ + padding,
  };
}

function viewDepthClusterBounds(
  lights: readonly LocalLightSphere[],
  projectionMatrix: ArrayLike<number>,
): LocalLightClusterBounds {
  let minDepth = Number.POSITIVE_INFINITY;
  let maxDepth = Number.NEGATIVE_INFINITY;

  for (const light of lights) {
    const depth = -light.z;

    minDepth = Math.min(minDepth, depth - light.radius);
    maxDepth = Math.max(maxDepth, depth + light.radius);
  }

  const nearDepth = Math.max(minDepth, 0.0001);
  const farDepth = Math.max(maxDepth, nearDepth + 0.0001);
  const perspective = projectionLooksPerspective(projectionMatrix);
  const projectionX = Math.max(Math.abs(projectionMatrix[0] ?? 1), 0.0001);
  const projectionY = Math.max(Math.abs(projectionMatrix[5] ?? 1), 0.0001);
  const xExtent = perspective ? farDepth / projectionX : 1 / projectionX;
  const yExtent = perspective ? farDepth / projectionY : 1 / projectionY;
  const padding = 0.001;

  return {
    minX: -xExtent - padding,
    minY: -yExtent - padding,
    minZ: -farDepth - padding,
    maxX: xExtent + padding,
    maxY: yExtent + padding,
    maxZ: -nearDepth + padding,
  };
}

function localLightsForCell(input: {
  readonly lights: readonly LocalLightSphere[];
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly bounds: ReturnType<typeof localLightBounds>;
  readonly cellSize: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly maxLightsPerCell: number;
}): number[] {
  const min = {
    x: input.bounds.minX + input.x * input.cellSize.x,
    y: input.bounds.minY + input.y * input.cellSize.y,
    z: input.bounds.minZ + input.z * input.cellSize.z,
  };
  const max = {
    x: min.x + input.cellSize.x,
    y: min.y + input.cellSize.y,
    z: min.z + input.cellSize.z,
  };
  const result: number[] = [];

  for (const light of input.lights) {
    if (sphereIntersectsAabb(light, min, max)) {
      result.push(light.lightIndex);
    }
  }

  result.sort((a, b) => a - b);

  return result;
}

function sphereIntersectsAabb(
  light: LocalLightSphere,
  min: { readonly x: number; readonly y: number; readonly z: number },
  max: { readonly x: number; readonly y: number; readonly z: number },
): boolean {
  const dx = axisDistanceSquared(light.x, min.x, max.x);
  const dy = axisDistanceSquared(light.y, min.y, max.y);
  const dz = axisDistanceSquared(light.z, min.z, max.z);

  return dx + dy + dz <= light.radius * light.radius;
}

function axisDistanceSquared(value: number, min: number, max: number): number {
  if (value < min) {
    return (min - value) * (min - value);
  }

  if (value > max) {
    return (value - max) * (value - max);
  }

  return 0;
}

function transformPoint(
  matrix: ArrayLike<number>,
  x: number,
  y: number,
  z: number,
): { readonly x: number; readonly y: number; readonly z: number } {
  return {
    x:
      (matrix[0] ?? 1) * x +
      (matrix[4] ?? 0) * y +
      (matrix[8] ?? 0) * z +
      (matrix[12] ?? 0),
    y:
      (matrix[1] ?? 0) * x +
      (matrix[5] ?? 1) * y +
      (matrix[9] ?? 0) * z +
      (matrix[13] ?? 0),
    z:
      (matrix[2] ?? 0) * x +
      (matrix[6] ?? 0) * y +
      (matrix[10] ?? 1) * z +
      (matrix[14] ?? 0),
  };
}

function projectionLooksPerspective(projectionMatrix: ArrayLike<number>): boolean {
  return (
    Math.abs(projectionMatrix[11] ?? 0) > 0.5 ||
    Math.abs(projectionMatrix[15] ?? 1) < 0.5
  );
}

function hasMatrixRange(values: Float32Array, offset: number): boolean {
  return (
    Number.isInteger(offset) &&
    offset >= 0 &&
    offset + 16 <= values.length
  );
}

function hashLocalLightClusterCells(cells: Uint32Array): number {
  let hash = 2166136261;

  for (let index = 0; index < cells.length; index += 1) {
    hash ^= cells[index] ?? 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash;
}

function clusterCellIndex(
  x: number,
  y: number,
  z: number,
  dimensions: LocalLightClusterDimensions,
): number {
  return x + y * dimensions.x + z * dimensions.x * dimensions.y;
}

function normalizeDimensions(
  dimensions: Partial<LocalLightClusterDimensions> | undefined,
): LocalLightClusterDimensions {
  return {
    x: normalizePositiveInteger(dimensions?.x, 8),
    y: normalizePositiveInteger(dimensions?.y, 4),
    z: normalizePositiveInteger(dimensions?.z, 8),
  };
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  return value !== undefined && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function pushCreationDiagnostic(
  diagnostics: LocalLightClusterGpuResourceDiagnostic[],
  result: ReturnType<typeof createWebGpuBuffer>,
  resourceKey: string,
): void {
  if (result.ok) {
    return;
  }

  diagnostics.push({
    code: "localLightClusterGpuBuffer.creationFailed",
    reason: result.reason,
    resourceKey,
    message: `Failed to create local-light cluster buffer '${resourceKey}': ${result.message}`,
  });
}
