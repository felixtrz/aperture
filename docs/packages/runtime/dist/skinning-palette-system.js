import { WorldTransform, identityMat4, invertMat4, mat4, multiplyMat4, } from "@aperture-engine/simulation";
import { Skin } from "@aperture-engine/render";
/**
 * Joint-palette compute: derive each skinned entity's typed palette from
 * resolved world transforms + inverse-bind matrices. Extracted from the
 * glb-viewer worker `updateSkinningPalettesFromWorld`
 * (examples/glb-viewer.worker.js:4407):
 *
 *   palette_i = inverse(meshWorld) * jointWorld_i * inverseBind_i
 *
 * The result is written in place into `Skin.jointMatrices` (the typed buffer
 * from M2-T5) — no JSON, no reallocation. It MUST run after world-transform
 * resolution so joint worlds are same-frame, and before extraction; the
 * runtime `step()` invokes it imperatively right after `resolveWorldTransforms`
 * for exactly this ordering.
 *
 * Manual skins (a precomputed palette and no `skeleton`) are left untouched.
 */
const MATRIX_FLOATS = 16;
function readWorldMatrix(entity, out) {
    out.set(entity.getVectorView(WorldTransform, "col0"), 0);
    out.set(entity.getVectorView(WorldTransform, "col1"), 4);
    out.set(entity.getVectorView(WorldTransform, "col2"), 8);
    out.set(entity.getVectorView(WorldTransform, "col3"), 12);
    return out;
}
function writeIdentityBlock(palette, offset) {
    palette.fill(0, offset, offset + MATRIX_FLOATS);
    palette[offset] = 1;
    palette[offset + 5] = 1;
    palette[offset + 10] = 1;
    palette[offset + 15] = 1;
}
/**
 * Recompute joint palettes for every skinned entity in `world`. Returns the
 * number of skeletons updated. Safe to call on worlds with no skins.
 */
export function updateSkeletonPalettes(world) {
    const query = world.queryManager.registerQuery({ required: [Skin] });
    // Per-call scratch matrices (allocation-light across many joints/entities).
    const meshWorld = mat4();
    const jointWorld = identityMat4();
    const inverseScratch = mat4();
    const jointLocal = mat4();
    const result = mat4();
    let updated = 0;
    for (const entity of query.entities) {
        const skeleton = entity.getValue(Skin, "skeleton");
        const palette = entity.getValue(Skin, "jointMatrices");
        // Only imported skeletons drive the palette; manual skins keep their
        // authored palette.
        if (skeleton === null ||
            skeleton === undefined ||
            !(palette instanceof Float32Array) ||
            !entity.hasComponent(WorldTransform)) {
            continue;
        }
        readWorldMatrix(entity, meshWorld);
        const inverseMeshWorld = invertMat4(meshWorld, inverseScratch);
        const joints = skeleton.joints;
        for (let index = 0; index < joints.length; index += 1) {
            const offset = index * MATRIX_FLOATS;
            if (offset + MATRIX_FLOATS > palette.length) {
                break;
            }
            const joint = joints[index];
            // Degenerate mesh world or a joint without a resolved world transform
            // falls back to identity (mirrors the worker).
            if (inverseMeshWorld === null ||
                joint === undefined ||
                !joint.hasComponent(WorldTransform)) {
                writeIdentityBlock(palette, offset);
                continue;
            }
            readWorldMatrix(joint, jointWorld);
            multiplyMat4(inverseMeshWorld, jointWorld, jointLocal);
            const inverseBind = skeleton.inverseBindMatrices.subarray(offset, offset + MATRIX_FLOATS);
            multiplyMat4(jointLocal, inverseBind, result);
            palette.set(result, offset);
        }
        updated += 1;
    }
    return updated;
}
//# sourceMappingURL=skinning-palette-system.js.map