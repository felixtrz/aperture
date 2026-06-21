import { Name, Parent, getChildren, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { AppEntitySource as AppGltfSource } from "./components.js";
export function createGltfInstanceAccess(world) {
    return {
        nodes(root, filter = {}) {
            return findNodes(world, root, filter);
        },
        node(root, name, filter = {}) {
            if (!root.active) {
                return {
                    ok: false,
                    entity: null,
                    node: null,
                    matches: [],
                    diagnostic: {
                        code: "aperture.gltf.rootInactive",
                        severity: "error",
                        message: "Cannot look up a GLTF node from an inactive root entity.",
                        suggestedFix: "Keep the spawned GLTF root entity alive while resolving nodes from it.",
                    },
                };
            }
            if (name.trim().length === 0) {
                return {
                    ok: false,
                    entity: null,
                    node: null,
                    matches: [],
                    diagnostic: {
                        code: "aperture.gltf.invalidNodeName",
                        severity: "error",
                        message: "GLTF node lookup requires a non-empty node name.",
                        suggestedFix: "Pass the imported node name, for example this.gltf.node(root, 'body').",
                    },
                };
            }
            const matches = findNodes(world, root, { ...filter, name });
            if (matches.length === 1) {
                const node = matches[0];
                return { ok: true, entity: node.entity, node, matches };
            }
            if (matches.length === 0) {
                return {
                    ok: false,
                    entity: null,
                    node: null,
                    matches,
                    diagnostic: {
                        code: "aperture.gltf.nodeMissing",
                        severity: "warning",
                        message: `No GLTF node named '${name}' exists in the spawned root subtree.`,
                        suggestedFix: "Check the imported GLTF node names or inspect this.gltf.nodes(root).",
                        data: { name, ...filter },
                    },
                };
            }
            return {
                ok: false,
                entity: null,
                node: null,
                matches,
                diagnostic: {
                    code: "aperture.gltf.nodeDuplicate",
                    severity: "warning",
                    message: `Found ${matches.length} GLTF nodes named '${name}' in the spawned root subtree.`,
                    suggestedFix: "Use this.gltf.nodes(root, { name }) and disambiguate by assetId or nodePath.",
                    data: {
                        name,
                        ...filter,
                        matches: matches.map((match) => ({
                            assetId: match.assetId,
                            nodeIndex: match.nodeIndex,
                            nodePath: match.nodePath,
                        })),
                    },
                },
            };
        },
    };
}
function findNodes(world, root, filter) {
    if (!root.active) {
        return [];
    }
    const result = [];
    for (const entity of traverseSubtree(world, root)) {
        const record = nodeRecord(entity);
        if (record !== null && matchesFilter(record, filter)) {
            result.push(record);
        }
    }
    return result;
}
function traverseSubtree(world, root) {
    const result = [];
    const visited = new Set();
    const parentChildren = createParentChildrenIndex(world);
    const stack = [root];
    while (stack.length > 0) {
        const entity = stack.pop();
        const key = entityRefKey(entity);
        if (!entity.active || visited.has(key)) {
            continue;
        }
        visited.add(key);
        result.push(entity);
        const children = mergedChildren(world, entity, parentChildren);
        for (let index = children.length - 1; index >= 0; index -= 1) {
            stack.push(children[index]);
        }
    }
    return result;
}
function createParentChildrenIndex(world) {
    const byParent = new Map();
    if (!world.hasComponent(Parent)) {
        return byParent;
    }
    const query = world.queryManager.registerQuery({ required: [Parent] });
    for (const entity of query.entities) {
        if (!entity.active) {
            continue;
        }
        const parent = entity.getValue(Parent, "entity");
        if (parent === null || parent === undefined || !parent.active) {
            continue;
        }
        const key = entityRefKey(parent);
        const children = byParent.get(key) ?? [];
        children.push(entity);
        byParent.set(key, children);
    }
    return byParent;
}
function mergedChildren(world, entity, parentChildren) {
    const indexed = getChildren(world, entity);
    const parentLinked = parentChildren.get(entityRefKey(entity)) ?? [];
    if (indexed.length === 0) {
        return parentLinked;
    }
    if (parentLinked.length === 0) {
        return indexed;
    }
    const merged = [...indexed];
    const seen = new Set(indexed.map(entityRefKey));
    for (const child of parentLinked) {
        if (!seen.has(entityRefKey(child))) {
            merged.push(child);
        }
    }
    return merged;
}
function entityRefKey(entity) {
    return `${entity.index}:${entity.generation}`;
}
function nodeRecord(entity) {
    if (!entity.hasComponent(AppGltfSource)) {
        return null;
    }
    const kind = entity.getValue(AppGltfSource, "kind");
    if (kind !== "gltf") {
        return null;
    }
    const name = entity.hasComponent(Name) ? entity.getValue(Name, "value") : "";
    const assetId = entity.getValue(AppGltfSource, "assetId");
    const nodeIndex = entity.getValue(AppGltfSource, "gltfNodeIndex");
    const nodePath = entity.getValue(AppGltfSource, "gltfNodePath");
    if (typeof name !== "string" ||
        typeof assetId !== "string" ||
        typeof nodeIndex !== "number" ||
        typeof nodePath !== "string" ||
        !isAuthoredGltfNodePath(nodePath)) {
        return null;
    }
    return { entity, name, assetId, nodeIndex, nodePath };
}
function isAuthoredGltfNodePath(nodePath) {
    return (nodePath.startsWith("scene:") ||
        /^scene\[\d+\]$/u.test(nodePath) ||
        /^nodes\[\d+\]$/u.test(nodePath));
}
function matchesFilter(record, filter) {
    return ((filter.name === undefined || record.name === filter.name) &&
        (filter.nameIncludes === undefined ||
            record.name.includes(filter.nameIncludes)) &&
        (filter.assetId === undefined || record.assetId === filter.assetId));
}
//# sourceMappingURL=gltf.js.map