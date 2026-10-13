export function gltfMeshAssetConstructionReportToJsonValue(report) {
    return {
        valid: report.valid,
        meshes: report.meshes.map((mesh) => ({
            ...mesh,
            mesh: mesh.mesh === null ? null : meshAssetToJsonValue(mesh.mesh),
        })),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function gltfMeshAssetConstructionReportToJson(report) {
    return JSON.stringify(gltfMeshAssetConstructionReportToJsonValue(report));
}
function meshAssetToJsonValue(mesh) {
    const { vertexStreams, indexBuffer, morphTargetData, ...rest } = mesh;
    return {
        ...rest,
        vertexStreams: vertexStreams.map((stream) => ({
            ...stream,
            data: typedArrayToJsonSummary(stream.data),
        })),
        ...(indexBuffer === undefined
            ? {}
            : {
                indexBuffer: {
                    format: indexBuffer.format,
                    data: typedArrayToJsonSummary(indexBuffer.data),
                },
            }),
        ...(morphTargetData === undefined
            ? {}
            : {
                morphTargetData: {
                    targetCount: morphTargetData.targetCount,
                    vertexCount: morphTargetData.vertexCount,
                    hasNormals: morphTargetData.hasNormals,
                    positionDeltas: typedArrayToJsonSummary(morphTargetData.positionDeltas),
                    normalDeltas: typedArrayToJsonSummary(morphTargetData.normalDeltas),
                },
            }),
    };
}
function typedArrayToJsonSummary(array) {
    if (array instanceof Float32Array) {
        return { type: "Float32Array", length: array.length };
    }
    if (array instanceof Uint8Array) {
        return { type: "Uint8Array", length: array.length };
    }
    if (array instanceof Uint16Array) {
        return { type: "Uint16Array", length: array.length };
    }
    return { type: "Uint32Array", length: array.length };
}
//# sourceMappingURL=gltf-mesh-asset-construction-report.js.map