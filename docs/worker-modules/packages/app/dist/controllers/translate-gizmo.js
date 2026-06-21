import { LocalTransform, Parent, WorldTransform, composeTrsMatrix, decomposeTrsMatrix, identityMat4, invertMat4, multiplyMat4, transformVector, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { Pickable, createPickable } from "/aperture/worker-modules/packages/render/dist/index.js";
import { resolveActiveEntity } from "../entities/lookup/resolve.js";
import { material, mesh } from "../systems/spawn/descriptors.js";
// M7-T9: a reusable translate gizmo built entirely from ECS entities (no renderer
// overlay). It spawns 3 axis-handle Pickable meshes parented to the selected
// entity (world-preserving setParent, M7-T1) so the handles track the target; on
// drag of a handle (M7-T8) it projects the pointer ray onto the handle's WORLD
// axis and writes the target's LocalTransform translation along that axis only.
// Handles sit on a separate Pickable layer + carry a tag so callers can exclude
// them from normal scene picking. The axis projection is guarded against the
// degenerate case where the camera looks nearly straight down the axis (the
// ray/axis become parallel and the closest-point is ill-conditioned).
// Headless/worker-safe: pure math + ECS writes, no DOM.
const DEFAULT_SIZE = 2;
const DEFAULT_THICKNESS = 0.3;
const DEFAULT_LAYER_MASK = 2;
const DEFAULT_TAG = "gizmo";
const PARALLEL_EPSILON = 1e-4;
const AXES = [
    { name: "x", axis: [1, 0, 0], color: [0.9, 0.2, 0.2, 1] },
    { name: "y", axis: [0, 1, 0], color: [0.2, 0.85, 0.3, 1] },
    { name: "z", axis: [0.0, 0, 1], color: [0.25, 0.45, 1, 1] },
];
export function createTranslateGizmo(context, options) {
    const target = options.target;
    const size = options.size ?? DEFAULT_SIZE;
    const thickness = options.thickness ?? DEFAULT_THICKNESS;
    const layerMask = options.layerMask ?? DEFAULT_LAYER_MASK;
    const tag = options.tag ?? DEFAULT_TAG;
    const unsubscribes = [];
    const handleRefs = {};
    let active = null;
    for (const spec of AXES) {
        const half = size / 2;
        const handleSize = [
            spec.axis[0] !== 0 ? size : thickness,
            spec.axis[1] !== 0 ? size : thickness,
            spec.axis[2] !== 0 ? size : thickness,
        ];
        const offset = [
            spec.axis[0] * half,
            spec.axis[1] * half,
            spec.axis[2] * half,
        ];
        const handle = context.spawn.mesh({
            key: `gizmo.translate.${spec.name}`,
            name: `TranslateHandle${spec.name.toUpperCase()}`,
            tags: [tag],
            mesh: mesh.box({ size: handleSize }),
            material: material.standard({ baseColor: spec.color, roughness: 0.5 }),
            transform: { translation: offset },
        });
        handle.addComponent(Pickable, createPickable({ enabled: true, layerMask }));
        const handleRef = {
            index: handle.index,
            generation: handle.generation,
        };
        handleRefs[spec.name] = handleRef;
        // Parent to the target (world-preserving), then pin the handle's local offset
        // so it sits on the target's axis regardless of the target's world position.
        context.hierarchy.setParent(handleRef, target);
        handle.getVectorView(LocalTransform, "translation").set(offset);
        const axis = spec.axis;
        unsubscribes.push(context.interaction.onDrag(handleRef, (event) => {
            handleDrag(context, target, axis, event, {
                get: () => active,
                set: (next) => {
                    active = next;
                },
            });
        }));
    }
    const half = size / 2;
    return {
        target,
        handles: {
            x: handleRefs.x,
            y: handleRefs.y,
            z: handleRefs.z,
        },
        sync(world) {
            const resolvedTarget = resolveActiveEntity(world, target);
            if (!resolvedTarget.ok ||
                !resolvedTarget.entity.hasComponent(WorldTransform)) {
                return;
            }
            const targetWorld = readWorldMatrix(resolvedTarget.entity);
            const inverseTargetWorld = invertMat4(targetWorld);
            if (inverseTargetWorld === null) {
                return;
            }
            const col3 = resolvedTarget.entity.getVectorView(WorldTransform, "col3");
            for (const spec of AXES) {
                const ref = handleRefs[spec.name];
                if (ref === undefined) {
                    continue;
                }
                const resolvedHandle = resolveActiveEntity(world, ref);
                if (!resolvedHandle.ok ||
                    !resolvedHandle.entity.hasComponent(LocalTransform)) {
                    continue;
                }
                // Desired WORLD placement: at the target's world position + a world-axis
                // offset, world-axis-aligned (identity rotation, unit scale). Because the
                // handle is a child of the target, its required local transform is
                // inverse(targetWorld) * desiredWorld.
                const desiredWorld = composeTrsMatrix([
                    (col3[0] ?? 0) + spec.axis[0] * half,
                    (col3[1] ?? 0) + spec.axis[1] * half,
                    (col3[2] ?? 0) + spec.axis[2] * half,
                ], [0, 0, 0, 1], [1, 1, 1]);
                const handleLocal = decomposeTrsMatrix(multiplyMat4(inverseTargetWorld, desiredWorld));
                if (handleLocal === null) {
                    continue;
                }
                const entity = resolvedHandle.entity;
                entity
                    .getVectorView(LocalTransform, "translation")
                    .set(handleLocal.translation);
                entity
                    .getVectorView(LocalTransform, "rotation")
                    .set(handleLocal.rotation);
                entity.getVectorView(LocalTransform, "scale").set(handleLocal.scale);
            }
        },
        dispose() {
            for (const unsubscribe of unsubscribes) {
                unsubscribe();
            }
            for (const ref of [handleRefs.x, handleRefs.y, handleRefs.z]) {
                if (ref === undefined) {
                    continue;
                }
                const resolved = resolveActiveEntity(context.world, ref);
                if (resolved.ok) {
                    resolved.entity.destroy();
                }
            }
        },
    };
}
function handleDrag(context, target, axis, event, slot) {
    if (event.type === "dragStart") {
        const resolved = resolveActiveEntity(context.world, target);
        if (!resolved.ok) {
            return;
        }
        const anchor = worldTranslation(resolved.entity);
        const startTranslation = localTranslation(resolved.entity);
        const ray = context.cameras.main.rayFromPointer(event.position);
        const startParam = closestAxisParam(anchor, axis, ray.origin, ray.direction);
        slot.set({ axis, anchor, startTranslation, startParam });
        return;
    }
    if (event.type === "dragEnd") {
        slot.set(null);
        return;
    }
    if (event.type !== "drag") {
        return;
    }
    const state = slot.get();
    if (state === null) {
        return;
    }
    const ray = context.cameras.main.rayFromPointer(event.position);
    const param = closestAxisParam(state.anchor, state.axis, ray.origin, ray.direction);
    if (param === null) {
        // Degenerate this frame (ray ~parallel to the axis) — skip the update.
        return;
    }
    if (state.startParam === null) {
        state.startParam = param;
        return;
    }
    const delta = param - state.startParam;
    const worldDelta = [
        state.axis[0] * delta,
        state.axis[1] * delta,
        state.axis[2] * delta,
    ];
    const resolved = resolveActiveEntity(context.world, target);
    if (!resolved.ok || !resolved.entity.hasComponent(LocalTransform)) {
        return;
    }
    // The drag delta is in WORLD space; LocalTransform.translation lives in the
    // target's PARENT space. Convert the world delta through the parent's inverse so
    // a parented (rotated/scaled) target still moves along the intended world axis.
    const localDelta = worldDeltaToParentLocal(resolved.entity, worldDelta);
    const next = [
        state.startTranslation[0] + localDelta[0],
        state.startTranslation[1] + localDelta[1],
        state.startTranslation[2] + localDelta[2],
    ];
    resolved.entity.getVectorView(LocalTransform, "translation").set(next);
}
function readWorldMatrix(entity) {
    const matrix = identityMat4();
    matrix.set(entity.getVectorView(WorldTransform, "col0"), 0);
    matrix.set(entity.getVectorView(WorldTransform, "col1"), 4);
    matrix.set(entity.getVectorView(WorldTransform, "col2"), 8);
    matrix.set(entity.getVectorView(WorldTransform, "col3"), 12);
    return matrix;
}
function resolveParent(entity) {
    if (!entity.hasComponent(Parent)) {
        return null;
    }
    const parent = entity.getValue(Parent, "entity");
    return parent === null || parent === undefined ? null : parent;
}
function worldDeltaToParentLocal(entity, worldDelta) {
    const parent = resolveParent(entity);
    if (parent === null || !parent.hasComponent(WorldTransform)) {
        return [worldDelta[0], worldDelta[1], worldDelta[2]];
    }
    const inverseParentWorld = invertMat4(readWorldMatrix(parent));
    if (inverseParentWorld === null) {
        return [worldDelta[0], worldDelta[1], worldDelta[2]];
    }
    const local = transformVector(inverseParentWorld, worldDelta);
    return [local[0] ?? 0, local[1] ?? 0, local[2] ?? 0];
}
/**
 * Parameter `t` of the point `anchor + t·axis` closest to the ray. Returns null
 * when the ray is nearly parallel to the axis (degenerate projection).
 */
function closestAxisParam(anchor, axis, origin, direction) {
    const o = [
        read(origin, 0),
        read(origin, 1),
        read(origin, 2),
    ];
    const dRaw = [
        read(direction, 0),
        read(direction, 1),
        read(direction, 2),
    ];
    const dLen = Math.hypot(dRaw[0], dRaw[1], dRaw[2]);
    if (dLen <= 1e-9) {
        return null;
    }
    const d = [
        dRaw[0] / dLen,
        dRaw[1] / dLen,
        dRaw[2] / dLen,
    ];
    const b = axis[0] * d[0] + axis[1] * d[1] + axis[2] * d[2]; // axis·d (axis is unit)
    const denom = 1 - b * b;
    if (denom < PARALLEL_EPSILON) {
        return null;
    }
    const w0 = [
        anchor[0] - o[0],
        anchor[1] - o[1],
        anchor[2] - o[2],
    ];
    const dCoeff = axis[0] * w0[0] + axis[1] * w0[1] + axis[2] * w0[2]; // axis·w0
    const eCoeff = d[0] * w0[0] + d[1] * w0[1] + d[2] * w0[2]; // d·w0
    return (b * eCoeff - dCoeff) / denom;
}
function worldTranslation(entity) {
    const col3 = entity.getVectorView(WorldTransform, "col3");
    return [col3[0] ?? 0, col3[1] ?? 0, col3[2] ?? 0];
}
function localTranslation(entity) {
    const t = entity.getVectorView(LocalTransform, "translation");
    return [t[0] ?? 0, t[1] ?? 0, t[2] ?? 0];
}
function read(values, index) {
    const value = values[index];
    if (value === undefined) {
        throw new RangeError(`Expected numeric value at index ${index}.`);
    }
    return value;
}
//# sourceMappingURL=translate-gizmo.js.map