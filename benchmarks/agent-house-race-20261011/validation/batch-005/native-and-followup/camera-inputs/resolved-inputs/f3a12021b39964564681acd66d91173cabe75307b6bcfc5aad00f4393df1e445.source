/**
 * Synthesize per-vertex NORMAL data for a triangle primitive that has none.
 *
 * The glTF spec requires clients to compute normals when a mesh omits the
 * NORMAL attribute; without them a lit (non-unlit) material has nothing to
 * shade against and renders black. We accumulate area-weighted face normals
 * into each vertex (the un-normalized cross product is proportional to the
 * triangle area, so larger faces contribute more) and normalize, which yields
 * smooth normals on indexed geometry without changing the vertex count.
 *
 * Returns a decoded NORMAL accessor (float32x3, one per vertex) on success, or
 * null when the geometry is not a supported indexed/sequential float triangle
 * list — in which case the caller leaves the mesh normal-less, exactly as
 * before.
 */
export function generateMissingNormals(primitive, position) {
    const positions = position.array;
    if (!(positions instanceof Float32Array) || position.itemSize !== 3) {
        return null;
    }
    const indices = primitive.indices?.array ?? null;
    if (indices !== null &&
        !(indices instanceof Uint16Array) &&
        !(indices instanceof Uint32Array)) {
        return null;
    }
    const vertexCount = primitive.vertexCount;
    if (vertexCount <= 0 || positions.length < vertexCount * 3) {
        return null;
    }
    const triangleIndexCount = indices?.length ?? vertexCount;
    const triangleCount = Math.floor(triangleIndexCount / 3);
    if (triangleCount === 0) {
        return null;
    }
    const normals = new Float32Array(vertexCount * 3);
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const i0 = indices ? Number(indices[triangle * 3]) : triangle * 3;
        const i1 = indices ? Number(indices[triangle * 3 + 1]) : triangle * 3 + 1;
        const i2 = indices ? Number(indices[triangle * 3 + 2]) : triangle * 3 + 2;
        if (i0 >= vertexCount || i1 >= vertexCount || i2 >= vertexCount) {
            continue;
        }
        const ax = positions[i0 * 3] ?? 0;
        const ay = positions[i0 * 3 + 1] ?? 0;
        const az = positions[i0 * 3 + 2] ?? 0;
        const bx = positions[i1 * 3] ?? 0;
        const by = positions[i1 * 3 + 1] ?? 0;
        const bz = positions[i1 * 3 + 2] ?? 0;
        const cx = positions[i2 * 3] ?? 0;
        const cy = positions[i2 * 3 + 1] ?? 0;
        const cz = positions[i2 * 3 + 2] ?? 0;
        // edge1 = b - a, edge2 = c - a; faceNormal = edge1 x edge2 (area-weighted).
        const e1x = bx - ax;
        const e1y = by - ay;
        const e1z = bz - az;
        const e2x = cx - ax;
        const e2y = cy - ay;
        const e2z = cz - az;
        const nx = e1y * e2z - e1z * e2y;
        const ny = e1z * e2x - e1x * e2z;
        const nz = e1x * e2y - e1y * e2x;
        for (const index of [i0, i1, i2]) {
            normals[index * 3] = (normals[index * 3] ?? 0) + nx;
            normals[index * 3 + 1] = (normals[index * 3 + 1] ?? 0) + ny;
            normals[index * 3 + 2] = (normals[index * 3 + 2] ?? 0) + nz;
        }
    }
    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
        const x = normals[vertex * 3] ?? 0;
        const y = normals[vertex * 3 + 1] ?? 0;
        const z = normals[vertex * 3 + 2] ?? 0;
        const length = Math.hypot(x, y, z);
        if (length > 1e-8) {
            normals[vertex * 3] = x / length;
            normals[vertex * 3 + 1] = y / length;
            normals[vertex * 3 + 2] = z / length;
        }
        else {
            // Degenerate vertex (no incident area): fall back to +Z.
            normals[vertex * 3] = 0;
            normals[vertex * 3 + 1] = 0;
            normals[vertex * 3 + 2] = 1;
        }
    }
    return {
        semantic: "NORMAL",
        accessorIndex: -1,
        bufferIndex: -1,
        sourceByteOffset: 0,
        sourceByteLength: 0,
        expectedFormat: "float32x3",
        itemSize: 3,
        array: normals,
    };
}
//# sourceMappingURL=gltf-mesh-normals.js.map