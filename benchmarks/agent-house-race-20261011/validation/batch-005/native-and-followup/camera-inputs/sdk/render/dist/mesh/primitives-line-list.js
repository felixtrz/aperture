import { PRIMITIVE_VERTEX_STRIDE_BYTES, boundsFromPositions, interleavePrimitiveVertexList, } from "./primitives-builders.js";
export function createLineListMeshAsset(options) {
    const label = options.label ?? "LineList";
    const vertices = interleavePrimitiveVertexList(options.positions.map((position) => ({
        position,
        normal: [0, 0, 1],
        uv: [0, 0],
    })));
    const indexBuffer = createLineListIndexBuffer(options.indices);
    const submeshes = createLineListSubmeshes({
        submeshes: options.submeshes,
        vertexCount: options.positions.length,
        indexCount: indexBuffer?.data.length ?? 0,
        indexed: indexBuffer !== undefined,
    });
    const materialSlotCount = Math.max(1, options.materialSlots?.length ?? 0, ...submeshes.map((submesh) => submesh.materialSlot + 1));
    const bounds = boundsFromPositions(options.positions);
    return {
        kind: "mesh",
        label,
        vertexStreams: [
            {
                id: "line-list-interleaved",
                arrayStride: PRIMITIVE_VERTEX_STRIDE_BYTES,
                vertexCount: options.positions.length,
                attributes: [
                    { semantic: "POSITION", format: "float32x3", offset: 0 },
                    { semantic: "NORMAL", format: "float32x3", offset: 12 },
                    { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
                ],
                data: vertices,
            },
        ],
        ...(indexBuffer === undefined ? {} : { indexBuffer }),
        submeshes,
        materialSlots: Array.from({ length: materialSlotCount }, (_, index) => ({
            index,
            label: options.materialSlots?.[index] ?? `slot-${index}`,
        })),
        localAabb: bounds.aabb,
        localSphere: bounds.sphere,
    };
}
function createLineListIndexBuffer(indices) {
    if (indices === undefined) {
        return undefined;
    }
    if (indices instanceof Uint16Array) {
        return { format: "uint16", data: indices, indexCount: indices.length };
    }
    if (indices instanceof Uint32Array) {
        return { format: "uint32", data: indices, indexCount: indices.length };
    }
    const maxIndex = indices.reduce((max, index) => Math.max(max, index), 0);
    const data = maxIndex > 0xffff ? new Uint32Array(indices) : new Uint16Array(indices);
    return {
        format: data instanceof Uint32Array ? "uint32" : "uint16",
        data,
        indexCount: data.length,
    };
}
function createLineListSubmeshes(input) {
    const source = input.submeshes === undefined || input.submeshes.length === 0
        ? [
            {
                label: "default",
                materialSlot: 0,
                vertexStart: 0,
                vertexCount: input.vertexCount,
                indexStart: 0,
                indexCount: input.indexed ? input.indexCount : 0,
            },
        ]
        : input.submeshes;
    return source.map((submesh, index) => ({
        label: submesh.label ?? `line-list-${index}`,
        topology: "line-list",
        materialSlot: submesh.materialSlot ?? 0,
        vertexStart: submesh.vertexStart ?? 0,
        vertexCount: submesh.vertexCount ?? input.vertexCount,
        indexStart: submesh.indexStart ?? 0,
        indexCount: submesh.indexCount ?? (input.indexed ? input.indexCount : 0),
    }));
}
//# sourceMappingURL=primitives-line-list.js.map