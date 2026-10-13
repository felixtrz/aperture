export function validNodeReference(nodes, nodeIndex) {
    return (Number.isInteger(nodeIndex) &&
        typeof nodeIndex === "number" &&
        nodeIndex >= 0 &&
        nodeIndex < nodes.length);
}
export function mapOptionalIndex(value) {
    return Number.isInteger(value) && typeof value === "number" && value >= 0
        ? value
        : null;
}
export function sceneKey(options, sceneIndex) {
    return `${options.keyPrefix ?? "gltf"}:scene:${sceneIndex}`;
}
export function nodeKey(keyPrefix, nodeIndex) {
    return `${keyPrefix}:node:${nodeIndex}`;
}
export function createGltfSceneTraversalResult(input) {
    return {
        valid: input.diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
        root: input.root,
        sceneIndex: input.sceneIndex,
        sceneEntityKey: input.sceneEntityKey,
        rootNodeKeys: input.rootNodeKeys,
        nodes: input.nodes,
        diagnostics: input.diagnostics,
    };
}
export function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function toDiagnosticValue(value) {
    if (value === null) {
        return null;
    }
    switch (typeof value) {
        case "string":
        case "boolean":
            return value;
        case "number":
            return Number.isFinite(value) ? value : String(value);
        case "undefined":
            return "undefined";
        case "bigint":
        case "symbol":
        case "function":
        case "object":
            return Object.prototype.toString.call(value);
    }
    return String(value);
}
//# sourceMappingURL=gltf-scene-traversal-utils.js.map