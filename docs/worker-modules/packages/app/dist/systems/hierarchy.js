import { despawnRecursive as despawnRecursiveSubtree, getChildren as getChildEntities, setParent as setParentEntity, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { resolveActiveEntity } from "../entities/lookup/resolve.js";
export function createHierarchyAccess(world) {
    return {
        children(entity) {
            const resolved = resolveActiveEntity(world, entity);
            if (!resolved.ok) {
                return { ok: false, children: [], diagnostic: resolved.diagnostic };
            }
            const children = getChildEntities(world, resolved.entity).map(entityRef);
            return { ok: true, children };
        },
        setParent(child, parent) {
            const resolvedChild = resolveActiveEntity(world, child);
            if (!resolvedChild.ok) {
                return { ok: false, diagnostic: resolvedChild.diagnostic };
            }
            let parentEntity = null;
            if (parent !== null) {
                const resolvedParent = resolveActiveEntity(world, parent);
                if (!resolvedParent.ok) {
                    return { ok: false, diagnostic: resolvedParent.diagnostic };
                }
                parentEntity = resolvedParent.entity;
            }
            const result = setParentEntity(world, resolvedChild.entity, parentEntity);
            if (!result.ok) {
                return {
                    ok: false,
                    diagnostic: hierarchyDiagnostic(result.diagnostic, child, parent),
                };
            }
            return { ok: true };
        },
        despawnRecursive(entity) {
            const resolved = resolveActiveEntity(world, entity);
            if (!resolved.ok) {
                return { ok: false, despawned: 0, diagnostic: resolved.diagnostic };
            }
            const despawned = despawnRecursiveSubtree(world, resolved.entity);
            return { ok: true, despawned };
        },
    };
}
function entityRef(entity) {
    return { index: entity.index, generation: entity.generation };
}
function hierarchyDiagnostic(diagnostic, child, parent) {
    const code = diagnostic?.code ?? "invalid-world-transform";
    return {
        code: `aperture.hierarchy.${code}`,
        severity: "error",
        message: diagnostic?.message ??
            "setParent failed to reparent the entity while preserving its world transform.",
        data: {
            child,
            parent,
            ...(diagnostic?.cycle === undefined ? {} : { cycle: diagnostic.cycle }),
        },
        suggestedFix: hierarchySuggestedFix(code),
    };
}
function hierarchySuggestedFix(code) {
    switch (code) {
        case "cycle":
            return "Choose a parent that is not the child itself or one of its descendants.";
        case "missing-world-transform":
            return "Resolve world transforms (step the app or call resolveWorldTransforms) so both entities have a WorldTransform before reparenting.";
        case "invalid-world-transform":
            return "Ensure both entities carry non-singular, affine world transforms before reparenting.";
    }
}
//# sourceMappingURL=hierarchy.js.map