import { LocalTransform, Parent, WorldTransform, composeTrsMatrix, invertMat4, multiplyMat4, } from "@aperture-engine/simulation";
import { slerpQuat } from "@aperture-engine/physics";
import { RenderInterpolation } from "./systems/components.js";
import { rewriteInterpolatedPacketBounds } from "./snapshot-interpolation-bounds.js";
export const RENDER_INTERPOLATION_PRE_PRIORITY = -1_000_000_000;
export const RENDER_INTERPOLATION_POST_PRIORITY = 1_000_000_000;
export function installRenderInterpolationFixedStep(options) {
    const unregisterPrepare = options.registerFixedStepTask(() => prepareRenderInterpolationFixedStep(options.world), { priority: RENDER_INTERPOLATION_PRE_PRIORITY });
    const unregisterCommit = options.registerFixedStepTask(() => commitRenderInterpolationFixedStep(options.world), { priority: RENDER_INTERPOLATION_POST_PRIORITY });
    return () => {
        unregisterPrepare();
        unregisterCommit();
    };
}
export function prepareRenderInterpolationFixedStep(world) {
    for (const entity of renderInterpolationEntities(world)) {
        if (!renderInterpolationEnabled(entity)) {
            continue;
        }
        if (entity.getValue(RenderInterpolation, "initialized") === true) {
            copyVectorField(entity, "currentTranslation", "previousTranslation");
            copyVectorField(entity, "currentRotation", "previousRotation");
            copyVectorField(entity, "currentScale", "previousScale");
        }
        else {
            copyLocalToInterpolation(entity, "previous");
            copyLocalToInterpolation(entity, "current");
            entity.setValue(RenderInterpolation, "initialized", true);
        }
    }
}
export function commitRenderInterpolationFixedStep(world) {
    for (const entity of renderInterpolationEntities(world)) {
        if (!renderInterpolationEnabled(entity)) {
            continue;
        }
        if (entity.getValue(RenderInterpolation, "initialized") !== true) {
            copyLocalToInterpolation(entity, "previous");
            entity.setValue(RenderInterpolation, "initialized", true);
        }
        copyLocalToInterpolation(entity, "current");
    }
}
export function applyRenderSnapshotInterpolation(options) {
    const alpha = clampAlpha(options.alpha);
    const matrixCache = new Map();
    const affectedCache = new Map();
    const writtenOffsets = new Set();
    const writtenBounds = new Set();
    const affectedVisiting = new Set();
    const matrixVisiting = new Set();
    let transformWrites = 0;
    let boundsWrites = 0;
    let viewWrites = 0;
    for (const draw of options.snapshot.meshDraws) {
        const writes = writeInterpolatedPacketTransform({
            snapshot: options.snapshot,
            world: options.world,
            transforms: options.snapshot.transforms,
            entityRef: draw.entity,
            offset: draw.worldTransformOffset,
            boundsIndex: draw.boundsIndex,
            alpha,
            matrixCache,
            affectedCache,
            affectedVisiting,
            matrixVisiting,
            writtenOffsets,
            writtenBounds,
        });
        transformWrites += writes.transformWrites;
        boundsWrites += writes.boundsWrites;
    }
    for (const draw of options.snapshot.shadowCasterDraws ?? []) {
        const writes = writeInterpolatedPacketTransform({
            snapshot: options.snapshot,
            world: options.world,
            transforms: options.snapshot.transforms,
            entityRef: draw.entity,
            offset: draw.worldTransformOffset,
            boundsIndex: draw.boundsIndex,
            alpha,
            matrixCache,
            affectedCache,
            affectedVisiting,
            matrixVisiting,
            writtenOffsets,
            writtenBounds,
        });
        transformWrites += writes.transformWrites;
        boundsWrites += writes.boundsWrites;
    }
    for (const draw of options.snapshot.spriteDraws ?? []) {
        const writes = writeInterpolatedPacketTransform({
            snapshot: options.snapshot,
            world: options.world,
            transforms: options.snapshot.transforms,
            entityRef: draw.entity,
            offset: draw.worldTransformOffset,
            boundsIndex: draw.boundsIndex,
            alpha,
            matrixCache,
            affectedCache,
            affectedVisiting,
            matrixVisiting,
            writtenOffsets,
            writtenBounds,
        });
        transformWrites += writes.transformWrites;
        boundsWrites += writes.boundsWrites;
    }
    for (const emitter of options.snapshot.particleEmitters ?? []) {
        const writes = writeInterpolatedPacketTransform({
            snapshot: options.snapshot,
            world: options.world,
            transforms: options.snapshot.transforms,
            entityRef: emitter.entity,
            offset: emitter.worldTransformOffset,
            boundsIndex: emitter.boundsIndex,
            alpha,
            matrixCache,
            affectedCache,
            affectedVisiting,
            matrixVisiting,
            writtenOffsets,
            writtenBounds,
        });
        transformWrites += writes.transformWrites;
        boundsWrites += writes.boundsWrites;
    }
    for (const view of options.snapshot.views) {
        viewWrites += writeInterpolatedViewMatrices({
            world: options.world,
            viewMatrices: options.snapshot.viewMatrices,
            entityRef: view.camera,
            viewOffset: view.viewMatrixOffset,
            projectionOffset: view.projectionMatrixOffset,
            viewProjectionOffset: view.viewProjectionMatrixOffset,
            alpha,
            matrixCache,
            affectedCache,
            affectedVisiting,
            matrixVisiting,
        });
    }
    return {
        enabled: true,
        alpha,
        transformWrites,
        boundsWrites,
        viewWrites,
    };
}
function writeInterpolatedPacketTransform(options) {
    if (!matrixOffsetValid(options.transforms, options.offset)) {
        return noPacketWrites();
    }
    const offsetWritten = options.writtenOffsets.has(options.offset);
    const boundsWritten = options.writtenBounds.has(options.boundsIndex);
    if (offsetWritten && boundsWritten) {
        return noPacketWrites();
    }
    const entity = resolveSnapshotEntity(options.world, options.entityRef);
    options.affectedVisiting.clear();
    if (entity === null ||
        !interpolationAffectsWorldMatrix(entity, options.affectedCache, options.affectedVisiting)) {
        options.affectedVisiting.clear();
        return noPacketWrites();
    }
    options.affectedVisiting.clear();
    options.matrixVisiting.clear();
    const matrix = interpolatedWorldMatrix(entity, options.alpha, options.matrixCache, options.affectedCache, options.affectedVisiting, options.matrixVisiting);
    options.affectedVisiting.clear();
    options.matrixVisiting.clear();
    if (matrix === null) {
        return noPacketWrites();
    }
    let transformWrites = 0;
    if (!offsetWritten) {
        options.transforms.set(matrix, options.offset);
        options.writtenOffsets.add(options.offset);
        transformWrites = 1;
    }
    return {
        transformWrites,
        boundsWrites: rewriteInterpolatedPacketBounds({
            snapshot: options.snapshot,
            boundsIndex: options.boundsIndex,
            worldMatrix: matrix,
            writtenBounds: options.writtenBounds,
        }),
    };
}
function noPacketWrites() {
    return { transformWrites: 0, boundsWrites: 0 };
}
function writeInterpolatedViewMatrices(options) {
    if (!matrixOffsetValid(options.viewMatrices, options.viewOffset) ||
        !matrixOffsetValid(options.viewMatrices, options.projectionOffset) ||
        !matrixOffsetValid(options.viewMatrices, options.viewProjectionOffset)) {
        return 0;
    }
    const entity = resolveSnapshotEntity(options.world, options.entityRef);
    options.affectedVisiting.clear();
    if (entity === null ||
        !interpolationAffectsWorldMatrix(entity, options.affectedCache, options.affectedVisiting)) {
        options.affectedVisiting.clear();
        return 0;
    }
    options.affectedVisiting.clear();
    options.matrixVisiting.clear();
    const worldMatrix = interpolatedWorldMatrix(entity, options.alpha, options.matrixCache, options.affectedCache, options.affectedVisiting, options.matrixVisiting);
    options.affectedVisiting.clear();
    options.matrixVisiting.clear();
    const viewMatrix = worldMatrix === null ? null : invertMat4(worldMatrix);
    if (viewMatrix === null) {
        return 0;
    }
    const projectionMatrix = readMatrix(options.viewMatrices, options.projectionOffset);
    const viewProjectionMatrix = multiplyMat4(projectionMatrix, viewMatrix);
    options.viewMatrices.set(viewMatrix, options.viewOffset);
    options.viewMatrices.set(viewProjectionMatrix, options.viewProjectionOffset);
    return 1;
}
function interpolatedWorldMatrix(entity, alpha, cache, affectedCache, affectedVisiting, matrixVisiting) {
    const key = entityKey(entity);
    const cached = cache.get(key);
    if (cached !== undefined) {
        return cached;
    }
    if (matrixVisiting.has(key)) {
        cache.set(key, null);
        return null;
    }
    matrixVisiting.add(key);
    const localMatrix = renderInterpolationReady(entity)
        ? interpolatedLocalMatrix(entity, alpha)
        : currentLocalMatrix(entity);
    let worldMatrix = null;
    if (localMatrix !== null) {
        const parent = parentEntity(entity);
        if (parent !== null) {
            affectedVisiting.clear();
            const parentMatrix = interpolationAffectsWorldMatrix(parent, affectedCache, affectedVisiting)
                ? interpolatedWorldMatrix(parent, alpha, cache, affectedCache, affectedVisiting, matrixVisiting)
                : readWorldMatrix(parent);
            affectedVisiting.clear();
            worldMatrix =
                parentMatrix === null ? null : multiplyMat4(parentMatrix, localMatrix);
        }
        else {
            worldMatrix = localMatrix;
        }
    }
    matrixVisiting.delete(key);
    cache.set(key, worldMatrix);
    return worldMatrix;
}
function interpolationAffectsWorldMatrix(entity, cache, visiting) {
    const key = entityKey(entity);
    const cached = cache.get(key);
    if (cached !== undefined) {
        return cached;
    }
    if (visiting.has(key)) {
        cache.set(key, false);
        return false;
    }
    visiting.add(key);
    const parent = parentEntity(entity);
    const affected = renderInterpolationReady(entity) ||
        (parent !== null &&
            interpolationAffectsWorldMatrix(parent, cache, visiting));
    visiting.delete(key);
    cache.set(key, affected);
    return affected;
}
function interpolatedLocalMatrix(entity, alpha) {
    return composeTrsMatrix(lerpVec3(entity.getVectorView(RenderInterpolation, "previousTranslation"), entity.getVectorView(RenderInterpolation, "currentTranslation"), alpha), slerpQuat(entity.getVectorView(RenderInterpolation, "previousRotation"), entity.getVectorView(RenderInterpolation, "currentRotation"), alpha), lerpVec3(entity.getVectorView(RenderInterpolation, "previousScale"), entity.getVectorView(RenderInterpolation, "currentScale"), alpha));
}
function currentLocalMatrix(entity) {
    if (!entity.hasComponent(LocalTransform)) {
        return readWorldMatrix(entity);
    }
    return composeTrsMatrix(entity.getVectorView(LocalTransform, "translation"), entity.getVectorView(LocalTransform, "rotation"), entity.getVectorView(LocalTransform, "scale"));
}
function readWorldMatrix(entity) {
    if (!entity.hasComponent(WorldTransform)) {
        return null;
    }
    return readWorldTransformMatrix(entity);
}
function readWorldTransformMatrix(entity) {
    return new Float32Array([
        ...entity.getVectorView(WorldTransform, "col0"),
        ...entity.getVectorView(WorldTransform, "col1"),
        ...entity.getVectorView(WorldTransform, "col2"),
        ...entity.getVectorView(WorldTransform, "col3"),
    ]);
}
function readMatrix(buffer, offset) {
    return buffer.slice(offset, offset + 16);
}
function renderInterpolationEntities(world) {
    return world.queryManager.registerQuery({
        required: [RenderInterpolation, LocalTransform],
    }).entities;
}
function renderInterpolationReady(entity) {
    return (entity.hasComponent(RenderInterpolation) &&
        renderInterpolationEnabled(entity) &&
        entity.getValue(RenderInterpolation, "initialized") === true);
}
function renderInterpolationEnabled(entity) {
    return entity.getValue(RenderInterpolation, "enabled") !== false;
}
function copyLocalToInterpolation(entity, target) {
    const translation = target === "previous" ? "previousTranslation" : "currentTranslation";
    const rotation = target === "previous" ? "previousRotation" : "currentRotation";
    const scale = target === "previous" ? "previousScale" : "currentScale";
    entity
        .getVectorView(RenderInterpolation, translation)
        .set(entity.getVectorView(LocalTransform, "translation"));
    entity
        .getVectorView(RenderInterpolation, rotation)
        .set(entity.getVectorView(LocalTransform, "rotation"));
    entity
        .getVectorView(RenderInterpolation, scale)
        .set(entity.getVectorView(LocalTransform, "scale"));
}
function copyVectorField(entity, source, target) {
    entity
        .getVectorView(RenderInterpolation, target)
        .set(entity.getVectorView(RenderInterpolation, source));
}
function parentEntity(entity) {
    if (!entity.hasComponent(Parent)) {
        return null;
    }
    const parent = entity.getValue(Parent, "entity");
    return parent !== null && parent !== undefined && parent.active
        ? parent
        : null;
}
function resolveSnapshotEntity(world, ref) {
    if (!Number.isInteger(ref.index) ||
        !Number.isInteger(ref.generation) ||
        ref.index < 0 ||
        ref.generation < 0) {
        return null;
    }
    const entity = world.entityManager.getEntityByIndex(ref.index);
    if (entity === null ||
        !entity.active ||
        entity.generation !== ref.generation) {
        return null;
    }
    return entity;
}
function lerpVec3(previous, current, alpha) {
    return [
        lerp(read(previous, 0), read(current, 0), alpha),
        lerp(read(previous, 1), read(current, 1), alpha),
        lerp(read(previous, 2), read(current, 2), alpha),
    ];
}
function lerp(left, right, alpha) {
    return left + (right - left) * alpha;
}
function clampAlpha(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.min(1, Math.max(0, value));
}
function matrixOffsetValid(buffer, offset) {
    return offset >= 0 && offset + 16 <= buffer.length;
}
function entityKey(entity) {
    return `${entity.index}:${entity.generation}`;
}
function read(values, index) {
    return values[index] ?? 0;
}
//# sourceMappingURL=render-interpolation.js.map