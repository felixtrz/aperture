import { composeTrsMatrix, multiplyMat4, } from "@aperture-engine/math";
import { LocalTransform, Parent, WorldTransform, registerTransformComponents, } from "./components.js";
export function resolveWorldTransforms(world) {
    registerTransformComponents(world);
    const query = world.queryManager.registerQuery({
        required: [LocalTransform, WorldTransform],
    });
    const entities = [...query.entities].sort(compareEntities);
    const transformEntities = new Set(entities);
    const visiting = new Set();
    const invalid = new Set();
    const worldMatrices = new Map();
    const diagnostics = [];
    let resolved = 0;
    for (const entity of entities) {
        if (resolveEntity(entity, []) !== null) {
            resolved += 1;
        }
    }
    return {
        resolved,
        skipped: entities.length - resolved,
        diagnostics,
    };
    function resolveEntity(entity, stack) {
        if (invalid.has(entity)) {
            return null;
        }
        const existing = worldMatrices.get(entity);
        if (existing !== undefined) {
            return existing;
        }
        if (visiting.has(entity)) {
            diagnoseCycle(entity, stack);
            return null;
        }
        visiting.add(entity);
        const nextStack = [...stack, entity];
        const localMatrix = readLocalMatrix(entity);
        const parent = readParent(entity, diagnostics);
        let matrix = localMatrix;
        if (parent !== null) {
            if (!transformEntities.has(parent)) {
                diagnostics.push({
                    code: "missing-parent-transform",
                    entity: entity.index,
                    generation: entity.generation,
                    parent: parent.index,
                    parentGeneration: parent.generation,
                    message: "Parent entity is active but does not have LocalTransform and WorldTransform; resolved child as a root for this pass.",
                });
            }
            else {
                const parentWorld = resolveEntity(parent, nextStack);
                if (parentWorld === null) {
                    invalid.add(entity);
                    diagnostics.push({
                        code: "parent-unresolved",
                        entity: entity.index,
                        generation: entity.generation,
                        parent: parent.index,
                        parentGeneration: parent.generation,
                        message: "Parent world transform could not be resolved; skipped this entity for this pass.",
                    });
                    visiting.delete(entity);
                    return null;
                }
                matrix = multiplyMat4(parentWorld, localMatrix);
            }
        }
        writeWorldTransform(world, entity, matrix);
        worldMatrices.set(entity, matrix);
        visiting.delete(entity);
        return matrix;
    }
    function diagnoseCycle(entity, stack) {
        const cycleStart = stack.findIndex((candidate) => candidate === entity);
        const cycleEntities = cycleStart >= 0 ? stack.slice(cycleStart) : [entity];
        const cyclePath = [...cycleEntities, entity].map(entityKey);
        for (const cycleEntity of cycleEntities) {
            invalid.add(cycleEntity);
            diagnostics.push({
                code: "cycle",
                entity: cycleEntity.index,
                generation: cycleEntity.generation,
                cycle: cyclePath,
                message: "Transform parent cycle detected; skipped cycle members for this pass.",
            });
        }
    }
}
function readLocalMatrix(entity) {
    return composeTrsMatrix(entity.getVectorView(LocalTransform, "translation"), entity.getVectorView(LocalTransform, "rotation"), entity.getVectorView(LocalTransform, "scale"));
}
function readParent(entity, diagnostics) {
    if (!entity.hasComponent(Parent)) {
        return null;
    }
    const parent = entity.getValue(Parent, "entity");
    if (parent !== null) {
        return parent;
    }
    const packedParent = readPackedParent(entity);
    if (packedParent !== -1) {
        diagnostics.push({
            code: "stale-parent",
            entity: entity.index,
            generation: entity.generation,
            message: "Parent reference no longer resolves, likely because the parent was destroyed; resolved entity as a root for this pass.",
        });
    }
    return null;
}
function readPackedParent(entity) {
    const parentData = Parent.data.entity;
    const packed = parentData[entity.index];
    if (packed === undefined) {
        return -1;
    }
    return packed;
}
function writeWorldTransform(world, entity, matrix) {
    const col0Changed = writeColumn(entity.getVectorView(WorldTransform, "col0"), matrix, 0);
    const col1Changed = writeColumn(entity.getVectorView(WorldTransform, "col1"), matrix, 1);
    const col2Changed = writeColumn(entity.getVectorView(WorldTransform, "col2"), matrix, 2);
    const col3Changed = writeColumn(entity.getVectorView(WorldTransform, "col3"), matrix, 3);
    const changed = col0Changed || col1Changed || col2Changed || col3Changed;
    if (changed) {
        // Matrix-only output change (AI-67): bump the transform version so render
        // extraction can refresh the cached packet's transform + bounds without a
        // structural rebuild.
        world.markEntityTransformChanged(entity);
    }
}
function writeColumn(out, matrix, column) {
    const offset = column * 4;
    const next0 = read(matrix, offset);
    const next1 = read(matrix, offset + 1);
    const next2 = read(matrix, offset + 2);
    const next3 = read(matrix, offset + 3);
    if (out[0] === next0 &&
        out[1] === next1 &&
        out[2] === next2 &&
        out[3] === next3) {
        return false;
    }
    out[0] = next0;
    out[1] = next1;
    out[2] = next2;
    out[3] = next3;
    return true;
}
function read(values, index) {
    const value = values[index];
    if (value === undefined) {
        throw new RangeError(`Expected numeric value at index ${index}.`);
    }
    return value;
}
function compareEntities(a, b) {
    return a.index - b.index || a.generation - b.generation;
}
function entityKey(entity) {
    return `${entity.index}:${entity.generation}`;
}
//# sourceMappingURL=resolution.js.map