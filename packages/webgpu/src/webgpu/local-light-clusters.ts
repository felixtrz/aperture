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
export const LOCAL_LIGHT_CLUSTER_PARAM_FLOATS = 12;
export const DEFAULT_LOCAL_LIGHT_CLUSTER_RESOURCE_KEY =
  "local-light-cluster:main";

export interface LocalLightClusterDimensions {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface LocalLightClusterDescriptorOptions {
  readonly resourceKey?: string;
  readonly dimensions?: Partial<LocalLightClusterDimensions>;
  readonly minLocalLights?: number;
  readonly maxLightsPerCell?: number;
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
  readonly dimensions: LocalLightClusterDimensions;
  readonly cellCount: number;
  readonly populatedCells: number;
  readonly maxLightsPerPopulatedCell: number;
  readonly averageLightsPerPopulatedCell: number;
  readonly totalAssignedLightReferences: number;
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
  readonly clusterDimensions: LocalLightClusterDimensions;
  readonly cellCount: number;
  readonly populatedCells: number;
  readonly maxLightsPerPopulatedCell: number;
  readonly averageLightsPerPopulatedCell: number;
  readonly totalAssignedLightReferences: number;
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
}

interface LocalLightSphere {
  readonly lightIndex: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
}

export function snapshotShouldUseClusteredLocalLights(
  snapshot: RenderSnapshot,
  minLocalLights = LOCAL_LIGHT_CLUSTER_MIN_LIGHTS,
): boolean {
  return countLocalLights(snapshot.lights) >= minLocalLights;
}

export function createLocalLightClusterDescriptor(
  snapshot: RenderSnapshot,
  options: LocalLightClusterDescriptorOptions = {},
): LocalLightClusterDescriptor {
  const resourceKey =
    options.resourceKey ?? DEFAULT_LOCAL_LIGHT_CLUSTER_RESOURCE_KEY;
  const dimensions = normalizeDimensions(options.dimensions);
  const maxLightsPerCell = normalizePositiveInteger(
    options.maxLightsPerCell,
    64,
  );
  const minLocalLights = normalizePositiveInteger(
    options.minLocalLights,
    LOCAL_LIGHT_CLUSTER_MIN_LIGHTS,
  );
  const totalLocalLights = countLocalLights(snapshot.lights);
  const localLights = localLightSpheres(snapshot);
  const cellCount = dimensions.x * dimensions.y * dimensions.z;
  const empty = () =>
    emptyLocalLightClusterDescriptor({
      resourceKey,
      dimensions,
      cellCount,
      maxLightsPerCell,
      totalLights: snapshot.lights.length,
      totalLocalLights,
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

  const bounds = localLightBounds(localLights.spheres);
  const cellSize = {
    x: Math.max((bounds.maxX - bounds.minX) / dimensions.x, 0.0001),
    y: Math.max((bounds.maxY - bounds.minY) / dimensions.y, 0.0001),
    z: Math.max((bounds.maxZ - bounds.minZ) / dimensions.z, 0.0001),
  };
  const params = new Float32Array(LOCAL_LIGHT_CLUSTER_PARAM_FLOATS);
  const cells = new Uint32Array(cellCount * 2);
  const indices: number[] = [];
  let populatedCells = 0;
  let maxLightsPerPopulatedCell = 0;
  let totalAssignedLightReferences = 0;
  let overflowedCells = 0;

  params.set(
    [
      bounds.minX,
      bounds.minY,
      bounds.minZ,
      0,
      1 / cellSize.x,
      1 / cellSize.y,
      1 / cellSize.z,
      0,
      dimensions.x,
      dimensions.y,
      dimensions.z,
      1,
    ],
    0,
  );

  for (let z = 0; z < dimensions.z; z += 1) {
    for (let y = 0; y < dimensions.y; y += 1) {
      for (let x = 0; x < dimensions.x; x += 1) {
        const cellIndex = clusterCellIndex(x, y, z, dimensions);
        const cellLights = localLightsForCell({
          lights: localLights.spheres,
          x,
          y,
          z,
          bounds,
          cellSize,
          maxLightsPerCell,
        });
        const cellOffset = indices.length;
        const storedCount = Math.min(cellLights.length, maxLightsPerCell);

        if (cellLights.length > maxLightsPerCell) {
          overflowedCells += 1;
        }

        for (let index = 0; index < storedCount; index += 1) {
          const lightIndex = cellLights[index];

          if (lightIndex !== undefined) {
            indices.push(lightIndex);
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
    clusteredLocalLights: localLights.spheres.length,
    dimensions,
    cellCount,
    populatedCells,
    maxLightsPerPopulatedCell,
    averageLightsPerPopulatedCell:
      populatedCells === 0 ? 0 : totalAssignedLightReferences / populatedCells,
    totalAssignedLightReferences,
    overflowedCells,
    maxLightsPerCell,
    params,
    cells,
    indices: new Uint32Array(indices.length === 0 ? [0] : indices),
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
    clusterDimensions: { ...descriptor.dimensions },
    cellCount: descriptor.cellCount,
    populatedCells: descriptor.populatedCells,
    maxLightsPerPopulatedCell: descriptor.maxLightsPerPopulatedCell,
    averageLightsPerPopulatedCell: descriptor.averageLightsPerPopulatedCell,
    totalAssignedLightReferences: descriptor.totalAssignedLightReferences,
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
  readonly dimensions: LocalLightClusterDimensions;
  readonly cellCount: number;
  readonly maxLightsPerCell: number;
  readonly totalLights: number;
  readonly totalLocalLights: number;
  readonly fallbackReason: LocalLightClusterFallbackReason;
}): LocalLightClusterDescriptor {
  const params = new Float32Array(LOCAL_LIGHT_CLUSTER_PARAM_FLOATS);

  params.set([0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0], 0);

  return {
    resourceKey: input.resourceKey,
    enabled: false,
    fallbackReason: input.fallbackReason,
    totalLights: input.totalLights,
    totalLocalLights: input.totalLocalLights,
    clusteredLocalLights: 0,
    dimensions: input.dimensions,
    cellCount: input.cellCount,
    populatedCells: 0,
    maxLightsPerPopulatedCell: 0,
    averageLightsPerPopulatedCell: 0,
    totalAssignedLightReferences: 0,
    overflowedCells: 0,
    maxLightsPerCell: input.maxLightsPerCell,
    params,
    cells: new Uint32Array(Math.max(input.cellCount * 2, 2)),
    indices: new Uint32Array([0]),
  };
}

function countLocalLights(lights: readonly LightPacket[]): number {
  let count = 0;

  for (const light of lights) {
    if (light.kind === "point" || light.kind === "spot") {
      count += 1;
    }
  }

  return count;
}

function localLightSpheres(snapshot: RenderSnapshot): {
  readonly spheres: readonly LocalLightSphere[];
  readonly missingTransform: boolean;
} {
  const spheres: LocalLightSphere[] = [];
  let missingTransform = false;

  for (let index = 0; index < snapshot.lights.length; index += 1) {
    const light = snapshot.lights[index];

    if (
      light === undefined ||
      (light.kind !== "point" && light.kind !== "spot")
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

function localLightBounds(lights: readonly LocalLightSphere[]): {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
} {
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
