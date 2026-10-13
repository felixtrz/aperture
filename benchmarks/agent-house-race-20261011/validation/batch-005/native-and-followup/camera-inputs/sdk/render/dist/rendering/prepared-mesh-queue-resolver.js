export function createPreparedMeshQueueResourceKeyResolver(meshes) {
    return (input) => meshes.get(input.draw.mesh)?.prepared.meshResourceKey ?? null;
}
//# sourceMappingURL=prepared-mesh-queue-resolver.js.map