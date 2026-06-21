import { EPSILON, intersectRayAabb, read, transformAabb, v3, vec2, vec3, } from "@aperture-engine/math";
const NODE_BOUNDS_STRIDE = 6;
const NODE_DATA_STRIDE = 5;
const NODE_DATA_FIRST = 0;
const NODE_DATA_COUNT = 1;
const NODE_DATA_DEPTH = 2;
const NODE_DATA_AXIS = 3;
const NODE_DATA_SECOND = 4;
const DEFAULT_MAX_LEAF_SIZE = 8;
const DEFAULT_MAX_DEPTH = 40;
const SAH_BIN_COUNT = 32;
const DEFAULT_RAY_MAX_DISTANCE = Number.POSITIVE_INFINITY;
export function createMeshTriangleQuery(mesh) {
    return {
        raycast(ray, options = {}) {
            return raycastMeshTriangles(mesh, ray, options);
        },
        raycastFirst(ray, options = {}) {
            return raycastFirstMeshTriangle(mesh, ray, options);
        },
    };
}
export function raycastMeshTriangles(mesh, ray, options = {}) {
    const normalizedRay = normalizeRay(ray);
    resetTriangleStats(options.stats);
    if (normalizedRay === null) {
        return [];
    }
    const maxDistance = normalizeMaxDistance(options.maxDistance);
    if (maxDistance === null) {
        return [];
    }
    const hits = [];
    const triangles = collectMeshTriangles(mesh);
    for (const triangle of triangles) {
        if (options.stats !== undefined) {
            options.stats.testedPrimitiveCount += 1;
        }
        const hit = intersectTriangle(mesh, triangle, normalizedRay, maxDistance, {
            ...options,
            source: "mesh-linear",
        });
        if (hit !== null) {
            hits.push(hit);
        }
    }
    return sortTriangleHits(hits);
}
export function raycastFirstMeshTriangle(mesh, ray, options = {}) {
    const normalizedRay = normalizeRay(ray);
    resetTriangleStats(options.stats);
    if (normalizedRay === null) {
        return null;
    }
    const maxDistance = normalizeMaxDistance(options.maxDistance);
    if (maxDistance === null) {
        return null;
    }
    let closest = null;
    let closestDistance = maxDistance;
    for (const triangle of collectMeshTriangles(mesh)) {
        if (options.stats !== undefined) {
            options.stats.testedPrimitiveCount += 1;
        }
        const hit = intersectTriangle(mesh, triangle, normalizedRay, closestDistance, {
            ...options,
            source: "mesh-linear",
        });
        if (hit !== null &&
            (closest === null ||
                hit.distance < closest.distance ||
                (hit.distance === closest.distance &&
                    hit.faceIndex < closest.faceIndex))) {
            closest = hit;
            closestDistance = hit.distance;
        }
    }
    return closest;
}
export function createMeshBvh(mesh, options = {}) {
    return MeshBvh.build(mesh, options);
}
export function deserializeMeshBvh(mesh, serialized) {
    return new MeshBvh(mesh, serialized.nodeBounds.slice(), serialized.nodeData.slice(), serialized.primitiveIndices.slice(), { ...serialized.stats });
}
export function createMeshTriangleQueryStats() {
    return { testedPrimitiveCount: 0 };
}
export function createMeshBvhTraversalStats() {
    return { visitedNodeCount: 0, testedPrimitiveCount: 0 };
}
export function createSpatialQueryReport(report) {
    return {
        ...report,
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function createMeshBvhCache() {
    return new MeshBvhCache();
}
export function createMeshBvhCacheKey(input) {
    return JSON.stringify({
        meshKey: input.meshKey,
        version: input.version,
        primitiveRangesKey: input.primitiveRangesKey ?? "all",
        options: normalizeBuildOptions(input.options),
    });
}
export class MeshBvhCache {
    entries = new Map();
    latestKeyByMesh = new Map();
    keysByMesh = new Map();
    versionByMesh = new Map();
    getOrBuild(input) {
        return this.finishGetOrBuild(input, (mesh, options) => createMeshBvh(mesh, options));
    }
    invalidate(meshKey) {
        const keys = this.keysByMesh.get(meshKey);
        if (keys !== undefined) {
            for (const key of keys) {
                this.entries.delete(key);
            }
        }
        this.keysByMesh.delete(meshKey);
        this.latestKeyByMesh.delete(meshKey);
        this.versionByMesh.delete(meshKey);
    }
    /**
     * Drop cached BVH entries for any mesh key NOT in `liveMeshKeys` — called after a
     * spatial-index population pass to reclaim BVHs for despawned/removed meshes.
     */
    prune(liveMeshKeys) {
        for (const meshKey of [...this.keysByMesh.keys()]) {
            if (!liveMeshKeys.has(meshKey)) {
                this.invalidate(meshKey);
            }
        }
    }
    finishGetOrBuild(input, builder) {
        const diagnostics = unsupportedInputDiagnostics(input);
        const cacheKey = createMeshBvhCacheKey(input);
        const existing = this.entries.get(cacheKey);
        if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
            return {
                cacheKey,
                bvh: null,
                reused: false,
                refit: false,
                built: false,
                buildTimeMs: 0,
                memoryEstimateBytes: 0,
                stats: null,
                diagnostics,
            };
        }
        if (existing !== undefined) {
            return {
                cacheKey,
                bvh: existing,
                reused: true,
                refit: false,
                built: false,
                buildTimeMs: 0,
                memoryEstimateBytes: existing.stats.memoryBytes,
                stats: existing.stats,
                diagnostics,
            };
        }
        const latestKey = this.latestKeyByMesh.get(input.meshKey);
        const stale = latestKey === undefined ? undefined : this.entries.get(latestKey);
        if (stale !== undefined) {
            diagnostics.push({
                code: "spatial.mesh-bvh.stale",
                severity: "warning",
                message: `BVH cache entry for mesh '${input.meshKey}' is stale for version '${String(input.version)}'.`,
                suggestedFix: "Refit when only vertex positions changed, or rebuild after topology, primitive range, or build-option changes.",
                data: {
                    meshKey: input.meshKey,
                    previousCacheKey: latestKey,
                    nextCacheKey: cacheKey,
                },
            });
            if ((input.dynamicPolicy ?? "static") === "refit") {
                const start = performanceNow();
                stale.refit();
                this.entries.set(cacheKey, stale);
                this.rememberKey(input.meshKey, cacheKey, input.version);
                return {
                    cacheKey,
                    bvh: stale,
                    reused: false,
                    refit: true,
                    built: false,
                    buildTimeMs: performanceNow() - start,
                    memoryEstimateBytes: stale.stats.memoryBytes,
                    stats: stale.stats,
                    diagnostics,
                };
            }
        }
        const start = performanceNow();
        try {
            return this.storeBuiltBvh(input, cacheKey, builder(input.mesh, input.options), start, diagnostics);
        }
        catch (error) {
            return this.buildFailedReport(cacheKey, start, diagnostics, error);
        }
    }
    storeBuiltBvh(input, cacheKey, bvh, start, diagnostics) {
        this.entries.set(cacheKey, bvh);
        this.rememberKey(input.meshKey, cacheKey, input.version);
        return {
            cacheKey,
            bvh,
            reused: false,
            refit: false,
            built: true,
            buildTimeMs: performanceNow() - start,
            memoryEstimateBytes: bvh.stats.memoryBytes,
            stats: bvh.stats,
            diagnostics,
        };
    }
    buildFailedReport(cacheKey, start, diagnostics, error) {
        return {
            cacheKey,
            bvh: null,
            reused: false,
            refit: false,
            built: false,
            buildTimeMs: performanceNow() - start,
            memoryEstimateBytes: 0,
            stats: null,
            diagnostics: [
                ...diagnostics,
                {
                    code: "spatial.mesh-bvh.build-failed",
                    severity: "error",
                    message: "Mesh BVH build failed.",
                    suggestedFix: "Validate mesh CPU buffers and retry with a supported triangle-list mesh.",
                    data: {
                        error: error instanceof Error ? error.message : String(error),
                    },
                },
            ],
        };
    }
    rememberKey(meshKey, cacheKey, version) {
        const previousVersion = this.versionByMesh.get(meshKey);
        // A new mesh version supersedes every prior-version BVH entry for this mesh
        // (re-bake / LOD swap / repeated markReady). Under the static policy the old
        // entries are never otherwise evicted — that is the cache leak. Drop them so
        // dynamic meshes keep at most the current version's entries (one per options
        // variant). Same-version option variants coexist and are not evicted.
        if (previousVersion !== undefined && previousVersion !== version) {
            const existingKeys = this.keysByMesh.get(meshKey);
            if (existingKeys !== undefined) {
                for (const key of existingKeys) {
                    if (key !== cacheKey) {
                        this.entries.delete(key);
                    }
                }
                existingKeys.clear();
            }
        }
        this.versionByMesh.set(meshKey, version);
        let keys = this.keysByMesh.get(meshKey);
        if (keys === undefined) {
            keys = new Set();
            this.keysByMesh.set(meshKey, keys);
        }
        keys.add(cacheKey);
        this.latestKeyByMesh.set(meshKey, cacheKey);
    }
}
export class MeshBvh {
    mesh;
    nodeBounds;
    nodeData;
    primitiveIndices;
    stats;
    static build(mesh, options = {}) {
        const strategy = options.strategy ?? "center";
        const maxDepth = normalizePositiveInteger(options.maxDepth, DEFAULT_MAX_DEPTH);
        const maxLeafSize = normalizePositiveInteger(options.maxLeafSize, DEFAULT_MAX_LEAF_SIZE);
        const primitiveData = collectPrimitiveBuildData(mesh);
        const primitiveIndices = primitiveData.map((_, index) => index);
        const root = primitiveData.length === 0
            ? null
            : buildNode({
                primitiveData,
                primitiveIndices,
                start: 0,
                count: primitiveData.length,
                depth: 0,
                maxDepth,
                maxLeafSize,
                strategy,
            });
        const nodeCount = root === null ? 0 : countNodes(root);
        const nodeBounds = new Float32Array(nodeCount * NODE_BOUNDS_STRIDE);
        const nodeData = new Uint32Array(nodeCount * NODE_DATA_STRIDE);
        const writeState = { nextNodeIndex: 0, leafCount: 0, maxDepth: 0 };
        if (root !== null) {
            writeNode(root, nodeBounds, nodeData, writeState);
        }
        const primitiveIndexArray = new Uint32Array(primitiveIndices);
        const memoryBytes = nodeBounds.byteLength +
            nodeData.byteLength +
            primitiveIndexArray.byteLength;
        const stats = {
            nodeCount,
            leafCount: writeState.leafCount,
            maxDepth: writeState.maxDepth,
            primitiveCount: primitiveData.length,
            buildStrategy: strategy,
            maxLeafSize,
            indirect: options.indirect ?? false,
            memoryBytes,
        };
        return new MeshBvh(mesh, nodeBounds, nodeData, primitiveIndexArray, stats);
    }
    triangles;
    constructor(mesh, nodeBounds, nodeData, primitiveIndices, stats) {
        this.mesh = mesh;
        this.nodeBounds = nodeBounds;
        this.nodeData = nodeData;
        this.primitiveIndices = primitiveIndices;
        this.stats = stats;
        this.triangles = collectMeshTriangles(mesh);
    }
    raycast(ray, options = {}) {
        const normalizedRay = normalizeRay(ray);
        resetBvhStats(options.stats);
        if (normalizedRay === null || this.stats.nodeCount === 0) {
            return [];
        }
        const maxDistance = normalizeMaxDistance(options.maxDistance);
        if (maxDistance === null) {
            return [];
        }
        if (options.firstHitOnly === true) {
            const first = this.raycastFirst(normalizedRay, {
                ...options,
                maxDistance,
            });
            return first === null ? [] : [first];
        }
        const hits = [];
        const stack = [0];
        while (stack.length > 0) {
            const nodeIndex = stack.pop();
            const boundsHit = intersectRayAabb(normalizedRay, this.readNodeBounds(nodeIndex), maxDistance);
            if (boundsHit === null) {
                continue;
            }
            incrementVisitedNodeCount(options.stats);
            if (this.isLeaf(nodeIndex)) {
                this.raycastLeaf(nodeIndex, normalizedRay, maxDistance, options, hits);
                continue;
            }
            const left = this.leftChild(nodeIndex);
            const right = this.rightChild(nodeIndex);
            const leftHit = intersectRayAabb(normalizedRay, this.readNodeBounds(left), maxDistance);
            const rightHit = intersectRayAabb(normalizedRay, this.readNodeBounds(right), maxDistance);
            if (leftHit !== null &&
                rightHit !== null &&
                leftHit.distance > rightHit.distance) {
                stack.push(left, right);
            }
            else {
                if (rightHit !== null) {
                    stack.push(right);
                }
                if (leftHit !== null) {
                    stack.push(left);
                }
            }
        }
        return sortTriangleHits(hits);
    }
    raycastFirst(ray, options = {}) {
        const normalizedRay = normalizeRay(ray);
        resetBvhStats(options.stats);
        if (normalizedRay === null || this.stats.nodeCount === 0) {
            return null;
        }
        const normalizedMaxDistance = normalizeMaxDistance(options.maxDistance);
        if (normalizedMaxDistance === null) {
            return null;
        }
        let closest = null;
        let maxDistance = normalizedMaxDistance;
        const stack = [0];
        while (stack.length > 0) {
            const nodeIndex = stack.pop();
            const boundsHit = intersectRayAabb(normalizedRay, this.readNodeBounds(nodeIndex), maxDistance);
            if (boundsHit === null || boundsHit.distance > maxDistance) {
                continue;
            }
            incrementVisitedNodeCount(options.stats);
            if (this.isLeaf(nodeIndex)) {
                const leafClosest = this.raycastLeafFirst(nodeIndex, normalizedRay, maxDistance, options);
                if (leafClosest !== null &&
                    (closest === null ||
                        leafClosest.distance < closest.distance ||
                        (leafClosest.distance === closest.distance &&
                            leafClosest.faceIndex < closest.faceIndex))) {
                    closest = leafClosest;
                    maxDistance = leafClosest.distance;
                }
                continue;
            }
            const left = this.leftChild(nodeIndex);
            const right = this.rightChild(nodeIndex);
            const leftHit = intersectRayAabb(normalizedRay, this.readNodeBounds(left), maxDistance);
            const rightHit = intersectRayAabb(normalizedRay, this.readNodeBounds(right), maxDistance);
            if (leftHit === null && rightHit === null) {
                continue;
            }
            if (leftHit !== null && rightHit !== null) {
                if (leftHit.distance <= rightHit.distance) {
                    stack.push(right, left);
                }
                else {
                    stack.push(left, right);
                }
                continue;
            }
            stack.push(leftHit !== null ? left : right);
        }
        return closest;
    }
    visitMeshBvh(callbacks) {
        if (this.stats.nodeCount === 0) {
            return false;
        }
        const stack = [
            { nodeIndex: 0, contained: false, score: 0 },
        ];
        while (stack.length > 0) {
            const item = stack.pop();
            const bounds = this.readNodeBounds(item.nodeIndex);
            const isLeaf = this.isLeaf(item.nodeIndex);
            const intersection = normalizeShapeIntersection(item.contained
                ? "contained"
                : callbacks.intersectsBounds(bounds, {
                    isLeaf,
                    depth: this.nodeDepth(item.nodeIndex),
                    nodeIndex: item.nodeIndex,
                    score: item.score,
                }));
            if (intersection === "not-intersected") {
                continue;
            }
            const contained = intersection === "contained";
            if (isLeaf) {
                const rangeHit = callbacks.intersectsRange?.({
                    offset: this.primitiveOffset(item.nodeIndex),
                    count: this.primitiveCount(item.nodeIndex),
                    contained,
                    depth: this.nodeDepth(item.nodeIndex),
                    nodeIndex: item.nodeIndex,
                    bounds,
                }) ?? false;
                if (rangeHit) {
                    return true;
                }
                if (callbacks.intersectsTriangle === undefined) {
                    return true;
                }
                const offset = this.primitiveOffset(item.nodeIndex);
                const end = offset + this.primitiveCount(item.nodeIndex);
                for (let index = offset; index < end; index += 1) {
                    const primitiveIndex = this.primitiveIndices[index];
                    if (primitiveIndex === undefined) {
                        continue;
                    }
                    const triangle = this.triangles[primitiveIndex];
                    if (triangle === undefined) {
                        continue;
                    }
                    const triangleView = createTriangleView(this.mesh, triangle);
                    const hitScratch = createTriangleHitScratch();
                    if (callbacks.intersectsTriangle(triangleView, hitScratch) === true) {
                        return true;
                    }
                }
                continue;
            }
            const left = this.leftChild(item.nodeIndex);
            const right = this.rightChild(item.nodeIndex);
            const leftBounds = this.readNodeBounds(left);
            const rightBounds = this.readNodeBounds(right);
            const leftScore = callbacks.boundsTraverseOrder?.(leftBounds) ?? 0;
            const rightScore = callbacks.boundsTraverseOrder?.(rightBounds) ?? 0;
            const leftItem = { nodeIndex: left, contained, score: leftScore };
            const rightItem = { nodeIndex: right, contained, score: rightScore };
            if (leftScore <= rightScore) {
                stack.push(rightItem, leftItem);
            }
            else {
                stack.push(leftItem, rightItem);
            }
        }
        return false;
    }
    intersectsSphere(sphere) {
        return this.visitMeshBvh({
            intersectsBounds: (bounds) => {
                if (!aabbIntersectsSphere(bounds, sphere)) {
                    return "not-intersected";
                }
                return sphereContainsAabb(sphere, bounds) ? "contained" : "intersected";
            },
            intersectsRange: (range) => range.contained,
            intersectsTriangle: (triangle) => distanceSqPointToTriangle(sphere.center, triangle.a, triangle.b, triangle.c) <=
                sphere.radius * sphere.radius + EPSILON,
        });
    }
    intersectsBox(box, boxToMesh) {
        const meshBox = boxToMesh === undefined ? box : transformAabb(box, boxToMesh);
        return this.visitMeshBvh({
            intersectsBounds: (bounds) => {
                if (!aabbIntersectsAabb(bounds, meshBox)) {
                    return "not-intersected";
                }
                return aabbContainsAabb(meshBox, bounds) ? "contained" : "intersected";
            },
            intersectsRange: (range) => range.contained,
            intersectsTriangle: (triangle) => aabbIntersectsAabb(triangleBounds(triangle.a, triangle.b, triangle.c), meshBox),
        });
    }
    intersectsCapsule(capsule) {
        const radius = Math.max(0, capsule.radius);
        const radiusSq = radius * radius;
        return this.visitMeshBvh({
            intersectsBounds: (bounds) => segmentIntersectsAabb(capsule.start, capsule.end, expandAabb(bounds, radius)),
            intersectsTriangle: (triangle) => distanceSqSegmentToTriangle(capsule.start, capsule.end, triangle.a, triangle.b, triangle.c) <=
                radiusSq + EPSILON,
        });
    }
    intersectsFrustum(frustum) {
        return this.visitMeshBvh({
            intersectsBounds: (bounds) => {
                const result = classifyAabbAgainstFrustum(bounds, frustum);
                if (result === "outside") {
                    return "not-intersected";
                }
                return result === "inside" ? "contained" : "intersected";
            },
            intersectsRange: (range) => range.contained,
            intersectsTriangle: (triangle) => pointInFrustum(triangle.a, frustum) ||
                pointInFrustum(triangle.b, frustum) ||
                pointInFrustum(triangle.c, frustum) ||
                classifyAabbAgainstFrustum(triangleBounds(triangle.a, triangle.b, triangle.c), frustum) !== "outside",
        });
    }
    closestPointToPoint(point, options = {}) {
        resetBvhStats(options.stats);
        if (this.stats.nodeCount === 0) {
            return null;
        }
        const maxDistance = normalizeMaxDistance(options.maxDistance);
        if (maxDistance === null) {
            return null;
        }
        let best = null;
        let bestDistanceSq = maxDistance * maxDistance;
        const stack = [0];
        while (stack.length > 0) {
            const nodeIndex = stack.pop();
            const bounds = this.readNodeBounds(nodeIndex);
            const boundsDistanceSq = distanceSqPointToAabb(point, bounds);
            if (boundsDistanceSq > bestDistanceSq + EPSILON) {
                continue;
            }
            incrementVisitedNodeCount(options.stats);
            if (this.isLeaf(nodeIndex)) {
                const offset = this.primitiveOffset(nodeIndex);
                const end = offset + this.primitiveCount(nodeIndex);
                for (let index = offset; index < end; index += 1) {
                    const primitiveIndex = this.primitiveIndices[index];
                    const triangle = primitiveIndex === undefined
                        ? undefined
                        : this.triangles[primitiveIndex];
                    if (triangle === undefined) {
                        continue;
                    }
                    incrementTestedPrimitiveCount(options.stats);
                    const a = readPosition(this.mesh, triangle.v0);
                    const b = readPosition(this.mesh, triangle.v1);
                    const c = readPosition(this.mesh, triangle.v2);
                    const closest = closestPointOnTriangle(point, a, b, c);
                    const candidateDistanceSq = distanceSq(point, closest);
                    if (candidateDistanceSq <= bestDistanceSq + EPSILON) {
                        bestDistanceSq = candidateDistanceSq;
                        best = {
                            point: closest,
                            distance: Math.sqrt(candidateDistanceSq),
                            faceIndex: triangle.faceIndex,
                            submeshIndex: triangle.submeshIndex,
                            materialSlot: triangle.materialSlot,
                        };
                    }
                }
                continue;
            }
            const left = this.leftChild(nodeIndex);
            const right = this.rightChild(nodeIndex);
            const leftDistance = distanceSqPointToAabb(point, this.readNodeBounds(left));
            const rightDistance = distanceSqPointToAabb(point, this.readNodeBounds(right));
            if (leftDistance <= rightDistance) {
                stack.push(right, left);
            }
            else {
                stack.push(left, right);
            }
        }
        return best;
    }
    closestPointToSegment(start, end, options = {}) {
        resetBvhStats(options.stats);
        if (this.stats.nodeCount === 0) {
            return null;
        }
        const maxDistance = normalizeMaxDistance(options.maxDistance);
        if (maxDistance === null) {
            return null;
        }
        let best = null;
        let bestDistanceSq = maxDistance * maxDistance;
        const stack = [0];
        while (stack.length > 0) {
            const nodeIndex = stack.pop();
            const bounds = this.readNodeBounds(nodeIndex);
            const boundDistanceSq = Math.min(distanceSqPointToAabb(start, bounds), distanceSqPointToAabb(end, bounds));
            if (boundDistanceSq > bestDistanceSq + EPSILON) {
                continue;
            }
            incrementVisitedNodeCount(options.stats);
            if (this.isLeaf(nodeIndex)) {
                const offset = this.primitiveOffset(nodeIndex);
                const endOffset = offset + this.primitiveCount(nodeIndex);
                for (let index = offset; index < endOffset; index += 1) {
                    const primitiveIndex = this.primitiveIndices[index];
                    const triangle = primitiveIndex === undefined
                        ? undefined
                        : this.triangles[primitiveIndex];
                    if (triangle === undefined) {
                        continue;
                    }
                    incrementTestedPrimitiveCount(options.stats);
                    const a = readPosition(this.mesh, triangle.v0);
                    const b = readPosition(this.mesh, triangle.v1);
                    const c = readPosition(this.mesh, triangle.v2);
                    const closest = closestPointSegmentToTriangle(start, end, a, b, c);
                    if (closest.distanceSq <= bestDistanceSq + EPSILON) {
                        bestDistanceSq = closest.distanceSq;
                        best = {
                            point: closest.pointOnTriangle,
                            distance: Math.sqrt(closest.distanceSq),
                            faceIndex: triangle.faceIndex,
                            submeshIndex: triangle.submeshIndex,
                            materialSlot: triangle.materialSlot,
                        };
                    }
                }
                continue;
            }
            stack.push(this.leftChild(nodeIndex), this.rightChild(nodeIndex));
        }
        return best;
    }
    bvhcast(other, options = {}) {
        const maxPairs = options.maxPairs ?? Number.POSITIVE_INFINITY;
        const pairs = [];
        if (this.stats.nodeCount === 0 ||
            other.stats.nodeCount === 0 ||
            maxPairs <= 0) {
            return pairs;
        }
        const stack = [[0, 0]];
        while (stack.length > 0 && pairs.length < maxPairs) {
            const pair = stack.pop();
            const [aNode, bNode] = pair;
            if (!aabbIntersectsAabb(this.readNodeBounds(aNode), other.readNodeBounds(bNode))) {
                continue;
            }
            const aLeaf = this.isLeaf(aNode);
            const bLeaf = other.isLeaf(bNode);
            if (aLeaf && bLeaf) {
                const aStart = this.primitiveOffset(aNode);
                const aEnd = aStart + this.primitiveCount(aNode);
                const bStart = other.primitiveOffset(bNode);
                const bEnd = bStart + other.primitiveCount(bNode);
                for (let ai = aStart; ai < aEnd && pairs.length < maxPairs; ai += 1) {
                    const aPrimitive = this.primitiveIndices[ai];
                    const aTriangle = aPrimitive === undefined ? undefined : this.triangles[aPrimitive];
                    if (aTriangle === undefined) {
                        continue;
                    }
                    const aBounds = triangleRefBounds(this.mesh, aTriangle);
                    for (let bi = bStart; bi < bEnd && pairs.length < maxPairs; bi += 1) {
                        const bPrimitive = other.primitiveIndices[bi];
                        const bTriangle = bPrimitive === undefined
                            ? undefined
                            : other.triangles[bPrimitive];
                        if (bTriangle !== undefined &&
                            aabbIntersectsAabb(aBounds, triangleRefBounds(other.mesh, bTriangle))) {
                            pairs.push({
                                aFaceIndex: aTriangle.faceIndex,
                                bFaceIndex: bTriangle.faceIndex,
                                aSubmeshIndex: aTriangle.submeshIndex,
                                bSubmeshIndex: bTriangle.submeshIndex,
                            });
                        }
                    }
                }
                continue;
            }
            if (aLeaf) {
                const bLeft = other.leftChild(bNode);
                stack.push([aNode, bLeft], [aNode, other.rightChild(bNode)]);
            }
            else if (bLeaf) {
                const aLeft = this.leftChild(aNode);
                stack.push([aLeft, bNode], [this.rightChild(aNode), bNode]);
            }
            else {
                const aLeft = this.leftChild(aNode);
                const aRight = this.rightChild(aNode);
                const bLeft = other.leftChild(bNode);
                const bRight = other.rightChild(bNode);
                stack.push([aLeft, bLeft], [aLeft, bRight], [aRight, bLeft], [aRight, bRight]);
            }
        }
        return pairs;
    }
    refit(_nodeIndices) {
        if (this.stats.nodeCount === 0) {
            return;
        }
        this.refitNode(0);
    }
    serialize() {
        return {
            nodeBounds: this.nodeBounds.slice(),
            nodeData: this.nodeData.slice(),
            primitiveIndices: this.primitiveIndices.slice(),
            stats: { ...this.stats },
        };
    }
    raycastLeaf(nodeIndex, ray, maxDistance, options, hits) {
        const offset = this.primitiveOffset(nodeIndex);
        const end = offset + this.primitiveCount(nodeIndex);
        for (let index = offset; index < end; index += 1) {
            const primitiveIndex = this.primitiveIndices[index];
            const triangle = primitiveIndex === undefined
                ? undefined
                : this.triangles[primitiveIndex];
            if (triangle === undefined) {
                continue;
            }
            incrementTestedPrimitiveCount(options.stats);
            const hit = intersectTriangle(this.mesh, triangle, ray, maxDistance, {
                ...options,
                source: "mesh-bvh",
            });
            if (hit !== null) {
                hits.push(hit);
            }
        }
    }
    raycastLeafFirst(nodeIndex, ray, maxDistance, options) {
        let closest = null;
        let closestDistance = maxDistance;
        const offset = this.primitiveOffset(nodeIndex);
        const end = offset + this.primitiveCount(nodeIndex);
        for (let index = offset; index < end; index += 1) {
            const primitiveIndex = this.primitiveIndices[index];
            const triangle = primitiveIndex === undefined
                ? undefined
                : this.triangles[primitiveIndex];
            if (triangle === undefined) {
                continue;
            }
            incrementTestedPrimitiveCount(options.stats);
            const hit = intersectTriangle(this.mesh, triangle, ray, closestDistance, {
                ...options,
                source: "mesh-bvh",
            });
            if (hit !== null &&
                (closest === null ||
                    hit.distance < closest.distance ||
                    (hit.distance === closest.distance &&
                        hit.faceIndex < closest.faceIndex))) {
                closest = hit;
                closestDistance = hit.distance;
            }
        }
        return closest;
    }
    refitNode(nodeIndex) {
        let bounds;
        if (this.isLeaf(nodeIndex)) {
            bounds = emptyBounds();
            const offset = this.primitiveOffset(nodeIndex);
            const end = offset + this.primitiveCount(nodeIndex);
            for (let index = offset; index < end; index += 1) {
                const primitiveIndex = this.primitiveIndices[index];
                const triangle = primitiveIndex === undefined
                    ? undefined
                    : this.triangles[primitiveIndex];
                if (triangle !== undefined) {
                    expandBoundsByBounds(bounds, triangleRefMutableBounds(this.mesh, triangle));
                }
            }
        }
        else {
            const left = this.leftChild(nodeIndex);
            bounds = this.refitNode(left);
            expandBoundsByBounds(bounds, this.refitNode(this.rightChild(nodeIndex)));
        }
        writeMutableBounds(this.nodeBounds, nodeIndex, bounds);
        return bounds;
    }
    readNodeBounds(nodeIndex) {
        const offset = nodeIndex * NODE_BOUNDS_STRIDE;
        return {
            min: vec3(read(this.nodeBounds, offset, "nodeBounds"), read(this.nodeBounds, offset + 1, "nodeBounds"), read(this.nodeBounds, offset + 2, "nodeBounds")),
            max: vec3(read(this.nodeBounds, offset + 3, "nodeBounds"), read(this.nodeBounds, offset + 4, "nodeBounds"), read(this.nodeBounds, offset + 5, "nodeBounds")),
        };
    }
    isLeaf(nodeIndex) {
        return this.primitiveCount(nodeIndex) > 0;
    }
    leftChild(nodeIndex) {
        return read(this.nodeData, nodeIndex * NODE_DATA_STRIDE + NODE_DATA_FIRST, "nodeData");
    }
    rightChild(nodeIndex) {
        return read(this.nodeData, nodeIndex * NODE_DATA_STRIDE + NODE_DATA_SECOND, "nodeData");
    }
    primitiveOffset(nodeIndex) {
        return read(this.nodeData, nodeIndex * NODE_DATA_STRIDE + NODE_DATA_FIRST, "nodeData");
    }
    primitiveCount(nodeIndex) {
        return read(this.nodeData, nodeIndex * NODE_DATA_STRIDE + NODE_DATA_COUNT, "nodeData");
    }
    nodeDepth(nodeIndex) {
        return read(this.nodeData, nodeIndex * NODE_DATA_STRIDE + NODE_DATA_DEPTH, "nodeData");
    }
}
function intersectTriangle(mesh, triangle, ray, maxDistance, options) {
    const a = readPosition(mesh, triangle.v0);
    const b = readPosition(mesh, triangle.v1);
    const c = readPosition(mesh, triangle.v2);
    const edge1 = subtract(b, a);
    const edge2 = subtract(c, a);
    const pvec = cross(ray.direction, edge2);
    const det = dot(edge1, pvec);
    const includeBackfaces = options.includeBackfaces ?? false;
    if (includeBackfaces ? Math.abs(det) <= EPSILON : det <= EPSILON) {
        return null;
    }
    const invDet = 1 / det;
    const tvec = subtract(ray.origin, a);
    const u = dot(tvec, pvec) * invDet;
    if (u < -EPSILON || u > 1 + EPSILON) {
        return null;
    }
    const qvec = cross(tvec, edge1);
    const v = dot(ray.direction, qvec) * invDet;
    if (v < -EPSILON || u + v > 1 + EPSILON) {
        return null;
    }
    const distance = dot(edge2, qvec) * invDet;
    if (distance < -EPSILON || distance > maxDistance) {
        return null;
    }
    const barycentric = vec3(1 - u - v, u, v);
    const hit = {
        distance: Math.max(0, distance),
        point: addScaled(ray.origin, ray.direction, distance),
        normal: options.includeNormal === false
            ? normalize(cross(edge1, edge2))
            : (interpolatedNormal(mesh, triangle, barycentric) ??
                normalize(cross(edge1, edge2))),
        ...(options.includeUv === false
            ? {}
            : optionalUv(mesh, triangle, barycentric)),
        barycentric,
        faceIndex: triangle.faceIndex,
        submeshIndex: triangle.submeshIndex,
        materialSlot: triangle.materialSlot,
        source: options.source,
    };
    return hit;
}
function collectMeshTriangles(mesh) {
    const submeshes = mesh.submeshes !== undefined && mesh.submeshes.length > 0
        ? mesh.submeshes
        : [defaultSubmesh(mesh)];
    const triangles = [];
    for (let submeshIndex = 0; submeshIndex < submeshes.length; submeshIndex += 1) {
        const submesh = submeshes[submeshIndex];
        if (submesh === undefined ||
            submesh.topology === "triangle-list" ||
            submesh.topology === undefined) {
            collectSubmeshTriangles(mesh, submesh ?? defaultSubmesh(mesh), submeshIndex, triangles);
        }
    }
    return triangles;
}
function collectSubmeshTriangles(mesh, submesh, submeshIndex, out) {
    const materialSlot = submesh.materialSlot ?? 0;
    if (mesh.indices !== undefined) {
        const indexStart = submesh.indexStart ?? 0;
        const indexCount = submesh.indexCount ?? Math.max(0, mesh.indices.length - indexStart);
        const end = indexStart + indexCount - 2;
        for (let index = indexStart; index < end; index += 3) {
            out.push({
                v0: readIndex(mesh.indices, index),
                v1: readIndex(mesh.indices, index + 1),
                v2: readIndex(mesh.indices, index + 2),
                faceIndex: out.length,
                submeshIndex,
                materialSlot,
            });
        }
        return;
    }
    const vertexStart = submesh.vertexStart ?? 0;
    const vertexCount = submesh.vertexCount ?? Math.max(0, mesh.vertexCount - vertexStart);
    const end = vertexStart + vertexCount - 2;
    for (let vertex = vertexStart; vertex < end; vertex += 3) {
        out.push({
            v0: vertex,
            v1: vertex + 1,
            v2: vertex + 2,
            faceIndex: out.length,
            submeshIndex,
            materialSlot,
        });
    }
}
function defaultSubmesh(mesh) {
    return mesh.indices === undefined
        ? {
            topology: "triangle-list",
            materialSlot: 0,
            vertexStart: 0,
            vertexCount: mesh.vertexCount,
        }
        : {
            topology: "triangle-list",
            materialSlot: 0,
            vertexStart: 0,
            vertexCount: mesh.vertexCount,
            indexStart: 0,
            indexCount: mesh.indices.length,
        };
}
function collectPrimitiveBuildData(mesh) {
    return collectMeshTriangles(mesh).map((triangle) => {
        const bounds = triangleRefMutableBounds(mesh, triangle);
        return {
            triangle,
            bounds,
            centroidX: (bounds.minX + bounds.maxX) / 2,
            centroidY: (bounds.minY + bounds.maxY) / 2,
            centroidZ: (bounds.minZ + bounds.maxZ) / 2,
        };
    });
}
function buildNode(options) {
    const bounds = boundsForRange(options.primitiveData, options.primitiveIndices, options.start, options.count);
    const splitAxis = longestCentroidAxis(options.primitiveData, options.primitiveIndices, options.start, options.count);
    if (options.count <= options.maxLeafSize ||
        options.depth >= options.maxDepth) {
        return {
            bounds,
            depth: options.depth,
            splitAxis,
            primitiveOffset: options.start,
            primitiveCount: options.count,
        };
    }
    const split = splitPrimitiveRange(options);
    if (split <= options.start || split >= options.start + options.count) {
        return {
            bounds,
            depth: options.depth,
            splitAxis,
            primitiveOffset: options.start,
            primitiveCount: options.count,
        };
    }
    return {
        bounds,
        depth: options.depth,
        splitAxis,
        left: buildNode({
            ...options,
            count: split - options.start,
            depth: options.depth + 1,
        }),
        right: buildNode({
            ...options,
            start: split,
            count: options.start + options.count - split,
            depth: options.depth + 1,
        }),
    };
}
function splitPrimitiveRange(options) {
    if (options.strategy === "sah") {
        const sahSplit = splitSah(options);
        if (sahSplit !== null) {
            return sahSplit;
        }
    }
    const axis = longestCentroidAxis(options.primitiveData, options.primitiveIndices, options.start, options.count);
    const splitPosition = options.strategy === "average"
        ? averageCentroid(options.primitiveData, options.primitiveIndices, options.start, options.count, axis)
        : centerCentroid(options.primitiveData, options.primitiveIndices, options.start, options.count, axis);
    const split = partitionByCentroid(options, axis, splitPosition);
    return split === null ? medianSplit(options, axis) : split;
}
function splitSah(options) {
    let best = null;
    for (let axis = 0; axis < 3; axis += 1) {
        const min = centroidMin(options, axis);
        const max = centroidMax(options, axis);
        const extent = max - min;
        if (extent <= EPSILON) {
            continue;
        }
        const bins = Array.from({ length: SAH_BIN_COUNT }, () => ({
            count: 0,
            bounds: emptyBounds(),
        }));
        for (let index = options.start; index < options.start + options.count; index += 1) {
            const primitiveIndex = options.primitiveIndices[index];
            const primitive = primitiveIndex === undefined
                ? undefined
                : options.primitiveData[primitiveIndex];
            if (primitive === undefined) {
                continue;
            }
            const bin = Math.min(SAH_BIN_COUNT - 1, Math.max(0, Math.floor(((centroidAxis(primitive, axis) - min) / extent) * SAH_BIN_COUNT)));
            const bucket = bins[bin];
            if (bucket !== undefined) {
                bucket.count += 1;
                expandBoundsByBounds(bucket.bounds, primitive.bounds);
            }
        }
        for (let splitBin = 0; splitBin < SAH_BIN_COUNT - 1; splitBin += 1) {
            const left = emptyBounds();
            const right = emptyBounds();
            let leftCount = 0;
            let rightCount = 0;
            for (let bin = 0; bin <= splitBin; bin += 1) {
                const bucket = bins[bin];
                if (bucket !== undefined && bucket.count > 0) {
                    leftCount += bucket.count;
                    expandBoundsByBounds(left, bucket.bounds);
                }
            }
            for (let bin = splitBin + 1; bin < SAH_BIN_COUNT; bin += 1) {
                const bucket = bins[bin];
                if (bucket !== undefined && bucket.count > 0) {
                    rightCount += bucket.count;
                    expandBoundsByBounds(right, bucket.bounds);
                }
            }
            if (leftCount === 0 || rightCount === 0) {
                continue;
            }
            const cost = leftCount * surfaceArea(left) + rightCount * surfaceArea(right);
            if (best === null || cost < best.cost) {
                best = { axis, bin: splitBin, cost };
            }
        }
    }
    if (best === null) {
        return null;
    }
    const min = centroidMin(options, best.axis);
    const max = centroidMax(options, best.axis);
    const extent = max - min;
    const split = partitionByPredicate(options, (primitive) => {
        const bin = Math.min(SAH_BIN_COUNT - 1, Math.max(0, Math.floor(((centroidAxis(primitive, best.axis) - min) / extent) * SAH_BIN_COUNT)));
        return bin <= best.bin;
    });
    return split ?? medianSplit(options, best.axis);
}
function partitionByCentroid(options, axis, splitPosition) {
    return partitionByPredicate(options, (primitive) => centroidAxis(primitive, axis) < splitPosition);
}
function partitionByPredicate(options, predicate) {
    let left = options.start;
    let right = options.start + options.count - 1;
    while (left <= right) {
        const leftPrimitive = primitiveAt(options, left);
        if (leftPrimitive !== undefined && predicate(leftPrimitive)) {
            left += 1;
            continue;
        }
        const rightPrimitive = primitiveAt(options, right);
        if (rightPrimitive !== undefined && !predicate(rightPrimitive)) {
            right -= 1;
            continue;
        }
        const temp = options.primitiveIndices[left];
        options.primitiveIndices[left] = options.primitiveIndices[right] ?? 0;
        options.primitiveIndices[right] = temp ?? 0;
        left += 1;
        right -= 1;
    }
    return left === options.start || left === options.start + options.count
        ? null
        : left;
}
function medianSplit(options, axis) {
    const subset = options.primitiveIndices
        .slice(options.start, options.start + options.count)
        .sort((a, b) => {
        const left = options.primitiveData[a];
        const right = options.primitiveData[b];
        return ((left === undefined ? 0 : centroidAxis(left, axis)) -
            (right === undefined ? 0 : centroidAxis(right, axis)));
    });
    options.primitiveIndices.splice(options.start, options.count, ...subset);
    return options.start + Math.floor(options.count / 2);
}
function primitiveAt(options, index) {
    const primitiveIndex = options.primitiveIndices[index];
    return primitiveIndex === undefined
        ? undefined
        : options.primitiveData[primitiveIndex];
}
function countNodes(node) {
    return (1 +
        (node.left === undefined ? 0 : countNodes(node.left)) +
        (node.right === undefined ? 0 : countNodes(node.right)));
}
function writeNode(node, nodeBounds, nodeData, state) {
    const nodeIndex = state.nextNodeIndex;
    state.nextNodeIndex += 1;
    state.maxDepth = Math.max(state.maxDepth, node.depth);
    writeMutableBounds(nodeBounds, nodeIndex, node.bounds);
    const dataOffset = nodeIndex * NODE_DATA_STRIDE;
    nodeData[dataOffset + NODE_DATA_DEPTH] = node.depth;
    nodeData[dataOffset + NODE_DATA_AXIS] = node.splitAxis;
    if (node.left === undefined || node.right === undefined) {
        state.leafCount += 1;
        nodeData[dataOffset + NODE_DATA_FIRST] = node.primitiveOffset ?? 0;
        nodeData[dataOffset + NODE_DATA_COUNT] = node.primitiveCount ?? 0;
        return nodeIndex;
    }
    const leftIndex = writeNode(node.left, nodeBounds, nodeData, state);
    const rightIndex = writeNode(node.right, nodeBounds, nodeData, state);
    nodeData[dataOffset + NODE_DATA_FIRST] = leftIndex;
    nodeData[dataOffset + NODE_DATA_COUNT] = 0;
    nodeData[dataOffset + NODE_DATA_SECOND] = rightIndex;
    return nodeIndex;
}
function boundsForRange(primitiveData, primitiveIndices, start, count) {
    const bounds = emptyBounds();
    for (let index = start; index < start + count; index += 1) {
        const primitive = primitiveAt({ primitiveData, primitiveIndices }, index);
        if (primitive !== undefined) {
            expandBoundsByBounds(bounds, primitive.bounds);
        }
    }
    return bounds;
}
function longestCentroidAxis(primitiveData, primitiveIndices, start, count) {
    const min = [
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
    ];
    const max = [
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
    ];
    for (let index = start; index < start + count; index += 1) {
        const primitive = primitiveAt({ primitiveData, primitiveIndices }, index);
        if (primitive === undefined) {
            continue;
        }
        min[0] = Math.min(min[0] ?? 0, primitive.centroidX);
        min[1] = Math.min(min[1] ?? 0, primitive.centroidY);
        min[2] = Math.min(min[2] ?? 0, primitive.centroidZ);
        max[0] = Math.max(max[0] ?? 0, primitive.centroidX);
        max[1] = Math.max(max[1] ?? 0, primitive.centroidY);
        max[2] = Math.max(max[2] ?? 0, primitive.centroidZ);
    }
    const extentX = (max[0] ?? 0) - (min[0] ?? 0);
    const extentY = (max[1] ?? 0) - (min[1] ?? 0);
    const extentZ = (max[2] ?? 0) - (min[2] ?? 0);
    if (extentY > extentX && extentY >= extentZ) {
        return 1;
    }
    return extentZ > extentX && extentZ > extentY ? 2 : 0;
}
function centroidMin(options, axis) {
    let min = Number.POSITIVE_INFINITY;
    for (let index = options.start; index < options.start + options.count; index += 1) {
        const primitive = primitiveAt(options, index);
        if (primitive !== undefined) {
            min = Math.min(min, centroidAxis(primitive, axis));
        }
    }
    return min;
}
function centroidMax(options, axis) {
    let max = Number.NEGATIVE_INFINITY;
    for (let index = options.start; index < options.start + options.count; index += 1) {
        const primitive = primitiveAt(options, index);
        if (primitive !== undefined) {
            max = Math.max(max, centroidAxis(primitive, axis));
        }
    }
    return max;
}
function centerCentroid(primitiveData, primitiveIndices, start, count, axis) {
    return ((centroidMin({ primitiveData, primitiveIndices, start, count }, axis) +
        centroidMax({ primitiveData, primitiveIndices, start, count }, axis)) /
        2);
}
function averageCentroid(primitiveData, primitiveIndices, start, count, axis) {
    let sum = 0;
    let actualCount = 0;
    for (let index = start; index < start + count; index += 1) {
        const primitive = primitiveAt({ primitiveData, primitiveIndices }, index);
        if (primitive !== undefined) {
            sum += centroidAxis(primitive, axis);
            actualCount += 1;
        }
    }
    return actualCount === 0 ? 0 : sum / actualCount;
}
function centroidAxis(primitive, axis) {
    if (axis === 1) {
        return primitive.centroidY;
    }
    return axis === 2 ? primitive.centroidZ : primitive.centroidX;
}
function readPosition(mesh, vertexIndex) {
    return readAttribute3(mesh.positions, vertexIndex, "POSITION");
}
function readNormal(mesh, vertexIndex) {
    return mesh.normals === undefined
        ? null
        : readAttribute3(mesh.normals, vertexIndex, "NORMAL");
}
function readUv(mesh, vertexIndex) {
    if (mesh.uvs === undefined) {
        return null;
    }
    const offset = (mesh.uvs.offset ?? 0) + vertexIndex * mesh.uvs.stride;
    return vec2(read(mesh.uvs.data, offset, "TEXCOORD_0"), read(mesh.uvs.data, offset + 1, "TEXCOORD_0"));
}
function readAttribute3(attribute, vertexIndex, label) {
    const offset = (attribute.offset ?? 0) + vertexIndex * attribute.stride;
    return vec3(read(attribute.data, offset, label), read(attribute.data, offset + 1, label), read(attribute.data, offset + 2, label));
}
function readIndex(indices, index) {
    return read(indices, index, "indices");
}
function interpolatedNormal(mesh, triangle, barycentric) {
    const a = readNormal(mesh, triangle.v0);
    const b = readNormal(mesh, triangle.v1);
    const c = readNormal(mesh, triangle.v2);
    if (a === null || b === null || c === null) {
        return null;
    }
    return normalize(vec3(v3(a, 0) * v3(barycentric, 0) +
        v3(b, 0) * v3(barycentric, 1) +
        v3(c, 0) * v3(barycentric, 2), v3(a, 1) * v3(barycentric, 0) +
        v3(b, 1) * v3(barycentric, 1) +
        v3(c, 1) * v3(barycentric, 2), v3(a, 2) * v3(barycentric, 0) +
        v3(b, 2) * v3(barycentric, 1) +
        v3(c, 2) * v3(barycentric, 2)));
}
function optionalUv(mesh, triangle, barycentric) {
    const a = readUv(mesh, triangle.v0);
    const b = readUv(mesh, triangle.v1);
    const c = readUv(mesh, triangle.v2);
    if (a === null || b === null || c === null) {
        return {};
    }
    const w0 = v3(barycentric, 0);
    const w1 = v3(barycentric, 1);
    const w2 = v3(barycentric, 2);
    return {
        uv: vec2(w0 * read(a, 0, "uv") + w1 * read(b, 0, "uv") + w2 * read(c, 0, "uv"), w0 * read(a, 1, "uv") + w1 * read(b, 1, "uv") + w2 * read(c, 1, "uv")),
    };
}
function triangleRefMutableBounds(mesh, triangle) {
    const a = readPosition(mesh, triangle.v0);
    const b = readPosition(mesh, triangle.v1);
    const c = readPosition(mesh, triangle.v2);
    return mutableBoundsFromTriangle(a, b, c);
}
function triangleRefBounds(mesh, triangle) {
    return toAabb(triangleRefMutableBounds(mesh, triangle));
}
function triangleBounds(a, b, c) {
    return toAabb(mutableBoundsFromTriangle(a, b, c));
}
function mutableBoundsFromTriangle(a, b, c) {
    return {
        minX: Math.min(v3(a, 0), v3(b, 0), v3(c, 0)),
        minY: Math.min(v3(a, 1), v3(b, 1), v3(c, 1)),
        minZ: Math.min(v3(a, 2), v3(b, 2), v3(c, 2)),
        maxX: Math.max(v3(a, 0), v3(b, 0), v3(c, 0)),
        maxY: Math.max(v3(a, 1), v3(b, 1), v3(c, 1)),
        maxZ: Math.max(v3(a, 2), v3(b, 2), v3(c, 2)),
    };
}
function emptyBounds() {
    return {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        minZ: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
        maxZ: Number.NEGATIVE_INFINITY,
    };
}
function expandBoundsByBounds(target, source) {
    target.minX = Math.min(target.minX, source.minX);
    target.minY = Math.min(target.minY, source.minY);
    target.minZ = Math.min(target.minZ, source.minZ);
    target.maxX = Math.max(target.maxX, source.maxX);
    target.maxY = Math.max(target.maxY, source.maxY);
    target.maxZ = Math.max(target.maxZ, source.maxZ);
}
function writeMutableBounds(array, nodeIndex, bounds) {
    const offset = nodeIndex * NODE_BOUNDS_STRIDE;
    array[offset] = bounds.minX;
    array[offset + 1] = bounds.minY;
    array[offset + 2] = bounds.minZ;
    array[offset + 3] = bounds.maxX;
    array[offset + 4] = bounds.maxY;
    array[offset + 5] = bounds.maxZ;
}
function toAabb(bounds) {
    return {
        min: vec3(bounds.minX, bounds.minY, bounds.minZ),
        max: vec3(bounds.maxX, bounds.maxY, bounds.maxZ),
    };
}
function surfaceArea(bounds) {
    const x = Math.max(0, bounds.maxX - bounds.minX);
    const y = Math.max(0, bounds.maxY - bounds.minY);
    const z = Math.max(0, bounds.maxZ - bounds.minZ);
    return 2 * (x * y + y * z + z * x);
}
function normalizeRay(ray) {
    const ox = v3(ray.origin, 0);
    const oy = v3(ray.origin, 1);
    const oz = v3(ray.origin, 2);
    const dx = v3(ray.direction, 0);
    const dy = v3(ray.direction, 1);
    const dz = v3(ray.direction, 2);
    const length = Math.hypot(dx, dy, dz);
    if (!Number.isFinite(ox) ||
        !Number.isFinite(oy) ||
        !Number.isFinite(oz) ||
        !Number.isFinite(length) ||
        length <= EPSILON) {
        return null;
    }
    return {
        origin: vec3(ox, oy, oz),
        direction: vec3(dx / length, dy / length, dz / length),
    };
}
function normalizeMaxDistance(value) {
    if (value === undefined) {
        return DEFAULT_RAY_MAX_DISTANCE;
    }
    return !Number.isNaN(value) && value >= 0 ? value : null;
}
function normalizeBuildOptions(options) {
    return {
        strategy: options?.strategy ?? "center",
        maxDepth: normalizePositiveInteger(options?.maxDepth, DEFAULT_MAX_DEPTH),
        maxLeafSize: normalizePositiveInteger(options?.maxLeafSize, DEFAULT_MAX_LEAF_SIZE),
        indirect: options?.indirect ?? false,
    };
}
function normalizePositiveInteger(value, fallback) {
    return Number.isInteger(value) && value !== undefined && value > 0
        ? value
        : fallback;
}
function sortTriangleHits(hits) {
    return hits.sort((a, b) => a.distance - b.distance ||
        a.submeshIndex - b.submeshIndex ||
        a.faceIndex - b.faceIndex);
}
function resetTriangleStats(stats) {
    if (stats !== undefined) {
        stats.testedPrimitiveCount = 0;
    }
}
function resetBvhStats(stats) {
    if (stats !== undefined) {
        stats.visitedNodeCount = 0;
        stats.testedPrimitiveCount = 0;
    }
}
function incrementVisitedNodeCount(stats) {
    if (stats !== undefined) {
        stats.visitedNodeCount += 1;
    }
}
function incrementTestedPrimitiveCount(stats) {
    if (stats !== undefined) {
        stats.testedPrimitiveCount += 1;
    }
}
function normalizeShapeIntersection(value) {
    if (value === true) {
        return "intersected";
    }
    if (value === false) {
        return "not-intersected";
    }
    return value;
}
function unsupportedInputDiagnostics(input) {
    const diagnostics = [];
    if (input.unsupportedTopology === true) {
        diagnostics.push({
            code: "spatial.mesh-bvh.unsupported-topology",
            severity: "error",
            message: `Mesh '${input.meshKey}' uses topology that the mesh BVH cannot query exactly.`,
            suggestedFix: "Use triangle-list CPU mesh data or provide a supported simplified query mesh.",
            data: { meshKey: input.meshKey },
        });
    }
    if (input.unsupportedSkinned === true) {
        diagnostics.push({
            code: "spatial.mesh-bvh.unsupported-skinned",
            severity: "warning",
            message: `Mesh '${input.meshKey}' is skinned; exact deformed BVH queries are not active for this asset.`,
            suggestedFix: "Use bounds or a simplified query mesh until skinned/refit query support is enabled.",
            data: { meshKey: input.meshKey },
        });
    }
    if (input.unsupportedMorphed === true) {
        diagnostics.push({
            code: "spatial.mesh-bvh.unsupported-morphed",
            severity: "warning",
            message: `Mesh '${input.meshKey}' is morphed; exact deformed BVH queries are not active for this asset.`,
            suggestedFix: "Use bounds, a simplified query mesh, or rebuild/refit after applying morph deltas.",
            data: { meshKey: input.meshKey },
        });
    }
    return diagnostics;
}
function performanceNow() {
    return globalThis.performance?.now() ?? Date.now();
}
function createTriangleView(mesh, triangle) {
    const a = readPosition(mesh, triangle.v0);
    const b = readPosition(mesh, triangle.v1);
    const c = readPosition(mesh, triangle.v2);
    const uvA = readUv(mesh, triangle.v0);
    const uvB = readUv(mesh, triangle.v1);
    const uvC = readUv(mesh, triangle.v2);
    return {
        a,
        b,
        c,
        normal: normalize(cross(subtract(b, a), subtract(c, a))),
        ...(uvA === null ? {} : { uvA }),
        ...(uvB === null ? {} : { uvB }),
        ...(uvC === null ? {} : { uvC }),
        faceIndex: triangle.faceIndex,
        submeshIndex: triangle.submeshIndex,
        materialSlot: triangle.materialSlot,
    };
}
function createTriangleHitScratch() {
    return {
        distance: Number.POSITIVE_INFINITY,
        point: vec3(),
        normal: vec3(),
        barycentric: vec3(),
    };
}
function aabbIntersectsSphere(aabb, sphere) {
    return (distanceSqPointToAabb(sphere.center, aabb) <=
        sphere.radius * sphere.radius + EPSILON);
}
function sphereContainsAabb(sphere, aabb) {
    const radiusSq = sphere.radius * sphere.radius;
    for (const corner of aabbCorners(aabb)) {
        if (distanceSq(corner, sphere.center) > radiusSq + EPSILON) {
            return false;
        }
    }
    return true;
}
function aabbIntersectsAabb(a, b) {
    return (v3(a.min, 0) <= v3(b.max, 0) &&
        v3(a.max, 0) >= v3(b.min, 0) &&
        v3(a.min, 1) <= v3(b.max, 1) &&
        v3(a.max, 1) >= v3(b.min, 1) &&
        v3(a.min, 2) <= v3(b.max, 2) &&
        v3(a.max, 2) >= v3(b.min, 2));
}
function aabbContainsAabb(outer, inner) {
    return (v3(outer.min, 0) <= v3(inner.min, 0) &&
        v3(outer.min, 1) <= v3(inner.min, 1) &&
        v3(outer.min, 2) <= v3(inner.min, 2) &&
        v3(outer.max, 0) >= v3(inner.max, 0) &&
        v3(outer.max, 1) >= v3(inner.max, 1) &&
        v3(outer.max, 2) >= v3(inner.max, 2));
}
function expandAabb(aabb, amount) {
    return {
        min: vec3(v3(aabb.min, 0) - amount, v3(aabb.min, 1) - amount, v3(aabb.min, 2) - amount),
        max: vec3(v3(aabb.max, 0) + amount, v3(aabb.max, 1) + amount, v3(aabb.max, 2) + amount),
    };
}
function segmentIntersectsAabb(start, end, aabb) {
    const direction = subtract(end, start);
    let tmin = 0;
    let tmax = 1;
    for (let axis = 0; axis < 3; axis += 1) {
        const origin = v3(start, axis);
        const delta = v3(direction, axis);
        const min = v3(aabb.min, axis);
        const max = v3(aabb.max, axis);
        if (Math.abs(delta) <= EPSILON) {
            if (origin < min || origin > max) {
                return false;
            }
            continue;
        }
        const inverseDelta = 1 / delta;
        let near = (min - origin) * inverseDelta;
        let far = (max - origin) * inverseDelta;
        if (near > far) {
            const swap = near;
            near = far;
            far = swap;
        }
        tmin = Math.max(tmin, near);
        tmax = Math.min(tmax, far);
        if (tmin > tmax) {
            return false;
        }
    }
    return true;
}
function classifyAabbAgainstFrustum(aabb, frustum) {
    let fullyInside = true;
    for (const plane of frustum.planes) {
        let insideCount = 0;
        for (const corner of aabbCorners(aabb)) {
            if (planeDistance(plane.normal, plane.constant, corner) >= 0) {
                insideCount += 1;
            }
        }
        if (insideCount === 0) {
            return "outside";
        }
        if (insideCount < 8) {
            fullyInside = false;
        }
    }
    return fullyInside ? "inside" : "intersecting";
}
function pointInFrustum(point, frustum) {
    return frustum.planes.every((plane) => planeDistance(plane.normal, plane.constant, point) >= 0);
}
function planeDistance(normal, constant, point) {
    return dot(normal, point) + constant;
}
function aabbCorners(aabb) {
    const minX = v3(aabb.min, 0);
    const minY = v3(aabb.min, 1);
    const minZ = v3(aabb.min, 2);
    const maxX = v3(aabb.max, 0);
    const maxY = v3(aabb.max, 1);
    const maxZ = v3(aabb.max, 2);
    return [
        vec3(minX, minY, minZ),
        vec3(maxX, minY, minZ),
        vec3(minX, maxY, minZ),
        vec3(maxX, maxY, minZ),
        vec3(minX, minY, maxZ),
        vec3(maxX, minY, maxZ),
        vec3(minX, maxY, maxZ),
        vec3(maxX, maxY, maxZ),
    ];
}
function closestPointOnTriangle(point, a, b, c) {
    const ab = subtract(b, a);
    const ac = subtract(c, a);
    const ap = subtract(point, a);
    const d1 = dot(ab, ap);
    const d2 = dot(ac, ap);
    if (d1 <= 0 && d2 <= 0) {
        return vec3(v3(a, 0), v3(a, 1), v3(a, 2));
    }
    const bp = subtract(point, b);
    const d3 = dot(ab, bp);
    const d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) {
        return vec3(v3(b, 0), v3(b, 1), v3(b, 2));
    }
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        // d1 - d3 === |ab|²; it is zero only for a degenerate (a === b) triangle,
        // where dividing would produce NaN. Fall through so the AC/BC regions
        // below resolve the query against the surviving edges.
        const div = d1 - d3;
        if (div > 0) {
            return addScaled(a, ab, d1 / div);
        }
    }
    const cp = subtract(point, c);
    const d5 = dot(ab, cp);
    const d6 = dot(ac, cp);
    if (d6 >= 0 && d5 <= d6) {
        return vec3(v3(c, 0), v3(c, 1), v3(c, 2));
    }
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
        // d2 - d6 === |ac|²; zero only when a === c. Fall through on degeneracy.
        const div = d2 - d6;
        if (div > 0) {
            return addScaled(a, ac, d2 / div);
        }
    }
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
        // (d4 - d3) + (d5 - d6) === |bc|²; zero only when b === c. Fall through
        // on degeneracy so the interior fallback below resolves against AB.
        const div = d4 - d3 + (d5 - d6);
        if (div > 0) {
            return addScaled(b, subtract(c, b), (d4 - d3) / div);
        }
    }
    const sum = va + vb + vc;
    if (sum <= 0) {
        // va + vb + vc is proportional to the squared triangle area, so only
        // zero-area triangles (collinear vertices, or a degenerate edge deferred
        // by the region checks above) reach this point with sum === 0. Dividing
        // would produce NaN; clamp to the nearest point on edge AB so callers
        // always receive a finite point on the degenerate triangle.
        const div = d1 - d3;
        const v = div > 0 ? Math.min(1, Math.max(0, d1 / div)) : 0;
        return addScaled(a, ab, v);
    }
    const denom = 1 / sum;
    const v = vb * denom;
    const w = vc * denom;
    return vec3(v3(a, 0) + v3(ab, 0) * v + v3(ac, 0) * w, v3(a, 1) + v3(ab, 1) * v + v3(ac, 1) * w, v3(a, 2) + v3(ab, 2) * v + v3(ac, 2) * w);
}
function closestPointSegmentToTriangle(start, end, a, b, c) {
    let bestPoint = closestPointOnTriangle(start, a, b, c);
    let bestDistanceSq = distanceSq(start, bestPoint);
    const endPoint = closestPointOnTriangle(end, a, b, c);
    const endDistanceSq = distanceSq(end, endPoint);
    if (endDistanceSq < bestDistanceSq) {
        bestPoint = endPoint;
        bestDistanceSq = endDistanceSq;
    }
    for (const [edgeStart, edgeEnd] of [
        [a, b],
        [b, c],
        [c, a],
    ]) {
        const closest = closestPointSegmentToSegment(start, end, edgeStart, edgeEnd);
        if (closest.distanceSq < bestDistanceSq) {
            bestDistanceSq = closest.distanceSq;
            bestPoint = closest.pointB;
        }
    }
    return { pointOnTriangle: bestPoint, distanceSq: bestDistanceSq };
}
function closestPointSegmentToSegment(p1, q1, p2, q2) {
    const d1 = subtract(q1, p1);
    const d2 = subtract(q2, p2);
    const r = subtract(p1, p2);
    const a = dot(d1, d1);
    const e = dot(d2, d2);
    const f = dot(d2, r);
    let s = 0;
    let t = 0;
    if (a <= EPSILON && e <= EPSILON) {
        return {
            pointA: vec3(v3(p1, 0), v3(p1, 1), v3(p1, 2)),
            pointB: vec3(v3(p2, 0), v3(p2, 1), v3(p2, 2)),
            distanceSq: distanceSq(p1, p2),
        };
    }
    if (a <= EPSILON) {
        t = clamp01(f / e);
    }
    else {
        const c = dot(d1, r);
        if (e <= EPSILON) {
            s = clamp01(-c / a);
        }
        else {
            const b = dot(d1, d2);
            const denom = a * e - b * b;
            s = denom === 0 ? 0 : clamp01((b * f - c * e) / denom);
            t = (b * s + f) / e;
            if (t < 0) {
                t = 0;
                s = clamp01(-c / a);
            }
            else if (t > 1) {
                t = 1;
                s = clamp01((b - c) / a);
            }
        }
    }
    const pointA = addScaled(p1, d1, s);
    const pointB = addScaled(p2, d2, t);
    return { pointA, pointB, distanceSq: distanceSq(pointA, pointB) };
}
function distanceSqSegmentToTriangle(start, end, a, b, c) {
    return closestPointSegmentToTriangle(start, end, a, b, c).distanceSq;
}
function distanceSqPointToTriangle(point, a, b, c) {
    return distanceSq(point, closestPointOnTriangle(point, a, b, c));
}
function distanceSqPointToAabb(point, aabb) {
    let result = 0;
    for (let axis = 0; axis < 3; axis += 1) {
        const value = v3(point, axis);
        const min = v3(aabb.min, axis);
        const max = v3(aabb.max, axis);
        const delta = value < min ? min - value : value > max ? value - max : 0;
        result += delta * delta;
    }
    return result;
}
function addScaled(a, b, scale) {
    return vec3(v3(a, 0) + v3(b, 0) * scale, v3(a, 1) + v3(b, 1) * scale, v3(a, 2) + v3(b, 2) * scale);
}
function subtract(a, b) {
    return vec3(v3(a, 0) - v3(b, 0), v3(a, 1) - v3(b, 1), v3(a, 2) - v3(b, 2));
}
function cross(a, b) {
    return vec3(v3(a, 1) * v3(b, 2) - v3(a, 2) * v3(b, 1), v3(a, 2) * v3(b, 0) - v3(a, 0) * v3(b, 2), v3(a, 0) * v3(b, 1) - v3(a, 1) * v3(b, 0));
}
function dot(a, b) {
    return v3(a, 0) * v3(b, 0) + v3(a, 1) * v3(b, 1) + v3(a, 2) * v3(b, 2);
}
function normalize(value) {
    const length = Math.hypot(v3(value, 0), v3(value, 1), v3(value, 2));
    if (length <= EPSILON || !Number.isFinite(length)) {
        return vec3();
    }
    return vec3(v3(value, 0) / length, v3(value, 1) / length, v3(value, 2) / length);
}
function distanceSq(a, b) {
    const dx = v3(a, 0) - v3(b, 0);
    const dy = v3(a, 1) - v3(b, 1);
    const dz = v3(a, 2) - v3(b, 2);
    return dx * dx + dy * dy + dz * dz;
}
function clamp01(value) {
    return Math.min(1, Math.max(0, value));
}
//# sourceMappingURL=mesh-bvh.js.map