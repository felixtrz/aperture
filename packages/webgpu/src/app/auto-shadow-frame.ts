import {
  assetHandleKey,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import type {
  MeshAsset,
  MeshDrawPacket,
  RenderSnapshot,
  ShadowRequestPacket,
} from "@aperture-engine/render";
import { prepareAppMeshResource } from "../resources/meshes/prepared-app-mesh-resource.js";
import type { GpuTimestampQueryResources } from "../gpu/gpu-timing.js";
import {
  createRenderShadowFrame,
  resolvePrimaryShadowCamera,
  type RenderShadowFrameDeviceLike,
  type RenderShadowFrameResult,
} from "../shadows/render-shadow-frame.js";
import type { ShadowCasterExecutableMeshResourceView } from "../shadows/shadow-caster-command-record-plan.js";
import { isDepthOnlyShadowCasterDrawSupported } from "../shadows/shadow-caster-draw-list-plan.js";
import type { ShadowCasterPreparedMeshResourceView } from "../shadows/shadow-caster-frame-resource-readiness.js";
import type { WebGpuApp, WebGpuAppResourceReuseReport } from "./app.js";
import { sourceAssetCacheKey } from "./app-texture-sampler-resources.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";

export type WebGpuAppAutoShadowPipelineKind =
  | "directional"
  | "directional-cascaded"
  | "point-array";

export function standardAutoShadowPipelineKindFromSnapshot(
  snapshot: RenderSnapshot,
): WebGpuAppAutoShadowPipelineKind | null {
  if (!snapshotHasStandardShadowReceiver(snapshot)) {
    return null;
  }

  const directionalRequests = snapshot.shadowRequests.filter(
    isDirectionalShadowRequest,
  );

  if (directionalRequests.length > 0) {
    return directionalRequests.some((request) => (request.cascadeCount ?? 1) > 1)
      ? "directional-cascaded"
      : "directional";
  }

  // No directional shadows: bake point shadows when present. Point shadows use
  // the 2d-array ("point-array") receiver path (self-consistent per-face
  // reprojection), so the pipeline-key variant must match the "point-array"
  // receiver resources produced by render-shadow-frame. (Mixed directional+point
  // in one frame is a follow-up; directional takes precedence above to keep its
  // path unchanged.)
  return snapshot.shadowRequests.some(isPointShadowRequest)
    ? "point-array"
    : null;
}

export function createWebGpuAppAutoShadowFrame(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly snapshot: RenderSnapshot;
  readonly resourceLifetimeFrame?: number;
  readonly label?: string;
  readonly submit?: boolean;
  readonly gpuTiming?: {
    readonly resources: GpuTimestampQueryResources;
  };
}): RenderShadowFrameResult | null {
  if (standardAutoShadowPipelineKindFromSnapshot(options.snapshot) === null) {
    return null;
  }

  const meshViews = createAutoShadowCasterMeshViews({
    ...options,
    resourceLifetimeFrame:
      options.resourceLifetimeFrame ?? options.snapshot.frame,
  });

  // The render-shadow frame uses the active render camera for PlayCanvas-style
  // automatic directional fitting when a primary view exists. The scene matrix
  // is a no-camera fallback, not a default fixed shadow box; avoid computing
  // it on camera-backed frames because it walks all caster/receiver bounds.
  const sceneMatrix =
    resolvePrimaryShadowCamera(options.snapshot) === null &&
    autoShadowNeedsCameraFrustumFitBounds(options.snapshot)
      ? computeShadowSceneMatrix(options.snapshot)
      : null;

  return createRenderShadowFrame({
    device: options.app.initialization.device as RenderShadowFrameDeviceLike,
    snapshot: options.snapshot,
    preparedMeshes: meshViews.preparedMeshes,
    executableMeshes: meshViews.executableMeshes,
    cache: options.cache.environmentResources,
    ...(sceneMatrix === null ? {} : { matrix: sceneMatrix }),
    label: `${options.label ?? "aperture-webgpu-app"}:auto-shadow`,
    ...(options.submit === false ? { encode: false } : {}),
    ...(options.submit === undefined ? {} : { submit: options.submit }),
    ...(options.gpuTiming === undefined
      ? {}
      : { gpuTiming: options.gpuTiming }),
  });
}

export function createWebGpuAppAutoShadowFrameInputKey(
  snapshot: RenderSnapshot,
): string {
  const primaryShadowCamera = resolvePrimaryShadowCamera(snapshot);
  const needsAutoFit = autoShadowNeedsCameraFrustumFitBounds(snapshot);
  const needsCameraFrustumFitBounds =
    primaryShadowCamera !== null && needsAutoFit;
  const needsFallbackSceneFit = primaryShadowCamera === null && needsAutoFit;
  const indices = needsCameraFrustumFitBounds
    ? collectCameraFitShadowBoundsIndices(snapshot)
    : needsFallbackSceneFit
      ? collectFallbackShadowBoundsIndices(snapshot)
      : new Set<number>();
  // Key on every shadow request the frame may bake (directional + point) plus
  // their lights and casters, so the cached frame invalidates when a point
  // light moves or a caster animates — not only on directional changes.
  const supportedRequests = snapshot.shadowRequests.filter(
    isSupportedAutoShadowRequest,
  );

  return [
    "auto-shadow-input:v4",
    needsCameraFrustumFitBounds
      ? "primary-camera-fit"
      : needsFallbackSceneFit
        ? "fallback-scene-fit"
        : "fixed-camera",
    needsCameraFrustumFitBounds
      ? shadowCameraInputKey(primaryShadowCamera)
      : "camera:not-used",
    shadowRequestsInputKey(supportedRequests),
    shadowLightsInputKey(snapshot, supportedRequests),
    shadowCastersInputKey(snapshot, supportedRequests),
    shadowBoundsInputKey(snapshot, indices),
  ].join(";");
}

export function autoShadowInputKeyUsesCamera(
  snapshot: RenderSnapshot,
): boolean {
  return (
    resolvePrimaryShadowCamera(snapshot) !== null &&
    autoShadowNeedsCameraFrustumFitBounds(snapshot)
  );
}

export function autoShadowInputKeyUsesBounds(
  snapshot: RenderSnapshot,
): boolean {
  return autoShadowNeedsCameraFrustumFitBounds(snapshot);
}

interface ShadowSceneMatrix {
  readonly center: readonly [number, number, number];
  readonly orthographicSize: number;
  readonly near: number;
  readonly far: number;
  readonly lightDistance: number;
}

const SHADOW_RADIUS_MARGIN = 1.1;
const SHADOW_MIN_RADIUS = 2;
const SHADOW_NEAR_MIN = 0.1;
const SHADOW_DEPTH_SLACK = 1;

/**
 * Derive the no-camera fallback directional shadow ortho by fitting a
 * light-space ortho to the world-space region the shadow map must cover: the
 * shadow CASTERS plus where their shadows land (see computeCasterShadowFit).
 * Primary camera snapshots do not use this as their default footprint; they use
 * receiver/frustum fitting in createRenderShadowFrame and keep this result as a
 * fallback for headless/simple snapshots.
 *
 * One shadow map necessarily trades resolution for coverage, so very large
 * no-camera scenes get coarse shadows from this fallback. Camera-backed frames
 * should prefer the automatic receiver/frustum fit, and larger worlds should
 * use cascaded shadow maps (`cascadeCount > 1`). Returns null when the scene
 * has no casters (nothing to shadow).
 */
function computeShadowSceneMatrix(
  snapshot: RenderSnapshot,
): ShadowSceneMatrix | null {
  const lightDirection = directionalLightDirection(snapshot);
  const floorY = receiverFloorY(snapshot);
  const ceilingY = receiverCeilingY(snapshot);
  const casterFit = computeCasterShadowFit(
    snapshot,
    lightDirection,
    floorY,
    ceilingY,
  );
  if (casterFit === null) {
    return null;
  }

  const radius = Math.max(
    casterFit.inPlaneRadius * SHADOW_RADIUS_MARGIN,
    SHADOW_MIN_RADIUS,
  );
  const depthRadius = Math.max(
    casterFit.depthRadius * SHADOW_RADIUS_MARGIN,
    SHADOW_MIN_RADIUS,
  );
  const near = Math.max(SHADOW_NEAR_MIN, depthRadius * 0.1);
  const lightDistance = depthRadius + near + SHADOW_DEPTH_SLACK;
  return {
    center: casterFit.center,
    orthographicSize: radius * 2,
    lightDistance,
    near,
    far: lightDistance + depthRadius + SHADOW_DEPTH_SLACK,
  };
}

/**
 * Bound the region the shadow map must cover: every shadow CASTER's world AABB
 * AND where its shadow lands. A directional shadow extends DOWN-LIGHT from the
 * caster onto the receivers, well beyond the caster's own bounds, so fitting to
 * the casters alone clips the cast shadow. We additionally project each caster
 * AABB corner onto the receiver floor along the light and fold those points into
 * the fit. The final size is a LIGHT-SPACE square, not a world-space
 * half-diagonal sphere: directional shadows only need enough in-plane coverage
 * for the light's orthographic camera, while depth coverage is handled
 * separately by near/far. Null when there are no casters.
 */
function computeCasterShadowFit(
  snapshot: RenderSnapshot,
  lightDirection: readonly [number, number, number] | null,
  floorY: number | null,
  ceilingY: number | null,
): {
  readonly center: readonly [number, number, number];
  readonly inPlaneRadius: number;
  readonly depthRadius: number;
} | null {
  const points: (readonly [number, number, number])[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let found = false;

  // Only project onto the floor when the light points downward enough to cast a
  // finite ground shadow (near-horizontal light would project to infinity).
  const canProject =
    lightDirection !== null && lightDirection[1] < -1e-3 && floorY !== null;

  const include = (x: number, y: number, z: number): void => {
    points.push([x, y, z]);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  };

  for (const draw of shadowCasterDrawsForSnapshot(snapshot)) {
    if (!isShadowCasterDraw(draw, snapshot.shadowRequests)) {
      continue;
    }
    const bounds = snapshot.bounds[draw.boundsIndex];
    if (bounds === undefined) {
      continue;
    }
    const { min, max } = bounds.worldAabb;
    found = true;

    for (let cx = 0; cx < 2; cx += 1) {
      for (let cy = 0; cy < 2; cy += 1) {
        for (let cz = 0; cz < 2; cz += 1) {
          const px = cx === 0 ? min[0]! : max[0]!;
          const py = cy === 0 ? min[1]! : max[1]!;
          const pz = cz === 0 ? min[2]! : max[2]!;
          include(px, py, pz);

          if (canProject && py > floorY!) {
            const t = (py - floorY!) / -lightDirection![1];
            include(
              px + t * lightDirection![0],
              floorY!,
              pz + t * lightDirection![2],
            );
          }
        }
      }
    }
  }

  if (!found || !Number.isFinite(minX) || !Number.isFinite(maxX)) {
    return null;
  }

  // Extend the bound UP to the highest receiver surface. This guarantees the
  // light eye (center - lightDir*distance) ends up on the light's side of the
  // receivers, so a caster sitting BELOW the receivers (e.g. a cube dropped
  // under the ground plane) reads as farther from the light than the ground and
  // correctly casts NO shadow on it — instead of a spurious one.
  if (ceilingY !== null && ceilingY > maxY) {
    const ceilingMinX = minX;
    const ceilingMaxX = maxX;
    const ceilingMinZ = minZ;
    const ceilingMaxZ = maxZ;
    include(ceilingMinX, ceilingY, ceilingMinZ);
    include(ceilingMinX, ceilingY, ceilingMaxZ);
    include(ceilingMaxX, ceilingY, ceilingMinZ);
    include(ceilingMaxX, ceilingY, ceilingMaxZ);
  }

  const lightSpaceFit =
    lightDirection === null
      ? null
      : fitShadowPointsInLightSpace(points, lightDirection);
  if (lightSpaceFit !== null) {
    return lightSpaceFit;
  }

  const center: readonly [number, number, number] = [
    (minX + maxX) * 0.5,
    (minY + maxY) * 0.5,
    (minZ + maxZ) * 0.5,
  ];
  const radius = 0.5 * Math.hypot(maxX - minX, maxY - minY, maxZ - minZ);
  return { center, inPlaneRadius: radius, depthRadius: radius };
}

function fitShadowPointsInLightSpace(
  points: readonly (readonly [number, number, number])[],
  lightDirection: readonly [number, number, number],
): {
  readonly center: readonly [number, number, number];
  readonly inPlaneRadius: number;
  readonly depthRadius: number;
} | null {
  const basis = lightSpaceBasis(lightDirection);
  if (basis === null) {
    return null;
  }

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  let minW = Infinity;
  let maxW = -Infinity;

  for (const point of points) {
    const u = dot(basis.xAxis, point);
    const v = dot(basis.yAxis, point);
    const w = dot(basis.zAxis, point);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
    minW = Math.min(minW, w);
    maxW = Math.max(maxW, w);
  }

  if (
    !Number.isFinite(minU) ||
    !Number.isFinite(maxU) ||
    !Number.isFinite(minV) ||
    !Number.isFinite(maxV) ||
    !Number.isFinite(minW) ||
    !Number.isFinite(maxW)
  ) {
    return null;
  }

  const centerU = (minU + maxU) * 0.5;
  const centerV = (minV + maxV) * 0.5;
  const centerW = (minW + maxW) * 0.5;
  const center: readonly [number, number, number] = [
    centerU * basis.xAxis[0] +
      centerV * basis.yAxis[0] +
      centerW * basis.zAxis[0],
    centerU * basis.xAxis[1] +
      centerV * basis.yAxis[1] +
      centerW * basis.zAxis[1],
    centerU * basis.xAxis[2] +
      centerV * basis.yAxis[2] +
      centerW * basis.zAxis[2],
  ];
  return {
    center,
    inPlaneRadius: Math.max(maxU - minU, maxV - minV) * 0.5,
    depthRadius: Math.max(maxW - minW, 0) * 0.5,
  };
}

function lightSpaceBasis(lightDirection: readonly [number, number, number]): {
  readonly xAxis: readonly [number, number, number];
  readonly yAxis: readonly [number, number, number];
  readonly zAxis: readonly [number, number, number];
} | null {
  const zAxis = normalize([
    -lightDirection[0],
    -lightDirection[1],
    -lightDirection[2],
  ]);
  if (zAxis === null) {
    return null;
  }

  let xAxis = normalize(cross([0, 1, 0], zAxis));
  if (xAxis === null) {
    xAxis = normalize(cross([0, 0, 1], zAxis));
  }
  if (xAxis === null) {
    return null;
  }

  return { xAxis, yAxis: cross(zAxis, xAxis), zAxis };
}

function normalize(
  value: readonly [number, number, number],
): readonly [number, number, number] | null {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (length <= 1e-6) {
    return null;
  }
  return [value[0] / length, value[1] / length, value[2] / length];
}

function cross(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): readonly [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * The directional light's world travel direction (its -Z column, normalized),
 * matching the receiver/caster matrix convention. Null when there is no
 * directional light or its transform is missing.
 */
function directionalLightDirection(
  snapshot: RenderSnapshot,
): readonly [number, number, number] | null {
  for (const light of snapshot.lights) {
    if (light.kind !== "directional") {
      continue;
    }
    const o = light.worldTransformOffset;
    const t = snapshot.transforms;
    if (!Number.isInteger(o) || o < 0 || o + 11 >= t.length) {
      continue;
    }
    const dx = -(t[o + 8] ?? 0);
    const dy = -(t[o + 9] ?? 0);
    const dz = -(t[o + 10] ?? 0);
    const length = Math.hypot(dx, dy, dz);
    if (length <= 1e-6) {
      continue;
    }
    return [dx / length, dy / length, dz / length];
  }
  return null;
}

/**
 * Lowest world-space surface among shadow RECEIVERS — the floor cast shadows
 * land on. Conservative (uses each receiver AABB's min y, so the projected
 * shadow over-covers slightly). Null when there are no receivers.
 */
function receiverFloorY(snapshot: RenderSnapshot): number | null {
  let floor = Infinity;
  for (const draw of snapshot.meshDraws) {
    if (draw.receivesShadow === false) {
      continue;
    }
    const bounds = snapshot.bounds[draw.boundsIndex];
    if (bounds === undefined) {
      continue;
    }
    floor = Math.min(floor, bounds.worldAabb.min[1]!);
  }
  return Number.isFinite(floor) ? floor : null;
}

/**
 * Highest world-space surface among shadow RECEIVERS. The shadow ortho's bound
 * is extended up to this so the light eye clears the receivers (see
 * computeCasterShadowFit). Null when there are no receivers.
 */
function receiverCeilingY(snapshot: RenderSnapshot): number | null {
  let ceiling = -Infinity;
  for (const draw of snapshot.meshDraws) {
    if (draw.receivesShadow === false) {
      continue;
    }
    const bounds = snapshot.bounds[draw.boundsIndex];
    if (bounds === undefined) {
      continue;
    }
    ceiling = Math.max(ceiling, bounds.worldAabb.max[1]!);
  }
  return Number.isFinite(ceiling) ? ceiling : null;
}

function autoShadowNeedsCameraFrustumFitBounds(
  snapshot: RenderSnapshot,
): boolean {
  return snapshot.shadowRequests.some(
    (request) =>
      isDirectionalShadowRequest(request) &&
      (request.orthographicSize ?? 0) <= 0,
  );
}

function collectCameraFitShadowBoundsIndices(
  snapshot: RenderSnapshot,
): ReadonlySet<number> {
  const indices = new Set<number>();
  const directionalRequests = snapshot.shadowRequests.filter(
    isDirectionalShadowRequest,
  );

  for (const draw of shadowCasterDrawsForSnapshot(snapshot)) {
    if (isShadowCasterDraw(draw, directionalRequests)) {
      indices.add(draw.boundsIndex);
    }
  }

  for (const draw of snapshot.meshDraws) {
    if (
      draw.receivesShadow === false ||
      !draw.batchKey.pipelineKey.startsWith("standard|")
    ) {
      continue;
    }

    const isReceiver = directionalRequests.some(
      (request) => (draw.layerMask & request.receiverLayerMask) !== 0,
    );

    if (isReceiver) {
      indices.add(draw.boundsIndex);
    }
  }

  return indices;
}

function collectFallbackShadowBoundsIndices(
  snapshot: RenderSnapshot,
): ReadonlySet<number> {
  const indices = new Set<number>();

  for (const draw of shadowCasterDrawsForSnapshot(snapshot)) {
    if (isShadowCasterDraw(draw, snapshot.shadowRequests)) {
      indices.add(draw.boundsIndex);
    }
  }

  for (const draw of snapshot.meshDraws) {
    if (draw.receivesShadow !== false) {
      indices.add(draw.boundsIndex);
    }
  }

  return indices;
}

function shadowBoundsInputKey(
  snapshot: RenderSnapshot,
  indices: ReadonlySet<number>,
): string {
  if (indices.size === 0) {
    return "auto-shadow-input:bounds:none";
  }

  return [...indices]
    .sort((a, b) => a - b)
    .map((index) => {
      const bounds = snapshot.bounds[index];
      if (bounds === undefined) {
        return `${index}:missing`;
      }

      const { min, max } = bounds.worldAabb;
      return `${index}:${numberKey(min[0])},${numberKey(min[1])},${numberKey(
        min[2],
      )}:${numberKey(max[0])},${numberKey(max[1])},${numberKey(max[2])}`;
    })
    .join("|");
}

function numberKey(value: number | undefined): string {
  return Number.isFinite(value) ? String(value) : "nan";
}

function shadowCameraInputKey(
  camera: ReturnType<typeof resolvePrimaryShadowCamera>,
): string {
  if (camera === null) {
    return "camera:none";
  }

  return [
    "camera",
    numberKey(camera.near),
    numberKey(camera.far),
    matrixKey(camera.viewMatrix),
    matrixKey(camera.projectionMatrix),
  ].join(":");
}

function shadowRequestsInputKey(
  requests: readonly ShadowRequestPacket[],
): string {
  return `requests:${requests.map(shadowRequestInputKey).join("|")}`;
}

function shadowRequestInputKey(request: ShadowRequestPacket): string {
  return [
    request.shadowId,
    request.lightId,
    request.lightKind ?? "directional",
    request.cascadeCount ?? "default",
    request.casterLayerMask,
    request.receiverLayerMask,
    request.shadowType ?? "default",
    request.strength ?? "default",
    request.filterRadius ?? "default",
    request.slopeBias ?? "default",
    request.depthBias ?? "default",
    request.normalBias ?? "default",
    request.mapSize ?? "default",
    tupleKey(request.center),
    request.orthographicSize ?? "default",
    request.near ?? "default",
    request.far ?? "default",
    request.lightDistance ?? "default",
  ].join(",");
}

function shadowLightsInputKey(
  snapshot: RenderSnapshot,
  requests: readonly ShadowRequestPacket[],
): string {
  const lightIds = new Set(requests.map((request) => request.lightId));
  const lights = snapshot.lights.filter((light) =>
    lightIds.has(light.lightId),
  );

  return `lights:${lights
    .map((light) => {
      return [
        light.lightId,
        light.kind,
        tupleKey(light.color),
        light.intensity,
        light.range,
        light.innerConeAngle,
        light.outerConeAngle,
        light.width ?? "default",
        light.height ?? "default",
        nullableAssetHandleKey(light.cookieTexture),
        nullableAssetHandleKey(light.cookieSampler),
        light.cookieIntensity ?? "default",
        light.layerMask,
        matrixAtKey(snapshot.transforms, light.worldTransformOffset),
      ].join(",");
    })
    .join("|")}`;
}

function shadowCastersInputKey(
  snapshot: RenderSnapshot,
  requests: readonly ShadowRequestPacket[],
): string {
  const casters = shadowCasterDrawsForSnapshot(snapshot).filter((draw) =>
    isSupportedShadowCasterDraw(draw, requests),
  );

  return `casters:${casters
    .map((draw) => {
      return [
        draw.renderId,
        assetHandleKey(draw.mesh),
        assetHandleKey(draw.material),
        draw.submesh,
        draw.materialSlot,
        draw.vertexStart ?? "default",
        draw.vertexCount ?? "default",
        draw.indexStart ?? "default",
        draw.indexCount ?? "default",
        draw.layerMask,
        draw.castsShadow ?? "default",
        draw.receivesShadow ?? "default",
        draw.batchKey.pipelineKey,
        draw.batchKey.materialKey,
        draw.batchKey.meshLayoutKey,
        draw.batchKey.topology,
        draw.batchKey.instanced,
        draw.batchKey.skinned,
        draw.batchKey.morphed,
        matrixAtKey(snapshot.transforms, draw.worldTransformOffset),
      ].join(",");
    })
    .join("|")}`;
}

function matrixAtKey(values: Float32Array, offset: number): string {
  if (!Number.isInteger(offset) || offset < 0 || offset + 16 > values.length) {
    return "missing";
  }

  return matrixKey(values.subarray(offset, offset + 16));
}

function matrixKey(values: ArrayLike<number>): string {
  const parts: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    parts.push(numberKey(values[index]));
  }
  return parts.join(",");
}

function tupleKey(values: ArrayLike<number> | undefined): string {
  if (values === undefined) {
    return "default";
  }

  return matrixKey(values);
}

function nullableAssetHandleKey(
  handle: Parameters<typeof assetHandleKey>[0] | null | undefined,
): string {
  return handle === null || handle === undefined
    ? "none"
    : assetHandleKey(handle);
}

function createAutoShadowCasterMeshViews(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly snapshot: RenderSnapshot;
  readonly resourceLifetimeFrame: number;
}): {
  readonly preparedMeshes: readonly ShadowCasterPreparedMeshResourceView[];
  readonly executableMeshes: readonly ShadowCasterExecutableMeshResourceView[];
} {
  const preparedMeshes: ShadowCasterPreparedMeshResourceView[] = [];
  const executableMeshes: ShadowCasterExecutableMeshResourceView[] = [];
  const preparedByMeshKey = new Set<string>();

  for (const draw of shadowCasterDrawsForSnapshot(options.snapshot)) {
    if (!isSupportedShadowCasterDraw(draw, options.snapshot.shadowRequests)) {
      continue;
    }

    const meshKey = assetHandleKey(draw.mesh);

    if (preparedByMeshKey.has(meshKey)) {
      continue;
    }

    preparedByMeshKey.add(meshKey);

    const meshEntry = options.assets.get<"mesh", MeshAsset>(draw.mesh);
    const mesh = meshEntry?.asset ?? null;
    const prepared = prepareAppMeshResource({
      device: options.app.initialization.device,
      mesh,
      meshHandle: draw.mesh,
      meshKey: sourceAssetCacheKey(draw.mesh, meshEntry?.version ?? -1),
      frame: options.resourceLifetimeFrame,
      preparedMeshes: options.cache.preparedMeshes,
    });

    if (prepared === null) {
      continue;
    }

    if (prepared.status === "reused") {
      options.reuse.meshBuffersReused += 1;
      options.reuse.preparedMeshBuffersReused += 1;
    } else {
      options.reuse.meshBuffersCreated += 1;
      options.reuse.preparedMeshBuffersCreated += 1;
    }

    const resource = prepared.resource.mesh;
    const preparedView: ShadowCasterPreparedMeshResourceView = {
      meshKey,
      meshResourceKey: resource.resourceKey,
      vertexBufferResourceKeys: resource.vertexBuffers.map(
        (buffer) => buffer.resourceKey,
      ),
      indexBufferResourceKey: resource.indexBuffer?.resourceKey ?? null,
    };
    const executableView: ShadowCasterExecutableMeshResourceView = {
      meshKey,
      meshResourceKey: resource.resourceKey,
      vertexBuffers: resource.vertexBuffers.map((buffer) => ({
        resourceKey: buffer.resourceKey,
        buffer: buffer.buffer,
        vertexCount: buffer.vertexCount,
      })),
      indexBuffer:
        resource.indexBuffer === undefined || resource.indexBuffer === null
          ? null
          : {
              resourceKey: resource.indexBuffer.resourceKey,
              buffer: resource.indexBuffer.buffer,
              format: resource.indexBuffer.format,
              indexCount: resource.indexBuffer.indexCount,
            },
    };

    preparedMeshes.push(preparedView);
    executableMeshes.push(executableView);
  }

  return { preparedMeshes, executableMeshes };
}

function snapshotHasStandardShadowReceiver(snapshot: RenderSnapshot): boolean {
  return snapshot.meshDraws.some(
    (draw) =>
      draw.receivesShadow !== false &&
      draw.batchKey.pipelineKey.startsWith("standard|"),
  );
}

function shadowCasterDrawsForSnapshot(
  snapshot: RenderSnapshot,
): readonly MeshDrawPacket[] {
  return snapshot.shadowCasterDraws ?? snapshot.meshDraws;
}

function isShadowCasterDraw(
  draw: MeshDrawPacket,
  shadowRequests: readonly ShadowRequestPacket[],
): boolean {
  return (
    draw.castsShadow !== false &&
    isDepthOnlyShadowCasterDrawSupported(draw) &&
    shadowRequests.some(
      (request) =>
        isDirectionalShadowRequest(request) &&
        (draw.layerMask & request.casterLayerMask) !== 0,
    )
  );
}

/**
 * Like {@link isShadowCasterDraw} but matches any baked shadow kind (directional
 * or point). Used for caster mesh-resource preparation and the cache input key,
 * which must cover point casters too; the directional auto-fit helpers keep using
 * the directional-only predicate so their behavior is unchanged.
 */
function isSupportedShadowCasterDraw(
  draw: MeshDrawPacket,
  shadowRequests: readonly ShadowRequestPacket[],
): boolean {
  return (
    draw.castsShadow !== false &&
    isDepthOnlyShadowCasterDrawSupported(draw) &&
    shadowRequests.some(
      (request) =>
        isSupportedAutoShadowRequest(request) &&
        (draw.layerMask & request.casterLayerMask) !== 0,
    )
  );
}

function isDirectionalShadowRequest(request: ShadowRequestPacket): boolean {
  return request.lightKind === undefined || request.lightKind === "directional";
}

function isPointShadowRequest(request: ShadowRequestPacket): boolean {
  return request.lightKind === "point";
}

function isSupportedAutoShadowRequest(request: ShadowRequestPacket): boolean {
  return isDirectionalShadowRequest(request) || isPointShadowRequest(request);
}
