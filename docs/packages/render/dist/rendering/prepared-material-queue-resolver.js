export function createPreparedMaterialQueueResourceKeyResolver(materials) {
    return (input) => materials.get(input.draw.material)?.prepared.materialResourceKey ?? null;
}
//# sourceMappingURL=prepared-material-queue-resolver.js.map