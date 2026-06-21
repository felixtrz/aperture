export function calculateVertexTangents(input) {
    const tan1 = new Float32Array(input.vertexCount * 3);
    const tan2 = new Float32Array(input.vertexCount * 3);
    const tangents = new Float32Array(input.vertexCount * 4);
    for (let triangle = 0; triangle < input.triangleCount; triangle += 1) {
        const i1 = vertexIndex(input.indices, triangle * 3);
        const i2 = vertexIndex(input.indices, triangle * 3 + 1);
        const i3 = vertexIndex(input.indices, triangle * 3 + 2);
        accumulateTriangleTangents(input.positions, input.uvs, tan1, tan2, i1, i2, i3);
    }
    for (let vertex = 0; vertex < input.vertexCount; vertex += 1) {
        writeOrthogonalizedTangent(input.normals, tan1, tan2, tangents, vertex);
    }
    return tangents;
}
function accumulateTriangleTangents(positions, uvs, tan1, tan2, i1, i2, i3) {
    const p1 = i1 * 3;
    const p2 = i2 * 3;
    const p3 = i3 * 3;
    const uv1 = i1 * 2;
    const uv2 = i2 * 2;
    const uv3 = i3 * 2;
    const x1 = (positions[p2] ?? 0) - (positions[p1] ?? 0);
    const x2 = (positions[p3] ?? 0) - (positions[p1] ?? 0);
    const y1 = (positions[p2 + 1] ?? 0) - (positions[p1 + 1] ?? 0);
    const y2 = (positions[p3 + 1] ?? 0) - (positions[p1 + 1] ?? 0);
    const z1 = (positions[p2 + 2] ?? 0) - (positions[p1 + 2] ?? 0);
    const z2 = (positions[p3 + 2] ?? 0) - (positions[p1 + 2] ?? 0);
    const s1 = (uvs[uv2] ?? 0) - (uvs[uv1] ?? 0);
    const s2 = (uvs[uv3] ?? 0) - (uvs[uv1] ?? 0);
    const t1 = (uvs[uv2 + 1] ?? 0) - (uvs[uv1 + 1] ?? 0);
    const t2 = (uvs[uv3 + 1] ?? 0) - (uvs[uv1 + 1] ?? 0);
    const determinant = s1 * t2 - s2 * t1;
    const [sdirX, sdirY, sdirZ, tdirX, tdirY, tdirZ] = Math.abs(determinant) <= Number.EPSILON
        ? [0, 1, 0, 1, 0, 0]
        : [
            (t2 * x1 - t1 * x2) / determinant,
            (t2 * y1 - t1 * y2) / determinant,
            (t2 * z1 - t1 * z2) / determinant,
            (s1 * x2 - s2 * x1) / determinant,
            (s1 * y2 - s2 * y1) / determinant,
            (s1 * z2 - s2 * z1) / determinant,
        ];
    for (const index of [i1, i2, i3]) {
        const offset = index * 3;
        tan1[offset] = (tan1[offset] ?? 0) + sdirX;
        tan1[offset + 1] = (tan1[offset + 1] ?? 0) + sdirY;
        tan1[offset + 2] = (tan1[offset + 2] ?? 0) + sdirZ;
        tan2[offset] = (tan2[offset] ?? 0) + tdirX;
        tan2[offset + 1] = (tan2[offset + 1] ?? 0) + tdirY;
        tan2[offset + 2] = (tan2[offset + 2] ?? 0) + tdirZ;
    }
}
function writeOrthogonalizedTangent(normals, tan1, tan2, tangents, vertex) {
    const n = vertex * 3;
    const t = vertex * 3;
    const nx = normals[n] ?? 0;
    const ny = normals[n + 1] ?? 0;
    const nz = normals[n + 2] ?? 1;
    const tx = tan1[t] ?? 0;
    const ty = tan1[t + 1] ?? 0;
    const tz = tan1[t + 2] ?? 0;
    const dot = nx * tx + ny * ty + nz * tz;
    const ox = tx - nx * dot;
    const oy = ty - ny * dot;
    const oz = tz - nz * dot;
    const [tangentX, tangentY, tangentZ] = normalizeOrFallbackTangent(ox, oy, oz, nx, ny, nz);
    const cx = ny * tangentZ - nz * tangentY;
    const cy = nz * tangentX - nx * tangentZ;
    const cz = nx * tangentY - ny * tangentX;
    const handedness = cx * (tan2[t] ?? 0) + cy * (tan2[t + 1] ?? 0) + cz * (tan2[t + 2] ?? 0) < 0
        ? -1
        : 1;
    const out = vertex * 4;
    tangents[out] = tangentX;
    tangents[out + 1] = tangentY;
    tangents[out + 2] = tangentZ;
    tangents[out + 3] = handedness;
}
function normalizeOrFallbackTangent(x, y, z, normalX, normalY, normalZ) {
    const length = Math.hypot(x, y, z);
    if (length > Number.EPSILON) {
        return [x / length, y / length, z / length];
    }
    return Math.abs(normalZ) < 0.9
        ? crossAndNormalize(0, 0, 1, normalX, normalY, normalZ)
        : crossAndNormalize(0, 1, 0, normalX, normalY, normalZ);
}
function crossAndNormalize(ax, ay, az, bx, by, bz) {
    const x = ay * bz - az * by;
    const y = az * bx - ax * bz;
    const z = ax * by - ay * bx;
    const length = Math.hypot(x, y, z);
    return length > Number.EPSILON
        ? [x / length, y / length, z / length]
        : [1, 0, 0];
}
function vertexIndex(indices, triangleComponent) {
    return indices === null
        ? triangleComponent
        : (indices[triangleComponent] ?? 0);
}
//# sourceMappingURL=gltf-mesh-tangent-calculation.js.map