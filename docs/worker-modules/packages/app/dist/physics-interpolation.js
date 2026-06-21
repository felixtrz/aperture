import { composeTrsMatrix, decomposeTrsMatrix, LocalTransform, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { PhysicsBodyState, slerpQuat } from "/aperture/worker-modules/packages/physics/dist/index.js";
import { rewriteInterpolatedPacketBounds } from "./snapshot-interpolation-bounds.js";
export function applyPhysicsSnapshotInterpolation(options) {
    const alpha = clampAlpha(options.alpha);
    let transformWrites = 0;
    let boundsWrites = 0;
    const writtenOffsets = new Set();
    const writtenBounds = new Set();
    for (const draw of options.snapshot.meshDraws) {
        const writes = writeInterpolatedPacketTransform({
            snapshot: options.snapshot,
            world: options.world,
            transforms: options.snapshot.transforms,
            entityRef: draw.entity,
            offset: draw.worldTransformOffset,
            boundsIndex: draw.boundsIndex,
            alpha,
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
            writtenOffsets,
            writtenBounds,
        });
        transformWrites += writes.transformWrites;
        boundsWrites += writes.boundsWrites;
    }
    return {
        enabled: true,
        alpha,
        transformWrites,
        boundsWrites,
    };
}
function writeInterpolatedPacketTransform(options) {
    if (options.offset < 0 || options.offset + 16 > options.transforms.length) {
        return noPacketWrites();
    }
    const offsetWritten = options.writtenOffsets.has(options.offset);
    const boundsWritten = options.writtenBounds.has(options.boundsIndex);
    if (offsetWritten && boundsWritten) {
        return noPacketWrites();
    }
    const entity = resolveSnapshotEntity(options.world, options.entityRef);
    if (entity === null || !entity.hasComponent(PhysicsBodyState)) {
        return noPacketWrites();
    }
    const currentMatrix = Array.from(options.transforms.slice(options.offset, options.offset + 16));
    const decomposed = decomposeTrsMatrix(currentMatrix);
    if (decomposed === null) {
        return noPacketWrites();
    }
    const translation = lerpVec3(entity.getVectorView(PhysicsBodyState, "previousTranslation"), entity.getVectorView(PhysicsBodyState, "currentTranslation"), options.alpha);
    const rotation = slerpQuat(entity.getVectorView(PhysicsBodyState, "previousRotation"), entity.getVectorView(PhysicsBodyState, "currentRotation"), options.alpha);
    const matrix = composeTrsMatrix(translation, rotation, entity.hasComponent(LocalTransform)
        ? entity.getVectorView(LocalTransform, "scale")
        : decomposed.scale);
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
function read(values, index) {
    return values[index] ?? 0;
}
//# sourceMappingURL=physics-interpolation.js.map