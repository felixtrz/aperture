import { decomposeTrsMatrix, toVec3Tuple, toVec4Tuple, } from "@aperture-engine/simulation";
import { toDiagnosticValue } from "./gltf-scene-traversal-utils.js";
export function readLocalTransform(input) {
    const hasMatrix = input.node.matrix !== undefined;
    const hasTrs = input.node.translation !== undefined ||
        input.node.rotation !== undefined ||
        input.node.scale !== undefined;
    if (hasMatrix && hasTrs) {
        input.state.diagnostics.push({
            code: "gltfScene.malformedTransform",
            severity: "error",
            sceneIndex: input.state.sceneIndex,
            nodeIndex: input.nodeIndex,
            entityKey: input.entityKey,
            field: `nodes[${input.nodeIndex}]`,
            message: `glTF node ${input.nodeIndex} cannot mix matrix and TRS transform fields.`,
        });
        return null;
    }
    if (hasMatrix) {
        const matrix = tuple16(input.node.matrix);
        if (matrix === null) {
            input.state.diagnostics.push({
                code: "gltfScene.malformedTransform",
                severity: "error",
                sceneIndex: input.state.sceneIndex,
                nodeIndex: input.nodeIndex,
                entityKey: input.entityKey,
                field: `nodes[${input.nodeIndex}].matrix`,
                value: toDiagnosticValue(input.node.matrix),
                message: `glTF node ${input.nodeIndex} matrix must contain 16 finite numbers.`,
            });
            return null;
        }
        const decomposed = decomposeTrsMatrix(matrix);
        if (decomposed === null) {
            input.state.diagnostics.push({
                code: "gltfScene.unsupportedMatrixDecomposition",
                severity: "error",
                sceneIndex: input.state.sceneIndex,
                nodeIndex: input.nodeIndex,
                entityKey: input.entityKey,
                field: `nodes[${input.nodeIndex}].matrix`,
                message: `glTF node ${input.nodeIndex} matrix must be decomposable to an affine TRS transform.`,
            });
            return null;
        }
        return {
            kind: "trs",
            translation: toVec3Tuple(decomposed.translation),
            rotation: toVec4Tuple(decomposed.rotation),
            scale: toVec3Tuple(decomposed.scale),
        };
    }
    const translation = tuple3(input.node.translation, [0, 0, 0]);
    const rotation = tuple4(input.node.rotation, [0, 0, 0, 1]);
    const scale = tuple3(input.node.scale, [1, 1, 1]);
    if (translation === null || rotation === null || scale === null) {
        input.state.diagnostics.push({
            code: "gltfScene.malformedTransform",
            severity: "error",
            sceneIndex: input.state.sceneIndex,
            nodeIndex: input.nodeIndex,
            entityKey: input.entityKey,
            field: `nodes[${input.nodeIndex}]`,
            message: `glTF node ${input.nodeIndex} TRS transform fields must be finite numeric tuples.`,
        });
        return null;
    }
    return { kind: "trs", translation, rotation, scale };
}
function tuple3(value, fallback) {
    if (value === undefined) {
        return fallback;
    }
    if (!Array.isArray(value) ||
        value.length !== 3 ||
        !value.every(isFiniteNumber)) {
        return null;
    }
    return [value[0], value[1], value[2]];
}
function tuple4(value, fallback) {
    if (value === undefined) {
        return fallback;
    }
    if (!Array.isArray(value) ||
        value.length !== 4 ||
        !value.every(isFiniteNumber)) {
        return null;
    }
    return [
        value[0],
        value[1],
        value[2],
        value[3],
    ];
}
function tuple16(value) {
    if (!Array.isArray(value) ||
        value.length !== 16 ||
        !value.every(isFiniteNumber)) {
        return null;
    }
    return [
        value[0],
        value[1],
        value[2],
        value[3],
        value[4],
        value[5],
        value[6],
        value[7],
        value[8],
        value[9],
        value[10],
        value[11],
        value[12],
        value[13],
        value[14],
        value[15],
    ];
}
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
//# sourceMappingURL=gltf-scene-traversal-transforms.js.map