import { raycastBoundsHit, raycastBoundsHits } from "./bounds.js";
import { closestPointOnMeshes } from "./closest.js";
import { raycastColliderHit, raycastColliderHits, } from "./collider.js";
import { raycastMeshHit, raycastMeshHits } from "./mesh.js";
import { overlapBoxOnMeshes, overlapCapsuleOnMeshes, overlapSphereOnMeshes, } from "./overlap.js";
// PERF NOTE (audit B3): the bounds query uses a correct O(n) linear ray-AABB scan
// (raycastBoundsHit/Hits). The exported simulation `EntityBoundsBvh` accelerator is
// available for multi-pick / very-large-scene workloads, but it is intentionally NOT
// wired into this default per-frame picker: the dominant path casts a single ray per
// populated frame, where building/refitting the BVH (O(n) refit + O(log n) query) is
// no cheaper than the linear O(n) scan, and a per-frame rebuild would regress it.
// Wiring it for multi-pick batches requires membership-diffed refit — tracked as a
// perf follow-up rather than a default change here.
export function createSpatialQueries(setup = {}) {
    let bounds = [];
    let meshes = [];
    return {
        raycastFirst(ray, options = {}) {
            const source = options.source ?? "bounds";
            if (source === "bounds") {
                return raycastBoundsHit(bounds, ray, options);
            }
            if (source === "collider") {
                const colliderHit = raycastColliderHit(setup.colliders, ray, options);
                if (colliderHit !== null || options.fallback !== "bounds") {
                    return colliderHit;
                }
                return options.fallback === "bounds"
                    ? raycastBoundsHit(bounds, ray, options)
                    : null;
            }
            const meshResult = raycastMeshHit(meshes, ray, options);
            if (meshResult.hit !== null || options.fallback !== "bounds") {
                return meshResult.hit;
            }
            return meshResult.queryableMeshCount === 0
                ? raycastBoundsHit(bounds, ray, options)
                : null;
        },
        raycastAll(ray, options = {}) {
            const source = options.source ?? "bounds";
            if (source === "bounds") {
                return raycastBoundsHits(bounds, ray, options);
            }
            if (source === "collider") {
                const colliderHits = raycastColliderHits(setup.colliders, ray, options);
                if (colliderHits.length > 0 || options.fallback !== "bounds") {
                    return colliderHits;
                }
                return options.fallback === "bounds"
                    ? raycastBoundsHits(bounds, ray, options)
                    : [];
            }
            const meshResult = raycastMeshHits(meshes, ray, options);
            if (meshResult.hits.length > 0 || options.fallback !== "bounds") {
                return meshResult.hits;
            }
            return meshResult.queryableMeshCount === 0
                ? raycastBoundsHits(bounds, ray, options)
                : [];
        },
        closestPoint(point, options = {}) {
            return closestPointOnMeshes(meshes, point, options).hit;
        },
        overlapSphere(center, radius, options = {}) {
            return overlapSphereOnMeshes(meshes, center, radius, options);
        },
        overlapBox(min, max, options = {}) {
            return overlapBoxOnMeshes(meshes, min, max, options);
        },
        overlapCapsule(start, end, radius, options = {}) {
            return overlapCapsuleOnMeshes(meshes, start, end, radius, options);
        },
        setBounds(nextBounds) {
            bounds = [...nextBounds];
        },
        setMeshes(nextMeshes) {
            meshes = [...nextMeshes];
        },
    };
}
//# sourceMappingURL=index.js.map