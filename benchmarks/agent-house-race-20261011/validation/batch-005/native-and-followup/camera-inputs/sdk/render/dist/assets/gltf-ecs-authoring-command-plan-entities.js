export function appendGltfEcsEntityCommands(input) {
    if (input.seenEntityKeys.has(input.entityKey)) {
        input.diagnostics.push({
            code: "gltfEcsAuthoring.duplicateEntityKey",
            severity: "error",
            message: `Entity key '${input.entityKey}' was planned more than once.`,
            ...(input.sceneIndex === null ? {} : { sceneIndex: input.sceneIndex }),
            ...(input.nodeIndex === undefined ? {} : { nodeIndex: input.nodeIndex }),
            entityKey: input.entityKey,
            parentEntityKey: input.parentEntityKey,
        });
        return false;
    }
    input.seenEntityKeys.add(input.entityKey);
    input.commands.push({
        type: "createEntity",
        entityKey: input.entityKey,
        label: input.label,
    }, {
        type: "addComponent",
        entityKey: input.entityKey,
        component: "Name",
        value: { value: input.label },
    }, {
        type: "addComponent",
        entityKey: input.entityKey,
        component: "Parent",
        value: { parentEntityKey: input.parentEntityKey },
    }, {
        type: "addComponent",
        entityKey: input.entityKey,
        component: "LocalTransform",
        value: input.localTransform,
    }, {
        type: "addComponent",
        entityKey: input.entityKey,
        component: "WorldTransform",
        value: identityWorldTransform(),
    }, {
        type: "addComponent",
        entityKey: input.entityKey,
        component: "Visibility",
        value: { visible: true },
    });
    return true;
}
export function skipGltfEcsNodeByAncestor(input) {
    const diagnostic = {
        code: "gltfEcsAuthoring.nodeSkippedByAncestor",
        severity: "error",
        message: `Node '${input.node.entityKey}' was skipped because an ancestor node was skipped.`,
        nodeIndex: input.node.nodeIndex,
        entityKey: input.node.entityKey,
        parentEntityKey: input.node.parentEntityKey,
    };
    input.diagnostics.push(diagnostic);
    input.skipped.push({
        entityKey: input.node.entityKey,
        reason: diagnostic.code,
        nodeIndex: input.node.nodeIndex,
        parentEntityKey: input.node.parentEntityKey,
        diagnostics: [diagnostic],
    });
    input.skippedEntityKeys.add(input.node.entityKey);
}
export function gltfLocalTransformCommandValue(transform) {
    if (transform === null) {
        return gltfIdentityLocalTransformCommandValue();
    }
    return {
        translation: transform.translation,
        rotation: transform.rotation,
        scale: transform.scale,
    };
}
export function gltfIdentityLocalTransformCommandValue() {
    return {
        translation: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
    };
}
export function gltfSceneLabel(sceneIndex) {
    return sceneIndex === null ? "Scene" : `Scene${sceneIndex}`;
}
export function createGltfEcsAuthoringCommandPlanResult(traversalReport, commands, diagnostics, skipped, dependencies) {
    return {
        valid: diagnostics.length === 0,
        sceneIndex: traversalReport.sceneIndex,
        rootEntityKeys: traversalReport.sceneEntityKey === null
            ? []
            : [traversalReport.sceneEntityKey],
        commands,
        dependencies,
        skipped,
        diagnostics,
    };
}
function identityWorldTransform() {
    return {
        col0: [1, 0, 0, 0],
        col1: [0, 1, 0, 0],
        col2: [0, 0, 1, 0],
        col3: [0, 0, 0, 1],
    };
}
//# sourceMappingURL=gltf-ecs-authoring-command-plan-entities.js.map