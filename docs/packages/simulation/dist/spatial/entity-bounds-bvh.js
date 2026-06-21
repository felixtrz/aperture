import { intersectRayAabb, intersectRaySphere, v3, vec3, } from "@aperture-engine/math";
const DEFAULT_MAX_LEAF_SIZE = 8;
const DEFAULT_MAX_DEPTH = 40;
const DEFAULT_RAY_LAYER_MASK = 0xffffffff;
const DEFAULT_OBJECT_LAYER_MASK = 0x00000001;
export function createEntityBoundsBvh(bounds, options = {}) {
    return new EntityBoundsBvh(bounds, options);
}
export function createEntityBoundsBvhQueryStats() {
    return { candidateEntityCount: 0, testedEntityCount: 0, visitedNodeCount: 0 };
}
export class EntityBoundsBvh {
    options;
    items;
    indexByEntity = new Map();
    root;
    dirty = false;
    constructor(bounds, options = {}) {
        this.options = options;
        this.items = bounds.map((entry, sourceIndex) => ({
            bounds: entry,
            sourceIndex,
        }));
        for (let index = 0; index < this.items.length; index += 1) {
            const item = this.items[index];
            if (item !== undefined) {
                this.indexByEntity.set(item.bounds.entity, index);
            }
        }
        this.root = buildEntityNode([...this.items], 0, normalizePositiveInteger(options.maxDepth, DEFAULT_MAX_DEPTH), normalizePositiveInteger(options.maxLeafSize, DEFAULT_MAX_LEAF_SIZE));
    }
    get count() {
        return this.items.length;
    }
    raycast(origin, direction, options = {}) {
        resetStats(options.stats, this.items.length);
        this.refitDirty();
        const ray = normalizeRay(origin, direction);
        const maxDistance = normalizeMaxDistance(options.maxDistance);
        if (ray === null || maxDistance === null || this.root === null) {
            return [];
        }
        const layerMask = (options.layerMask ?? DEFAULT_RAY_LAYER_MASK) >>> 0;
        const hits = [];
        const stack = [this.root];
        while (stack.length > 0) {
            const node = stack.pop();
            if (intersectRayAabb(ray, node.bounds, maxDistance) === null) {
                continue;
            }
            if (options.stats !== undefined) {
                options.stats.visitedNodeCount += 1;
            }
            if (node.items !== undefined) {
                for (const item of node.items) {
                    const objectLayerMask = (item.bounds.layerMask ?? DEFAULT_OBJECT_LAYER_MASK) >>> 0;
                    if ((objectLayerMask & layerMask) === 0) {
                        continue;
                    }
                    if (options.stats !== undefined) {
                        options.stats.testedEntityCount += 1;
                    }
                    if (item.bounds.worldSphere !== undefined &&
                        intersectRaySphere(ray, item.bounds.worldSphere, maxDistance) ===
                            null) {
                        continue;
                    }
                    const hit = intersectRayAabb(ray, item.bounds.worldAabb, maxDistance);
                    if (hit !== null) {
                        hits.push({
                            sourceIndex: item.sourceIndex,
                            entity: item.bounds.entity,
                            bounds: item.bounds,
                            distance: hit.distance,
                            point: hit.point,
                        });
                    }
                }
                continue;
            }
            const leftHit = node.left === undefined
                ? null
                : intersectRayAabb(ray, node.left.bounds, maxDistance);
            const rightHit = node.right === undefined
                ? null
                : intersectRayAabb(ray, node.right.bounds, maxDistance);
            if (node.left !== undefined &&
                node.right !== undefined &&
                leftHit !== null &&
                rightHit !== null) {
                if (leftHit.distance <= rightHit.distance) {
                    stack.push(node.right, node.left);
                }
                else {
                    stack.push(node.left, node.right);
                }
            }
            else {
                if (node.right !== undefined && rightHit !== null) {
                    stack.push(node.right);
                }
                if (node.left !== undefined && leftHit !== null) {
                    stack.push(node.left);
                }
            }
        }
        return hits
            .sort((a, b) => a.distance - b.distance || a.sourceIndex - b.sourceIndex)
            .map(({ sourceIndex: _sourceIndex, ...hit }) => hit);
    }
    updateBounds(entity, bounds) {
        const index = this.indexByEntity.get(entity);
        if (index === undefined) {
            return false;
        }
        const item = this.items[index];
        item.bounds = { entity, ...bounds };
        this.dirty = true;
        return true;
    }
    refitDirty() {
        if (!this.dirty || this.root === null) {
            return;
        }
        refitEntityNode(this.root);
        this.dirty = false;
    }
}
function buildEntityNode(items, depth, maxDepth, maxLeafSize) {
    if (items.length === 0) {
        return null;
    }
    const bounds = boundsForItems(items);
    if (items.length <= maxLeafSize || depth >= maxDepth) {
        return { bounds, depth, items };
    }
    const axis = longestAxis(bounds);
    const sorted = [...items].sort((a, b) => centroid(a.bounds.worldAabb, axis) - centroid(b.bounds.worldAabb, axis));
    const split = Math.max(1, Math.floor(sorted.length / 2));
    const left = buildEntityNode(sorted.slice(0, split), depth + 1, maxDepth, maxLeafSize);
    const right = buildEntityNode(sorted.slice(split), depth + 1, maxDepth, maxLeafSize);
    return { bounds, depth, left, right };
}
function refitEntityNode(node) {
    if (node.items !== undefined) {
        node.bounds = boundsForItems(node.items);
        return node.bounds;
    }
    node.bounds = unionAabb(refitEntityNode(node.left), refitEntityNode(node.right));
    return node.bounds;
}
function boundsForItems(items) {
    let bounds = items[0]?.bounds.worldAabb;
    if (bounds === undefined) {
        return { min: vec3(), max: vec3() };
    }
    for (let index = 1; index < items.length; index += 1) {
        const item = items[index];
        if (item !== undefined) {
            bounds = unionAabb(bounds, item.bounds.worldAabb);
        }
    }
    return bounds;
}
function unionAabb(a, b) {
    return {
        min: vec3(Math.min(v3(a.min, 0), v3(b.min, 0)), Math.min(v3(a.min, 1), v3(b.min, 1)), Math.min(v3(a.min, 2), v3(b.min, 2))),
        max: vec3(Math.max(v3(a.max, 0), v3(b.max, 0)), Math.max(v3(a.max, 1), v3(b.max, 1)), Math.max(v3(a.max, 2), v3(b.max, 2))),
    };
}
function longestAxis(bounds) {
    const x = v3(bounds.max, 0) - v3(bounds.min, 0);
    const y = v3(bounds.max, 1) - v3(bounds.min, 1);
    const z = v3(bounds.max, 2) - v3(bounds.min, 2);
    if (y > x && y >= z) {
        return 1;
    }
    return z > x && z > y ? 2 : 0;
}
function centroid(bounds, axis) {
    return (v3(bounds.min, axis) + v3(bounds.max, axis)) / 2;
}
function normalizeRay(origin, direction) {
    const dx = v3(direction, 0);
    const dy = v3(direction, 1);
    const dz = v3(direction, 2);
    const length = Math.hypot(dx, dy, dz);
    if (!Number.isFinite(v3(origin, 0)) ||
        !Number.isFinite(v3(origin, 1)) ||
        !Number.isFinite(v3(origin, 2)) ||
        !Number.isFinite(length) ||
        length <= 1e-8) {
        return null;
    }
    return {
        origin: vec3(v3(origin, 0), v3(origin, 1), v3(origin, 2)),
        direction: vec3(dx / length, dy / length, dz / length),
    };
}
function normalizeMaxDistance(value) {
    if (value === undefined) {
        return Number.POSITIVE_INFINITY;
    }
    return !Number.isNaN(value) && value >= 0 ? value : null;
}
function normalizePositiveInteger(value, fallback) {
    return Number.isInteger(value) && value !== undefined && value > 0
        ? value
        : fallback;
}
function resetStats(stats, candidateEntityCount) {
    if (stats !== undefined) {
        stats.candidateEntityCount = candidateEntityCount;
        stats.testedEntityCount = 0;
        stats.visitedNodeCount = 0;
    }
}
//# sourceMappingURL=entity-bounds-bvh.js.map