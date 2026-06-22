import {
  makePerspective,
  multiplyMat4,
  toVec3Tuple,
  vec3Dot,
  type Mat4Like,
} from "@aperture-engine/simulation";
import type { LightPacket, RenderSnapshot } from "@aperture-engine/render";
import { writeBufferData } from "../app/app-frame-resource-utils.js";
import {
  createWebGpuBuffer,
  type WebGpuBufferDeviceLike,
} from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
import type {
  CookieArrayCandidate,
  CookieAtlasCandidate,
  LocalLightClusterCookieMatrixResource,
  LocalLightClusterCookieResourceDiagnostic,
} from "./local-light-cookie-types.js";

const SPOT_COOKIE_MATRIX_VERSION = 1;
const EPSILON = 1e-6;

export function prepareCookieMatrixResource(options: {
  readonly device: WebGpuBufferDeviceLike;
  readonly snapshot: RenderSnapshot;
  readonly light: LightPacket;
  readonly cache?: Map<string, LocalLightClusterCookieMatrixResource>;
  readonly diagnostics: LocalLightClusterCookieResourceDiagnostic[];
}): LocalLightClusterCookieMatrixResource | null {
  const matrix =
    options.light.kind === "spot"
      ? computeSpotCookieMatrix(options.snapshot, options.light)
      : { data: new Float32Array(identityMat4()) };

  if ("diagnostic" in matrix) {
    options.diagnostics.push(matrix.diagnostic);
    return null;
  }

  const resourceKey = cookieMatrixResourceKey(options.light);
  const cached = options.cache?.get(resourceKey);

  if (
    cached !== undefined &&
    cached.matrixCount === 1 &&
    writeBufferData(options.device, cached.buffer, matrix.data)
  ) {
    return cached;
  }

  const buffer = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: resourceKey,
      size: matrix.data.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: matrix.data,
    },
  });

  if (!buffer.ok) {
    options.diagnostics.push({
      code: "localLightClusterCookie.bufferCreationFailed",
      lightId: options.light.lightId,
      reason: buffer.reason,
      message: `Clustered local-light cookie matrix buffer '${resourceKey}' could not be created: ${buffer.message}`,
    });
    return null;
  }

  const resource: LocalLightClusterCookieMatrixResource = {
    resourceKey,
    label: resourceKey,
    buffer: buffer.buffer,
    matrixCount: 1,
    entryLightIds: [options.light.lightId],
  };

  options.cache?.set(resourceKey, resource);

  return resource;
}

export function prepareCookieMatrixArrayResource(options: {
  readonly device: WebGpuBufferDeviceLike;
  readonly snapshot: RenderSnapshot;
  readonly candidates: readonly CookieArrayCandidate[];
  readonly cache?: Map<string, LocalLightClusterCookieMatrixResource>;
  readonly diagnostics: LocalLightClusterCookieResourceDiagnostic[];
}): LocalLightClusterCookieMatrixResource | null {
  const matrixCount = Math.max(
    options.candidates.reduce(
      (total, candidate) => total + candidate.layerCount,
      0,
    ),
    1,
  );
  const matrices = new Float32Array(matrixCount * 16);
  const entryLightIds: number[] = [];

  for (const candidate of options.candidates) {
    const light = candidate.light;

    const matrix =
      light.kind === "spot"
        ? computeSpotCookieMatrix(options.snapshot, light)
        : { data: new Float32Array(identityMat4()) };

    if ("diagnostic" in matrix) {
      options.diagnostics.push(matrix.diagnostic);
      return null;
    }

    for (let layer = 0; layer < candidate.layerCount; layer += 1) {
      matrices.set(matrix.data, (candidate.layerBaseIndex + layer) * 16);
    }

    entryLightIds.push(light.lightId);
  }

  const resourceKey = cookieMatrixArrayResourceKey(options.candidates);
  const cached = options.cache?.get(resourceKey);

  if (
    cached !== undefined &&
    cached.matrixCount === matrixCount &&
    writeBufferData(options.device, cached.buffer, matrices)
  ) {
    return cached;
  }

  const buffer = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: resourceKey,
      size: matrices.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: matrices,
    },
  });

  if (!buffer.ok) {
    options.diagnostics.push({
      code: "localLightClusterCookie.bufferCreationFailed",
      lightId: entryLightIds[0] ?? -1,
      reason: buffer.reason,
      message: `Clustered local-light cookie matrix buffer '${resourceKey}' could not be created: ${buffer.message}`,
    });
    return null;
  }

  const resource: LocalLightClusterCookieMatrixResource = {
    resourceKey,
    label: resourceKey,
    buffer: buffer.buffer,
    matrixCount,
    entryLightIds,
  };

  options.cache?.set(resourceKey, resource);

  return resource;
}

export function prepareCookieAtlasMatrixResource(options: {
  readonly device: WebGpuBufferDeviceLike;
  readonly snapshot: RenderSnapshot;
  readonly candidates: readonly CookieAtlasCandidate[];
  readonly cache?: Map<string, LocalLightClusterCookieMatrixResource>;
  readonly diagnostics: LocalLightClusterCookieResourceDiagnostic[];
}): LocalLightClusterCookieMatrixResource | null {
  const matrixCount = Math.max(options.candidates.length, 1);
  const matrices = new Float32Array(matrixCount * 16);
  const entryLightIds: number[] = [];

  for (const candidate of options.candidates) {
    const matrix = computeSpotCookieMatrix(options.snapshot, candidate.light);

    if ("diagnostic" in matrix) {
      options.diagnostics.push(matrix.diagnostic);
      return null;
    }

    matrices.set(
      atlasAdjustedCookieMatrix(matrix.data, {
        x: candidate.originX / candidate.atlasWidth,
        y: candidate.originY / candidate.atlasHeight,
        width: candidate.atlasTileWidth / candidate.atlasWidth,
        height: candidate.atlasTileHeight / candidate.atlasHeight,
      }),
      candidate.matrixBaseIndex * 16,
    );
    entryLightIds.push(candidate.light.lightId);
  }

  const resourceKey = cookieAtlasMatrixResourceKey(options.candidates);
  const cached = options.cache?.get(resourceKey);

  if (
    cached !== undefined &&
    cached.matrixCount === matrixCount &&
    writeBufferData(options.device, cached.buffer, matrices)
  ) {
    return cached;
  }

  const buffer = createWebGpuBuffer({
    device: options.device,
    descriptor: {
      label: resourceKey,
      size: matrices.byteLength,
      usage:
        WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
      initialData: matrices,
    },
  });

  if (!buffer.ok) {
    options.diagnostics.push({
      code: "localLightClusterCookie.bufferCreationFailed",
      lightId: entryLightIds[0] ?? -1,
      reason: buffer.reason,
      message: `Clustered local-light cookie matrix buffer '${resourceKey}' could not be created: ${buffer.message}`,
    });
    return null;
  }

  const resource: LocalLightClusterCookieMatrixResource = {
    resourceKey,
    label: resourceKey,
    buffer: buffer.buffer,
    matrixCount,
    entryLightIds,
  };

  options.cache?.set(resourceKey, resource);

  return resource;
}

function computeSpotCookieMatrix(
  snapshot: RenderSnapshot,
  light: LightPacket,
):
  | { readonly data: Float32Array }
  | {
      readonly diagnostic: LocalLightClusterCookieResourceDiagnostic;
    } {
  if (!hasMatrix(snapshot.transforms, light.worldTransformOffset)) {
    return {
      diagnostic: {
        code: "localLightClusterCookie.missingLightTransform",
        lightId: light.lightId,
        message: `Clustered spot cookie light '${light.lightId}' references missing transform offset ${light.worldTransformOffset}.`,
      },
    };
  }

  const transform = snapshot.transforms.subarray(
    light.worldTransformOffset,
    light.worldTransformOffset + 16,
  );
  const lightPosition = toVec3Tuple([
    transform[12] ?? 0,
    transform[13] ?? 0,
    transform[14] ?? 0,
  ]);
  const lightDirection = normalize([
    -(transform[8] ?? 0),
    -(transform[9] ?? 0),
    -(transform[10] ?? 0),
  ]);

  if (lightDirection === null) {
    return {
      diagnostic: {
        code: "localLightClusterCookie.invalidLightDirection",
        lightId: light.lightId,
        message: `Clustered spot cookie light '${light.lightId}' has a zero-length light direction.`,
      },
    };
  }

  const target = toVec3Tuple([
    lightPosition[0] + lightDirection[0],
    lightPosition[1] + lightDirection[1],
    lightPosition[2] + lightDirection[2],
  ]);
  const up = toVec3Tuple([
    transform[4] ?? 0,
    transform[5] ?? 1,
    transform[6] ?? 0,
  ]);
  const viewMatrix = makeLookAt(lightPosition, target, up);
  const projectionMatrix = makePerspective(
    Math.max(light.outerConeAngle * 2, 0.01),
    1,
    Math.max(light.range / 1000, 0.01),
    Math.max(light.range, 0.02),
  );
  const viewProjectionMatrix = multiplyMat4(projectionMatrix, viewMatrix);

  return { data: new Float32Array(viewProjectionMatrix) };
}

function cookieMatrixResourceKey(light: LightPacket): string {
  return `local-light-cookie-matrix:v${SPOT_COOKIE_MATRIX_VERSION}:${light.kind}:${light.lightId}`;
}

function cookieMatrixArrayResourceKey(
  candidates: readonly CookieArrayCandidate[],
): string {
  return `local-light-cookie-matrix-array:v${SPOT_COOKIE_MATRIX_VERSION}:${candidates
    .map(
      (candidate) =>
        `${candidate.light.kind}:${candidate.light.lightId}@${candidate.layerBaseIndex}+${candidate.layerCount}`,
    )
    .join(",")}`;
}

function cookieAtlasMatrixResourceKey(
  candidates: readonly CookieAtlasCandidate[],
): string {
  return `local-light-cookie-matrix-atlas:v${SPOT_COOKIE_MATRIX_VERSION}:${candidates
    .map(
      (candidate) =>
        `${candidate.light.kind}:${candidate.light.lightId}@${candidate.matrixBaseIndex}:${candidate.originX},${candidate.originY}+${candidate.atlasTileWidth}x${candidate.atlasTileHeight}`,
    )
    .join(",")}`;
}

function atlasAdjustedCookieMatrix(
  matrix: Float32Array,
  rect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
): Float32Array {
  const result = new Float32Array(matrix);
  const xScale = rect.width;
  const xOffset = 2 * rect.x + rect.width - 1;
  const yScale = rect.height;
  const yOffset = 1 - 2 * rect.y - rect.height;

  for (let column = 0; column < 4; column += 1) {
    const offset = column * 4;
    const row0 = matrix[offset] ?? 0;
    const row1 = matrix[offset + 1] ?? 0;
    const row3 = matrix[offset + 3] ?? 0;

    result[offset] = xScale * row0 + xOffset * row3;
    result[offset + 1] = yScale * row1 + yOffset * row3;
  }

  return result;
}

function makeLookAt(
  eye: readonly [number, number, number],
  target: readonly [number, number, number],
  up: readonly [number, number, number],
): Mat4Like {
  const zAxis = normalize([
    eye[0] - target[0],
    eye[1] - target[1],
    eye[2] - target[2],
  ]);

  if (zAxis === null) {
    return identityMat4();
  }

  const xAxis =
    normalize(cross(toVec3Tuple(up), zAxis)) ??
    normalize(cross(fallbackUpForAxis(zAxis), zAxis)) ??
    toVec3Tuple([1, 0, 0]);
  const yAxis = cross(zAxis, xAxis);

  return [
    xAxis[0],
    yAxis[0],
    zAxis[0],
    0,
    xAxis[1],
    yAxis[1],
    zAxis[1],
    0,
    xAxis[2],
    yAxis[2],
    zAxis[2],
    0,
    -vec3Dot(xAxis, eye),
    -vec3Dot(yAxis, eye),
    -vec3Dot(zAxis, eye),
    1,
  ];
}

function fallbackUpForAxis(
  axis: readonly [number, number, number],
): readonly [number, number, number] {
  return Math.abs(axis[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1];
}

function identityMat4(): Mat4Like {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function hasMatrix(transforms: Float32Array, offset: number): boolean {
  return (
    Number.isInteger(offset) && offset >= 0 && offset + 16 <= transforms.length
  );
}

function normalize(
  value: readonly [number, number, number],
): readonly [number, number, number] | null {
  const length = Math.hypot(value[0], value[1], value[2]);

  if (length <= EPSILON) {
    return null;
  }

  return toVec3Tuple([value[0] / length, value[1] / length, value[2] / length]);
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
