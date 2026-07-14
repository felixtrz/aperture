// F1 proof route (Animation mixer v2). A tiny two-bone rig — a "hip" marker
// whose height is a locomotion blend space (idle/walk/run selected by a speed
// signal) and a "head" marker rotated by an ADDITIVE head-look layer on top.
// Everything runs headlessly through the engine AnimationMixer N-lane API; the
// worker steps the sim deterministically and reports the sampled bone pose, and
// the main thread renders the two markers so the blend + head-look are visible.
//
// Shared between locomotion-blend.worker.js (builds clips, drives the mixer) and
// locomotion-blend.main.js (registers the same marker mesh/material so the
// renderer resolves the worker snapshot's handles).

export const clearColor = [0.02, 0.03, 0.06, 1];

/** Fixed deterministic step schedule (30 × 1/60s) the worker advances. */
export const STEP_DT = 1 / 60;
export const STEP_COUNT = 30;

/** Locomotion blend-space control points: speed → dominant clip. */
export const BLEND_POINTS = { idle: 0, walk: 3, run: 6 };

/** Additive head-look yaw at look weight 1, in degrees about +Y. */
export const LOOK_ANGLE_DEGREES = 40;

/** Rest pose of the bone markers (the head only ever rotates in place). */
export const HIP_REST = [0, 0, 0];
export const HEAD_REST = [0, 1.4, 0];

/** Marker corner heights that the locomotion clips park the hip at. */
export const HIP_HEIGHT = { idle: 0.0, walk: 0.5, run: 1.0 };

export const MARKER_MESH_ID = "locomotion-marker";
export const HIP_MATERIAL_ID = "locomotion-hip-standard";
export const HEAD_MATERIAL_ID = "locomotion-head-standard";

export const animationReadbackSamples = [
  { id: "hip", x: 0.5, y: 0.66 },
  { id: "head", x: 0.5, y: 0.32 },
  { id: "background", x: 0.08, y: 0.5 },
];

/**
 * 1D locomotion blend weights for a speed signal. `idle`, `walk`, and `run`
 * always sum to 1: below the walk point it blends idle↔walk, above it blends
 * walk↔run. Pure + deterministic so pose readback is exact.
 */
export function blendWeights(speed) {
  const s = clampNumber(speed, BLEND_POINTS.idle, BLEND_POINTS.run);
  if (s <= BLEND_POINTS.walk) {
    const t = (s - BLEND_POINTS.idle) / (BLEND_POINTS.walk - BLEND_POINTS.idle);
    return { idle: 1 - t, walk: t, run: 0 };
  }
  const t = (s - BLEND_POINTS.walk) / (BLEND_POINTS.run - BLEND_POINTS.walk);
  return { idle: 0, walk: 1 - t, run: t };
}

/** The hip height the blend space parks at for `speed` (expected pose value). */
export function expectedHipHeight(speed) {
  const w = blendWeights(speed);
  return (
    w.idle * HIP_HEIGHT.idle + w.walk * HIP_HEIGHT.walk + w.run * HIP_HEIGHT.run
  );
}

/**
 * Build the locomotion + additive head-look clips. Idle/walk/run are constant
 * "corner" poses that park the hip at distinct heights (so the blended height is
 * an exact weighted average); the head-look is an additive delta clip
 * (`makeAdditiveClip`) built from a yaw pose against an identity head reference.
 */
export function buildLocomotionClips(aperture) {
  const idle = hipHeightClip("Idle", HIP_HEIGHT.idle);
  const walk = hipHeightClip("Walk", HIP_HEIGHT.walk);
  const run = hipHeightClip("Run", HIP_HEIGHT.run);

  const yaw = yawQuaternion(LOOK_ANGLE_DEGREES);
  const headLookPose = headRotationClip("HeadLookPose", yaw);
  const headRest = headRotationClip("HeadRest", [0, 0, 0, 1]);
  const headLook = aperture.makeAdditiveClip(headLookPose, {
    referenceClip: headRest,
  });

  return { idle, walk, run, headLook };
}

/** A constant hip-translation clip parking the hip at `height` in Y. */
function hipHeightClip(name, height) {
  const value = [HIP_REST[0], height, HIP_REST[2]];
  return {
    name,
    duration: 1,
    channels: [
      {
        targetId: "hip",
        path: "translation",
        interpolation: "LINEAR",
        times: new Float32Array([0, 1]),
        values: new Float32Array([...value, ...value]),
        componentCount: 3,
      },
    ],
  };
}

/** A constant head-rotation clip holding `quat`. */
function headRotationClip(name, quat) {
  return {
    name,
    duration: 1,
    channels: [
      {
        targetId: "head",
        path: "rotation",
        interpolation: "LINEAR",
        times: new Float32Array([0, 1]),
        values: new Float32Array([...quat, ...quat]),
        componentCount: 4,
      },
    ],
  };
}

/** Quaternion for a yaw of `degrees` about +Y as `[x, y, z, w]`. */
export function yawQuaternion(degrees) {
  const half = (degrees * Math.PI) / 360;
  return [0, Math.sin(half), 0, Math.cos(half)];
}

/**
 * Register the shared marker mesh + two materials (hip = warm, head = cool) into
 * `registry` under stable ids so the worker's ExtractionApp and the main-thread
 * renderer resolve identical handle keys. Returns the handles.
 */
export function registerLocomotionMarkerAssets(aperture, registry) {
  const collections = aperture.createRenderAssetCollections({ registry });
  const mesh = collections.meshes.add(
    aperture.createBoxMeshAsset({
      label: "LocomotionMarker",
      width: 0.6,
      height: 0.6,
      depth: 0.6,
    }),
    { id: MARKER_MESH_ID },
  );
  const hipMaterial = collections.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "LocomotionHipStandard",
      baseColorFactor: new Float32Array([1, 0.55, 0.22, 1]),
      metallicFactor: 0.05,
      roughnessFactor: 0.65,
      emissiveFactor: [0.18, 0.09, 0.03],
    }),
    { id: HIP_MATERIAL_ID },
  );
  const headMaterial = collections.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "LocomotionHeadStandard",
      baseColorFactor: new Float32Array([0.32, 0.62, 1, 1]),
      metallicFactor: 0.05,
      roughnessFactor: 0.55,
      emissiveFactor: [0.05, 0.11, 0.22],
    }),
    { id: HEAD_MATERIAL_ID },
  );
  return { mesh, hipMaterial, headMaterial };
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}
