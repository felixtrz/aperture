// Bidirectional transform hierarchy (M7-T1).
//
// `Parent` (components.ts) stays the single source of truth the resolver
// (resolution.ts) reads. `Children` is a DERIVED ordered index that setParent
// keeps consistent on every mutation. setParent is world-preserving: it
// recomputes the child's LocalTransform so the entity stays put in world space,
// mirroring Bevy's `set_parent_in_place` / `GlobalTransform::reparented_to`
// (references/bevy/crates/bevy_transform/src/commands.rs +
// components/global_transform.rs — concept borrowed, not code):
//   new_local = decompose( inverse(parentWorld) * childWorld )   (attach)
//   new_local = decompose( childWorld )                          (detach → root)
//
// Headless/worker-safe: pure ECS + math, no DOM. Entity refs are encoded
// index:generation so stale children are detectable (matching
// resolveActiveEntity semantics).
import { decomposeTrsMatrix, invertMat4, multiplyMat4, } from "/aperture/worker-modules/packages/math/dist/index.js";
import { Children, LocalTransform, Parent, WorldTransform, createParent, } from "./components.js";
const MAX_HIERARCHY_DEPTH = 100_000;
/**
 * Reparent `child` under `parent` (or detach to a transform root when `parent`
 * is null) while preserving the child's world-space transform. Updates Parent
 * (authoritative) and the old/new parents' Children index. Cycles are rejected
 * with a structured diagnostic and NO Parent write.
 */
export function setParent(world, child, parent) {
    if (!child.hasComponent(WorldTransform)) {
        return {
            ok: false,
            diagnostic: {
                code: "missing-world-transform",
                child: refKey(child),
                message: "setParent requires the child to have a resolved WorldTransform (run resolveWorldTransforms first).",
            },
        };
    }
    if (parent !== null) {
        if (sameEntity(child, parent) || isAncestor(child, parent)) {
            return {
                ok: false,
                diagnostic: {
                    code: "cycle",
                    child: refKey(child),
                    parent: refKey(parent),
                    cycle: ancestorPath(parent, child),
                    message: "setParent would create a transform parent cycle; rejected without mutating Parent.",
                },
            };
        }
        if (!parent.hasComponent(WorldTransform)) {
            return {
                ok: false,
                diagnostic: {
                    code: "missing-world-transform",
                    child: refKey(child),
                    parent: refKey(parent),
                    message: "setParent requires the parent to have a resolved WorldTransform (run resolveWorldTransforms first).",
                },
            };
        }
    }
    // World-preserving local recompute.
    const childWorld = readWorldMatrix(child);
    let relative = childWorld;
    if (parent !== null) {
        const inverseParent = invertMat4(readWorldMatrix(parent));
        if (inverseParent === null) {
            return invalidWorldTransform(child, parent);
        }
        relative = multiplyMat4(inverseParent, childWorld);
    }
    const local = decomposeTrsMatrix(relative);
    if (local === null) {
        return invalidWorldTransform(child, parent);
    }
    // Detach from the previous parent's Children index.
    const previousParent = readParentEntity(child);
    if (previousParent !== null && !sameEntity(previousParent, parent)) {
        removeChildRef(previousParent, child);
    }
    // Write the preserved LocalTransform.
    child.getVectorView(LocalTransform, "translation").set(local.translation);
    child.getVectorView(LocalTransform, "rotation").set(local.rotation);
    child.getVectorView(LocalTransform, "scale").set(local.scale);
    // Update the authoritative Parent ref.
    if (child.hasComponent(Parent)) {
        child.setValue(Parent, "entity", parent);
    }
    else {
        child.addComponent(Parent, createParent(parent));
    }
    // Attach to the new parent's Children index.
    if (parent !== null && !sameEntity(previousParent, parent)) {
        addChildRef(parent, child);
    }
    return { ok: true };
}
/** Resolve the ordered, live children of `entity` (stale refs are dropped). */
export function getChildren(world, entity) {
    const live = [];
    for (const ref of readChildrenRefs(entity)) {
        const resolved = resolveRef(world, ref);
        if (resolved !== null) {
            live.push(resolved);
        }
    }
    return live;
}
/**
 * Depth-first destroy `entity` and its entire subtree. Children are discovered
 * from the authoritative `Parent` relationship (unioned with the derived
 * `Children` index), so subtrees parented *outside* setParent — e.g. glTF scene
 * replay, which writes `Parent` directly and never populates `Children` — are
 * still fully torn down instead of leaking detached roots at the world origin.
 * Detaches the subtree root from its parent's Children first so no live entity
 * is left pointing at a destroyed one. Returns the number of entities destroyed.
 */
export function despawnRecursive(world, entity) {
    if (!entity.active) {
        return 0;
    }
    const parent = readParentEntity(entity);
    if (parent !== null) {
        removeChildRef(parent, entity);
    }
    return destroySubtree(world, entity, collectChildrenByParent(world));
}
/**
 * Index every live entity by its authoritative `Parent`, so a recursive despawn
 * can find children regardless of whether the `Children` index was maintained.
 */
function collectChildrenByParent(world) {
    const byParent = new Map();
    const query = world.queryManager.registerQuery({ required: [Parent] });
    for (const child of query.entities) {
        const parent = readParentEntity(child);
        if (parent === null) {
            continue;
        }
        const key = refKey(parent);
        const siblings = byParent.get(key);
        if (siblings === undefined) {
            byParent.set(key, [child]);
        }
        else {
            siblings.push(child);
        }
    }
    return byParent;
}
function destroySubtree(world, entity, childrenByParent) {
    if (!entity.active) {
        return 0;
    }
    const seen = new Set();
    const children = [];
    for (const child of getChildren(world, entity)) {
        if (!seen.has(child.index)) {
            seen.add(child.index);
            children.push(child);
        }
    }
    for (const child of childrenByParent.get(refKey(entity)) ?? []) {
        if (child.active && !seen.has(child.index)) {
            seen.add(child.index);
            children.push(child);
        }
    }
    let destroyed = 0;
    for (const childEntity of children) {
        destroyed += destroySubtree(world, childEntity, childrenByParent);
    }
    entity.destroy();
    return destroyed + 1;
}
// ---- Children index helpers ----------------------------------------------
function readChildrenRefs(entity) {
    if (!entity.active || !entity.hasComponent(Children)) {
        return [];
    }
    const raw = entity.getValue(Children, "refs");
    if (typeof raw !== "string" || raw.length === 0) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.filter((value) => typeof value === "string")
            : [];
    }
    catch {
        return [];
    }
}
function writeChildrenRefs(entity, refs) {
    if (!entity.hasComponent(Children)) {
        entity.addComponent(Children, { refs: JSON.stringify(refs) });
        return;
    }
    entity.setValue(Children, "refs", JSON.stringify(refs));
}
function addChildRef(parent, child) {
    const refs = readChildrenRefs(parent);
    const key = refKey(child);
    if (!refs.includes(key)) {
        refs.push(key);
        writeChildrenRefs(parent, refs);
    }
}
function removeChildRef(parent, child) {
    if (!parent.active || !parent.hasComponent(Children)) {
        return;
    }
    const key = refKey(child);
    const refs = readChildrenRefs(parent);
    const next = refs.filter((ref) => ref !== key);
    if (next.length !== refs.length) {
        writeChildrenRefs(parent, next);
    }
}
// ---- entity ref + matrix helpers -----------------------------------------
function refKey(entity) {
    return `${entity.index}:${entity.generation}`;
}
function resolveRef(world, ref) {
    const separator = ref.indexOf(":");
    if (separator < 0) {
        return null;
    }
    const index = Number.parseInt(ref.slice(0, separator), 10);
    const generation = Number.parseInt(ref.slice(separator + 1), 10);
    if (!Number.isInteger(index) || !Number.isInteger(generation)) {
        return null;
    }
    const entity = world.entityManager.getEntityByIndex(index);
    if (entity === null || !entity.active || entity.generation !== generation) {
        return null;
    }
    return entity;
}
function readParentEntity(entity) {
    if (!entity.active || !entity.hasComponent(Parent)) {
        return null;
    }
    return entity.getValue(Parent, "entity");
}
function sameEntity(a, b) {
    return (a !== null &&
        b !== null &&
        a.index === b.index &&
        a.generation === b.generation);
}
/** True when `ancestor` is `entity` or any transform ancestor of `entity`. */
function isAncestor(ancestor, entity) {
    let cursor = entity;
    let guard = 0;
    while (cursor !== null && guard < MAX_HIERARCHY_DEPTH) {
        if (sameEntity(cursor, ancestor)) {
            return true;
        }
        cursor = readParentEntity(cursor);
        guard += 1;
    }
    return false;
}
function ancestorPath(from, to) {
    const path = [];
    let cursor = from;
    let guard = 0;
    while (cursor !== null && guard < MAX_HIERARCHY_DEPTH) {
        path.push(refKey(cursor));
        if (sameEntity(cursor, to)) {
            break;
        }
        cursor = readParentEntity(cursor);
        guard += 1;
    }
    return path;
}
function readWorldMatrix(entity) {
    const matrix = new Float32Array(16);
    matrix.set(entity.getVectorView(WorldTransform, "col0"), 0);
    matrix.set(entity.getVectorView(WorldTransform, "col1"), 4);
    matrix.set(entity.getVectorView(WorldTransform, "col2"), 8);
    matrix.set(entity.getVectorView(WorldTransform, "col3"), 12);
    return matrix;
}
function invalidWorldTransform(child, parent) {
    return {
        ok: false,
        diagnostic: {
            code: "invalid-world-transform",
            child: refKey(child),
            ...(parent === null ? {} : { parent: refKey(parent) }),
            message: "setParent could not derive a preserved LocalTransform from the world matrices (non-affine or singular).",
        },
    };
}
//# sourceMappingURL=hierarchy.js.map