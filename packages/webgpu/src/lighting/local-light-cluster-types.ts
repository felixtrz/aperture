import type { WebGpuBufferFailureReason } from "../gpu/buffer.js";
import type { LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE } from "./local-light-cluster-constants.js";

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
  readonly filterRadiusTexels?: number;
}

export type LocalLightClusterSupportedPointShadowResource =
  LocalLightClusterSupportedShadowResource;

export type LocalLightClusterSupportedSpotShadowResource =
  LocalLightClusterSupportedShadowResource;

export interface LocalLightClusterSupportedCookieResource {
  readonly lightId: number;
  readonly textureKey: string;
  readonly samplerKey: string;
  readonly textureViewDimension: "2d" | "2d-array" | "cube";
  readonly matrixBaseIndex?: number;
}

export interface LocalLightClusterShadowCookieMetadata {
  readonly wordsPerLight: typeof LOCAL_LIGHT_CLUSTER_METADATA_WORD_STRIDE;
  readonly totalMetadataLights: number;
  readonly shadow: {
    readonly status: LocalLightClusterFeatureStatus;
    readonly samplingSupported: boolean;
    readonly localRequestCount: number;
    readonly clusteredLightCount: number;
    readonly supportedLightCount: number;
    readonly hardFilterLightCount: number;
    readonly softFilterLightCount: number;
    readonly maxFilterRadiusTexels: number;
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
  readonly supportedCookieResources?: readonly LocalLightClusterSupportedCookieResource[];
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
    readonly bufferWrites: number;
    readonly bufferWritesSkipped: number;
  };
  readonly routes?: readonly LocalLightClusterReport[];
}

export interface LocalLightSphere {
  readonly lightIndex: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
}

export interface LocalLightClusterBounds {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
}

export interface LocalLightClusterCellRange {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
}

export interface SelectedLocalLightClusterSpace {
  readonly coordinateSpace: LocalLightClusterCoordinateSpace;
  readonly viewId: number | null;
  readonly viewMatrix: ArrayLike<number>;
  readonly projectionMatrix: ArrayLike<number> | null;
}

export interface LocalLightClusterShadowCookieMetadataResult {
  readonly metadata: Uint32Array;
  readonly summary: LocalLightClusterShadowCookieMetadata;
}
