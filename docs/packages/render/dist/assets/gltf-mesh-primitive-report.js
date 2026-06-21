export function gltfMeshPrimitiveMappingReportToJsonValue(report) {
    return {
        valid: report.valid,
        root: report.root,
        meshes: report.meshes.map((mesh) => ({
            ...mesh,
            mesh: mesh.mesh === null ? null : meshAssetToJsonSummary(mesh.mesh),
        })),
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function gltfMeshPrimitiveMappingReportToJson(report) {
    return JSON.stringify(gltfMeshPrimitiveMappingReportToJsonValue(report));
}
export function createGltfMeshPrimitiveMappingReportResult(input) {
    return {
        valid: input.diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
        root: input.root,
        meshes: input.meshes,
        diagnostics: input.diagnostics,
    };
}
function meshAssetToJsonSummary(mesh) {
    return {
        kind: "mesh",
        label: mesh.label,
        vertexStreams: mesh.vertexStreams.length,
        submeshes: mesh.submeshes.length,
        materialSlots: mesh.materialSlots.length,
        ...(mesh.indexBuffer === undefined
            ? {}
            : {
                indexFormat: mesh.indexBuffer.format,
                indexCount: mesh.indexBuffer.data.length,
            }),
        hasLocalAabb: mesh.localAabb !== undefined,
        hasLocalSphere: mesh.localSphere !== undefined,
    };
}
//# sourceMappingURL=gltf-mesh-primitive-report.js.map