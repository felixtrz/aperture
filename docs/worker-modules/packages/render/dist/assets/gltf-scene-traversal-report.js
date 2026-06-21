export function gltfSceneTraversalReportToJsonValue(report) {
    return {
        valid: report.valid,
        root: report.root,
        sceneIndex: report.sceneIndex,
        sceneEntityKey: report.sceneEntityKey,
        rootNodeKeys: [...report.rootNodeKeys],
        nodes: report.nodes.map((node) => ({
            ...node,
            childNodeIndices: [...node.childNodeIndices],
        })),
        diagnostics: report.diagnostics.map((diagnostic) => ({
            ...diagnostic,
            ...(diagnostic.path === undefined ? {} : { path: [...diagnostic.path] }),
        })),
    };
}
export function gltfSceneTraversalReportToJson(report) {
    return JSON.stringify(gltfSceneTraversalReportToJsonValue(report));
}
//# sourceMappingURL=gltf-scene-traversal-report.js.map