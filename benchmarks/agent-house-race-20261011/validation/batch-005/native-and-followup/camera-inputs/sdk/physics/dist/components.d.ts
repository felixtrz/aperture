import { EcsType, type ComponentInitialData, type EcsWorld, type Vec3Like, type Vec4Like } from "@aperture-engine/simulation";
export declare const PhysicsRigidBodyType: {
    readonly Static: "static";
    readonly Dynamic: "dynamic";
    readonly KinematicPosition: "kinematicPosition";
    readonly KinematicVelocity: "kinematicVelocity";
};
export type PhysicsRigidBodyType = (typeof PhysicsRigidBodyType)[keyof typeof PhysicsRigidBodyType];
export declare const PhysicsColliderShapeKind: {
    readonly Box: "box";
    readonly Sphere: "sphere";
    readonly Capsule: "capsule";
    readonly Cylinder: "cylinder";
    readonly Cone: "cone";
    readonly ConvexHull: "convexHull";
    readonly Trimesh: "trimesh";
    readonly Heightfield: "heightfield";
};
export type PhysicsColliderShapeKind = (typeof PhysicsColliderShapeKind)[keyof typeof PhysicsColliderShapeKind];
export declare const PhysicsColliderAxis: {
    readonly X: "x";
    readonly Y: "y";
    readonly Z: "z";
};
export type PhysicsColliderAxis = (typeof PhysicsColliderAxis)[keyof typeof PhysicsColliderAxis];
export declare const PhysicsMaterialCombineRule: {
    readonly Average: "average";
    readonly Min: "min";
    readonly Max: "max";
    readonly Multiply: "multiply";
};
export type PhysicsMaterialCombineRule = (typeof PhysicsMaterialCombineRule)[keyof typeof PhysicsMaterialCombineRule];
export declare const PhysicsJointKind: {
    readonly Fixed: "fixed";
    readonly Spherical: "spherical";
    readonly Revolute: "revolute";
    readonly Prismatic: "prismatic";
    readonly Distance: "distance";
    readonly Generic: "generic";
};
export type PhysicsJointKind = (typeof PhysicsJointKind)[keyof typeof PhysicsJointKind];
export declare const PhysicsJointMotorMode: {
    readonly Position: "position";
    readonly Velocity: "velocity";
};
export type PhysicsJointMotorMode = (typeof PhysicsJointMotorMode)[keyof typeof PhysicsJointMotorMode];
export declare const PhysicsJointMotorModel: {
    readonly Acceleration: "acceleration";
    readonly Force: "force";
};
export type PhysicsJointMotorModel = (typeof PhysicsJointMotorModel)[keyof typeof PhysicsJointMotorModel];
export declare const PhysicsCharacterMassMode: {
    readonly BackendDefault: "backendDefault";
    readonly Disabled: "disabled";
    readonly Mass: "mass";
};
export type PhysicsCharacterMassMode = (typeof PhysicsCharacterMassMode)[keyof typeof PhysicsCharacterMassMode];
export type PhysicsVec3 = readonly [number, number, number];
export type PhysicsQuat = readonly [number, number, number, number];
export type PhysicsShape = {
    readonly kind: "box";
    readonly halfExtents: PhysicsVec3;
} | {
    readonly kind: "sphere";
    readonly radius: number;
} | {
    readonly kind: "capsule";
    readonly radius: number;
    readonly halfHeight: number;
    readonly axis?: PhysicsColliderAxis;
} | {
    readonly kind: "cylinder";
    readonly radius: number;
    readonly halfHeight: number;
    readonly axis?: PhysicsColliderAxis;
} | {
    readonly kind: "cone";
    readonly radius: number;
    readonly halfHeight: number;
    readonly axis?: PhysicsColliderAxis;
} | {
    readonly kind: "convexHull";
    readonly meshId: string;
} | {
    readonly kind: "trimesh";
    readonly meshId: string;
} | {
    readonly kind: "heightfield";
    readonly assetId: string;
};
export interface RigidBodyInput {
    readonly enabled?: boolean;
    readonly type?: PhysicsRigidBodyType;
    readonly gravityScale?: number;
    readonly linearDamping?: number;
    readonly angularDamping?: number;
    readonly canSleep?: boolean;
    readonly ccdEnabled?: boolean;
    readonly lockTranslationX?: boolean;
    readonly lockTranslationY?: boolean;
    readonly lockTranslationZ?: boolean;
    readonly lockRotationX?: boolean;
    readonly lockRotationY?: boolean;
    readonly lockRotationZ?: boolean;
}
export interface ColliderInput {
    readonly enabled?: boolean;
    readonly shape?: PhysicsShape;
    readonly offsetTranslation?: Vec3Like;
    readonly offsetRotation?: Vec4Like;
    readonly sensor?: boolean;
    readonly density?: number;
    readonly friction?: number;
    readonly restitution?: number;
    readonly collisionGroups?: number;
    readonly solverGroups?: number;
}
export interface PhysicsVelocityInput {
    readonly linear?: Vec3Like;
    readonly angular?: Vec3Like;
}
export interface ExternalForceInput {
    readonly force?: Vec3Like;
    readonly torque?: Vec3Like;
}
export interface ExternalImpulseInput {
    readonly impulse?: Vec3Like;
    readonly angularImpulse?: Vec3Like;
}
export interface KinematicTargetInput {
    readonly enabled?: boolean;
    readonly translation?: Vec3Like;
    readonly rotation?: Vec4Like;
}
export interface PhysicsGravityInput {
    readonly gravity?: Vec3Like;
}
export interface PhysicsCharacterAutostepInput {
    readonly maxHeight: number;
    readonly minWidth: number;
    readonly includeDynamicBodies?: boolean;
}
export interface PhysicsCharacterControllerInput {
    readonly enabled?: boolean;
    readonly offset?: number;
    readonly up?: Vec3Like;
    readonly slide?: boolean;
    readonly maxSlopeClimbAngle?: number;
    readonly minSlopeSlideAngle?: number;
    readonly snapToGroundDistance?: number;
    readonly autostep?: PhysicsCharacterAutostepInput | false;
    readonly applyImpulsesToDynamicBodies?: boolean;
    readonly characterMass?: number | null;
}
export interface PhysicsMaterialInput {
    readonly friction?: number;
    readonly restitution?: number;
    readonly density?: number;
    readonly frictionCombine?: PhysicsMaterialCombineRule;
    readonly restitutionCombine?: PhysicsMaterialCombineRule;
}
export interface PhysicsJointInput {
    readonly enabled?: boolean;
    readonly kind?: PhysicsJointKind;
    readonly bodyARef?: string;
    readonly bodyBRef?: string;
    readonly anchorA?: Vec3Like;
    readonly anchorB?: Vec3Like;
    readonly frameA?: Vec4Like;
    readonly frameB?: Vec4Like;
    readonly axis?: Vec3Like;
    readonly minLimit?: number;
    readonly maxLimit?: number;
    readonly motorMode?: PhysicsJointMotorMode;
    readonly motorModel?: PhysicsJointMotorModel;
    readonly motorTarget?: number;
    readonly motorVelocity?: number;
    readonly motorStiffness?: number;
    readonly motorDamping?: number;
    readonly motorFactor?: number;
    readonly motorMaxForce?: number;
    readonly contactsEnabled?: boolean;
    readonly breakForce?: number;
}
export interface PhysicsDebugInput {
    readonly colliderWireframes?: boolean;
    readonly contactNormals?: boolean;
    readonly bodyStateMarkers?: boolean;
    readonly broadphaseAabbs?: boolean;
    readonly jointFrames?: boolean;
}
export interface PhysicsBodyStateInput {
    readonly sleeping?: boolean;
    readonly currentTranslation?: Vec3Like;
    readonly currentRotation?: Vec4Like;
    readonly previousTranslation?: Vec3Like;
    readonly previousRotation?: Vec4Like;
    readonly backendBodyId?: string;
}
export declare const RigidBody: import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
    type: {
        type: EcsType.Enum;
        enum: {
            readonly Static: "static";
            readonly Dynamic: "dynamic";
            readonly KinematicPosition: "kinematicPosition";
            readonly KinematicVelocity: "kinematicVelocity";
        };
        default: "dynamic";
    };
    gravityScale: {
        type: EcsType.Float32;
        default: number;
    };
    linearDamping: {
        type: EcsType.Float32;
        default: number;
    };
    angularDamping: {
        type: EcsType.Float32;
        default: number;
    };
    canSleep: {
        type: EcsType.Boolean;
        default: true;
    };
    ccdEnabled: {
        type: EcsType.Boolean;
        default: false;
    };
    lockTranslationX: {
        type: EcsType.Boolean;
        default: false;
    };
    lockTranslationY: {
        type: EcsType.Boolean;
        default: false;
    };
    lockTranslationZ: {
        type: EcsType.Boolean;
        default: false;
    };
    lockRotationX: {
        type: EcsType.Boolean;
        default: false;
    };
    lockRotationY: {
        type: EcsType.Boolean;
        default: false;
    };
    lockRotationZ: {
        type: EcsType.Boolean;
        default: false;
    };
}>;
export declare const Collider: import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
    shapeKind: {
        type: EcsType.Enum;
        enum: {
            readonly Box: "box";
            readonly Sphere: "sphere";
            readonly Capsule: "capsule";
            readonly Cylinder: "cylinder";
            readonly Cone: "cone";
            readonly ConvexHull: "convexHull";
            readonly Trimesh: "trimesh";
            readonly Heightfield: "heightfield";
        };
        default: "box";
    };
    halfExtents: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    radius: {
        type: EcsType.Float32;
        default: number;
    };
    halfHeight: {
        type: EcsType.Float32;
        default: number;
    };
    axis: {
        type: EcsType.Enum;
        enum: {
            readonly X: "x";
            readonly Y: "y";
            readonly Z: "z";
        };
        default: "y";
    };
    meshId: {
        type: EcsType.String;
        default: string;
    };
    heightfieldAssetId: {
        type: EcsType.String;
        default: string;
    };
    offsetTranslation: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    offsetRotation: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    sensor: {
        type: EcsType.Boolean;
        default: false;
    };
    density: {
        type: EcsType.Float32;
        default: number;
    };
    friction: {
        type: EcsType.Float32;
        default: number;
    };
    restitution: {
        type: EcsType.Float32;
        default: number;
    };
    collisionGroups: {
        type: EcsType.Int32;
        default: number;
    };
    solverGroups: {
        type: EcsType.Int32;
        default: number;
    };
}>;
export declare const PhysicsVelocity: import("elics").Component<{
    linear: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    angular: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
}>;
export declare const ExternalForce: import("elics").Component<{
    force: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    torque: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
}>;
export declare const ExternalImpulse: import("elics").Component<{
    impulse: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    angularImpulse: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
}>;
export declare const KinematicTarget: import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
    translation: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    rotation: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
}>;
export declare const PhysicsGravity: import("elics").Component<{
    gravity: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
}>;
export declare const PhysicsCharacterController: import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
    offset: {
        type: EcsType.Float32;
        default: number;
    };
    up: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    slide: {
        type: EcsType.Boolean;
        default: true;
    };
    maxSlopeClimbAngleEnabled: {
        type: EcsType.Boolean;
        default: false;
    };
    maxSlopeClimbAngle: {
        type: EcsType.Float32;
        default: number;
    };
    minSlopeSlideAngleEnabled: {
        type: EcsType.Boolean;
        default: false;
    };
    minSlopeSlideAngle: {
        type: EcsType.Float32;
        default: number;
    };
    snapToGroundDistance: {
        type: EcsType.Float32;
        default: number;
    };
    autostepEnabled: {
        type: EcsType.Boolean;
        default: false;
    };
    autostepMaxHeight: {
        type: EcsType.Float32;
        default: number;
    };
    autostepMinWidth: {
        type: EcsType.Float32;
        default: number;
    };
    autostepIncludeDynamicBodies: {
        type: EcsType.Boolean;
        default: false;
    };
    applyImpulsesToDynamicBodies: {
        type: EcsType.Boolean;
        default: false;
    };
    characterMassMode: {
        type: EcsType.Enum;
        enum: {
            readonly BackendDefault: "backendDefault";
            readonly Disabled: "disabled";
            readonly Mass: "mass";
        };
        default: "backendDefault";
    };
    characterMass: {
        type: EcsType.Float32;
        default: number;
    };
}>;
export declare const PhysicsMaterial: import("elics").Component<{
    friction: {
        type: EcsType.Float32;
        default: number;
    };
    restitution: {
        type: EcsType.Float32;
        default: number;
    };
    density: {
        type: EcsType.Float32;
        default: number;
    };
    frictionCombine: {
        type: EcsType.Enum;
        enum: {
            readonly Average: "average";
            readonly Min: "min";
            readonly Max: "max";
            readonly Multiply: "multiply";
        };
        default: "average";
    };
    restitutionCombine: {
        type: EcsType.Enum;
        enum: {
            readonly Average: "average";
            readonly Min: "min";
            readonly Max: "max";
            readonly Multiply: "multiply";
        };
        default: "average";
    };
}>;
export declare const PhysicsJoint: import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
    kind: {
        type: EcsType.Enum;
        enum: {
            readonly Fixed: "fixed";
            readonly Spherical: "spherical";
            readonly Revolute: "revolute";
            readonly Prismatic: "prismatic";
            readonly Distance: "distance";
            readonly Generic: "generic";
        };
        default: "fixed";
    };
    bodyARef: {
        type: EcsType.String;
        default: string;
    };
    bodyBRef: {
        type: EcsType.String;
        default: string;
    };
    anchorA: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    anchorB: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    frameA: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    frameB: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    axis: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    minLimit: {
        type: EcsType.Float32;
        default: number;
    };
    maxLimit: {
        type: EcsType.Float32;
        default: number;
    };
    motorMode: {
        type: EcsType.Enum;
        enum: {
            readonly Position: "position";
            readonly Velocity: "velocity";
        };
        default: "position";
    };
    motorModel: {
        type: EcsType.Enum;
        enum: {
            readonly Acceleration: "acceleration";
            readonly Force: "force";
        };
        default: "acceleration";
    };
    motorTarget: {
        type: EcsType.Float32;
        default: number;
    };
    motorVelocity: {
        type: EcsType.Float32;
        default: number;
    };
    motorStiffness: {
        type: EcsType.Float32;
        default: number;
    };
    motorDamping: {
        type: EcsType.Float32;
        default: number;
    };
    motorFactor: {
        type: EcsType.Float32;
        default: number;
    };
    motorMaxForce: {
        type: EcsType.Float32;
        default: number;
    };
    contactsEnabled: {
        type: EcsType.Boolean;
        default: true;
    };
    breakForce: {
        type: EcsType.Float32;
        default: number;
    };
}>;
export declare const PhysicsDebug: import("elics").Component<{
    colliderWireframes: {
        type: EcsType.Boolean;
        default: false;
    };
    contactNormals: {
        type: EcsType.Boolean;
        default: false;
    };
    bodyStateMarkers: {
        type: EcsType.Boolean;
        default: false;
    };
    broadphaseAabbs: {
        type: EcsType.Boolean;
        default: false;
    };
    jointFrames: {
        type: EcsType.Boolean;
        default: false;
    };
}>;
export declare const PhysicsBodyState: import("elics").Component<{
    sleeping: {
        type: EcsType.Boolean;
        default: false;
    };
    currentTranslation: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    currentRotation: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    previousTranslation: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    previousRotation: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    backendBodyId: {
        type: EcsType.String;
        default: string;
    };
}>;
export declare const PHYSICS_AUTHORING_COMPONENTS: readonly [import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
    type: {
        type: EcsType.Enum;
        enum: {
            readonly Static: "static";
            readonly Dynamic: "dynamic";
            readonly KinematicPosition: "kinematicPosition";
            readonly KinematicVelocity: "kinematicVelocity";
        };
        default: "dynamic";
    };
    gravityScale: {
        type: EcsType.Float32;
        default: number;
    };
    linearDamping: {
        type: EcsType.Float32;
        default: number;
    };
    angularDamping: {
        type: EcsType.Float32;
        default: number;
    };
    canSleep: {
        type: EcsType.Boolean;
        default: true;
    };
    ccdEnabled: {
        type: EcsType.Boolean;
        default: false;
    };
    lockTranslationX: {
        type: EcsType.Boolean;
        default: false;
    };
    lockTranslationY: {
        type: EcsType.Boolean;
        default: false;
    };
    lockTranslationZ: {
        type: EcsType.Boolean;
        default: false;
    };
    lockRotationX: {
        type: EcsType.Boolean;
        default: false;
    };
    lockRotationY: {
        type: EcsType.Boolean;
        default: false;
    };
    lockRotationZ: {
        type: EcsType.Boolean;
        default: false;
    };
}>, import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
    shapeKind: {
        type: EcsType.Enum;
        enum: {
            readonly Box: "box";
            readonly Sphere: "sphere";
            readonly Capsule: "capsule";
            readonly Cylinder: "cylinder";
            readonly Cone: "cone";
            readonly ConvexHull: "convexHull";
            readonly Trimesh: "trimesh";
            readonly Heightfield: "heightfield";
        };
        default: "box";
    };
    halfExtents: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    radius: {
        type: EcsType.Float32;
        default: number;
    };
    halfHeight: {
        type: EcsType.Float32;
        default: number;
    };
    axis: {
        type: EcsType.Enum;
        enum: {
            readonly X: "x";
            readonly Y: "y";
            readonly Z: "z";
        };
        default: "y";
    };
    meshId: {
        type: EcsType.String;
        default: string;
    };
    heightfieldAssetId: {
        type: EcsType.String;
        default: string;
    };
    offsetTranslation: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    offsetRotation: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    sensor: {
        type: EcsType.Boolean;
        default: false;
    };
    density: {
        type: EcsType.Float32;
        default: number;
    };
    friction: {
        type: EcsType.Float32;
        default: number;
    };
    restitution: {
        type: EcsType.Float32;
        default: number;
    };
    collisionGroups: {
        type: EcsType.Int32;
        default: number;
    };
    solverGroups: {
        type: EcsType.Int32;
        default: number;
    };
}>, import("elics").Component<{
    linear: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    angular: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
}>, import("elics").Component<{
    force: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    torque: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
}>, import("elics").Component<{
    impulse: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    angularImpulse: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
}>, import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
    translation: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    rotation: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
}>, import("elics").Component<{
    gravity: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
}>, import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
    offset: {
        type: EcsType.Float32;
        default: number;
    };
    up: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    slide: {
        type: EcsType.Boolean;
        default: true;
    };
    maxSlopeClimbAngleEnabled: {
        type: EcsType.Boolean;
        default: false;
    };
    maxSlopeClimbAngle: {
        type: EcsType.Float32;
        default: number;
    };
    minSlopeSlideAngleEnabled: {
        type: EcsType.Boolean;
        default: false;
    };
    minSlopeSlideAngle: {
        type: EcsType.Float32;
        default: number;
    };
    snapToGroundDistance: {
        type: EcsType.Float32;
        default: number;
    };
    autostepEnabled: {
        type: EcsType.Boolean;
        default: false;
    };
    autostepMaxHeight: {
        type: EcsType.Float32;
        default: number;
    };
    autostepMinWidth: {
        type: EcsType.Float32;
        default: number;
    };
    autostepIncludeDynamicBodies: {
        type: EcsType.Boolean;
        default: false;
    };
    applyImpulsesToDynamicBodies: {
        type: EcsType.Boolean;
        default: false;
    };
    characterMassMode: {
        type: EcsType.Enum;
        enum: {
            readonly BackendDefault: "backendDefault";
            readonly Disabled: "disabled";
            readonly Mass: "mass";
        };
        default: "backendDefault";
    };
    characterMass: {
        type: EcsType.Float32;
        default: number;
    };
}>, import("elics").Component<{
    friction: {
        type: EcsType.Float32;
        default: number;
    };
    restitution: {
        type: EcsType.Float32;
        default: number;
    };
    density: {
        type: EcsType.Float32;
        default: number;
    };
    frictionCombine: {
        type: EcsType.Enum;
        enum: {
            readonly Average: "average";
            readonly Min: "min";
            readonly Max: "max";
            readonly Multiply: "multiply";
        };
        default: "average";
    };
    restitutionCombine: {
        type: EcsType.Enum;
        enum: {
            readonly Average: "average";
            readonly Min: "min";
            readonly Max: "max";
            readonly Multiply: "multiply";
        };
        default: "average";
    };
}>, import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
    kind: {
        type: EcsType.Enum;
        enum: {
            readonly Fixed: "fixed";
            readonly Spherical: "spherical";
            readonly Revolute: "revolute";
            readonly Prismatic: "prismatic";
            readonly Distance: "distance";
            readonly Generic: "generic";
        };
        default: "fixed";
    };
    bodyARef: {
        type: EcsType.String;
        default: string;
    };
    bodyBRef: {
        type: EcsType.String;
        default: string;
    };
    anchorA: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    anchorB: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    frameA: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    frameB: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    axis: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    minLimit: {
        type: EcsType.Float32;
        default: number;
    };
    maxLimit: {
        type: EcsType.Float32;
        default: number;
    };
    motorMode: {
        type: EcsType.Enum;
        enum: {
            readonly Position: "position";
            readonly Velocity: "velocity";
        };
        default: "position";
    };
    motorModel: {
        type: EcsType.Enum;
        enum: {
            readonly Acceleration: "acceleration";
            readonly Force: "force";
        };
        default: "acceleration";
    };
    motorTarget: {
        type: EcsType.Float32;
        default: number;
    };
    motorVelocity: {
        type: EcsType.Float32;
        default: number;
    };
    motorStiffness: {
        type: EcsType.Float32;
        default: number;
    };
    motorDamping: {
        type: EcsType.Float32;
        default: number;
    };
    motorFactor: {
        type: EcsType.Float32;
        default: number;
    };
    motorMaxForce: {
        type: EcsType.Float32;
        default: number;
    };
    contactsEnabled: {
        type: EcsType.Boolean;
        default: true;
    };
    breakForce: {
        type: EcsType.Float32;
        default: number;
    };
}>, import("elics").Component<{
    colliderWireframes: {
        type: EcsType.Boolean;
        default: false;
    };
    contactNormals: {
        type: EcsType.Boolean;
        default: false;
    };
    bodyStateMarkers: {
        type: EcsType.Boolean;
        default: false;
    };
    broadphaseAabbs: {
        type: EcsType.Boolean;
        default: false;
    };
    jointFrames: {
        type: EcsType.Boolean;
        default: false;
    };
}>];
export declare const PHYSICS_DERIVED_COMPONENTS: readonly [import("elics").Component<{
    sleeping: {
        type: EcsType.Boolean;
        default: false;
    };
    currentTranslation: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    currentRotation: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    previousTranslation: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    previousRotation: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    backendBodyId: {
        type: EcsType.String;
        default: string;
    };
}>];
export declare const PHYSICS_DERIVED_COMPONENT_IDS: readonly [string];
export declare const PHYSICS_ENTITY_REF_STRING_FIELDS: {
    readonly [PhysicsJoint.id]: readonly ["bodyARef", "bodyBRef"];
};
export declare function registerPhysicsComponents(world: EcsWorld): EcsWorld;
export declare function createRigidBody(input?: RigidBodyInput): ComponentInitialData<typeof RigidBody>;
export declare function createCollider(input?: ColliderInput): ComponentInitialData<typeof Collider>;
export declare function createPhysicsVelocity(input?: PhysicsVelocityInput): ComponentInitialData<typeof PhysicsVelocity>;
export declare function createExternalForce(input?: ExternalForceInput): ComponentInitialData<typeof ExternalForce>;
export declare function createExternalImpulse(input?: ExternalImpulseInput): ComponentInitialData<typeof ExternalImpulse>;
export declare function createKinematicTarget(input?: KinematicTargetInput): ComponentInitialData<typeof KinematicTarget>;
export declare function createPhysicsGravity(input?: PhysicsGravityInput): ComponentInitialData<typeof PhysicsGravity>;
export declare function createPhysicsCharacterController(input?: PhysicsCharacterControllerInput): ComponentInitialData<typeof PhysicsCharacterController>;
export declare function createPhysicsMaterial(input?: PhysicsMaterialInput): ComponentInitialData<typeof PhysicsMaterial>;
export declare function createPhysicsJoint(input?: PhysicsJointInput): ComponentInitialData<typeof PhysicsJoint>;
export declare function createPhysicsDebug(input?: PhysicsDebugInput): ComponentInitialData<typeof PhysicsDebug>;
export declare function createPhysicsBodyState(input?: PhysicsBodyStateInput): ComponentInitialData<typeof PhysicsBodyState>;
//# sourceMappingURL=components.d.ts.map