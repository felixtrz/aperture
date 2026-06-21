import { LocalTransform, Name, Parent, WorldTransform, toVec3Tuple, toVec4Tuple, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { Material, Mesh, Skin, Visibility, } from "../rendering/authoring.js";
import { skipGltfEcsReplayCommand, skipInvalidGltfEcsReplayComponentValue, } from "./gltf-ecs-command-replay-diagnostics.js";
import { isRecord, isTuple3, isTuple4, } from "./gltf-ecs-command-replay-value-guards.js";
export function applyGltfEcsReplayComponent(input) {
    try {
        switch (input.command.component) {
            case "Name": {
                const value = input.command.value;
                if (!isRecord(value) || typeof value.value !== "string") {
                    skipInvalidGltfEcsReplayComponentValue(input, "Name.value must be a string.");
                    return false;
                }
                input.entity.addComponent(Name, { value: value.value });
                return true;
            }
            case "LocalTransform": {
                const value = input.command.value;
                if (!isRecord(value) ||
                    !isTuple3(value.translation) ||
                    !isTuple4(value.rotation) ||
                    !isTuple3(value.scale)) {
                    skipInvalidGltfEcsReplayComponentValue(input, "LocalTransform value must contain finite translation, rotation, and scale tuples.");
                    return false;
                }
                input.entity.addComponent(LocalTransform, {
                    translation: toVec3Tuple(value.translation),
                    rotation: toVec4Tuple(value.rotation),
                    scale: toVec3Tuple(value.scale),
                });
                return true;
            }
            case "Parent": {
                const value = input.command.value;
                if (!isRecord(value) ||
                    !(value.parentEntityKey === null ||
                        typeof value.parentEntityKey === "string")) {
                    skipInvalidGltfEcsReplayComponentValue(input, "Parent.parentEntityKey must be a string or null.");
                    return false;
                }
                const parent = value.parentEntityKey === null
                    ? null
                    : input.entitiesByKey.get(value.parentEntityKey);
                if (parent === undefined) {
                    skipGltfEcsReplayCommand({
                        diagnostics: input.diagnostics,
                        skipped: input.skipped,
                        commandIndex: input.commandIndex,
                        entityKey: input.command.entityKey,
                        component: input.command.component,
                        code: "gltfEcsReplay.missingParentEntityKey",
                        parentEntityKey: value.parentEntityKey,
                        message: `Parent '${value.parentEntityKey}' was not found for entity '${input.command.entityKey}'.`,
                    });
                    return false;
                }
                input.entity.addComponent(Parent, { entity: parent });
                return true;
            }
            case "WorldTransform": {
                const value = input.command.value;
                if (!isRecord(value) ||
                    !isTuple4(value.col0) ||
                    !isTuple4(value.col1) ||
                    !isTuple4(value.col2) ||
                    !isTuple4(value.col3)) {
                    skipInvalidGltfEcsReplayComponentValue(input, "WorldTransform value must contain finite column tuples.");
                    return false;
                }
                input.entity.addComponent(WorldTransform, {
                    col0: toVec4Tuple(value.col0),
                    col1: toVec4Tuple(value.col1),
                    col2: toVec4Tuple(value.col2),
                    col3: toVec4Tuple(value.col3),
                });
                return true;
            }
            case "Visibility": {
                const value = input.command.value;
                if (!isRecord(value) || typeof value.visible !== "boolean") {
                    skipInvalidGltfEcsReplayComponentValue(input, "Visibility.visible must be a boolean.");
                    return false;
                }
                input.entity.addComponent(Visibility, { visible: value.visible });
                return true;
            }
            case "Mesh": {
                const value = input.command.value;
                if (!isRecord(value) ||
                    typeof value.meshId !== "string" ||
                    typeof value.handleKey !== "string") {
                    skipInvalidGltfEcsReplayComponentValue(input, "Mesh value must contain meshId and handleKey strings.");
                    return false;
                }
                input.entity.addComponent(Mesh, { meshId: value.handleKey });
                return true;
            }
            case "Material": {
                const value = input.command.value;
                if (!isRecord(value) ||
                    typeof value.materialId !== "string" ||
                    typeof value.handleKey !== "string") {
                    skipInvalidGltfEcsReplayComponentValue(input, "Material value must contain materialId and handleKey strings.");
                    return false;
                }
                input.entity.addComponent(Material, { materialId: value.handleKey });
                return true;
            }
            case "Skin": {
                const value = input.command.value;
                if (!isRecord(value) ||
                    !Array.isArray(value.jointEntityKeys) ||
                    !value.jointEntityKeys.every((key) => typeof key === "string") ||
                    !Array.isArray(value.inverseBindMatrices) ||
                    !value.inverseBindMatrices.every((component) => typeof component === "number" && Number.isFinite(component)) ||
                    !(value.skeletonEntityKey === null ||
                        typeof value.skeletonEntityKey === "string")) {
                    skipInvalidGltfEcsReplayComponentValue(input, "Skin value must contain jointEntityKeys (strings), inverseBindMatrices (finite numbers), and a nullable skeletonEntityKey.");
                    return false;
                }
                // Resolve joint node keys to live entities, deferred to replay time
                // like Parent — joints may be created after the skinned mesh entity.
                const joints = [];
                for (const jointKey of value.jointEntityKeys) {
                    const joint = input.entitiesByKey.get(jointKey);
                    if (joint === undefined) {
                        skipGltfEcsReplayCommand({
                            diagnostics: input.diagnostics,
                            skipped: input.skipped,
                            commandIndex: input.commandIndex,
                            entityKey: input.command.entityKey,
                            component: input.command.component,
                            code: "gltfEcsReplay.missingJointEntityKey",
                            message: `Skin joint '${jointKey}' was not found for entity '${input.command.entityKey}'.`,
                        });
                        return false;
                    }
                    joints.push(joint);
                }
                const skeleton = {
                    joints,
                    inverseBindMatrices: Float32Array.from(value.inverseBindMatrices),
                };
                // Seed the palette with identity matrices so the mesh renders in its
                // rest pose until the joint-palette system (M2-T6) computes it.
                input.entity.addComponent(Skin, {
                    jointCount: joints.length,
                    jointMatrices: createIdentityJointPalette(joints.length),
                    skeleton,
                });
                return true;
            }
            default:
                skipGltfEcsReplayCommand({
                    diagnostics: input.diagnostics,
                    skipped: input.skipped,
                    commandIndex: input.commandIndex,
                    entityKey: input.command.entityKey,
                    component: input.command.component,
                    code: "gltfEcsReplay.unknownComponent",
                    message: `Component '${input.command.component}' is not supported by GLB ECS replay.`,
                });
                return false;
        }
    }
    catch (error) {
        skipGltfEcsReplayCommand({
            diagnostics: input.diagnostics,
            skipped: input.skipped,
            commandIndex: input.commandIndex,
            entityKey: input.command.entityKey,
            component: input.command.component,
            code: "gltfEcsReplay.componentApplyFailed",
            message: error instanceof Error
                ? error.message
                : `Component '${input.command.component}' could not be applied.`,
        });
        return false;
    }
}
function createIdentityJointPalette(jointCount) {
    const palette = new Float32Array(jointCount * 16);
    for (let joint = 0; joint < jointCount; joint += 1) {
        const base = joint * 16;
        palette[base] = 1;
        palette[base + 5] = 1;
        palette[base + 10] = 1;
        palette[base + 15] = 1;
    }
    return palette;
}
//# sourceMappingURL=gltf-ecs-command-replay-components.js.map