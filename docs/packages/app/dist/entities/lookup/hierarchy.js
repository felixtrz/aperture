import { Children, LocalTransform, getChildren, } from "@aperture-engine/simulation";
import { collectActiveEntities, compareEntitySummaries, entityRefKey, entitySummary, } from "./summary.js";
/**
 * Build the entity hierarchy report consumed by the devtools/ECS tooling.
 *
 * When the M7-T1 `Children` index is in use (any active entity carries it), the
 * tree is assembled by walking that authoritative index from the transform
 * participants (O(subtree) per node) instead of re-deriving parent->child links
 * by bucketing a full ALL-entities scan. The legacy full-scan path
 * (collectActiveEntities) remains as the fallback for worlds whose subtrees were
 * authored without `Children` (e.g. raw glTF replay) so existing tooling keeps
 * working unchanged.
 */
export function createApertureEntityHierarchy(world) {
    if (worldUsesChildrenIndex(world)) {
        return buildFromChildrenIndex(world);
    }
    return buildFromActiveScan(world);
}
function worldUsesChildrenIndex(world) {
    if (!world.hasComponent(Children)) {
        return false;
    }
    const query = world.queryManager.registerQuery({ required: [Children] });
    for (const entity of query.entities) {
        if (entity.active) {
            return true;
        }
    }
    return false;
}
// Children-index assembly: enumerate the transform participants (every spawned
// entity carries LocalTransform), then attach children via the authoritative
// Children index, falling back to Parent links for any entity whose parent lacks
// a Children entry (glTF replay subtrees). Never calls collectActiveEntities.
function buildFromChildrenIndex(world) {
    const participants = [
        ...world.queryManager.registerQuery({ required: [LocalTransform] })
            .entities,
    ].filter((entity) => entity.active);
    const nodes = new Map();
    const diagnostics = [];
    for (const entity of participants) {
        ensureNode(nodes, entity);
    }
    const attached = new Set();
    // Pass 1 — attach children straight from the authoritative Children index.
    for (const entity of participants) {
        if (!entity.hasComponent(Children)) {
            continue;
        }
        const parentNode = nodes.get(entityRefKey(refOf(entity)));
        if (parentNode === undefined) {
            continue;
        }
        for (const child of getChildren(world, entity)) {
            const childKey = entityRefKey(refOf(child));
            if (attached.has(childKey)) {
                continue;
            }
            parentNode.children.push(ensureNode(nodes, child));
            attached.add(childKey);
        }
    }
    // Pass 2 — classify the remaining nodes as roots, attaching any with a live
    // Parent that the Children index did not already cover (the fallback path).
    const roots = [];
    for (const node of nodes.values()) {
        if (attached.has(entityRefKey(node.entity))) {
            continue;
        }
        if (node.parent === undefined) {
            roots.push(node);
            continue;
        }
        const parentNode = nodes.get(entityRefKey(node.parent));
        if (parentNode === undefined) {
            diagnostics.push(staleParentDiagnostic(node));
            roots.push(node);
            continue;
        }
        parentNode.children.push(node);
        attached.add(entityRefKey(node.entity));
    }
    return {
        roots: sortHierarchyNodes(roots),
        total: nodes.size,
        diagnostics,
    };
}
// Legacy full-scan fallback (unchanged behavior): summarize every active entity
// and bucket each node under its Parent. Retained for worlds without a Children
// index so the devtools hierarchy/diff tooling keeps working as before.
function buildFromActiveScan(world) {
    const summaries = collectActiveEntities(world)
        .map(entitySummary)
        .sort(compareEntitySummaries);
    const nodes = new Map();
    const diagnostics = [];
    for (const summary of summaries) {
        nodes.set(entityRefKey(summary.entity), {
            entity: summary.entity,
            ...(summary.key === undefined ? {} : { key: summary.key }),
            name: summary.name,
            ...(summary.parent === undefined ? {} : { parent: summary.parent }),
            children: [],
        });
    }
    const roots = [];
    for (const node of nodes.values()) {
        if (node.parent === undefined) {
            roots.push(node);
            continue;
        }
        const parent = nodes.get(entityRefKey(node.parent));
        if (parent === undefined) {
            diagnostics.push(staleParentDiagnostic(node));
            roots.push(node);
            continue;
        }
        parent.children.push(node);
    }
    return {
        roots: sortHierarchyNodes(roots),
        total: summaries.length,
        diagnostics,
    };
}
function ensureNode(nodes, entity) {
    const key = entityRefKey(refOf(entity));
    const existing = nodes.get(key);
    if (existing !== undefined) {
        return existing;
    }
    const summary = entitySummary(entity);
    const node = {
        entity: summary.entity,
        ...(summary.key === undefined ? {} : { key: summary.key }),
        name: summary.name,
        ...(summary.parent === undefined ? {} : { parent: summary.parent }),
        children: [],
    };
    nodes.set(key, node);
    return node;
}
function refOf(entity) {
    return { index: entity.index, generation: entity.generation };
}
function staleParentDiagnostic(node) {
    return {
        code: "aperture.entityHierarchy.staleParent",
        severity: "warning",
        message: `Entity ${node.entity.index} references a parent that is not active in the hierarchy snapshot.`,
        data: {
            entity: node.entity,
            ...(node.parent === undefined ? {} : { parent: node.parent }),
        },
        suggestedFix: "Resolve transforms and remove stale Parent references from app systems.",
    };
}
function sortHierarchyNodes(nodes) {
    return [...nodes]
        .sort((a, b) => a.entity.index - b.entity.index ||
        a.entity.generation - b.entity.generation)
        .map((node) => ({
        entity: node.entity,
        ...(node.key === undefined ? {} : { key: node.key }),
        name: node.name,
        ...(node.parent === undefined ? {} : { parent: node.parent }),
        children: sortHierarchyNodes(node.children),
    }));
}
//# sourceMappingURL=hierarchy.js.map