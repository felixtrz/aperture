import { LocalTransform, Parent, WorldTransform, composeTrsMatrix, decomposeTrsMatrix, invertMat4, mat4, multiplyMat4, registerTransformComponents, resolveWorldTransforms, serializeEntityRef, } from "@aperture-engine/simulation";
import { createPhysicsResultBuffer, } from "./backend.js";
import { Collider, ExternalForce, ExternalImpulse, KinematicTarget, PhysicsGravity, PhysicsJoint, PhysicsJointKind, PhysicsJointMotorMode, PhysicsJointMotorModel, PhysicsMaterial, PhysicsBodyState, PhysicsColliderShapeKind, PhysicsMaterialCombineRule, PhysicsRigidBodyType, PhysicsVelocity, RigidBody, createPhysicsBodyState, } from "./components.js";
import { multiplyQuat, normalizeQuat, rotateVec3ByQuat } from "./math.js";
import { isNonUnitScale, scaleColliderShape } from "./collider-scale.js";
export function createPhysicsWorldSyncState() {
    return {
        knownEntities: new Set(),
        knownJoints: new Set(),
        sleepingStates: new Map(),
        resultBuffer: createPhysicsResultBuffer(),
    };
}
export function collectPhysicsCommands(world, state) {
    const commands = [];
    const seen = new Set();
    const seenJoints = new Set();
    const query = world.queryManager.registerQuery({
        required: [RigidBody, LocalTransform],
    });
    const childColliders = childColliderSourcesByBody(world);
    const gravityQuery = world.queryManager.registerQuery({
        required: [PhysicsGravity],
    });
    const jointQuery = world.queryManager.registerQuery({
        required: [PhysicsJoint],
    });
    const gravity = firstAuthoredGravity(gravityQuery.entities);
    if (gravity !== undefined) {
        commands.push({ kind: "setGravity", gravity });
    }
    for (const entity of query.entities) {
        if (!entity.active) {
            continue;
        }
        if (!readBoolean(entity, RigidBody, "enabled")) {
            clearPhysicsBodyState(entity);
            continue;
        }
        const ref = serializeEntityRef(entity);
        const colliders = colliderSourcesForBody(entity, childColliders.get(ref));
        if (colliders.length === 0) {
            clearPhysicsBodyState(entity);
            continue;
        }
        const command = createUpsertBodyCommand(world, entity, ref, colliders);
        seen.add(ref);
        commands.push(command);
    }
    for (const entity of jointQuery.entities) {
        if (!entity.active) {
            continue;
        }
        if (!readBoolean(entity, PhysicsJoint, "enabled")) {
            continue;
        }
        const ref = serializeEntityRef(entity);
        seenJoints.add(ref);
        commands.push({
            kind: "upsertJoint",
            entity: ref,
            joint: createJointDescriptor(entity),
        });
    }
    if (state !== undefined) {
        for (const ref of state.knownEntities) {
            if (!seen.has(ref)) {
                commands.push({ kind: "destroyBody", entity: ref });
            }
        }
        state.knownEntities.clear();
        for (const ref of seen) {
            state.knownEntities.add(ref);
        }
        for (const ref of state.knownJoints) {
            if (!seenJoints.has(ref)) {
                commands.push({ kind: "destroyJoint", entity: ref });
            }
        }
        state.knownJoints.clear();
        for (const ref of seenJoints) {
            state.knownJoints.add(ref);
        }
    }
    return { commands };
}
function firstAuthoredGravity(entities) {
    const active = Array.from(entities)
        .filter((entity) => entity.active)
        .sort((a, b) => a.index - b.index || a.generation - b.generation)[0];
    return active === undefined
        ? undefined
        : readVec3(active, PhysicsGravity, "gravity");
}
/**
 * Add WorldTransform to parented RigidBody entities authored with only a
 * LocalTransform, so the following resolveWorldTransforms pass produces the
 * world pose physics sync needs (AI-3). Without this, a parented body would
 * fall back to its parent-local pose and be rejected as unsupported.
 */
export function ensureParentedPhysicsBodyWorldTransforms(world) {
    registerTransformComponents(world);
    const query = world.queryManager.registerQuery({
        required: [RigidBody, LocalTransform, Parent],
    });
    let added = 0;
    for (const entity of query.entities) {
        if (entity.active &&
            !entity.hasComponent(WorldTransform) &&
            activeParentForEntity(entity) !== null) {
            entity.addComponent(WorldTransform);
            added += 1;
        }
    }
    return added;
}
export function stepPhysicsWorld(options) {
    const state = options.state ?? createPhysicsWorldSyncState();
    ensureParentedPhysicsBodyWorldTransforms(options.world);
    resolveWorldTransforms(options.world);
    const sync = options.backend.sync(collectPhysicsCommands(options.world, state));
    const step = options.backend.step(options.fixedDelta, options.fixedStep);
    const readback = options.backend.readResults(state.resultBuffer);
    appendSleepWakeEvents(state, state.resultBuffer, options.fixedStep);
    const writeback = applyPhysicsResultsToWorld(options.world, state.resultBuffer);
    const events = [...state.resultBuffer.events];
    return { sync, step, readback, writeback, events };
}
function appendSleepWakeEvents(state, results, fixedStep) {
    const seen = new Set();
    const transitionEvents = [];
    for (const body of [...results.bodies].sort(compareBodyResults)) {
        seen.add(body.entity);
        const previousSleeping = state.sleepingStates.get(body.entity);
        if (previousSleeping !== undefined && previousSleeping !== body.sleeping) {
            transitionEvents.push({
                kind: body.sleeping ? "sleep" : "wake",
                frame: 0,
                fixedStep,
                substep: 0,
                entityA: body.entity,
                entityB: body.entity,
                colliderA: body.entity,
                colliderB: body.entity,
            });
        }
        state.sleepingStates.set(body.entity, body.sleeping);
    }
    for (const entity of [...state.sleepingStates.keys()]) {
        if (!seen.has(entity)) {
            state.sleepingStates.delete(entity);
        }
    }
    if (transitionEvents.length === 0) {
        return;
    }
    results.events.push(...transitionEvents);
    results.events.sort(comparePhysicsEvents);
}
function compareBodyResults(left, right) {
    return left.entity.localeCompare(right.entity);
}
function comparePhysicsEvents(left, right) {
    return (left.fixedStep - right.fixedStep ||
        left.substep - right.substep ||
        left.kind.localeCompare(right.kind) ||
        left.entityA.localeCompare(right.entityA) ||
        left.entityB.localeCompare(right.entityB) ||
        left.colliderA.localeCompare(right.colliderA) ||
        left.colliderB.localeCompare(right.colliderB));
}
export function applyPhysicsResultsToWorld(world, results) {
    const entities = activeEntitiesByRef(world);
    let transformWrites = 0;
    let velocityWrites = 0;
    let bodyStateWrites = 0;
    let missingEntities = 0;
    const seenBodies = new Set();
    for (const body of results.bodies) {
        seenBodies.add(body.entity);
        const entity = entities.get(body.entity) ?? resolveEntityRef(world, body.entity);
        if (entity === undefined) {
            missingEntities += 1;
            continue;
        }
        if (entity.hasComponent(LocalTransform)) {
            const localTransform = localTransformFromPhysicsResult(world, entity, body);
            entity
                .getVectorView(LocalTransform, "translation")
                .set(localTransform.translation);
            entity
                .getVectorView(LocalTransform, "rotation")
                .set(localTransform.rotation);
            transformWrites += 1;
        }
        if (entity.hasComponent(PhysicsVelocity)) {
            entity.getVectorView(PhysicsVelocity, "linear").set(body.velocity.linear);
            entity
                .getVectorView(PhysicsVelocity, "angular")
                .set(body.velocity.angular);
            velocityWrites += 1;
        }
        writePhysicsBodyState(entity, body);
        bodyStateWrites += 1;
    }
    clearMissingPhysicsBodyStates(world, seenBodies);
    return {
        bodyCount: results.bodies.length,
        transformWrites,
        velocityWrites,
        bodyStateWrites,
        missingEntities,
    };
}
function clearMissingPhysicsBodyStates(world, seenBodies) {
    if (!world.hasComponent(PhysicsBodyState)) {
        return;
    }
    const query = world.queryManager.registerQuery({
        required: [RigidBody, PhysicsBodyState],
    });
    for (const entity of query.entities) {
        if (!entity.active || seenBodies.has(serializeEntityRef(entity))) {
            continue;
        }
        clearPhysicsBodyState(entity);
    }
}
function localTransformFromPhysicsResult(world, entity, body) {
    const parent = activeParentForEntity(entity);
    if (parent === null || !hasWorldTransform(world, parent)) {
        return body.transform;
    }
    const parentInverse = invertMat4(readWorldMatrix(parent));
    if (parentInverse === null) {
        return {
            translation: readVec3(entity, LocalTransform, "translation"),
            rotation: readQuat(entity, LocalTransform, "rotation"),
        };
    }
    const localMatrix = multiplyMat4(parentInverse, composeTrsMatrix(body.transform.translation, body.transform.rotation, readVec3(entity, LocalTransform, "scale")));
    const local = decomposeTrsMatrix(localMatrix);
    if (local === null) {
        return {
            translation: readVec3(entity, LocalTransform, "translation"),
            rotation: readQuat(entity, LocalTransform, "rotation"),
        };
    }
    return {
        translation: [
            local.translation[0],
            local.translation[1],
            local.translation[2],
        ],
        rotation: [
            local.rotation[0],
            local.rotation[1],
            local.rotation[2],
            local.rotation[3],
        ],
    };
}
function createUpsertBodyCommand(world, entity, ref, colliderSources) {
    const bodyType = readRigidBodyType(entity);
    const kinematicTarget = kinematicTargetForEntity(entity, bodyType);
    const colliders = colliderSources.map((source) => createColliderDescriptor(entity, source));
    const primaryCollider = colliders[0];
    const transform = physicsTransformForEntity(entity, world);
    if (primaryCollider === undefined) {
        throw new Error(`Physics body '${ref}' cannot be synced without at least one collider.`);
    }
    return {
        kind: "upsertBody",
        entity: ref,
        transform,
        ...(kinematicTarget === undefined ? {} : { kinematicTarget }),
        bodyType,
        gravityScale: readNumber(entity, RigidBody, "gravityScale"),
        linearDamping: readNumber(entity, RigidBody, "linearDamping"),
        angularDamping: readNumber(entity, RigidBody, "angularDamping"),
        canSleep: readBoolean(entity, RigidBody, "canSleep"),
        ccdEnabled: readBoolean(entity, RigidBody, "ccdEnabled"),
        lockTranslations: [
            readBoolean(entity, RigidBody, "lockTranslationX"),
            readBoolean(entity, RigidBody, "lockTranslationY"),
            readBoolean(entity, RigidBody, "lockTranslationZ"),
        ],
        lockRotations: [
            readBoolean(entity, RigidBody, "lockRotationX"),
            readBoolean(entity, RigidBody, "lockRotationY"),
            readBoolean(entity, RigidBody, "lockRotationZ"),
        ],
        ...(hasActiveParent(entity) && transform.source !== "world"
            ? { parented: true }
            : {}),
        ...(entity.hasComponent(PhysicsVelocity)
            ? {
                velocity: {
                    linear: readVec3(entity, PhysicsVelocity, "linear"),
                    angular: readVec3(entity, PhysicsVelocity, "angular"),
                },
            }
            : {}),
        ...(entity.hasComponent(ExternalForce)
            ? {
                externalForce: {
                    force: readVec3(entity, ExternalForce, "force"),
                    torque: readVec3(entity, ExternalForce, "torque"),
                },
            }
            : {}),
        ...(entity.hasComponent(ExternalImpulse)
            ? {
                externalImpulse: consumeExternalImpulse(entity),
            }
            : {}),
        collider: primaryCollider,
        ...(colliders.length > 1 ? { colliders } : {}),
    };
}
function hasActiveParent(entity) {
    return activeParentForEntity(entity) !== null;
}
function activeParentForEntity(entity) {
    if (!entity.hasComponent(Parent)) {
        return null;
    }
    const parent = entity.getValue(Parent, "entity");
    return parent !== null && parent !== undefined && parent.active
        ? parent
        : null;
}
function physicsTransformForEntity(entity, world) {
    if (hasActiveParent(entity) && hasWorldTransform(world, entity)) {
        const worldTransform = decomposeTrsMatrix(readWorldMatrix(entity));
        if (worldTransform !== null) {
            return {
                source: "world",
                translation: [
                    worldTransform.translation[0],
                    worldTransform.translation[1],
                    worldTransform.translation[2],
                ],
                rotation: [
                    worldTransform.rotation[0],
                    worldTransform.rotation[1],
                    worldTransform.rotation[2],
                    worldTransform.rotation[3],
                ],
            };
        }
    }
    return {
        source: "local",
        translation: readVec3(entity, LocalTransform, "translation"),
        rotation: readQuat(entity, LocalTransform, "rotation"),
    };
}
function readWorldMatrix(entity) {
    const matrix = mat4();
    matrix.set(entity.getVectorView(WorldTransform, "col0"), 0);
    matrix.set(entity.getVectorView(WorldTransform, "col1"), 4);
    matrix.set(entity.getVectorView(WorldTransform, "col2"), 8);
    matrix.set(entity.getVectorView(WorldTransform, "col3"), 12);
    return matrix;
}
function hasWorldTransform(world, entity) {
    return (world.hasComponent(WorldTransform) && entity.hasComponent(WorldTransform));
}
function colliderSourcesForBody(body, childColliders) {
    const sources = [];
    if (body.hasComponent(Collider) && readBoolean(body, Collider, "enabled")) {
        sources.push({ entity: body, bodyLocalOffset: false });
    }
    if (childColliders !== undefined) {
        sources.push(...childColliders);
    }
    return sources;
}
function childColliderSourcesByBody(world) {
    const sources = new Map();
    const query = world.queryManager.registerQuery({
        required: [Collider, LocalTransform, Parent],
    });
    for (const entity of [...query.entities].sort(compareEntities)) {
        if (!entity.active || !readBoolean(entity, Collider, "enabled")) {
            continue;
        }
        const parent = entity.getValue(Parent, "entity");
        if (parent === null || parent === undefined || !parent.active) {
            continue;
        }
        const parentRef = serializeEntityRef(parent);
        const bodySources = sources.get(parentRef) ?? [];
        bodySources.push({ entity, bodyLocalOffset: true });
        if (!sources.has(parentRef)) {
            sources.set(parentRef, bodySources);
        }
    }
    return sources;
}
function compareEntities(left, right) {
    return left.index - right.index || left.generation - right.generation;
}
function createColliderDescriptor(body, source) {
    const collider = source.entity;
    const frictionCombine = readMaterialCombineRule(body, collider, "frictionCombine");
    const restitutionCombine = readMaterialCombineRule(body, collider, "restitutionCombine");
    const rawShape = readColliderShape(collider);
    const colliderScale = readColliderScale(collider);
    const assetBacked = isAssetBackedColliderShape(rawShape);
    // Bake the entity scale into primitive shape dimensions so the collider matches
    // the scaled render geometry (PlayCanvas applies world scale to its shapes the
    // same way). Asset shapes are left unscaled — their scale is rejected/handled by
    // the asset cooking path. `scale` is attached for asset shapes (as before) and
    // for non-unit primitive scale (so the backend can diagnose inexact scale and the
    // descriptor stays self-describing); unit-scale primitives are left untouched so
    // their descriptor is unchanged.
    const shape = assetBacked
        ? rawShape
        : scaleColliderShape(rawShape, colliderScale);
    return {
        entity: serializeEntityRef(collider),
        shape,
        ...(assetBacked || isNonUnitScale(colliderScale)
            ? { scale: colliderScale }
            : {}),
        offsetTranslation: colliderOffsetTranslation(source),
        offsetRotation: colliderOffsetRotation(source),
        sensor: readBoolean(collider, Collider, "sensor"),
        density: readMaterialNumber(body, collider, "density"),
        friction: readMaterialNumber(body, collider, "friction"),
        restitution: readMaterialNumber(body, collider, "restitution"),
        ...(frictionCombine === undefined ? {} : { frictionCombine }),
        ...(restitutionCombine === undefined ? {} : { restitutionCombine }),
        collisionGroups: readNumber(collider, Collider, "collisionGroups"),
        solverGroups: readNumber(collider, Collider, "solverGroups"),
    };
}
function isAssetBackedColliderShape(shape) {
    switch (shape.kind) {
        case "convexHull":
        case "trimesh":
        case "heightfield":
            return true;
        case "box":
        case "sphere":
        case "capsule":
        case "cylinder":
        case "cone":
            return false;
    }
}
function colliderOffsetTranslation(source) {
    const colliderOffset = readVec3(source.entity, Collider, "offsetTranslation");
    if (!source.bodyLocalOffset) {
        return colliderOffset;
    }
    const childTranslation = readVec3(source.entity, LocalTransform, "translation");
    const childRotation = readQuat(source.entity, LocalTransform, "rotation");
    return addVec3(childTranslation, rotateVec3ByQuat(colliderOffset, childRotation));
}
function colliderOffsetRotation(source) {
    const colliderOffset = readQuat(source.entity, Collider, "offsetRotation");
    if (!source.bodyLocalOffset) {
        return colliderOffset;
    }
    return normalizeQuat(multiplyQuat(readQuat(source.entity, LocalTransform, "rotation"), colliderOffset));
}
function readMaterialNumber(body, collider, field) {
    if (collider.hasComponent(PhysicsMaterial)) {
        return readNumber(collider, PhysicsMaterial, field);
    }
    return body.hasComponent(PhysicsMaterial)
        ? readNumber(body, PhysicsMaterial, field)
        : readNumber(collider, Collider, field);
}
function readMaterialCombineRule(body, collider, field) {
    const materialEntity = collider.hasComponent(PhysicsMaterial)
        ? collider
        : body.hasComponent(PhysicsMaterial)
            ? body
            : undefined;
    if (materialEntity === undefined) {
        return undefined;
    }
    const value = materialEntity.getValue(PhysicsMaterial, field);
    switch (value) {
        case PhysicsMaterialCombineRule.Average:
        case PhysicsMaterialCombineRule.Min:
        case PhysicsMaterialCombineRule.Max:
        case PhysicsMaterialCombineRule.Multiply:
            return value;
        default:
            throw new Error(`Unsupported physics material combine rule '${String(value)}'.`);
    }
}
function kinematicTargetForEntity(entity, bodyType) {
    if (bodyType !== PhysicsRigidBodyType.KinematicPosition) {
        return undefined;
    }
    if (!entity.hasComponent(KinematicTarget) ||
        !readBoolean(entity, KinematicTarget, "enabled")) {
        return undefined;
    }
    return {
        translation: readVec3(entity, KinematicTarget, "translation"),
        rotation: readQuat(entity, KinematicTarget, "rotation"),
    };
}
function consumeExternalImpulse(entity) {
    const impulse = readVec3(entity, ExternalImpulse, "impulse");
    const angularImpulse = readVec3(entity, ExternalImpulse, "angularImpulse");
    entity.getVectorView(ExternalImpulse, "impulse").set([0, 0, 0]);
    entity.getVectorView(ExternalImpulse, "angularImpulse").set([0, 0, 0]);
    return { impulse, angularImpulse };
}
function createJointDescriptor(entity) {
    return {
        kind: readJointKind(entity),
        bodyARef: readString(entity, PhysicsJoint, "bodyARef"),
        bodyBRef: readString(entity, PhysicsJoint, "bodyBRef"),
        anchorA: readVec3(entity, PhysicsJoint, "anchorA"),
        anchorB: readVec3(entity, PhysicsJoint, "anchorB"),
        frameA: readQuat(entity, PhysicsJoint, "frameA"),
        frameB: readQuat(entity, PhysicsJoint, "frameB"),
        axis: readVec3(entity, PhysicsJoint, "axis"),
        minLimit: readNumber(entity, PhysicsJoint, "minLimit"),
        maxLimit: readNumber(entity, PhysicsJoint, "maxLimit"),
        motorMode: readJointMotorMode(entity),
        motorModel: readJointMotorModel(entity),
        motorTarget: readNumber(entity, PhysicsJoint, "motorTarget"),
        motorVelocity: readNumber(entity, PhysicsJoint, "motorVelocity"),
        motorStiffness: readNumber(entity, PhysicsJoint, "motorStiffness"),
        motorDamping: readNumber(entity, PhysicsJoint, "motorDamping"),
        motorFactor: readNumber(entity, PhysicsJoint, "motorFactor"),
        motorMaxForce: readNumber(entity, PhysicsJoint, "motorMaxForce"),
        contactsEnabled: readBoolean(entity, PhysicsJoint, "contactsEnabled"),
        breakForce: readNumber(entity, PhysicsJoint, "breakForce"),
    };
}
function readColliderShape(entity) {
    const kind = entity.getValue(Collider, "shapeKind");
    switch (kind) {
        case PhysicsColliderShapeKind.Box:
            return {
                kind: "box",
                halfExtents: readVec3(entity, Collider, "halfExtents"),
            };
        case PhysicsColliderShapeKind.Sphere:
            return {
                kind: "sphere",
                radius: readNumber(entity, Collider, "radius"),
            };
        case PhysicsColliderShapeKind.Capsule:
            return {
                kind: "capsule",
                radius: readNumber(entity, Collider, "radius"),
                halfHeight: readNumber(entity, Collider, "halfHeight"),
                axis: readColliderAxis(entity),
            };
        case PhysicsColliderShapeKind.Cylinder:
            return {
                kind: "cylinder",
                radius: readNumber(entity, Collider, "radius"),
                halfHeight: readNumber(entity, Collider, "halfHeight"),
                axis: readColliderAxis(entity),
            };
        case PhysicsColliderShapeKind.Cone:
            return {
                kind: "cone",
                radius: readNumber(entity, Collider, "radius"),
                halfHeight: readNumber(entity, Collider, "halfHeight"),
                axis: readColliderAxis(entity),
            };
        case PhysicsColliderShapeKind.ConvexHull:
            return {
                kind: "convexHull",
                meshId: readString(entity, Collider, "meshId"),
            };
        case PhysicsColliderShapeKind.Trimesh:
            return {
                kind: "trimesh",
                meshId: readString(entity, Collider, "meshId"),
            };
        case PhysicsColliderShapeKind.Heightfield:
            return {
                kind: "heightfield",
                assetId: readString(entity, Collider, "heightfieldAssetId"),
            };
    }
    throw new Error(`Unsupported physics collider shape kind '${String(kind)}'.`);
}
function readColliderScale(entity) {
    return entity.hasComponent(LocalTransform)
        ? readVec3(entity, LocalTransform, "scale")
        : [1, 1, 1];
}
function writePhysicsBodyState(entity, body) {
    const previousTranslation = entity.hasComponent(PhysicsBodyState)
        ? readVec3(entity, PhysicsBodyState, "currentTranslation")
        : body.transform.translation;
    const previousRotation = entity.hasComponent(PhysicsBodyState)
        ? readQuat(entity, PhysicsBodyState, "currentRotation")
        : body.transform.rotation;
    if (!entity.hasComponent(PhysicsBodyState)) {
        entity.addComponent(PhysicsBodyState, createPhysicsBodyState({
            sleeping: body.sleeping,
            currentTranslation: body.transform.translation,
            currentRotation: body.transform.rotation,
            previousTranslation,
            previousRotation,
            backendBodyId: body.entity,
        }));
        return;
    }
    entity.setValue(PhysicsBodyState, "sleeping", body.sleeping);
    entity.setValue(PhysicsBodyState, "backendBodyId", body.entity);
    entity
        .getVectorView(PhysicsBodyState, "previousTranslation")
        .set(previousTranslation);
    entity
        .getVectorView(PhysicsBodyState, "previousRotation")
        .set(previousRotation);
    entity
        .getVectorView(PhysicsBodyState, "currentTranslation")
        .set(body.transform.translation);
    entity
        .getVectorView(PhysicsBodyState, "currentRotation")
        .set(body.transform.rotation);
}
function clearPhysicsBodyState(entity) {
    if (entity.hasComponent(PhysicsBodyState)) {
        entity.removeComponent(PhysicsBodyState);
    }
}
function activeEntitiesByRef(world) {
    const entities = new Map();
    const query = world.queryManager.registerQuery({ required: [] });
    for (const entity of query.entities) {
        if (entity.active) {
            entities.set(serializeEntityRef(entity), entity);
        }
    }
    return entities;
}
function resolveEntityRef(world, ref) {
    const separator = ref.indexOf(":");
    if (separator < 0) {
        return undefined;
    }
    const index = Number.parseInt(ref.slice(0, separator), 10);
    const generation = Number.parseInt(ref.slice(separator + 1), 10);
    if (!Number.isInteger(index) || !Number.isInteger(generation)) {
        return undefined;
    }
    const entity = world.entityManager.getEntityByIndex(index);
    return entity !== null && entity.active && entity.generation === generation
        ? entity
        : undefined;
}
function readVec3(entity, component, field) {
    const value = entity.getVectorView(component, field);
    return [read(value, 0), read(value, 1), read(value, 2)];
}
function readQuat(entity, component, field) {
    const value = entity.getVectorView(component, field);
    return [read(value, 0), read(value, 1), read(value, 2), read(value, 3)];
}
function readNumber(entity, component, field) {
    const value = entity.getValue(component, field);
    if (typeof value !== "number") {
        throw new TypeError(`Expected numeric physics field ${field}.`);
    }
    return value;
}
function readBoolean(entity, component, field) {
    return entity.getValue(component, field) === true;
}
function readString(entity, component, field) {
    const value = entity.getValue(component, field);
    return typeof value === "string" ? value : "";
}
function readRigidBodyType(entity) {
    const value = entity.getValue(RigidBody, "type");
    switch (value) {
        case PhysicsRigidBodyType.Static:
        case PhysicsRigidBodyType.Dynamic:
        case PhysicsRigidBodyType.KinematicPosition:
        case PhysicsRigidBodyType.KinematicVelocity:
            return value;
        default:
            throw new Error(`Unsupported physics rigid body type '${String(value)}'.`);
    }
}
function readJointKind(entity) {
    const value = entity.getValue(PhysicsJoint, "kind");
    switch (value) {
        case PhysicsJointKind.Fixed:
        case PhysicsJointKind.Spherical:
        case PhysicsJointKind.Revolute:
        case PhysicsJointKind.Prismatic:
        case PhysicsJointKind.Distance:
        case PhysicsJointKind.Generic:
            return value;
        default:
            throw new Error(`Unsupported physics joint kind '${String(value)}'.`);
    }
}
function readJointMotorMode(entity) {
    const value = entity.getValue(PhysicsJoint, "motorMode");
    switch (value) {
        case PhysicsJointMotorMode.Position:
        case PhysicsJointMotorMode.Velocity:
            return value;
        default:
            throw new Error(`Unsupported physics joint motor mode '${String(value)}'.`);
    }
}
function readJointMotorModel(entity) {
    const value = entity.getValue(PhysicsJoint, "motorModel");
    switch (value) {
        case PhysicsJointMotorModel.Acceleration:
        case PhysicsJointMotorModel.Force:
            return value;
        default:
            throw new Error(`Unsupported physics joint motor model '${String(value)}'.`);
    }
}
function readColliderAxis(entity) {
    return readString(entity, Collider, "axis");
}
function addVec3(left, right) {
    return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}
function read(values, index) {
    const value = values[index];
    if (value === undefined) {
        throw new RangeError(`Expected vector value at index ${index}.`);
    }
    return value;
}
//# sourceMappingURL=ecs-sync.js.map