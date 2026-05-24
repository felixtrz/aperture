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
export const LOCAL_LIGHT_CLUSTER_METADATA_BINDING = 19;
export const LOCAL_LIGHT_CLUSTER_PARAM_FLOATS = 28;
export const LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE = 4;
export const LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_REQUEST = 1 << 0;
export const LOCAL_LIGHT_CLUSTER_METADATA_FLAG_COOKIE_REQUEST = 1 << 1;
export const LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_SAMPLING_DEFERRED =
  1 << 2;
export const LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_SAMPLING_SUPPORTED =
  1 << 3;
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

export type LocalLightClusterAssignmentStrategy = "none" | "light-range";

export interface LocalLightClusterBuildPressure {
  readonly assignmentStrategy: LocalLightClusterAssignmentStrategy;
  readonly naiveCellLightPairTests: number;
  readonly lightCellRangeTests: number;
  readonly lightCellWriteAttempts: number;
  readonly storedLightReferences: number;
  readonly skippedOverflowReferences: number;
}

export type LocalLightClusterFeatureStatus =
  | "not-requested"
  | "sampling-ready"
  | "metadata-only"
  | "not-supported";

export interface LocalLightClusterSupportedShadowResource {
  readonly shadowId: number;
  readonly lightId: number;
  readonly matrixBaseIndex?: number;
}

export type LocalLightClusterSupportedPointShadowResource =
  LocalLightClusterSupportedShadowResource;

export type LocalLightClusterSupportedSpotShadowResource =
  LocalLightClusterSupportedShadowResource;

export interface LocalLightClusterShadowCookieMetadata {
  readonly wordsPerLight: typeof LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE;
  readonly totalMetadataLights: number;
  readonly shadow: {
    readonly status: LocalLightClusterFeatureStatus;
    readonly samplingSupported: boolean;
    readonly localRequestCount: number;
    readonly clusteredLightCount: number;
    readonly supportedLightCount: number;
    readonly fallbackReason: string | null;
  };
  readonly cookie: {
    readonly status: LocalLightClusterFeatureStatus;
    readonly samplingSupported: boolean;
    readonly localRequestCount: number;
    readonly clusteredLightCount: number;
    readonly supportedLightCount: number;
    readonly fallbackReason: string | null;
  };
}

export interface LocalLightClusterDescriptorOptions {
  readonly resourceKey?: string;
  readonly dimensions?: Partial<LocalLightClusterDimensions>;
  readonly minLocalLights?: number;
  readonly maxLightsPerCell?: number;
  readonly coordinateSpace?: LocalLightClusterCoordinateSpaceOption;
  readonly viewId?: number;
  readonly layerMask?: number;
  readonly supportedPointShadowResources?: readonly LocalLightClusterSupportedPointShadowResource[];
  readonly supportedSpotShadowResources?: readonly LocalLightClusterSupportedSpotShadowResource[];
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
  readonly buildPressure: LocalLightClusterBuildPressure;
  readonly shadowCookieMetadata: LocalLightClusterShadowCookieMetadata;
  readonly params: Float32Array;
  readonly cells: Uint32Array;
  readonly indices: Uint32Array;
  readonly metadata: Uint32Array;
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
  readonly metadataResourceKey: string;
  readonly paramsBuffer: unknown;
  readonly cellsBuffer: unknown;
  readonly indicesBuffer: unknown;
  readonly metadataBuffer: unknown;
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
  readonly buildPressure: LocalLightClusterBuildPressure;
  readonly shadowCookieMetadata: LocalLightClusterShadowCookieMetadata;
  readonly resourceKey: string;
  readonly paramsResourceKey: string;
  readonly cellsResourceKey: string;
  readonly indicesResourceKey: string;
  readonly metadataResourceKey: string;
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

interface LocalLightClusterCellRange {
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

interface LocalLightClusterShadowCookieMetadataResult {
  readonly metadata: Uint32Array;
  readonly summary: LocalLightClusterShadowCookieMetadata;
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
  const shadowCookieMetadata = createLocalLightClusterShadowCookieMetadata(
    snapshot,
    localLights.spheres,
    layerMask,
    options.supportedPointShadowResources ?? [],
    options.supportedSpotShadowResources ?? [],
  );
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
      shadowCookieMetadata,
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
  const overflowedCellFlags = new Uint8Array(cellCount);
  let lightCellWriteAttempts = 0;
  let skippedOverflowReferences = 0;
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

  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    cells[cellIndex * 2] = cellIndex * maxLightsPerCell;
    cells[cellIndex * 2 + 1] = 0;
  }

  for (const light of clusterLights) {
    const range = localLightCellRange(light, bounds, cellSize, dimensions);

    if (range === null) {
      continue;
    }

    for (let z = range.minZ; z <= range.maxZ; z += 1) {
      for (let y = range.minY; y <= range.maxY; y += 1) {
        for (let x = range.minX; x <= range.maxX; x += 1) {
          const cellIndex = clusterCellIndex(x, y, z, dimensions);
          const cellCountOffset = cellIndex * 2 + 1;
          const storedCount = cells[cellCountOffset] ?? 0;

          lightCellWriteAttempts += 1;

          if (
            !sphereIntersectsClusterCell(
              light,
              x,
              y,
              z,
              bounds,
              cellSize,
            )
          ) {
            continue;
          }

          if (storedCount >= maxLightsPerCell) {
            skippedOverflowReferences += 1;

            if (overflowedCellFlags[cellIndex] === 0) {
              overflowedCellFlags[cellIndex] = 1;
              overflowedCells += 1;
            }

            continue;
          }

          indices[cellIndex * maxLightsPerCell + storedCount] =
            light.lightIndex;
          cells[cellCountOffset] = storedCount + 1;
        }
      }
    }
  }

  const pressure = summarizeClusterCells(cells);

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
    populatedCells: pressure.populatedCells,
    maxLightsPerPopulatedCell: pressure.maxLightsPerPopulatedCell,
    averageLightsPerPopulatedCell:
      pressure.populatedCells === 0
        ? 0
        : pressure.totalAssignedLightReferences / pressure.populatedCells,
    totalAssignedLightReferences: pressure.totalAssignedLightReferences,
    occupancyHash: hashLocalLightClusterCells(cells),
    overflowedCells,
    maxLightsPerCell,
    buildPressure: {
      assignmentStrategy: "light-range",
      naiveCellLightPairTests: cellCount * clusterLights.length,
      lightCellRangeTests: clusterLights.length,
      lightCellWriteAttempts,
      storedLightReferences: pressure.totalAssignedLightReferences,
      skippedOverflowReferences,
    },
    shadowCookieMetadata: shadowCookieMetadata.summary,
    params,
    cells,
    indices,
    metadata: shadowCookieMetadata.metadata,
  };
}

export function createLocalLightClusterGpuResource(options: {
  readonly device: WebGpuBufferDeviceLike;
  readonly descriptor: LocalLightClusterDescriptor;
}): CreateLocalLightClusterGpuResourceResult {
  const paramsResourceKey = `${options.descriptor.resourceKey}/params`;
  const cellsResourceKey = `${options.descriptor.resourceKey}/cells`;
  const indicesResourceKey = `${options.descriptor.resourceKey}/indices`;
  const metadataResourceKey = `${options.descriptor.resourceKey}/metadata`;
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
  const metadata = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: metadataResourceKey,
      size: options.descriptor.metadata.byteLength,
      usage,
      initialData: options.descriptor.metadata,
    },
  });
  const diagnostics: LocalLightClusterGpuResourceDiagnostic[] = [];

  pushCreationDiagnostic(diagnostics, params, paramsResourceKey);
  pushCreationDiagnostic(diagnostics, cells, cellsResourceKey);
  pushCreationDiagnostic(diagnostics, indices, indicesResourceKey);
  pushCreationDiagnostic(diagnostics, metadata, metadataResourceKey);

  if (!params.ok || !cells.ok || !indices.ok || !metadata.ok) {
    return { valid: false, resource: null, diagnostics };
  }

  return {
    valid: true,
    resource: {
      resourceKey: options.descriptor.resourceKey,
      paramsResourceKey,
      cellsResourceKey,
      indicesResourceKey,
      metadataResourceKey,
      paramsBuffer: params.buffer,
      cellsBuffer: cells.buffer,
      indicesBuffer: indices.buffer,
      metadataBuffer: metadata.buffer,
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
    buildPressure: { ...descriptor.buildPressure },
    shadowCookieMetadata: cloneShadowCookieMetadata(
      descriptor.shadowCookieMetadata,
    ),
    resourceKey: descriptor.resourceKey,
    paramsResourceKey:
      resource?.paramsResourceKey ?? `${descriptor.resourceKey}/params`,
    cellsResourceKey:
      resource?.cellsResourceKey ?? `${descriptor.resourceKey}/cells`,
    indicesResourceKey:
      resource?.indicesResourceKey ?? `${descriptor.resourceKey}/indices`,
    metadataResourceKey:
      resource?.metadataResourceKey ?? `${descriptor.resourceKey}/metadata`,
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
  readonly shadowCookieMetadata: LocalLightClusterShadowCookieMetadataResult;
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
    buildPressure: {
      assignmentStrategy: "none",
      naiveCellLightPairTests: input.cellCount * input.totalLocalLights,
      lightCellRangeTests: 0,
      lightCellWriteAttempts: 0,
      storedLightReferences: 0,
      skippedOverflowReferences: 0,
    },
    shadowCookieMetadata: input.shadowCookieMetadata.summary,
    params,
    cells: new Uint32Array(Math.max(input.cellCount * 2, 2)),
    indices: new Uint32Array([0]),
    metadata: input.shadowCookieMetadata.metadata,
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

function createLocalLightClusterShadowCookieMetadata(
  snapshot: RenderSnapshot,
  clusteredLights: readonly LocalLightSphere[],
  layerMask: number | null,
  supportedPointShadowResources: readonly LocalLightClusterSupportedPointShadowResource[],
  supportedSpotShadowResources: readonly LocalLightClusterSupportedSpotShadowResource[],
): LocalLightClusterShadowCookieMetadataResult {
  const metadata = new Uint32Array(
    Math.max(
      snapshot.lights.length * LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE,
      LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE,
    ),
  );
  const clusteredLightIndices = new Set(
    clusteredLights.map((light) => light.lightIndex),
  );
  const localLightIndexById = new Map<number, number>();

  for (let index = 0; index < snapshot.lights.length; index += 1) {
    const light = snapshot.lights[index];

    if (
      light !== undefined &&
      (light.kind === "point" || light.kind === "spot") &&
      lightMatchesLayer(light, layerMask)
    ) {
      localLightIndexById.set(light.lightId, index);
    }
  }

  const localShadowLightIndices = new Set<number>();
  const clusteredShadowLightIndices = new Set<number>();
  const supportedShadowLightIndices = new Set<number>();
  const supportedPointShadowByKey = new Map(
    supportedPointShadowResources.map((resource, index) => [
      `${resource.shadowId}:${resource.lightId}`,
      Math.max(resource.matrixBaseIndex ?? index * 6, 0),
    ]),
  );
  const supportedSpotShadowByKey = new Map(
    supportedSpotShadowResources.map((resource, index) => [
      `${resource.shadowId}:${resource.lightId}`,
      Math.max(resource.matrixBaseIndex ?? index, 0),
    ]),
  );

  for (const request of snapshot.shadowRequests) {
    const lightIndex = localLightIndexById.get(request.lightId);

    if (lightIndex === undefined) {
      continue;
    }

    const light = snapshot.lights[lightIndex];

    if (
      light === undefined ||
      (request.lightKind !== undefined &&
        request.lightKind !== "point" &&
        request.lightKind !== "spot")
    ) {
      continue;
    }

    localShadowLightIndices.add(lightIndex);

    const supportedMatrixBaseIndex =
      request.lightKind === "point"
        ? supportedPointShadowByKey.get(`${request.shadowId}:${request.lightId}`)
        : request.lightKind === "spot"
          ? supportedSpotShadowByKey.get(`${request.shadowId}:${request.lightId}`)
        : undefined;
    const metadataOffset =
      lightIndex * LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE;
    const shadowFlags =
      LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_REQUEST |
      (supportedMatrixBaseIndex === undefined
        ? LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_SAMPLING_DEFERRED
        : LOCAL_LIGHT_CLUSTER_METADATA_FLAG_SHADOW_SAMPLING_SUPPORTED);

    metadata[metadataOffset] =
      (metadata[metadataOffset] ?? 0) | shadowFlags;
    metadata[metadataOffset + 1] = request.shadowId >>> 0;
    metadata[metadataOffset + 2] = supportedMatrixBaseIndex ?? 0;

    if (clusteredLightIndices.has(lightIndex)) {
      clusteredShadowLightIndices.add(lightIndex);

      if (supportedMatrixBaseIndex !== undefined) {
        supportedShadowLightIndices.add(lightIndex);
      }
    }
  }

  const localShadowRequestCount = localShadowLightIndices.size;
  const clusteredShadowLightCount = clusteredShadowLightIndices.size;
  const supportedShadowLightCount = supportedShadowLightIndices.size;
  const shadowStatus: LocalLightClusterFeatureStatus =
    supportedShadowLightCount > 0
      ? "sampling-ready"
      : clusteredShadowLightCount > 0
        ? "metadata-only"
        : "not-requested";

  return {
    metadata,
    summary: {
      wordsPerLight: LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE,
      totalMetadataLights: snapshot.lights.length,
      shadow: {
        status: shadowStatus,
        samplingSupported: supportedShadowLightCount > 0,
        localRequestCount: localShadowRequestCount,
        clusteredLightCount: clusteredShadowLightCount,
        supportedLightCount: supportedShadowLightCount,
        fallbackReason:
          shadowStatus === "sampling-ready" &&
          supportedShadowLightCount < clusteredShadowLightCount
            ? "clustered-local-shadow-sampling-partial"
            : shadowStatus === "metadata-only"
            ? "clustered-local-shadow-sampling-not-implemented"
            : null,
      },
      cookie: {
        status: "not-supported",
        samplingSupported: false,
        localRequestCount: 0,
        clusteredLightCount: 0,
        supportedLightCount: 0,
        fallbackReason: "light-cookie-authoring-not-implemented",
      },
    },
  };
}

function cloneShadowCookieMetadata(
  metadata: LocalLightClusterShadowCookieMetadata,
): LocalLightClusterShadowCookieMetadata {
  return {
    wordsPerLight: metadata.wordsPerLight,
    totalMetadataLights: metadata.totalMetadataLights,
    shadow: { ...metadata.shadow },
    cookie: { ...metadata.cookie },
  };
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

function localLightCellRange(
  light: LocalLightSphere,
  bounds: LocalLightClusterBounds,
  cellSize: { readonly x: number; readonly y: number; readonly z: number },
  dimensions: LocalLightClusterDimensions,
): LocalLightClusterCellRange | null {
  const minX = clusterAxisMin(light.x - light.radius, bounds.minX, cellSize.x);
  const minY = clusterAxisMin(light.y - light.radius, bounds.minY, cellSize.y);
  const minZ = clusterAxisMin(light.z - light.radius, bounds.minZ, cellSize.z);
  const maxX = clusterAxisMax(light.x + light.radius, bounds.minX, cellSize.x);
  const maxY = clusterAxisMax(light.y + light.radius, bounds.minY, cellSize.y);
  const maxZ = clusterAxisMax(light.z + light.radius, bounds.minZ, cellSize.z);

  if (
    maxX < 0 ||
    maxY < 0 ||
    maxZ < 0 ||
    minX >= dimensions.x ||
    minY >= dimensions.y ||
    minZ >= dimensions.z
  ) {
    return null;
  }

  return {
    minX: clampInteger(minX, 0, dimensions.x - 1),
    minY: clampInteger(minY, 0, dimensions.y - 1),
    minZ: clampInteger(minZ, 0, dimensions.z - 1),
    maxX: clampInteger(maxX, 0, dimensions.x - 1),
    maxY: clampInteger(maxY, 0, dimensions.y - 1),
    maxZ: clampInteger(maxZ, 0, dimensions.z - 1),
  };
}

function clusterAxisMin(
  value: number,
  boundsMin: number,
  cellSize: number,
): number {
  return Math.floor((value - boundsMin) / cellSize);
}

function clusterAxisMax(
  value: number,
  boundsMin: number,
  cellSize: number,
): number {
  return Math.floor((value - boundsMin) / cellSize);
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function sphereIntersectsClusterCell(
  light: LocalLightSphere,
  x: number,
  y: number,
  z: number,
  bounds: LocalLightClusterBounds,
  cellSize: { readonly x: number; readonly y: number; readonly z: number },
): boolean {
  const minX = bounds.minX + x * cellSize.x;
  const minY = bounds.minY + y * cellSize.y;
  const minZ = bounds.minZ + z * cellSize.z;
  const maxX = minX + cellSize.x;
  const maxY = minY + cellSize.y;
  const maxZ = minZ + cellSize.z;
  const distanceSquared =
    axisDistanceSquared(light.x, minX, maxX) +
    axisDistanceSquared(light.y, minY, maxY) +
    axisDistanceSquared(light.z, minZ, maxZ);

  return distanceSquared <= light.radius * light.radius;
}

function axisDistanceSquared(value: number, min: number, max: number): number {
  if (value < min) {
    return (min - value) ** 2;
  }

  if (value > max) {
    return (value - max) ** 2;
  }

  return 0;
}

function summarizeClusterCells(cells: Uint32Array): {
  readonly populatedCells: number;
  readonly maxLightsPerPopulatedCell: number;
  readonly totalAssignedLightReferences: number;
} {
  let populatedCells = 0;
  let maxLightsPerPopulatedCell = 0;
  let totalAssignedLightReferences = 0;

  for (let cellOffset = 1; cellOffset < cells.length; cellOffset += 2) {
    const count = cells[cellOffset] ?? 0;

    if (count > 0) {
      populatedCells += 1;
      maxLightsPerPopulatedCell = Math.max(
        maxLightsPerPopulatedCell,
        count,
      );
      totalAssignedLightReferences += count;
    }
  }

  return {
    populatedCells,
    maxLightsPerPopulatedCell,
    totalAssignedLightReferences,
  };
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
