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
import {
  createRenderShadowFrame,
  type RenderShadowFrameDeviceLike,
  type RenderShadowFrameResult,
} from "../shadows/render-shadow-frame.js";
import type { ShadowCasterExecutableMeshResourceView } from "../shadows/shadow-caster-command-record-plan.js";
import type { ShadowCasterPreparedMeshResourceView } from "../shadows/shadow-caster-frame-resource-readiness.js";
import type { WebGpuApp, WebGpuAppResourceReuseReport } from "./app.js";
import { sourceAssetCacheKey } from "./app-texture-sampler-resources.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";

export type WebGpuAppAutoShadowPipelineKind =
  | "directional"
  | "directional-cascaded";

export function standardAutoShadowPipelineKindFromSnapshot(
  snapshot: RenderSnapshot,
): WebGpuAppAutoShadowPipelineKind | null {
  if (!snapshotHasStandardShadowReceiver(snapshot)) {
    return null;
  }

  const directionalRequests = snapshot.shadowRequests.filter(
    isDirectionalShadowRequest,
  );

  if (directionalRequests.length === 0) {
    return null;
  }

  return directionalRequests.some((request) => (request.cascadeCount ?? 1) > 1)
    ? "directional-cascaded"
    : "directional";
}

export function createWebGpuAppAutoShadowFrame(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly snapshot: RenderSnapshot;
  readonly label?: string;
}): RenderShadowFrameResult | null {
  if (standardAutoShadowPipelineKindFromSnapshot(options.snapshot) === null) {
    return null;
  }

  const meshViews = createAutoShadowCasterMeshViews(options);

  // Derive the directional shadow ortho. Prefer fitting it to the shadow
  // CASTERS' world bounds (camera-independent, tight, stable) and only fall back
  // to a camera-followed region when the casters are too large for one shadow
  // map (open worlds, which should use cascaded shadow maps).
  const sceneMatrix = computeShadowSceneMatrix(options.snapshot);

  return createRenderShadowFrame({
    device: options.app.initialization.device as RenderShadowFrameDeviceLike,
    snapshot: options.snapshot,
    preparedMeshes: meshViews.preparedMeshes,
    executableMeshes: meshViews.executableMeshes,
    cache: options.cache.environmentResources,
    ...(sceneMatrix === null ? {} : { matrix: sceneMatrix }),
    label: `${options.label ?? "aperture-webgpu-app"}:auto-shadow`,
  });
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

/**
 * Derive the directional shadow ortho by fitting a light-space ortho to the
 * world-space region the shadow map must cover: the shadow CASTERS plus where
 * their shadows land (see computeCasterShadowBounds). This is the single,
 * camera-INDEPENDENT path — there is no camera-following heuristic, so shadows
 * never swim, detach, or change behavior as the camera orbits/zooms/pans. It
 * mirrors hand-authoring a three.js `DirectionalLight.shadow.camera` to fit the
 * scene.
 *
 * One shadow map necessarily trades resolution for coverage, so very large
 * (open-world) scenes get coarse shadows from this auto-fit — the answer there
 * is cascaded shadow maps (`cascadeCount > 1`), which fit the camera frustum
 * per cascade. We deliberately do NOT switch to a camera-followed region past
 * some size threshold: that would reintroduce camera-dependence and a magic
 * cutoff. Returns null when the scene has no casters (nothing to shadow).
 */
function computeShadowSceneMatrix(
  snapshot: RenderSnapshot,
): ShadowSceneMatrix | null {
  const lightDirection = directionalLightDirection(snapshot);
  const floorY = receiverFloorY(snapshot);
  const ceilingY = receiverCeilingY(snapshot);
  const casterBounds = computeCasterShadowBounds(
    snapshot,
    lightDirection,
    floorY,
    ceilingY,
  );
  if (casterBounds === null) {
    return null;
  }

  const radius = Math.max(
    casterBounds.radius * SHADOW_RADIUS_MARGIN,
    SHADOW_MIN_RADIUS,
  );
  return {
    center: casterBounds.center,
    orthographicSize: radius * 2,
    lightDistance: radius * 1.6,
    near: radius * 0.3,
    far: radius * 3,
  };
}

/**
 * Bound the region the shadow map must cover: every shadow CASTER's world AABB
 * AND where its shadow lands. A directional shadow extends DOWN-LIGHT from the
 * caster onto the receivers, well beyond the caster's own bounds, so fitting to
 * the casters alone clips the cast shadow. We additionally project each caster
 * AABB corner onto the receiver floor along the light and fold those points into
 * the bound, then return its bounding sphere (center + half-diagonal radius).
 * Null when there are no casters.
 */
function computeCasterShadowBounds(
  snapshot: RenderSnapshot,
  lightDirection: readonly [number, number, number] | null,
  floorY: number | null,
  ceilingY: number | null,
): {
  readonly center: readonly [number, number, number];
  readonly radius: number;
} | null {
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
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  };

  for (const draw of snapshot.meshDraws) {
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
    maxY = ceilingY;
  }

  const center: readonly [number, number, number] = [
    (minX + maxX) * 0.5,
    (minY + maxY) * 0.5,
    (minZ + maxZ) * 0.5,
  ];
  const radius = 0.5 * Math.hypot(maxX - minX, maxY - minY, maxZ - minZ);
  return { center, radius };
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
 * computeCasterShadowBounds). Null when there are no receivers.
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

function createAutoShadowCasterMeshViews(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly snapshot: RenderSnapshot;
}): {
  readonly preparedMeshes: readonly ShadowCasterPreparedMeshResourceView[];
  readonly executableMeshes: readonly ShadowCasterExecutableMeshResourceView[];
} {
  const preparedMeshes: ShadowCasterPreparedMeshResourceView[] = [];
  const executableMeshes: ShadowCasterExecutableMeshResourceView[] = [];
  const preparedByMeshKey = new Set<string>();

  for (const draw of options.snapshot.meshDraws) {
    if (!isShadowCasterDraw(draw, options.snapshot.shadowRequests)) {
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
      frame: options.snapshot.frame,
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

function isShadowCasterDraw(
  draw: MeshDrawPacket,
  shadowRequests: readonly ShadowRequestPacket[],
): boolean {
  return (
    draw.castsShadow !== false &&
    shadowRequests.some(
      (request) =>
        isDirectionalShadowRequest(request) &&
        (draw.layerMask & request.casterLayerMask) !== 0,
    )
  );
}

function isDirectionalShadowRequest(request: ShadowRequestPacket): boolean {
  return request.lightKind === undefined || request.lightKind === "directional";
}
