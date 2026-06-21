export function createGltfEcsMeshReadiness(options) {
    return {
        ready: new Set([
            ...(options.meshRegistrationReport?.written.map((entry) => entry.registeredHandleKey) ?? []),
            ...(options.availableMeshHandleKeys ?? []),
        ]),
        skippedReasons: new Map(options.meshRegistrationReport?.skipped.map((entry) => [
            entry.registeredHandleKey,
            entry.reason,
        ]) ?? []),
    };
}
export function gltfEcsMeshReadinessStatus(readiness, material) {
    if (readiness.ready.has(material.meshHandleKey)) {
        return { kind: "ready" };
    }
    const skippedReason = readiness.skippedReasons.get(material.meshHandleKey);
    if (skippedReason !== undefined) {
        return { kind: "skipped", reason: skippedReason };
    }
    return { kind: "missing" };
}
//# sourceMappingURL=gltf-ecs-authoring-command-plan-primitive-readiness.js.map