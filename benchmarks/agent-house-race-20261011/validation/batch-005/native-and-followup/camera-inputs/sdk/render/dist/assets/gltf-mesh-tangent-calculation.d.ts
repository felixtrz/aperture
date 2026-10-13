export interface GltfMeshTangentCalculationInput {
    readonly positions: Float32Array;
    readonly normals: Float32Array;
    readonly uvs: Float32Array;
    readonly indices: Uint16Array | Uint32Array | null;
    readonly vertexCount: number;
    readonly triangleCount: number;
}
export declare function calculateVertexTangents(input: GltfMeshTangentCalculationInput): Float32Array;
//# sourceMappingURL=gltf-mesh-tangent-calculation.d.ts.map