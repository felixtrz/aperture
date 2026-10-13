function isValidEntityRef(ref) {
    return (Number.isInteger(ref.index) &&
        Number.isInteger(ref.generation) &&
        ref.index >= 0 &&
        ref.generation >= 0);
}
export function resolveActiveEntity(world, ref) {
    if (!isValidEntityRef(ref)) {
        return {
            ok: false,
            diagnostic: {
                code: "aperture.entityLookup.invalidRef",
                severity: "error",
                message: "Entity lookup requires a finite integer { index, generation } reference.",
                data: { entity: ref },
                suggestedFix: "Re-run aperture_entity_find and pass the full returned { index, generation } pair.",
            },
        };
    }
    const entity = world.entityManager.getEntityByIndex(ref.index);
    if (entity === null || !entity.active) {
        return {
            ok: false,
            diagnostic: {
                code: "aperture.entityLookup.notFound",
                severity: "error",
                message: `No active entity exists at index ${ref.index}.`,
                data: { entity: ref },
                suggestedFix: "The entity may have been destroyed. Re-run aperture_entity_find before issuing a follow-up operation.",
            },
        };
    }
    if (entity.generation !== ref.generation) {
        return {
            ok: false,
            diagnostic: {
                code: "aperture.entityLookup.generationMismatch",
                severity: "error",
                message: `Entity index ${ref.index} is active with generation ${entity.generation}, not requested generation ${ref.generation}.`,
                data: {
                    requested: ref,
                    active: { index: entity.index, generation: entity.generation },
                },
                suggestedFix: "Re-run aperture_entity_find and use the current { index, generation } pair before mutating ECS state.",
            },
        };
    }
    return { ok: true, entity };
}
//# sourceMappingURL=resolve.js.map