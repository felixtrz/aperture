// Shared geometry + constants for the cloth-flag example (D5, advanced-audit
// scenario #16): a CPU-simulated cloth flag whose vertex positions/normals are
// deformed every frame and streamed to the GPU with `this.meshes.update(...)`.
//
// The mesh is a small low-resolution grid (SwiftShader e2e is slow) with a
// SINGLE interleaved vertex stream (POSITION/NORMAL/TEXCOORD_0, stride 32 — the
// exact layout the built-in standard material expects) and a static index
// buffer. The TOP row is pinned (a hanging banner), so each frame only the
// moving rows' bytes are re-uploaded through the existing update-range plan:
// one contiguous vertex window, and the index buffer is left untouched. That
// makes the per-frame GPU upload strictly PARTIAL — `frameBytes` is the moving
// window size, well below `frameFullBytes` (a full re-realization of the
// vertex + index buffers). No asset is ever re-registered.

export const CLOTH_COLS = 13;
export const CLOTH_ROWS = 10;
export const CLOTH_FLOATS_PER_VERTEX = 8;
export const CLOTH_VERTEX_STRIDE_BYTES = CLOTH_FLOATS_PER_VERTEX * 4; // 32

export const CLOTH_VERTEX_COUNT = CLOTH_COLS * CLOTH_ROWS; // 130
export const CLOTH_VERTEX_BYTES =
  CLOTH_VERTEX_COUNT * CLOTH_VERTEX_STRIDE_BYTES; // 4160
export const CLOTH_INDEX_COUNT = (CLOTH_COLS - 1) * (CLOTH_ROWS - 1) * 6; // 648
export const CLOTH_INDEX_BYTES = CLOTH_INDEX_COUNT * 2; // uint16 -> 1296

// The top row (row 0) is pinned. Only rows 1..ROWS-1 move, so the per-frame
// update window is one contiguous byte range starting after the pinned row.
export const CLOTH_PINNED_ROWS = 1;
export const CLOTH_PINNED_BYTES =
  CLOTH_PINNED_ROWS * CLOTH_COLS * CLOTH_VERTEX_STRIDE_BYTES; // 416
export const CLOTH_MOVING_BYTES = CLOTH_VERTEX_BYTES - CLOTH_PINNED_BYTES; // 3744

/** The exact partial-upload window streamed each frame (moving rows only). */
export const CLOTH_UPDATE_RANGE = Object.freeze({
  byteOffset: CLOTH_PINNED_BYTES,
  byteLength: CLOTH_MOVING_BYTES,
});

/** The partial-upload byte count the report must show each frame. */
export const CLOTH_EXPECTED_FRAME_BYTES = CLOTH_MOVING_BYTES; // 3744
/** Bytes a FULL re-realization (vertex + index) would have cost. */
export const CLOTH_FULL_UPLOAD_BYTES = CLOTH_VERTEX_BYTES + CLOTH_INDEX_BYTES; // 5456

export const CLOTH_STREAM_ID = "cloth-surface";
export const CLOTH_MESH_ID = "cloth-flag.mesh";

export const CLOTH_WIDTH = 3;
export const CLOTH_HEIGHT = 2.2;
export const CLOTH_WAVE_AMPLITUDE = 0.6;
const CLOTH_WAVE_FREQ = 1.7;
const CLOTH_WAVE_SPEED = 3.4;

// A fixed, generous local AABB/sphere that already contains every deformed
// pose, so the flag is never frustum-culled and the bounds never change (a
// changing AABB would churn the culling snapshot each frame).
export const CLOTH_LOCAL_AABB = Object.freeze({
  min: [-CLOTH_WIDTH / 2, -CLOTH_HEIGHT / 2, -CLOTH_WAVE_AMPLITUDE * 1.5],
  max: [CLOTH_WIDTH / 2, CLOTH_HEIGHT / 2, CLOTH_WAVE_AMPLITUDE * 1.5],
});
export const CLOTH_LOCAL_SPHERE = Object.freeze({
  center: [0, 0, 0],
  radius: Math.hypot(CLOTH_WIDTH / 2, CLOTH_HEIGHT / 2, CLOTH_WAVE_AMPLITUDE),
});

function restX(col) {
  return (col / (CLOTH_COLS - 1) - 0.5) * CLOTH_WIDTH;
}

function restY(row) {
  return (0.5 - row / (CLOTH_ROWS - 1)) * CLOTH_HEIGHT;
}

/**
 * Build the initial interleaved vertex buffer (flat rest pose) and the static
 * triangle index buffer. The returned `positions` Float32Array is the backing
 * store the system mutates in place each frame.
 */
export function createClothGeometry() {
  const positions = new Float32Array(
    CLOTH_VERTEX_COUNT * CLOTH_FLOATS_PER_VERTEX,
  );

  for (let row = 0; row < CLOTH_ROWS; row += 1) {
    for (let col = 0; col < CLOTH_COLS; col += 1) {
      const base = (row * CLOTH_COLS + col) * CLOTH_FLOATS_PER_VERTEX;
      positions[base] = restX(col);
      positions[base + 1] = restY(row);
      positions[base + 2] = 0;
      positions[base + 3] = 0;
      positions[base + 4] = 0;
      positions[base + 5] = 1;
      positions[base + 6] = col / (CLOTH_COLS - 1);
      positions[base + 7] = row / (CLOTH_ROWS - 1);
    }
  }

  const indices = new Uint16Array(CLOTH_INDEX_COUNT);
  let cursor = 0;

  for (let row = 0; row < CLOTH_ROWS - 1; row += 1) {
    for (let col = 0; col < CLOTH_COLS - 1; col += 1) {
      const topLeft = row * CLOTH_COLS + col;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + CLOTH_COLS;
      const bottomRight = bottomLeft + 1;
      indices[cursor] = topLeft;
      indices[cursor + 1] = bottomLeft;
      indices[cursor + 2] = topRight;
      indices[cursor + 3] = topRight;
      indices[cursor + 4] = bottomLeft;
      indices[cursor + 5] = bottomRight;
      cursor += 6;
    }
  }

  return { positions, indices };
}

/** Build the MeshAsset object for the cloth grid (a plain, serializable object). */
export function createClothMeshAsset(positions, indices) {
  return {
    kind: "mesh",
    label: "Cloth Flag",
    vertexStreams: [
      {
        id: CLOTH_STREAM_ID,
        arrayStride: CLOTH_VERTEX_STRIDE_BYTES,
        vertexCount: CLOTH_VERTEX_COUNT,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        ],
        data: positions,
      },
    ],
    indexBuffer: { format: "uint16", data: indices },
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: CLOTH_VERTEX_COUNT,
        indexStart: 0,
        indexCount: CLOTH_INDEX_COUNT,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: {
      min: [...CLOTH_LOCAL_AABB.min],
      max: [...CLOTH_LOCAL_AABB.max],
    },
    localSphere: {
      center: [...CLOTH_LOCAL_SPHERE.center],
      radius: CLOTH_LOCAL_SPHERE.radius,
    },
  };
}

function samplePosition(positions, row, col) {
  const r = Math.min(Math.max(row, 0), CLOTH_ROWS - 1);
  const c = Math.min(Math.max(col, 0), CLOTH_COLS - 1);
  const base = (r * CLOTH_COLS + c) * CLOTH_FLOATS_PER_VERTEX;
  return [positions[base], positions[base + 1], positions[base + 2]];
}

/**
 * CPU cloth "simulation": displace the moving rows' Z by a travelling wave and
 * recompute their normals from grid neighbors, mutating `positions` in place.
 * The pinned top row is never touched, so the caller can upload exactly the
 * moving-row window.
 */
export function deformCloth(positions, time) {
  for (let row = CLOTH_PINNED_ROWS; row < CLOTH_ROWS; row += 1) {
    const droop = row / (CLOTH_ROWS - 1);
    for (let col = 0; col < CLOTH_COLS; col += 1) {
      const base = (row * CLOTH_COLS + col) * CLOTH_FLOATS_PER_VERTEX;
      const primary =
        Math.sin(col * CLOTH_WAVE_FREQ + time * CLOTH_WAVE_SPEED) *
        CLOTH_WAVE_AMPLITUDE;
      const secondary =
        Math.sin(row * 0.9 - time * 1.3) * CLOTH_WAVE_AMPLITUDE * 0.35;
      positions[base + 2] = (primary + secondary) * droop;
    }
  }

  for (let row = CLOTH_PINNED_ROWS; row < CLOTH_ROWS; row += 1) {
    for (let col = 0; col < CLOTH_COLS; col += 1) {
      const base = (row * CLOTH_COLS + col) * CLOTH_FLOATS_PER_VERTEX;
      const left = samplePosition(positions, row, col - 1);
      const right = samplePosition(positions, row, col + 1);
      const up = samplePosition(positions, row - 1, col);
      const down = samplePosition(positions, row + 1, col);
      const du = [right[0] - left[0], right[1] - left[1], right[2] - left[2]];
      const dv = [down[0] - up[0], down[1] - up[1], down[2] - up[2]];
      let nx = dv[1] * du[2] - dv[2] * du[1];
      let ny = dv[2] * du[0] - dv[0] * du[2];
      let nz = dv[0] * du[1] - dv[1] * du[0];
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length;
      ny /= length;
      nz /= length;
      if (nz < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      positions[base + 3] = nx;
      positions[base + 4] = ny;
      positions[base + 5] = nz;
    }
  }
}
