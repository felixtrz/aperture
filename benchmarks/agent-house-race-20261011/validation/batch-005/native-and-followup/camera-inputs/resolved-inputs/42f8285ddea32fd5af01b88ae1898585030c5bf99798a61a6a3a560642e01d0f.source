import { isRecord, toDiagnosticValue } from "./gltf-scene-traversal-utils.js";
export function selectScene(input) {
    const scenes = input.root.scenes;
    if (!Array.isArray(scenes)) {
        input.diagnostics.push({
            code: "gltfScene.malformedScenes",
            severity: "error",
            field: "scenes",
            value: toDiagnosticValue(scenes),
            message: "glTF scenes must be an array for scene traversal.",
        });
        return null;
    }
    const selectedIndex = chooseSceneIndex(input.root, scenes, input.sceneIndex);
    if (selectedIndex === null) {
        input.diagnostics.push({
            code: "gltfScene.invalidSceneIndex",
            severity: "error",
            field: input.sceneIndex === undefined ? "scene" : "sceneIndex",
            value: toDiagnosticValue(input.sceneIndex ?? input.root.scene),
            message: "No deterministic glTF scene could be selected for traversal.",
        });
        return null;
    }
    const scene = scenes[selectedIndex];
    if (!isRecord(scene)) {
        input.diagnostics.push({
            code: "gltfScene.malformedScene",
            severity: "error",
            sceneIndex: selectedIndex,
            field: `scenes[${selectedIndex}]`,
            value: toDiagnosticValue(scene),
            message: `glTF scene ${selectedIndex} must be an object.`,
        });
        return null;
    }
    return { sceneIndex: selectedIndex, scene };
}
export function sceneRootNodeIndices(input) {
    const nodes = input.scene.nodes;
    if (nodes === undefined) {
        return [];
    }
    if (!Array.isArray(nodes)) {
        input.diagnostics.push({
            code: "gltfScene.malformedSceneNodes",
            severity: "error",
            sceneIndex: input.sceneIndex,
            field: `scenes[${input.sceneIndex}].nodes`,
            value: toDiagnosticValue(nodes),
            message: `glTF scene ${input.sceneIndex} nodes must be an array when present.`,
        });
        return null;
    }
    return nodes;
}
export function nodeArray(root, diagnostics) {
    const nodes = root.nodes;
    if (!Array.isArray(nodes)) {
        diagnostics.push({
            code: "gltfScene.malformedNodes",
            severity: "error",
            field: "nodes",
            value: toDiagnosticValue(nodes),
            message: "glTF nodes must be an array for scene traversal.",
        });
        return null;
    }
    return nodes;
}
function chooseSceneIndex(root, scenes, requestedSceneIndex) {
    if (requestedSceneIndex !== undefined) {
        return validSceneIndex(scenes, requestedSceneIndex)
            ? requestedSceneIndex
            : null;
    }
    if (root.scene !== undefined) {
        return validSceneIndex(scenes, root.scene) ? root.scene : null;
    }
    return scenes.length === 1 ? 0 : null;
}
function validSceneIndex(scenes, sceneIndex) {
    return (Number.isInteger(sceneIndex) &&
        typeof sceneIndex === "number" &&
        sceneIndex >= 0 &&
        sceneIndex < scenes.length);
}
//# sourceMappingURL=gltf-scene-traversal-selection.js.map