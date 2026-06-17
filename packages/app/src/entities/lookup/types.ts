import type {
  PhysicsColliderAxis,
  PhysicsColliderShapeKind,
  PhysicsCharacterMassMode,
  PhysicsJointKind,
  PhysicsJointMotorMode,
  PhysicsJointMotorModel,
  PhysicsMaterialCombineRule,
  PhysicsRigidBodyType,
} from "@aperture-engine/physics";
import type {
  SpriteBillboardMode,
  SpriteBlendMode,
  SpriteCoordinateMode,
  SpriteDepthMode,
  SpriteSizeMode,
} from "@aperture-engine/render";
import type { EcsEntityRef } from "../../config.js";

export interface ApertureEntitySourceSummary {
  readonly assetId?: string;
  readonly gltfNodeIndex?: number;
  readonly gltfNodePath?: string;
}

export interface ApertureEntitySummary {
  readonly entity: EcsEntityRef;
  readonly key?: string;
  readonly name: string;
  readonly enabled?: boolean;
  readonly componentIds: readonly string[];
  readonly tags?: readonly string[];
  readonly source?: ApertureEntitySourceSummary;
  readonly parent?: EcsEntityRef;
  readonly localTransform?: ApertureLocalTransformSummary;
  readonly worldTransform?: ApertureWorldTransformSummary;
  readonly renderSprite?: ApertureRenderSpriteSummary;
  readonly physicsRigidBody?: AperturePhysicsRigidBodySummary;
  readonly physicsCollider?: AperturePhysicsColliderSummary;
  readonly physicsVelocity?: AperturePhysicsVelocitySummary;
  readonly physicsExternalForce?: AperturePhysicsExternalForceSummary;
  readonly physicsExternalImpulse?: AperturePhysicsExternalImpulseSummary;
  readonly physicsKinematicTarget?: AperturePhysicsKinematicTargetSummary;
  readonly physicsGravity?: AperturePhysicsGravitySummary;
  readonly physicsCharacterController?: AperturePhysicsCharacterControllerSummary;
  readonly physicsMaterial?: AperturePhysicsMaterialSummary;
  readonly physicsDebug?: AperturePhysicsDebugSummary;
  readonly physicsJoint?: AperturePhysicsJointSummary;
  readonly physicsBodyState?: AperturePhysicsBodyStateSummary;
}

export interface ApertureLocalTransformSummary {
  readonly translation: readonly [number, number, number];
  readonly rotation: readonly [number, number, number, number];
  readonly scale: readonly [number, number, number];
}

export interface ApertureWorldTransformSummary {
  readonly matrix: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
}

export interface ApertureRenderSpriteSummary {
  readonly textureId: string;
  readonly samplerId: string;
  readonly color: readonly [number, number, number, number];
  readonly width: number;
  readonly height: number;
  readonly uvRect: readonly [number, number, number, number];
  readonly pivot: readonly [number, number];
  readonly rotation: number;
  readonly atlasFrame: number;
  readonly coordinateMode: SpriteCoordinateMode;
  readonly billboardMode: SpriteBillboardMode;
  readonly sizeMode: SpriteSizeMode;
  readonly blendMode: SpriteBlendMode;
  readonly depthMode: SpriteDepthMode;
}

export interface AperturePhysicsRigidBodySummary {
  readonly enabled: boolean;
  readonly type: PhysicsRigidBodyType;
  readonly gravityScale: number;
  readonly linearDamping: number;
  readonly angularDamping: number;
  readonly canSleep: boolean;
  readonly ccdEnabled: boolean;
  readonly lockTranslationX: boolean;
  readonly lockTranslationY: boolean;
  readonly lockTranslationZ: boolean;
  readonly lockRotationX: boolean;
  readonly lockRotationY: boolean;
  readonly lockRotationZ: boolean;
}

export interface AperturePhysicsColliderSummary {
  readonly enabled: boolean;
  readonly shapeKind: PhysicsColliderShapeKind;
  readonly halfExtents: readonly [number, number, number];
  readonly radius: number;
  readonly halfHeight: number;
  readonly axis: PhysicsColliderAxis;
  readonly meshId: string;
  readonly heightfieldAssetId: string;
  readonly offsetTranslation: readonly [number, number, number];
  readonly offsetRotation: readonly [number, number, number, number];
  readonly sensor: boolean;
  readonly density: number;
  readonly friction: number;
  readonly restitution: number;
  readonly collisionGroups: number;
  readonly solverGroups: number;
}

export interface AperturePhysicsVelocitySummary {
  readonly linear: readonly [number, number, number];
  readonly angular: readonly [number, number, number];
}

export interface AperturePhysicsExternalForceSummary {
  readonly force: readonly [number, number, number];
  readonly torque: readonly [number, number, number];
}

export interface AperturePhysicsExternalImpulseSummary {
  readonly impulse: readonly [number, number, number];
  readonly angularImpulse: readonly [number, number, number];
}

export interface AperturePhysicsKinematicTargetSummary {
  readonly enabled: boolean;
  readonly translation: readonly [number, number, number];
  readonly rotation: readonly [number, number, number, number];
}

export interface AperturePhysicsGravitySummary {
  readonly gravity: readonly [number, number, number];
}

export interface AperturePhysicsCharacterControllerSummary {
  readonly enabled: boolean;
  readonly offset: number;
  readonly up: readonly [number, number, number];
  readonly slide: boolean;
  readonly maxSlopeClimbAngleEnabled: boolean;
  readonly maxSlopeClimbAngle: number;
  readonly minSlopeSlideAngleEnabled: boolean;
  readonly minSlopeSlideAngle: number;
  readonly snapToGroundDistance: number;
  readonly autostepEnabled: boolean;
  readonly autostepMaxHeight: number;
  readonly autostepMinWidth: number;
  readonly autostepIncludeDynamicBodies: boolean;
  readonly applyImpulsesToDynamicBodies: boolean;
  readonly characterMassMode: PhysicsCharacterMassMode;
  readonly characterMass: number;
}

export interface AperturePhysicsMaterialSummary {
  readonly friction: number;
  readonly restitution: number;
  readonly density: number;
  readonly frictionCombine: PhysicsMaterialCombineRule;
  readonly restitutionCombine: PhysicsMaterialCombineRule;
}

export interface AperturePhysicsDebugSummary {
  readonly colliderWireframes: boolean;
  readonly contactNormals: boolean;
  readonly bodyStateMarkers: boolean;
  readonly broadphaseAabbs: boolean;
  readonly jointFrames: boolean;
}

export interface AperturePhysicsJointSummary {
  readonly enabled: boolean;
  readonly kind: PhysicsJointKind;
  readonly bodyARef: string;
  readonly bodyBRef: string;
  readonly anchorA: readonly [number, number, number];
  readonly anchorB: readonly [number, number, number];
  readonly frameA: readonly [number, number, number, number];
  readonly frameB: readonly [number, number, number, number];
  readonly axis: readonly [number, number, number];
  readonly minLimit: number;
  readonly maxLimit: number;
  readonly motorMode: PhysicsJointMotorMode;
  readonly motorModel: PhysicsJointMotorModel;
  readonly motorTarget: number;
  readonly motorVelocity: number;
  readonly motorStiffness: number;
  readonly motorDamping: number;
  readonly motorFactor: number;
  readonly motorMaxForce: number;
  readonly contactsEnabled: boolean;
  readonly breakForce: number;
}

export interface AperturePhysicsBodyStateSummary {
  readonly sleeping: boolean;
  readonly currentTranslation: readonly [number, number, number];
  readonly currentRotation: readonly [number, number, number, number];
  readonly previousTranslation: readonly [number, number, number];
  readonly previousRotation: readonly [number, number, number, number];
  readonly backendBodyId?: string;
}

export interface ApertureEntityHierarchyNode {
  readonly entity: EcsEntityRef;
  readonly key?: string;
  readonly name: string;
  readonly parent?: EcsEntityRef;
  readonly children: readonly ApertureEntityHierarchyNode[];
}

export interface ApertureEntityHierarchyReport {
  readonly roots: readonly ApertureEntityHierarchyNode[];
  readonly total: number;
  readonly diagnostics: readonly ApertureEntityLookupDiagnostic[];
}

export interface ApertureEntityLookupSourceFilter {
  readonly assetId?: string;
  readonly gltfNodeIndex?: number;
  readonly gltfNodePath?: string;
}

export interface ApertureEntityFindQuery {
  readonly key?: string;
  readonly namePattern?: string;
  readonly withComponents?: readonly string[];
  readonly tags?: readonly string[];
  readonly source?: ApertureEntityLookupSourceFilter;
  readonly limit?: number;
}

export interface ApertureEntityLookupDiagnostic {
  readonly code: string;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly suggestedFix: string;
}

export interface ApertureEntityFindReport {
  readonly summaries: readonly ApertureEntitySummary[];
  readonly total: number;
  readonly truncated: boolean;
  readonly diagnostics: readonly ApertureEntityLookupDiagnostic[];
}

export type ApertureEntityGetReport =
  | {
      readonly ok: true;
      readonly summary: ApertureEntitySummary;
    }
  | {
      readonly ok: false;
      readonly diagnostic: ApertureEntityLookupDiagnostic;
    };

export interface ApertureEntityLookupSnapshot {
  readonly label?: string;
  readonly summaries: readonly ApertureEntitySummary[];
  readonly total: number;
  readonly truncated: boolean;
  readonly diagnostics: readonly ApertureEntityLookupDiagnostic[];
}

export interface ApertureEntityLookupSnapshotOptions extends ApertureEntityFindQuery {
  readonly label?: string;
  readonly entities?: readonly EcsEntityRef[];
}

export interface ApertureEntitySnapshotChange {
  readonly entity: EcsEntityRef;
  readonly fields: readonly string[];
  readonly before: ApertureEntitySummary;
  readonly after: ApertureEntitySummary;
}

export interface ApertureEntitySnapshotDiffCounts {
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
  readonly unchanged: number;
}

export interface ApertureEntitySnapshotDiff {
  readonly fromLabel?: string;
  readonly toLabel?: string;
  readonly counts: ApertureEntitySnapshotDiffCounts;
  readonly added: readonly ApertureEntitySummary[];
  readonly removed: readonly ApertureEntitySummary[];
  readonly changed: readonly ApertureEntitySnapshotChange[];
  readonly unchanged: readonly ApertureEntitySummary[];
  readonly diagnostics: readonly ApertureEntityLookupDiagnostic[];
}

export interface ApertureEntitySetComponentFieldRequest {
  readonly entity: EcsEntityRef;
  readonly component: string;
  readonly field: string;
  readonly value: unknown;
}

export type ApertureEntitySetComponentFieldReport =
  | {
      readonly ok: true;
      readonly component: string;
      readonly field: string;
      readonly value: unknown;
      readonly summary: ApertureEntitySummary;
    }
  | {
      readonly ok: false;
      readonly diagnostic: ApertureEntityLookupDiagnostic;
    };

export interface ApertureEntityLookup {
  find(query?: ApertureEntityFindQuery): ApertureEntityFindReport;
  get(entity: EcsEntityRef): ApertureEntityGetReport;
  snapshot(
    options?: ApertureEntityLookupSnapshotOptions,
  ): ApertureEntityLookupSnapshot;
  diff(
    previous: ApertureEntityLookupSnapshot,
    next: ApertureEntityLookupSnapshot,
  ): ApertureEntitySnapshotDiff;
  setComponentField(
    request: ApertureEntitySetComponentFieldRequest,
  ): ApertureEntitySetComponentFieldReport;
  hierarchy(): ApertureEntityHierarchyReport;
}
