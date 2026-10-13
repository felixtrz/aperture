const FLOATS_PER_PRIMITIVE_VERTEX = 8;
export const PRIMITIVE_VERTEX_STRIDE_BYTES = FLOATS_PER_PRIMITIVE_VERTEX * 4;
export function boundsFromPositions(positions) {
    if (positions.length === 0) {
        return {
            aabb: { min: [0, 0, 0], max: [0, 0, 0] },
            sphere: { center: [0, 0, 0], radius: 0 },
        };
    }
    const min = [
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
    ];
    const max = [
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
    ];
    for (const position of positions) {
        min[0] = Math.min(min[0], position[0]);
        min[1] = Math.min(min[1], position[1]);
        min[2] = Math.min(min[2], position[2]);
        max[0] = Math.max(max[0], position[0]);
        max[1] = Math.max(max[1], position[1]);
        max[2] = Math.max(max[2], position[2]);
    }
    const center = [
        (min[0] + max[0]) * 0.5,
        (min[1] + max[1]) * 0.5,
        (min[2] + max[2]) * 0.5,
    ];
    const radius = positions.reduce((current, position) => Math.max(current, Math.hypot(position[0] - center[0], position[1] - center[1], position[2] - center[2])), 0);
    return {
        aabb: { min, max },
        sphere: { center, radius },
    };
}
export function createPrimitiveMeshAsset(input) {
    return {
        kind: "mesh",
        label: input.label,
        vertexStreams: [
            {
                id: "primitive-interleaved",
                arrayStride: PRIMITIVE_VERTEX_STRIDE_BYTES,
                vertexCount: input.vertexCount,
                attributes: [
                    { semantic: "POSITION", format: "float32x3", offset: 0 },
                    { semantic: "NORMAL", format: "float32x3", offset: 12 },
                    { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
                ],
                data: input.vertices,
            },
        ],
        indexBuffer: {
            format: "uint16",
            data: input.indices,
        },
        submeshes: [
            {
                label: "default",
                topology: "triangle-list",
                materialSlot: 0,
                vertexStart: 0,
                vertexCount: input.vertexCount,
                indexStart: 0,
                indexCount: input.indices.length,
            },
        ],
        materialSlots: [{ index: 0, label: "default" }],
        localAabb: input.localAabb,
        localSphere: input.localSphere,
    };
}
export function face(positions, normal) {
    return [
        { position: positions[0], normal, uv: [0, 0] },
        { position: positions[1], normal, uv: [1, 0] },
        { position: positions[2], normal, uv: [1, 1] },
        { position: positions[3], normal, uv: [0, 1] },
    ];
}
export function interleavePrimitiveVertices(faces) {
    return interleavePrimitiveVertexList(faces.flatMap((primitiveFace) => [...primitiveFace]));
}
export function interleavePrimitiveVertexList(vertices) {
    const values = [];
    for (const vertex of vertices) {
        values.push(vertex.position[0], vertex.position[1], vertex.position[2], vertex.normal[0], vertex.normal[1], vertex.normal[2], vertex.uv[0], vertex.uv[1]);
    }
    return new Float32Array(values);
}
export function positiveFinite(value, fallback) {
    return value === undefined || !Number.isFinite(value) || value <= 0
        ? fallback
        : value;
}
export function nonNegativeFinite(value, fallback) {
    return value === undefined || !Number.isFinite(value) || value < 0
        ? fallback
        : value;
}
export function clampInteger(value, min, max) {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.min(max, Math.max(min, Math.floor(value)));
}
export function normalize(value) {
    const length = Math.hypot(value[0], value[1], value[2]);
    if (length === 0) {
        return [0, 1, 0];
    }
    return [value[0] / length, value[1] / length, value[2] / length];
}
//# sourceMappingURL=primitives-builders.js.map