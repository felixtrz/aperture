import { createBoxMeshAsset } from "./primitives-box-plane.js";
import { boundsFromPositions, createPrimitiveMeshAsset, interleavePrimitiveVertexList, } from "./primitives-builders.js";
import { readRoundedBoxOptions, RoundedBoxMeshError, } from "./rounded-box-validation.js";
// Same outward face orientation and UV directions as createBoxMeshAsset.
const FACES = [
    { axis: 2, sign: 1, u: 0, us: 1, v: 1, vs: 1 },
    { axis: 2, sign: -1, u: 0, us: -1, v: 1, vs: 1 },
    { axis: 0, sign: 1, u: 2, us: -1, v: 1, vs: 1 },
    { axis: 0, sign: -1, u: 2, us: 1, v: 1, vs: 1 },
    { axis: 1, sign: 1, u: 0, us: 1, v: 2, vs: -1 },
    { axis: 1, sign: -1, u: 0, us: 1, v: 2, vs: 1 },
];
/** Indexed circular bevels, supplied smooth normals and independent face UVs. */
export function createRoundedBoxMeshAsset(options = {}) {
    const { halfExtents, radius, bevelSegments, label } = readRoundedBoxOptions(options);
    if (radius === 0) {
        return createBoxMeshAsset({
            width: halfExtents[0] * 2,
            height: halfExtents[1] * 2,
            depth: halfExtents[2] * 2,
            ...(label === undefined ? {} : { label }),
        });
    }
    const core = halfExtents.map((extent) => extent - radius);
    const samples = halfExtents.map((extent) => axisSamples(extent, radius, bevelSegments));
    const vertices = [];
    const indices = [];
    for (const face of FACES) {
        const uValues = samples[face.u];
        const vValues = samples[face.v];
        const start = vertices.length;
        for (const v of vValues) {
            for (const u of uValues) {
                const point = [0, 0, 0];
                point[face.axis] = halfExtents[face.axis] * face.sign;
                point[face.u] = u * face.us;
                point[face.v] = v * face.vs;
                const center = point.map((value, axis) => Math.max(-core[axis], Math.min(core[axis], value)));
                const offset = point.map((value, axis) => value - center[axis]);
                const length = Math.hypot(...offset);
                const normal = offset.map((value) => value / length);
                const position = center.map((value, axis) => Math.fround(value + normal[axis] * radius));
                vertices.push({
                    position: [position[0], position[1], position[2]],
                    normal: [normal[0], normal[1], normal[2]],
                    // Use the original cube face parameter, retaining the flat core's
                    // physical proportion instead of assigning equal UV space per cell.
                    uv: [
                        (u + halfExtents[face.u]) / (2 * halfExtents[face.u]),
                        (v + halfExtents[face.v]) / (2 * halfExtents[face.v]),
                    ],
                });
            }
        }
        for (let row = 0; row < vValues.length - 1; row++) {
            for (let column = 0; column < uValues.length - 1; column++) {
                const a = start + row * uValues.length + column;
                const b = a + 1;
                const d = a + uValues.length;
                const c = d + 1;
                addTriangle(vertices, indices, a, b, c);
                addTriangle(vertices, indices, a, c, d);
            }
        }
    }
    const bounds = boundsFromPositions(vertices.map((vertex) => vertex.position));
    return createPrimitiveMeshAsset({
        label: label ?? "Rounded box",
        vertices: interleavePrimitiveVertexList(vertices),
        vertexCount: vertices.length,
        indices: new Uint16Array(indices),
        localAabb: bounds.aabb,
        localSphere: bounds.sphere,
    });
}
function axisSamples(extent, radius, segments) {
    const inner = extent - radius;
    const positive = Array.from({ length: segments + 1 }, (_, step) => step === segments ? extent : inner + (radius * step) / segments);
    // A fully rounded axis has one center sample, never two coincident rows.
    return [
        ...[...positive].reverse().map((value) => -value),
        ...positive.slice(inner === 0 ? 1 : 0),
    ];
}
function addTriangle(vertices, indices, a, b, c) {
    const p = vertices[a].position;
    const q = vertices[b].position;
    const r = vertices[c].position;
    const ab = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
    const ac = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
    const area = Math.hypot(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]);
    if (!(area > 0) || !Number.isFinite(area)) {
        throw new RoundedBoxMeshError("halfExtents/radius/bevelSegments", "form a zero-area triangle after float32 conversion; increase the bevel radius relative to the extents, reduce bevelSegments, or use radius 0 for a flat box.");
    }
    indices.push(a, b, c);
}
//# sourceMappingURL=primitives-rounded-box.js.map