import { EcsType, defineComponent, } from "@aperture-engine/simulation";
export const PhysicsRigidBodyType = {
    Static: "static",
    Dynamic: "dynamic",
    KinematicPosition: "kinematicPosition",
    KinematicVelocity: "kinematicVelocity",
};
export const PhysicsColliderShapeKind = {
    Box: "box",
    Sphere: "sphere",
    Capsule: "capsule",
    Cylinder: "cylinder",
    Cone: "cone",
    ConvexHull: "convexHull",
    Trimesh: "trimesh",
    Heightfield: "heightfield",
};
export const PhysicsColliderAxis = {
    X: "x",
    Y: "y",
    Z: "z",
};
export const PhysicsMaterialCombineRule = {
    Average: "average",
    Min: "min",
    Max: "max",
    Multiply: "multiply",
};
export const PhysicsJointKind = {
    Fixed: "fixed",
    Spherical: "spherical",
    Revolute: "revolute",
    Prismatic: "prismatic",
    Distance: "distance",
    Generic: "generic",
};
export const PhysicsJointMotorMode = {
    Position: "position",
    Velocity: "velocity",
};
export const PhysicsJointMotorModel = {
    Acceleration: "acceleration",
    Force: "force",
};
export const PhysicsCharacterMassMode = {
    BackendDefault: "backendDefault",
    Disabled: "disabled",
    Mass: "mass",
};
export const RigidBody = defineComponent("aperture.physics.rigidBody", {
    enabled: { type: EcsType.Boolean, default: true },
    type: {
        type: EcsType.Enum,
        enum: PhysicsRigidBodyType,
        default: PhysicsRigidBodyType.Dynamic,
    },
    gravityScale: { type: EcsType.Float32, default: 1 },
    linearDamping: { type: EcsType.Float32, default: 0 },
    angularDamping: { type: EcsType.Float32, default: 0 },
    canSleep: { type: EcsType.Boolean, default: true },
    ccdEnabled: { type: EcsType.Boolean, default: false },
    lockTranslationX: { type: EcsType.Boolean, default: false },
    lockTranslationY: { type: EcsType.Boolean, default: false },
    lockTranslationZ: { type: EcsType.Boolean, default: false },
    lockRotationX: { type: EcsType.Boolean, default: false },
    lockRotationY: { type: EcsType.Boolean, default: false },
    lockRotationZ: { type: EcsType.Boolean, default: false },
}, "Backend-neutral rigid body authoring. ECS owns durable body intent; backend handles live in physics resources.");
export const Collider = defineComponent("aperture.physics.collider", {
    enabled: { type: EcsType.Boolean, default: true },
    shapeKind: {
        type: EcsType.Enum,
        enum: PhysicsColliderShapeKind,
        default: PhysicsColliderShapeKind.Box,
    },
    halfExtents: { type: EcsType.Vec3, default: tuple3(0.5, 0.5, 0.5) },
    radius: { type: EcsType.Float32, default: 0.5 },
    halfHeight: { type: EcsType.Float32, default: 0.5 },
    axis: {
        type: EcsType.Enum,
        enum: PhysicsColliderAxis,
        default: PhysicsColliderAxis.Y,
    },
    meshId: { type: EcsType.String, default: "" },
    heightfieldAssetId: { type: EcsType.String, default: "" },
    offsetTranslation: { type: EcsType.Vec3, default: tuple3(0, 0, 0) },
    offsetRotation: { type: EcsType.Vec4, default: tuple4(0, 0, 0, 1) },
    sensor: { type: EcsType.Boolean, default: false },
    density: { type: EcsType.Float32, default: 1 },
    friction: { type: EcsType.Float32, default: 0.5 },
    restitution: { type: EcsType.Float32, default: 0 },
    collisionGroups: { type: EcsType.Int32, default: -1 },
    solverGroups: { type: EcsType.Int32, default: -1 },
}, "Backend-neutral collider authoring. Shape parameters are schema fields so scenes stay JSON-safe and backend-independent.");
export const PhysicsVelocity = defineComponent("aperture.physics.velocity", {
    linear: { type: EcsType.Vec3, default: tuple3(0, 0, 0) },
    angular: { type: EcsType.Vec3, default: tuple3(0, 0, 0) },
}, "ECS-visible linear and angular velocity for physics bodies.");
export const ExternalForce = defineComponent("aperture.physics.externalForce", {
    force: { type: EcsType.Vec3, default: tuple3(0, 0, 0) },
    torque: { type: EcsType.Vec3, default: tuple3(0, 0, 0) },
}, "Fixed-step force and torque command data consumed by the physics backend sync phase.");
export const ExternalImpulse = defineComponent("aperture.physics.externalImpulse", {
    impulse: { type: EcsType.Vec3, default: tuple3(0, 0, 0) },
    angularImpulse: { type: EcsType.Vec3, default: tuple3(0, 0, 0) },
}, "One-step impulse command data consumed by the physics backend sync phase.");
export const KinematicTarget = defineComponent("aperture.physics.kinematicTarget", {
    enabled: { type: EcsType.Boolean, default: true },
    translation: { type: EcsType.Vec3, default: tuple3(0, 0, 0) },
    rotation: { type: EcsType.Vec4, default: tuple4(0, 0, 0, 1) },
}, "Desired fixed-step target pose for kinematic physics bodies.");
export const PhysicsGravity = defineComponent("aperture.physics.gravity", {
    gravity: { type: EcsType.Vec3, default: tuple3(0, -9.81, 0) },
}, "Durable ECS authoring for world gravity applied before fixed-step backend simulation.");
export const PhysicsCharacterController = defineComponent("aperture.physics.characterController", {
    enabled: { type: EcsType.Boolean, default: true },
    offset: { type: EcsType.Float32, default: 0.01 },
    up: { type: EcsType.Vec3, default: tuple3(0, 1, 0) },
    slide: { type: EcsType.Boolean, default: true },
    maxSlopeClimbAngleEnabled: { type: EcsType.Boolean, default: false },
    maxSlopeClimbAngle: { type: EcsType.Float32, default: Math.PI / 4 },
    minSlopeSlideAngleEnabled: { type: EcsType.Boolean, default: false },
    minSlopeSlideAngle: { type: EcsType.Float32, default: Math.PI / 3 },
    snapToGroundDistance: { type: EcsType.Float32, default: 0 },
    autostepEnabled: { type: EcsType.Boolean, default: false },
    autostepMaxHeight: { type: EcsType.Float32, default: 0.1 },
    autostepMinWidth: { type: EcsType.Float32, default: 0.1 },
    autostepIncludeDynamicBodies: { type: EcsType.Boolean, default: false },
    applyImpulsesToDynamicBodies: { type: EcsType.Boolean, default: false },
    characterMassMode: {
        type: EcsType.Enum,
        enum: PhysicsCharacterMassMode,
        default: PhysicsCharacterMassMode.BackendDefault,
    },
    characterMass: { type: EcsType.Float32, default: 0 },
}, "Durable ECS authoring for backend-neutral kinematic character-controller settings. Backend controller objects are derived per move.");
export const PhysicsMaterial = defineComponent("aperture.physics.material", {
    friction: { type: EcsType.Float32, default: 0.5 },
    restitution: { type: EcsType.Float32, default: 0 },
    density: { type: EcsType.Float32, default: 1 },
    frictionCombine: {
        type: EcsType.Enum,
        enum: PhysicsMaterialCombineRule,
        default: PhysicsMaterialCombineRule.Average,
    },
    restitutionCombine: {
        type: EcsType.Enum,
        enum: PhysicsMaterialCombineRule,
        default: PhysicsMaterialCombineRule.Average,
    },
}, "Reusable backend-neutral physics material authoring for collider friction, restitution, and density.");
export const PhysicsJoint = defineComponent("aperture.physics.joint", {
    enabled: { type: EcsType.Boolean, default: true },
    kind: {
        type: EcsType.Enum,
        enum: PhysicsJointKind,
        default: PhysicsJointKind.Fixed,
    },
    bodyARef: { type: EcsType.String, default: "" },
    bodyBRef: { type: EcsType.String, default: "" },
    anchorA: { type: EcsType.Vec3, default: tuple3(0, 0, 0) },
    anchorB: { type: EcsType.Vec3, default: tuple3(0, 0, 0) },
    frameA: { type: EcsType.Vec4, default: tuple4(0, 0, 0, 1) },
    frameB: { type: EcsType.Vec4, default: tuple4(0, 0, 0, 1) },
    axis: { type: EcsType.Vec3, default: tuple3(0, 1, 0) },
    minLimit: { type: EcsType.Float32, default: 0 },
    maxLimit: { type: EcsType.Float32, default: 0 },
    motorMode: {
        type: EcsType.Enum,
        enum: PhysicsJointMotorMode,
        default: PhysicsJointMotorMode.Position,
    },
    motorModel: {
        type: EcsType.Enum,
        enum: PhysicsJointMotorModel,
        default: PhysicsJointMotorModel.Acceleration,
    },
    motorTarget: { type: EcsType.Float32, default: 0 },
    motorVelocity: { type: EcsType.Float32, default: 0 },
    motorStiffness: { type: EcsType.Float32, default: 0 },
    motorDamping: { type: EcsType.Float32, default: 0 },
    motorFactor: { type: EcsType.Float32, default: 0 },
    motorMaxForce: { type: EcsType.Float32, default: 0 },
    contactsEnabled: { type: EcsType.Boolean, default: true },
    breakForce: { type: EcsType.Float32, default: 0 },
}, "Backend-neutral joint authoring. Joint execution is implemented by later backend slices.");
export const PhysicsDebug = defineComponent("aperture.physics.debug", {
    colliderWireframes: { type: EcsType.Boolean, default: false },
    contactNormals: { type: EcsType.Boolean, default: false },
    bodyStateMarkers: { type: EcsType.Boolean, default: false },
    broadphaseAabbs: { type: EcsType.Boolean, default: false },
    jointFrames: { type: EcsType.Boolean, default: false },
}, "Physics debug-draw authoring flags. Rendered debug primitives remain renderer-derived.");
export const PhysicsBodyState = defineComponent("aperture.physics.bodyState", {
    sleeping: { type: EcsType.Boolean, default: false },
    currentTranslation: { type: EcsType.Vec3, default: tuple3(0, 0, 0) },
    currentRotation: { type: EcsType.Vec4, default: tuple4(0, 0, 0, 1) },
    previousTranslation: { type: EcsType.Vec3, default: tuple3(0, 0, 0) },
    previousRotation: { type: EcsType.Vec4, default: tuple4(0, 0, 0, 1) },
    backendBodyId: { type: EcsType.String, default: "" },
}, "Derived runtime physics state for interpolation and diagnostics. Excluded from default serialization.");
export const PHYSICS_AUTHORING_COMPONENTS = [
    RigidBody,
    Collider,
    PhysicsVelocity,
    ExternalForce,
    ExternalImpulse,
    KinematicTarget,
    PhysicsGravity,
    PhysicsCharacterController,
    PhysicsMaterial,
    PhysicsJoint,
    PhysicsDebug,
];
export const PHYSICS_DERIVED_COMPONENTS = [PhysicsBodyState];
export const PHYSICS_DERIVED_COMPONENT_IDS = [PhysicsBodyState.id];
export const PHYSICS_ENTITY_REF_STRING_FIELDS = {
    [PhysicsJoint.id]: ["bodyARef", "bodyBRef"],
};
export function registerPhysicsComponents(world) {
    for (const component of PHYSICS_AUTHORING_COMPONENTS) {
        world.registerComponent(component);
    }
    for (const component of PHYSICS_DERIVED_COMPONENTS) {
        world.registerComponent(component);
    }
    return world;
}
export function createRigidBody(input = {}) {
    return {
        enabled: input.enabled ?? true,
        type: input.type ?? PhysicsRigidBodyType.Dynamic,
        gravityScale: input.gravityScale ?? 1,
        linearDamping: input.linearDamping ?? 0,
        angularDamping: input.angularDamping ?? 0,
        canSleep: input.canSleep ?? true,
        ccdEnabled: input.ccdEnabled ?? false,
        lockTranslationX: input.lockTranslationX ?? false,
        lockTranslationY: input.lockTranslationY ?? false,
        lockTranslationZ: input.lockTranslationZ ?? false,
        lockRotationX: input.lockRotationX ?? false,
        lockRotationY: input.lockRotationY ?? false,
        lockRotationZ: input.lockRotationZ ?? false,
    };
}
export function createCollider(input = {}) {
    const shape = input.shape ?? {
        kind: "box",
        halfExtents: tuple3(0.5, 0.5, 0.5),
    };
    return {
        enabled: input.enabled ?? true,
        shapeKind: shape.kind,
        halfExtents: shape.kind === "box"
            ? toTuple3(shape.halfExtents)
            : tuple3(0.5, 0.5, 0.5),
        radius: "radius" in shape ? shape.radius : 0.5,
        halfHeight: "halfHeight" in shape ? shape.halfHeight : 0.5,
        axis: "axis" in shape
            ? (shape.axis ?? PhysicsColliderAxis.Y)
            : PhysicsColliderAxis.Y,
        meshId: "meshId" in shape ? shape.meshId : "",
        heightfieldAssetId: "assetId" in shape ? shape.assetId : "",
        offsetTranslation: toTuple3(input.offsetTranslation ?? [0, 0, 0]),
        offsetRotation: toTuple4(input.offsetRotation ?? [0, 0, 0, 1]),
        sensor: input.sensor ?? false,
        density: input.density ?? 1,
        friction: input.friction ?? 0.5,
        restitution: input.restitution ?? 0,
        collisionGroups: input.collisionGroups ?? -1,
        solverGroups: input.solverGroups ?? -1,
    };
}
export function createPhysicsVelocity(input = {}) {
    return {
        linear: toTuple3(input.linear ?? [0, 0, 0]),
        angular: toTuple3(input.angular ?? [0, 0, 0]),
    };
}
export function createExternalForce(input = {}) {
    return {
        force: toTuple3(input.force ?? [0, 0, 0]),
        torque: toTuple3(input.torque ?? [0, 0, 0]),
    };
}
export function createExternalImpulse(input = {}) {
    return {
        impulse: toTuple3(input.impulse ?? [0, 0, 0]),
        angularImpulse: toTuple3(input.angularImpulse ?? [0, 0, 0]),
    };
}
export function createKinematicTarget(input = {}) {
    return {
        enabled: input.enabled ?? true,
        translation: toTuple3(input.translation ?? [0, 0, 0]),
        rotation: toTuple4(input.rotation ?? [0, 0, 0, 1]),
    };
}
export function createPhysicsGravity(input = {}) {
    return {
        gravity: toTuple3(input.gravity ?? [0, -9.81, 0]),
    };
}
export function createPhysicsCharacterController(input = {}) {
    const characterMassMode = input.characterMass === undefined
        ? PhysicsCharacterMassMode.BackendDefault
        : input.characterMass === null
            ? PhysicsCharacterMassMode.Disabled
            : PhysicsCharacterMassMode.Mass;
    const autostep = input.autostep !== undefined && input.autostep !== false
        ? input.autostep
        : null;
    return {
        enabled: input.enabled ?? true,
        offset: input.offset ?? 0.01,
        up: toTuple3(input.up ?? [0, 1, 0]),
        slide: input.slide ?? true,
        maxSlopeClimbAngleEnabled: input.maxSlopeClimbAngle !== undefined,
        maxSlopeClimbAngle: input.maxSlopeClimbAngle ?? Math.PI / 4,
        minSlopeSlideAngleEnabled: input.minSlopeSlideAngle !== undefined,
        minSlopeSlideAngle: input.minSlopeSlideAngle ?? Math.PI / 3,
        snapToGroundDistance: input.snapToGroundDistance ?? 0,
        autostepEnabled: autostep !== null,
        autostepMaxHeight: autostep?.maxHeight ?? 0.1,
        autostepMinWidth: autostep?.minWidth ?? 0.1,
        autostepIncludeDynamicBodies: autostep?.includeDynamicBodies ?? false,
        applyImpulsesToDynamicBodies: input.applyImpulsesToDynamicBodies ?? false,
        characterMassMode,
        characterMass: input.characterMass ?? 0,
    };
}
export function createPhysicsMaterial(input = {}) {
    return {
        friction: input.friction ?? 0.5,
        restitution: input.restitution ?? 0,
        density: input.density ?? 1,
        frictionCombine: input.frictionCombine ?? PhysicsMaterialCombineRule.Average,
        restitutionCombine: input.restitutionCombine ?? PhysicsMaterialCombineRule.Average,
    };
}
export function createPhysicsJoint(input = {}) {
    return {
        enabled: input.enabled ?? true,
        kind: input.kind ?? PhysicsJointKind.Fixed,
        bodyARef: input.bodyARef ?? "",
        bodyBRef: input.bodyBRef ?? "",
        anchorA: toTuple3(input.anchorA ?? [0, 0, 0]),
        anchorB: toTuple3(input.anchorB ?? [0, 0, 0]),
        frameA: toTuple4(input.frameA ?? [0, 0, 0, 1]),
        frameB: toTuple4(input.frameB ?? [0, 0, 0, 1]),
        axis: toTuple3(input.axis ?? [0, 1, 0]),
        minLimit: input.minLimit ?? 0,
        maxLimit: input.maxLimit ?? 0,
        motorMode: input.motorMode ?? PhysicsJointMotorMode.Position,
        motorModel: input.motorModel ?? PhysicsJointMotorModel.Acceleration,
        motorTarget: input.motorTarget ?? 0,
        motorVelocity: input.motorVelocity ?? 0,
        motorStiffness: input.motorStiffness ?? 0,
        motorDamping: input.motorDamping ?? 0,
        motorFactor: input.motorFactor ?? 0,
        motorMaxForce: input.motorMaxForce ?? 0,
        contactsEnabled: input.contactsEnabled ?? true,
        breakForce: input.breakForce ?? 0,
    };
}
export function createPhysicsDebug(input = {}) {
    return {
        colliderWireframes: input.colliderWireframes ?? false,
        contactNormals: input.contactNormals ?? false,
        bodyStateMarkers: input.bodyStateMarkers ?? false,
        broadphaseAabbs: input.broadphaseAabbs ?? false,
        jointFrames: input.jointFrames ?? false,
    };
}
export function createPhysicsBodyState(input = {}) {
    return {
        sleeping: input.sleeping ?? false,
        currentTranslation: toTuple3(input.currentTranslation ?? [0, 0, 0]),
        currentRotation: toTuple4(input.currentRotation ?? [0, 0, 0, 1]),
        previousTranslation: toTuple3(input.previousTranslation ?? [0, 0, 0]),
        previousRotation: toTuple4(input.previousRotation ?? [0, 0, 0, 1]),
        backendBodyId: input.backendBodyId ?? "",
    };
}
function toTuple3(values) {
    return tuple3(read(values, 0), read(values, 1), read(values, 2));
}
function toTuple4(values) {
    return tuple4(read(values, 0), read(values, 1), read(values, 2), read(values, 3));
}
function tuple3(x, y, z) {
    return [x, y, z];
}
function tuple4(x, y, z, w) {
    return [x, y, z, w];
}
function read(values, index) {
    const value = values[index];
    if (value === undefined) {
        throw new RangeError(`Expected numeric value at index ${index}.`);
    }
    return value;
}
//# sourceMappingURL=components.js.map