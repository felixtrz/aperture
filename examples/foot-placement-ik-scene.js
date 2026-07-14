// F2 proof route (IK — two-bone + CCD). A tiny leg rig — hip (root) → knee
// (mid) → foot (end), a parented transform chain — whose foot is planted onto
// uneven ground found by a PHYSICS RAYCAST. The worker casts a downward ray
// against a tilted static ramp collider, sets the two-bone IK constraint's
// target to the hit point, and the engine's fixed-step IK system bends the knee
// so the foot lands exactly on the surface. A pole hint controls which way the
// knee points. Everything is deterministic (pure IK math + CPU physics), so the
// worker reports the sampled joint pose for the e2e to assert.
//
// Shared between foot-placement-ik.worker.js (builds the scene, raycasts, drives
// IK) and foot-placement-ik.main.js (registers the same mesh/materials so the
// renderer resolves the worker snapshot's handles).

export const clearColor = [0.02, 0.03, 0.05, 1];

export const FIXED_DELTA = 1 / 60;
/** Physics settle steps before the raycast (creates the ramp collider). */
export const SETTLE_STEPS = 6;

/** Hip (root) world height; the foot must reach down to the ground from here. */
export const HIP_HEIGHT = 2.6;
/** Thigh + shin bone lengths (each joint hangs this far below its parent). */
export const BONE_LENGTH = 1.15;

/** Static ramp: a tilted box collider that gives x-varying ground height. */
export const RAMP = {
  halfExtents: [4, 0.3, 2.5],
  translation: [0, 0.6, 0],
  // ~10° tilt about +Z so the top surface rises with +x.
  rotationDegrees: 10,
};

/** Ray cast straight down from this height to find the ground under the foot. */
export const RAY_ORIGIN_HEIGHT = 5;
export const RAY_MAX_DISTANCE = 10;

export const MARKER_MESH_ID = "foot-placement-marker";
export const RAMP_MESH_ID = "foot-placement-ramp";
export const RAMP_MATERIAL_ID = "foot-placement-ramp-standard";
export const HIP_MATERIAL_ID = "foot-placement-hip-standard";
export const KNEE_MATERIAL_ID = "foot-placement-knee-standard";
export const FOOT_MATERIAL_ID = "foot-placement-foot-standard";
export const TARGET_MATERIAL_ID = "foot-placement-target-standard";

export const footPlacementReadbackSamples = [
  { id: "background", x: 0.06, y: 0.12 },
  { id: "ground", x: 0.5, y: 0.85 },
  { id: "leg", x: 0.5, y: 0.45 },
];

/** Quaternion for a rotation of `degrees` about +Z as `[x, y, z, w]`. */
export function zRotationQuaternion(degrees) {
  const half = (degrees * Math.PI) / 360;
  return [0, 0, Math.sin(half), Math.cos(half)];
}

/**
 * Register the shared marker + ramp meshes and their materials into `registry`
 * under stable ids so the worker's ExtractionApp and the main-thread renderer
 * resolve identical handle keys. Returns the handles.
 */
export function registerFootPlacementAssets(aperture, registry) {
  const collections = aperture.createRenderAssetCollections({ registry });
  const marker = collections.meshes.add(
    aperture.createBoxMeshAsset({
      label: "FootPlacementMarker",
      width: 0.34,
      height: 0.34,
      depth: 0.34,
    }),
    { id: MARKER_MESH_ID },
  );
  const ramp = collections.meshes.add(
    aperture.createBoxMeshAsset({
      label: "FootPlacementRamp",
      width: RAMP.halfExtents[0] * 2,
      height: RAMP.halfExtents[1] * 2,
      depth: RAMP.halfExtents[2] * 2,
    }),
    { id: RAMP_MESH_ID },
  );
  const rampMaterial = collections.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "FootPlacementRampStandard",
      baseColorFactor: new Float32Array([0.3, 0.34, 0.4, 1]),
      metallicFactor: 0.05,
      roughnessFactor: 0.9,
    }),
    { id: RAMP_MATERIAL_ID },
  );
  const hipMaterial = standardMarker(aperture, collections, {
    id: HIP_MATERIAL_ID,
    label: "FootPlacementHipStandard",
    color: [1, 0.55, 0.22, 1],
    emissive: [0.18, 0.09, 0.03],
  });
  const kneeMaterial = standardMarker(aperture, collections, {
    id: KNEE_MATERIAL_ID,
    label: "FootPlacementKneeStandard",
    color: [0.32, 0.62, 1, 1],
    emissive: [0.05, 0.11, 0.22],
  });
  const footMaterial = standardMarker(aperture, collections, {
    id: FOOT_MATERIAL_ID,
    label: "FootPlacementFootStandard",
    color: [0.4, 1, 0.55, 1],
    emissive: [0.06, 0.22, 0.09],
  });
  const targetMaterial = standardMarker(aperture, collections, {
    id: TARGET_MATERIAL_ID,
    label: "FootPlacementTargetStandard",
    color: [1, 0.24, 0.32, 1],
    emissive: [0.28, 0.04, 0.06],
  });

  return {
    marker,
    ramp,
    rampMaterial,
    hipMaterial,
    kneeMaterial,
    footMaterial,
    targetMaterial,
  };
}

function standardMarker(aperture, collections, { id, label, color, emissive }) {
  return collections.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label,
      baseColorFactor: new Float32Array(color),
      metallicFactor: 0.05,
      roughnessFactor: 0.55,
      emissiveFactor: emissive,
    }),
    { id },
  );
}
