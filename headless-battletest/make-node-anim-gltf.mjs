#!/usr/bin/env node
// Builds a minimal glTF (data-URI buffer) with NODE-transform animation (a cube
// that spins about Y via a rotation sampler) — NOT skinning. Used to contrast
// with F15: node animation goes through the same updateAnimationDrivers path but
// never touches the skin-palette inversion, so it should animate at any scale.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "app/public/models/spincube.gltf");

// --- geometry: a unit cube (24 verts, 36 indices) ---
const p = [
  // +X
  [1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1],
  // -X
  [-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1],
  // +Y
  [-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1],
  // -Y
  [-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1],
  // +Z
  [1,-1,1],[1,1,1],[-1,1,1],[-1,-1,1],
  // -Z
  [-1,-1,-1],[-1,1,-1],[1,1,-1],[1,-1,-1],
// Verts at ±50 so that with the node's 0.01 scale the WORLD size is ~1 unit
// (framable), while the mesh-world determinant stays 0.01^3 = 1e-6 (the F15
// boundary comes purely from node scale, not vertex magnitude).
].map((v) => v.map((c) => c * 50));
const positions = new Float32Array(p.flat());
const indices = new Uint16Array(
  [0,1,2,0,2,3, 4,5,6,4,6,7, 8,9,10,8,10,11, 12,13,14,12,14,15, 16,17,18,16,18,19, 20,21,22,20,22,23],
);

// --- animation: 5 keyframes, rotation about Y from 0 to 360 degrees ---
const times = new Float32Array([0, 0.5, 1.0, 1.5, 2.0]);
const rot = [];
for (let i = 0; i < times.length; i += 1) {
  const a = (i / (times.length - 1)) * Math.PI * 2; // full turn
  const half = a / 2;
  rot.push(0, Math.sin(half), 0, Math.cos(half)); // quat about +Y
}
const rotations = new Float32Array(rot);

// --- pack one buffer: positions | indices(+pad) | times | rotations ---
function align4(n) { return (n + 3) & ~3; }
const posBytes = positions.byteLength;
const idxBytes = indices.byteLength;
const idxPad = align4(idxBytes) - idxBytes;
const timeBytes = times.byteLength;
const rotBytes = rotations.byteLength;
const total = posBytes + align4(idxBytes) + timeBytes + rotBytes;
const buf = Buffer.alloc(total);
let o = 0;
Buffer.from(positions.buffer).copy(buf, o); const posOff = o; o += posBytes;
Buffer.from(indices.buffer).copy(buf, o); const idxOff = o; o += idxBytes + idxPad;
Buffer.from(times.buffer).copy(buf, o); const timeOff = o; o += timeBytes;
Buffer.from(rotations.buffer).copy(buf, o); const rotOff = o; o += rotBytes;

// POSITION accessor needs min/max
let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < positions.length; i += 3) {
  for (let k = 0; k < 3; k += 1) {
    min[k] = Math.min(min[k], positions[i + k]);
    max[k] = Math.max(max[k], positions[i + k]);
  }
}

const gltf = {
  asset: { version: "2.0", generator: "headless-battletest node-anim builder" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  // node scale 0.01 → mesh-world determinant 1e-6 (the F15 boundary), to prove
  // node animation is UNAFFECTED where skinning would freeze.
  nodes: [{ mesh: 0, scale: [0.01, 0.01, 0.01], name: "spin" }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
  materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.9, 0.5, 0.2, 1], metallicFactor: 0, roughnessFactor: 0.8 } }],
  animations: [{
    name: "Spin",
    samplers: [{ input: 2, output: 3, interpolation: "LINEAR" }],
    channels: [{ sampler: 0, target: { node: 0, path: "rotation" } }],
  }],
  bufferViews: [
    { buffer: 0, byteOffset: posOff, byteLength: posBytes, target: 34962 },
    { buffer: 0, byteOffset: idxOff, byteLength: idxBytes, target: 34963 },
    { buffer: 0, byteOffset: timeOff, byteLength: timeBytes },
    { buffer: 0, byteOffset: rotOff, byteLength: rotBytes },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: positions.length / 3, type: "VEC3", min, max },
    { bufferView: 1, componentType: 5123, count: indices.length, type: "SCALAR" },
    { bufferView: 2, componentType: 5126, count: times.length, type: "SCALAR", min: [times[0]], max: [times[times.length - 1]] },
    { bufferView: 3, componentType: 5126, count: rotations.length / 4, type: "VEC4" },
  ],
  buffers: [{ byteLength: total, uri: "spincube.bin" }],
};

const binOut = path.join(here, "app/public/models/spincube.bin");
writeFileSync(binOut, buf);
writeFileSync(out, JSON.stringify(gltf));
console.log("wrote", out, "+ spincube.bin", `(${total} buffer bytes, node scale 0.01, det=1e-6)`);
