export function createGltfEcsReplayReadinessSummaryJsonValue(plan, options = {}) {
    const wouldRegisterComponents = options.registerComponents ?? true;
    if (plan === null) {
        return {
            status: "absent",
            ready: null,
            reason: "No ECS command plan was provided.",
            requiredWorld: true,
            wouldRegisterComponents,
            expectedCreateEntityCount: 0,
            expectedAddComponentCount: 0,
            requiredComponents: [],
            blockerCount: 0,
            blockers: [],
        };
    }
    const createEntityKeys = new Set();
    const requiredComponents = new Set();
    const blockers = new Map();
    let expectedCreateEntityCount = 0;
    let expectedAddComponentCount = 0;
    if (!plan.valid) {
        addBlocker(blockers, "gltfEcsReplayReadiness.invalidPlan", "Command replay is blocked because the ECS command plan is invalid.");
    }
    for (const command of plan.commands) {
        if (command.type !== "createEntity") {
            continue;
        }
        expectedCreateEntityCount += 1;
        if (createEntityKeys.has(command.entityKey)) {
            addBlocker(blockers, "gltfEcsReplayReadiness.duplicateEntityKey", "Command replay is blocked because a createEntity key appears more than once.");
        }
        createEntityKeys.add(command.entityKey);
    }
    for (const command of plan.commands) {
        if (command.type !== "addComponent") {
            continue;
        }
        expectedAddComponentCount += 1;
        if (!isSupportedComponent(command.component)) {
            addBlocker(blockers, "gltfEcsReplayReadiness.unknownComponent", "Command replay is blocked because the command plan contains an unsupported component.");
            continue;
        }
        requiredComponents.add(command.component);
        if (!createEntityKeys.has(command.entityKey)) {
            addBlocker(blockers, "gltfEcsReplayReadiness.missingEntityKey", "Command replay is blocked because an addComponent command targets an uncreated entity key.");
        }
        if (command.component === "Parent") {
            const value = command.value;
            if (value.parentEntityKey !== null &&
                !createEntityKeys.has(value.parentEntityKey)) {
                addBlocker(blockers, "gltfEcsReplayReadiness.missingParentEntityKey", "Command replay is blocked because a Parent component references an uncreated parent entity key.");
            }
        }
    }
    const blockerList = BLOCKER_ORDER.flatMap((code) => {
        const blocker = blockers.get(code);
        return blocker === undefined ? [] : [blocker];
    });
    const ready = blockerList.length === 0;
    return {
        status: ready ? "ready" : "blocked",
        ready,
        reason: ready
            ? null
            : "Command replay readiness found blocking command-plan issues.",
        requiredWorld: true,
        wouldRegisterComponents,
        expectedCreateEntityCount,
        expectedAddComponentCount,
        requiredComponents: COMPONENT_ORDER.filter((component) => requiredComponents.has(component)),
        blockerCount: blockerList.reduce((total, blocker) => total + blocker.count, 0),
        blockers: blockerList,
    };
}
function addBlocker(blockers, code, message) {
    const existing = blockers.get(code);
    if (existing === undefined) {
        blockers.set(code, { code, message, count: 1 });
        return;
    }
    blockers.set(code, {
        ...existing,
        count: existing.count + 1,
    });
}
function isSupportedComponent(component) {
    return COMPONENT_ORDER.includes(component);
}
const COMPONENT_ORDER = [
    "Name",
    "LocalTransform",
    "Parent",
    "WorldTransform",
    "Mesh",
    "Material",
    "Visibility",
];
const BLOCKER_ORDER = [
    "gltfEcsReplayReadiness.invalidPlan",
    "gltfEcsReplayReadiness.duplicateEntityKey",
    "gltfEcsReplayReadiness.missingEntityKey",
    "gltfEcsReplayReadiness.missingParentEntityKey",
    "gltfEcsReplayReadiness.unknownComponent",
];
//# sourceMappingURL=gltf-ecs-command-replay-readiness.js.map