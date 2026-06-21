// M2-T9 fixture: a single skinned + 3-morph-target + CUBICSPLINE-animated GLB,
// built in-memory so the route imports it through the public gltf asset API
// (no hand-rolled glb-viewer code). A 2-joint skin bends the top of a quad; a
// CUBICSPLINE "Bend" clip rotates the upper joint; three morph targets (the 3rd
// pushes +X) prove the N-target morph path end to end.
export const clearColor = [0.02, 0.03, 0.06, 1];
export const animationReadbackSamples = [
  { id: "center", x: 0.5, y: 0.5 },
  { id: "upper", x: 0.5, y: 0.3 },
  { id: "right", x: 0.72, y: 0.5 },
];
export const CLIP_NAME = "Bend";
export const MORPH_TARGET_COUNT = 3;
export const SKIN_JOINT_COUNT = 2;
/** Asset key used when declaring the GLB; node keys are `${ASSET_KEY}:node:N`. */
export const ASSET_KEY = "model";
/** glTF node 0 is the skinned mesh; its imported entity carries the morph. */
export const MESH_NODE_KEY = `${ASSET_KEY}:node:0`;

const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BIN_CHUNK = 0x004e4942;

function alignTo4(value) {
  return (value + 3) & ~3;
}

// Append a typed array to the running byte segments, 4-byte aligned, and return
// its byte offset so accessors/bufferViews can reference it.
function pushSegment(segments, state, typedArray) {
  const byteOffset = state.byteLength;
  const bytes = new Uint8Array(
    typedArray.buffer,
    typedArray.byteOffset,
    typedArray.byteLength,
  );
  segments.push(bytes);
  let length = typedArray.byteLength;
  const padded = alignTo4(length);
  if (padded > length) {
    segments.push(new Uint8Array(padded - length));
    length = padded;
  }
  state.byteLength += length;
  return byteOffset;
}

export function buildAnimationSkinningGlb() {
  const segments = [];
  const state = { byteLength: 0 };

  // A 1x2 quad in the XY plane facing +Z: bottom edge at y=-1, top at y=+1.
  // Bottom verts bind to joint 0 (still); top verts bind to joint 1 (rotates).
  const positionOffset = pushSegment(
    segments,
    state,
    new Float32Array([-0.5, -1, 0, 0.5, -1, 0, -0.5, 1, 0, 0.5, 1, 0]),
  );
  const normalOffset = pushSegment(
    segments,
    state,
    new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
  );
  const uvOffset = pushSegment(
    segments,
    state,
    new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]),
  );
  const jointsOffset = pushSegment(
    segments,
    state,
    // VEC4 u8 joint indices: bottom → joint 0, top → joint 1.
    new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
  );
  const weightsOffset = pushSegment(
    segments,
    state,
    new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
  );
  const indicesOffset = pushSegment(
    segments,
    state,
    new Uint16Array([0, 1, 2, 2, 1, 3]),
  );
  // Morph targets 0 and 1: zero. Target 2: push every vertex +0.8 in X.
  const morph0Offset = pushSegment(segments, state, new Float32Array(12));
  const morph1Offset = pushSegment(segments, state, new Float32Array(12));
  const morph2Offset = pushSegment(
    segments,
    state,
    new Float32Array([0.8, 0, 0, 0.8, 0, 0, 0.8, 0, 0, 0.8, 0, 0]),
  );
  // Two identity inverse-bind matrices (column-major MAT4).
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const inverseBindOffset = pushSegment(
    segments,
    state,
    new Float32Array([...identity, ...identity]),
  );
  // Animation: rotation keyframe times [0, 1].
  const timesOffset = pushSegment(segments, state, new Float32Array([0, 1]));
  // CUBICSPLINE rotation output: per keyframe [inTangent, value, outTangent],
  // each VEC4. kf0 value = identity quat, kf1 value = 90deg about Z; zero tangents.
  const rotationOffset = pushSegment(
    segments,
    state,
    new Float32Array([
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0, // kf0 in / value(identity) / out
      0,
      0,
      0,
      0,
      0,
      0,
      0.7071,
      0.7071,
      0,
      0,
      0,
      0, // kf1 in / value(90Z) / out
    ]),
  );

  const totalLength = state.byteLength;
  const root = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2] }],
    nodes: [
      { name: "SkinnedMesh", mesh: 0, skin: 0 },
      { name: "Joint0" },
      { name: "Joint1" },
    ],
    materials: [
      {
        name: "AnimatedStandard",
        pbrMetallicRoughness: {
          baseColorFactor: [1, 0.62, 0.22, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
        emissiveFactor: [0.55, 0.32, 0.12],
      },
    ],
    meshes: [
      {
        primitives: [
          {
            attributes: {
              POSITION: 0,
              NORMAL: 1,
              TEXCOORD_0: 2,
              JOINTS_0: 3,
              WEIGHTS_0: 4,
            },
            indices: 5,
            material: 0,
            targets: [{ POSITION: 6 }, { POSITION: 7 }, { POSITION: 8 }],
          },
        ],
      },
    ],
    skins: [{ joints: [1, 2], inverseBindMatrices: 9 }],
    animations: [
      {
        name: CLIP_NAME,
        samplers: [{ input: 10, output: 11, interpolation: "CUBICSPLINE" }],
        channels: [{ sampler: 0, target: { node: 2, path: "rotation" } }],
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        type: "VEC3",
        count: 4,
        min: [-1.3, -1, 0],
        max: [1.3, 1, 0],
      },
      { bufferView: 1, componentType: 5126, type: "VEC3", count: 4 },
      { bufferView: 2, componentType: 5126, type: "VEC2", count: 4 },
      { bufferView: 3, componentType: 5121, type: "VEC4", count: 4 },
      { bufferView: 4, componentType: 5126, type: "VEC4", count: 4 },
      { bufferView: 5, componentType: 5123, type: "SCALAR", count: 6 },
      { bufferView: 6, componentType: 5126, type: "VEC3", count: 4 },
      { bufferView: 7, componentType: 5126, type: "VEC3", count: 4 },
      { bufferView: 8, componentType: 5126, type: "VEC3", count: 4 },
      { bufferView: 9, componentType: 5126, type: "MAT4", count: 2 },
      { bufferView: 10, componentType: 5126, type: "SCALAR", count: 2 },
      { bufferView: 11, componentType: 5126, type: "VEC4", count: 6 },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: positionOffset, byteLength: 48 },
      { buffer: 0, byteOffset: normalOffset, byteLength: 48 },
      { buffer: 0, byteOffset: uvOffset, byteLength: 32 },
      { buffer: 0, byteOffset: jointsOffset, byteLength: 16 },
      { buffer: 0, byteOffset: weightsOffset, byteLength: 64 },
      { buffer: 0, byteOffset: indicesOffset, byteLength: 12 },
      { buffer: 0, byteOffset: morph0Offset, byteLength: 48 },
      { buffer: 0, byteOffset: morph1Offset, byteLength: 48 },
      { buffer: 0, byteOffset: morph2Offset, byteLength: 48 },
      { buffer: 0, byteOffset: inverseBindOffset, byteLength: 128 },
      { buffer: 0, byteOffset: timesOffset, byteLength: 8 },
      { buffer: 0, byteOffset: rotationOffset, byteLength: 96 },
    ],
    buffers: [{ byteLength: totalLength }],
  };

  return packGlb(root, segments, totalLength);
}

function packGlb(root, segments, binLength) {
  const encoder = new TextEncoder();
  let json = encoder.encode(JSON.stringify(root));
  const jsonPadded = alignTo4(json.length);
  if (jsonPadded > json.length) {
    const padded = new Uint8Array(jsonPadded);
    padded.set(json);
    padded.fill(0x20, json.length); // pad JSON with spaces
    json = padded;
  }

  const bin = new Uint8Array(binLength);
  let cursor = 0;
  for (const segment of segments) {
    bin.set(segment, cursor);
    cursor += segment.length;
  }

  const totalLength = 12 + 8 + json.length + 8 + bin.length;
  const out = new Uint8Array(totalLength);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, json.length, true);
  view.setUint32(16, GLB_JSON_CHUNK, true);
  out.set(json, 20);
  const binChunkStart = 20 + json.length;
  view.setUint32(binChunkStart, bin.length, true);
  view.setUint32(binChunkStart + 4, GLB_BIN_CHUNK, true);
  out.set(bin, binChunkStart + 8);
  return out;
}

/**
 * Register the GLB's render assets (mesh with morphTargetData + material) into a
 * source-asset registry under the `ASSET_KEY` prefix, so the main-thread
 * renderer resolves the same mesh/material keys the worker's createApertureApp
 * import produces from the same bytes.
 */
export function registerAnimationSkinningRenderAssets(aperture, registry) {
  const report = aperture.createGltfReportDrivenImportReportFromGlb({
    source: buildAnimationSkinningGlb(),
    createAssetMapping: true,
    createMeshAssets: true,
    keyPrefix: ASSET_KEY,
  });
  const importReport = report.importReport;
  if (importReport === null) {
    throw new Error("animation-skinning GLB failed to import for rendering.");
  }
  aperture.registerGltfSourceAssetsFromReports({
    registry,
    assetMapping: importReport.assetMapping,
    meshConstruction: importReport.meshConstruction,
  });
}

export function animationSkinningDataUrl() {
  const glb = buildAnimationSkinningGlb();
  let binary = "";
  for (let i = 0; i < glb.length; i += 1) {
    binary += String.fromCharCode(glb[i]);
  }
  // btoa is available in both the browser worker and Node 18+ (vitest).
  return `data:model/gltf-binary;base64,${btoa(binary)}`;
}
