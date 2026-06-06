import type {
  PhysicsJointKind,
  PhysicsJointMotorMode,
  PhysicsJointMotorModel,
  PhysicsMaterialCombineRule,
  PhysicsQuat,
  PhysicsRigidBodyType,
  PhysicsShape,
  PhysicsVec3,
} from "./components.js";

export type PhysicsBackendKind = "rapier" | "test";

export type PhysicsBackendBuild =
  | "performance"
  | "compat"
  | "deterministic"
  | "test";

export type PhysicsExecutionMode =
  | "simulation-worker"
  | "physics-worker-transferable";

export type PhysicsEntityRef = string;

export interface PhysicsBackendCapabilities {
  readonly compoundColliders: boolean;
  readonly continuousCollisionDetection: boolean;
  readonly characterController: boolean;
  readonly linkedBodyContacts: boolean;
  readonly combinedPositionVelocityMotors: boolean;
  readonly motorForceLimits: boolean;
  readonly automaticBreakForce: boolean;
  readonly jointImpulseReadback: boolean;
  readonly pairedNonFixedFrameB: boolean;
}

export const TEST_PHYSICS_BACKEND_CAPABILITIES: PhysicsBackendCapabilities = {
  compoundColliders: true,
  continuousCollisionDetection: false,
  characterController: true,
  linkedBodyContacts: false,
  combinedPositionVelocityMotors: false,
  motorForceLimits: false,
  automaticBreakForce: false,
  jointImpulseReadback: false,
  pairedNonFixedFrameB: false,
};

export const RAPIER_PHYSICS_BACKEND_CAPABILITIES: PhysicsBackendCapabilities = {
  compoundColliders: true,
  continuousCollisionDetection: true,
  characterController: true,
  linkedBodyContacts: true,
  combinedPositionVelocityMotors: true,
  motorForceLimits: false,
  automaticBreakForce: false,
  jointImpulseReadback: false,
  pairedNonFixedFrameB: false,
};

export interface PhysicsTransform {
  readonly translation: PhysicsVec3;
  readonly rotation: PhysicsQuat;
}

export interface PhysicsVelocityValue {
  readonly linear: PhysicsVec3;
  readonly angular: PhysicsVec3;
}

export interface PhysicsExternalForceValue {
  readonly force: PhysicsVec3;
  readonly torque: PhysicsVec3;
}

export interface PhysicsExternalImpulseValue {
  readonly impulse: PhysicsVec3;
  readonly angularImpulse: PhysicsVec3;
}

export interface PhysicsColliderDescriptor {
  readonly entity?: PhysicsEntityRef;
  readonly shape: PhysicsShape;
  readonly offsetTranslation?: PhysicsVec3;
  readonly offsetRotation?: PhysicsQuat;
  readonly sensor?: boolean;
  readonly density?: number;
  readonly friction?: number;
  readonly restitution?: number;
  readonly frictionCombine?: PhysicsMaterialCombineRule;
  readonly restitutionCombine?: PhysicsMaterialCombineRule;
  readonly collisionGroups?: number;
  readonly solverGroups?: number;
}

export interface PhysicsJointDescriptor {
  readonly kind: PhysicsJointKind;
  readonly bodyARef: PhysicsEntityRef;
  readonly bodyBRef: PhysicsEntityRef;
  readonly anchorA: PhysicsVec3;
  readonly anchorB: PhysicsVec3;
  readonly frameA?: PhysicsQuat;
  readonly frameB?: PhysicsQuat;
  readonly axis: PhysicsVec3;
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

export interface PhysicsBackendInit {
  readonly gravity?: PhysicsVec3;
  readonly execution?: PhysicsExecutionMode;
}

export type PhysicsCommand =
  | {
      readonly kind: "setGravity";
      readonly gravity: PhysicsVec3;
    }
  | {
      readonly kind: "upsertBody";
      readonly entity: PhysicsEntityRef;
      readonly transform: PhysicsTransform;
      readonly kinematicTarget?: PhysicsTransform;
      readonly bodyType?: PhysicsRigidBodyType;
      readonly gravityScale?: number;
      readonly linearDamping?: number;
      readonly angularDamping?: number;
      readonly canSleep?: boolean;
      readonly ccdEnabled?: boolean;
      readonly lockTranslations?: readonly [boolean, boolean, boolean];
      readonly lockRotations?: readonly [boolean, boolean, boolean];
      readonly parented?: boolean;
      readonly velocity?: PhysicsVelocityValue;
      readonly externalForce?: PhysicsExternalForceValue;
      readonly externalImpulse?: PhysicsExternalImpulseValue;
      readonly collider?: PhysicsColliderDescriptor;
      readonly colliders?: readonly PhysicsColliderDescriptor[];
      readonly radius?: number;
    }
  | { readonly kind: "destroyBody"; readonly entity: PhysicsEntityRef }
  | {
      readonly kind: "upsertJoint";
      readonly entity: PhysicsEntityRef;
      readonly joint: PhysicsJointDescriptor;
    }
  | { readonly kind: "destroyJoint"; readonly entity: PhysicsEntityRef }
  | {
      readonly kind: "setVelocity";
      readonly entity: PhysicsEntityRef;
      readonly velocity: PhysicsVelocityValue;
    }
  | {
      readonly kind: "emitTrigger";
      readonly entityA: PhysicsEntityRef;
      readonly entityB: PhysicsEntityRef;
    };

export interface PhysicsCommandBuffer {
  readonly commands: readonly PhysicsCommand[];
}

export interface PhysicsBodyResult {
  readonly entity: PhysicsEntityRef;
  readonly transform: PhysicsTransform;
  readonly velocity: PhysicsVelocityValue;
  readonly sleeping: boolean;
}

export type PhysicsEventKind =
  | "collisionStart"
  | "collisionStay"
  | "collisionEnd"
  | "triggerEnter"
  | "triggerStay"
  | "triggerExit"
  | "sleep"
  | "wake"
  | "contactForce"
  | "controllerGroundedChanged"
  | "jointBreak";

export interface PhysicsEvent {
  readonly kind: PhysicsEventKind;
  readonly frame: number;
  readonly fixedStep: number;
  readonly substep: number;
  readonly joint?: PhysicsEntityRef;
  readonly entityA: PhysicsEntityRef;
  readonly entityB: PhysicsEntityRef;
  readonly colliderA: PhysicsEntityRef;
  readonly colliderB: PhysicsEntityRef;
  readonly point?: PhysicsVec3;
  readonly normal?: PhysicsVec3;
  readonly force?: PhysicsVec3;
  readonly forceMagnitude?: number;
  readonly maxForceMagnitude?: number;
  readonly impulse?: number;
  readonly grounded?: boolean;
}

export interface PhysicsResultBuffer {
  readonly bodies: PhysicsBodyResult[];
  readonly events: PhysicsEvent[];
}

export type PhysicsUnsupportedFeatureCode =
  | "physics.rigidBody.ccd.unsupported"
  | "physics.rigidBody.parentedBody.unsupported"
  | "physics.collider.assetShape.unsupported"
  | "physics.joint.unsupported"
  | "physics.characterController.unsupported"
  | "physics.debugGeometry.unsupported"
  | "physics.joint.impulseReadback.unsupported"
  | "physics.joint.breakForce.unsupported"
  | "physics.joint.motorMaxForce.unsupported"
  | "physics.joint.frameB.unsupported";

export interface PhysicsUnsupportedFeature {
  readonly code: PhysicsUnsupportedFeatureCode;
  readonly feature: string;
  readonly backend: PhysicsBackendKind;
  readonly entity: PhysicsEntityRef;
  readonly value?: number;
  readonly message: string;
  readonly suggestedFix: string;
}

export interface PhysicsSyncReport {
  readonly commandCount: number;
  readonly bodyCount: number;
  readonly colliderCount: number;
  readonly jointCount: number;
  readonly unsupportedFeatureCount: number;
  readonly unsupportedFeatures: readonly PhysicsUnsupportedFeature[];
}

export interface PhysicsStepReport {
  readonly enabled: boolean;
  readonly backend: PhysicsBackendKind;
  readonly backendVersion: string;
  readonly backendBuild: PhysicsBackendBuild;
  readonly execution: PhysicsExecutionMode;
  readonly fixedDelta: number;
  readonly fixedStep: number;
  readonly bodyCount: number;
  readonly colliderCount: number;
  readonly jointCount: number;
  readonly eventCount: number;
  readonly queryCount: number;
  readonly syncToBackendMs: number;
  readonly backendStepMs: number;
  readonly writebackMs: number;
}

export interface PhysicsReadbackReport {
  readonly bodyCount: number;
  readonly eventCount: number;
}

export interface PhysicsRay {
  readonly origin: PhysicsVec3;
  readonly direction: PhysicsVec3;
  readonly maxDistance?: number;
}

export interface PhysicsQueryOptions {
  readonly collisionGroups?: number;
  readonly includeSensors?: boolean;
  readonly excludeEntity?: PhysicsEntityRef;
}

export interface PhysicsRaycastHit {
  readonly entity: PhysicsEntityRef;
  readonly collider?: PhysicsEntityRef;
  readonly point: PhysicsVec3;
  readonly normal: PhysicsVec3;
  readonly distance: number;
}

export interface PhysicsOverlapHit {
  readonly entity: PhysicsEntityRef;
  readonly collider?: PhysicsEntityRef;
}

export interface PhysicsShapeCast {
  readonly from: PhysicsTransform;
  readonly to: PhysicsTransform;
}

export interface PhysicsShapeCastHit {
  readonly entity: PhysicsEntityRef;
  readonly collider?: PhysicsEntityRef;
  readonly timeOfImpact: number;
  readonly point: PhysicsVec3;
  readonly normal: PhysicsVec3;
}

export interface PhysicsPointProjection {
  readonly entity: PhysicsEntityRef;
  readonly collider?: PhysicsEntityRef;
  readonly point: PhysicsVec3;
  readonly normal: PhysicsVec3;
  readonly distance: number;
  readonly inside: boolean;
}

export interface PhysicsCharacterAutostep {
  readonly maxHeight: number;
  readonly minWidth: number;
  readonly includeDynamicBodies?: boolean;
}

export interface PhysicsCharacterControllerSettings {
  readonly offset?: number;
  readonly up?: PhysicsVec3;
  readonly slide?: boolean;
  readonly maxSlopeClimbAngle?: number;
  readonly minSlopeSlideAngle?: number;
  readonly snapToGroundDistance?: number;
  readonly autostep?: PhysicsCharacterAutostep | false;
  readonly applyImpulsesToDynamicBodies?: boolean;
  readonly characterMass?: number | null;
}

export interface PhysicsCharacterMove {
  readonly entity: PhysicsEntityRef;
  readonly desiredTranslation: PhysicsVec3;
  readonly settings?: PhysicsCharacterControllerSettings;
  readonly options?: PhysicsQueryOptions;
}

export interface PhysicsCharacterCollision {
  readonly entity: PhysicsEntityRef | null;
  readonly translationDeltaApplied: PhysicsVec3;
  readonly translationDeltaRemaining: PhysicsVec3;
  readonly timeOfImpact: number;
  readonly point: PhysicsVec3;
  readonly normal: PhysicsVec3;
}

export interface PhysicsCharacterMoveResult {
  readonly entity: PhysicsEntityRef;
  readonly desiredTranslation: PhysicsVec3;
  readonly movement: PhysicsVec3;
  readonly targetTranslation: PhysicsVec3;
  readonly grounded: boolean;
  readonly collisions: readonly PhysicsCharacterCollision[];
}

export interface PhysicsDebugOptions {
  readonly colliderWireframes?: boolean;
  readonly contactNormals?: boolean;
  readonly contactNormalColor?: readonly [number, number, number, number];
  readonly contactNormalLength?: number;
  readonly bodyStateMarkers?: boolean;
  readonly activeBodyColor?: readonly [number, number, number, number];
  readonly sleepingBodyColor?: readonly [number, number, number, number];
  readonly bodyStateMarkerLength?: number;
  readonly broadphaseAabbs?: boolean;
  readonly broadphaseAabbColor?: readonly [number, number, number, number];
  readonly jointFrames?: boolean;
  readonly jointFrameColor?: readonly [number, number, number, number];
  readonly jointAxisColor?: readonly [number, number, number, number];
  readonly jointFrameLength?: number;
  readonly rayProbes?: readonly PhysicsDebugRayProbe[];
}

export interface PhysicsAabb {
  readonly min: PhysicsVec3;
  readonly max: PhysicsVec3;
}

export interface PhysicsDebugGeometry {
  readonly lines: readonly PhysicsDebugLine[];
}

export interface PhysicsDebugLine {
  readonly from: PhysicsVec3;
  readonly to: PhysicsVec3;
  readonly color: readonly [number, number, number, number];
}

export interface PhysicsDebugBoundsSummary {
  readonly min: PhysicsVec3;
  readonly max: PhysicsVec3;
}

export interface PhysicsDebugColorSummary {
  readonly color: readonly [number, number, number, number];
  readonly lineCount: number;
}

export interface PhysicsDebugSummary {
  readonly lineCount: number;
  readonly finiteLineCount: number;
  readonly invalidLineCount: number;
  readonly colorCount: number;
  readonly colors: readonly PhysicsDebugColorSummary[];
  readonly bounds: PhysicsDebugBoundsSummary | null;
}

export interface PhysicsDebugRayProbe {
  readonly ray: PhysicsRay;
  readonly options?: PhysicsQueryOptions;
  readonly hitColor?: readonly [number, number, number, number];
  readonly missColor?: readonly [number, number, number, number];
  readonly normalColor?: readonly [number, number, number, number];
  readonly normalLength?: number;
}

export interface PhysicsBackend {
  readonly kind: PhysicsBackendKind;
  readonly version: string;
  readonly build: PhysicsBackendBuild;
  readonly execution: PhysicsExecutionMode;
  readonly capabilities: PhysicsBackendCapabilities;

  init(options?: PhysicsBackendInit): Promise<void> | void;
  dispose(): void;

  sync(commands: PhysicsCommandBuffer): PhysicsSyncReport;
  step(fixedDelta: number, fixedStepIndex: number): PhysicsStepReport;
  readResults(out: PhysicsResultBuffer): PhysicsReadbackReport;

  raycastFirst(
    ray: PhysicsRay,
    options?: PhysicsQueryOptions,
  ): PhysicsRaycastHit | null;

  raycastAll(
    ray: PhysicsRay,
    options?: PhysicsQueryOptions,
  ): readonly PhysicsRaycastHit[];

  overlapShape?(
    shape: PhysicsShape,
    transform: PhysicsTransform,
    options?: PhysicsQueryOptions,
  ): readonly PhysicsOverlapHit[];

  castShapeFirst?(
    shape: PhysicsShape,
    cast: PhysicsShapeCast,
    options?: PhysicsQueryOptions,
  ): PhysicsShapeCastHit | null;

  projectPoint?(
    point: PhysicsVec3,
    options?: PhysicsQueryOptions,
  ): PhysicsPointProjection | null;

  moveCharacter?(move: PhysicsCharacterMove): PhysicsCharacterMoveResult | null;

  sleepBody?(entity: PhysicsEntityRef): boolean;

  wakeBody?(entity: PhysicsEntityRef): boolean;

  debugGeometry?(options?: PhysicsDebugOptions): PhysicsDebugGeometry;
}

export function collectUnsupportedPhysicsCommandFeatures(
  backend: PhysicsBackendKind,
  buffer: PhysicsCommandBuffer,
): PhysicsUnsupportedFeature[] {
  const features: PhysicsUnsupportedFeature[] = [];

  for (const command of buffer.commands) {
    if (command.kind === "upsertBody") {
      features.push(
        ...collectUnsupportedPhysicsBodyFeatures(backend, command.entity, command),
      );
      continue;
    }

    if (command.kind === "upsertJoint") {
      features.push(
        ...collectUnsupportedPhysicsJointFeatures(
          backend,
          command.entity,
          command.joint,
        ),
      );
    }
  }

  return features;
}

export function collectUnsupportedPhysicsBodyFeatures(
  backend: PhysicsBackendKind,
  entity: PhysicsEntityRef,
  body: Extract<PhysicsCommand, { readonly kind: "upsertBody" }>,
): PhysicsUnsupportedFeature[] {
  const features: PhysicsUnsupportedFeature[] = [];

  if (
    body.ccdEnabled === true &&
    !backendSupportsContinuousCollisionDetection(backend)
  ) {
    features.push({
      code: "physics.rigidBody.ccd.unsupported",
      feature: "rigidBody.ccdEnabled",
      backend,
      entity,
      message:
        "RigidBody.ccdEnabled is authored on this body, but the active backend does not implement continuous collision detection.",
      suggestedFix:
        "Use the Rapier backend for high-speed dynamic bodies, or keep ccdEnabled false until the active backend implements swept collision handling.",
    });
  }

  if (physicsBodyCommandHasUnsupportedParentedBody(body)) {
    features.push({
      code: "physics.rigidBody.parentedBody.unsupported",
      feature: "rigidBody.parentedBody",
      backend,
      entity,
      message:
        "RigidBody is authored on a parented entity, but the current physics sync path cannot yet convert parent-local ECS transforms to backend world poses and back.",
      suggestedFix:
        "Keep RigidBody entities at the transform root for now, or use child Collider entities under a root body until parent-local physics sync/writeback is implemented.",
    });
  }

  for (const collider of colliderDescriptorsForBodyCommand(body)) {
    if (!isAssetBackedColliderShape(collider.shape)) {
      continue;
    }

    const colliderEntity = collider.entity ?? entity;

    features.push({
      code: "physics.collider.assetShape.unsupported",
      feature: `collider.${collider.shape.kind}`,
      backend,
      entity: colliderEntity,
      message: `Collider shape '${collider.shape.kind}' is authored, but the active backend does not yet sync asset-backed collider geometry.`,
      suggestedFix:
        "Use primitive colliders for now, or keep this collider out of active physics scenes until mesh/heightfield collider cooking is implemented for the active backend.",
    });
  }

  return features;
}

export function collectUnsupportedPhysicsJointFeatures(
  backend: PhysicsBackendKind,
  entity: PhysicsEntityRef,
  joint: PhysicsJointDescriptor,
): PhysicsUnsupportedFeature[] {
  const features: PhysicsUnsupportedFeature[] = [];

  if (joint.kind === "generic") {
    features.push({
      code: "physics.joint.unsupported",
      feature: "joint.generic",
      backend,
      entity,
      message:
        "PhysicsJoint.kind is 'generic', but the active backend route does not yet expose a backend-neutral generic constraint axis/mask mapping.",
      suggestedFix:
        "Use fixed, spherical, revolute, prismatic, or distance joints for now, or add an explicit generic-joint descriptor contract before authoring generic constraints.",
    });

    return features;
  }

  const breakForce = joint.breakForce;

  if (
    breakForce !== undefined &&
    Number.isFinite(breakForce) &&
    breakForce > 0
  ) {
    features.push({
      code: "physics.joint.breakForce.unsupported",
      feature: "joint.breakForce",
      backend,
      entity,
      value: breakForce,
      message:
        "PhysicsJoint.breakForce is authored on this joint, but the active backend cannot enforce joint break thresholds or emit truthful jointBreak events.",
      suggestedFix:
        "Leave breakForce at 0 for now, or implement gameplay-owned joint destruction until a physics backend exposes joint impulse/readback support.",
    });
  }

  const frameB = joint.frameB;

  if (
    frameB !== undefined &&
    joint.kind !== "fixed" &&
    !isIdentityQuat(frameB)
  ) {
    features.push({
      code: "physics.joint.frameB.unsupported",
      feature: "joint.frameB",
      backend,
      entity,
      message:
        "PhysicsJoint.frameB is authored on a non-fixed joint, but the active backend cannot encode a paired body-B joint frame for this joint kind.",
      suggestedFix:
        "Keep frameB as the identity for non-fixed joints, or constrain the joint through currently supported frameA-oriented unit-axis semantics until a backend exposes paired non-fixed joint frames.",
    });
  }

  const motorMaxForce = joint.motorMaxForce;

  if (
    motorMaxForce !== undefined &&
    Number.isFinite(motorMaxForce) &&
    motorMaxForce > 0
  ) {
    features.push({
      code: "physics.joint.motorMaxForce.unsupported",
      feature: "joint.motorMaxForce",
      backend,
      entity,
      value: motorMaxForce,
      message:
        "PhysicsJoint.motorMaxForce is authored on this joint, but the active backend cannot enforce motor force limits through the current public adapter API.",
      suggestedFix:
        "Leave motorMaxForce at 0 for now, or implement gameplay-side motor disabling until a backend exposes enforceable motor force/max-impulse controls.",
    });
  }

  return features;
}

function backendSupportsContinuousCollisionDetection(
  backend: PhysicsBackendKind,
): boolean {
  return backend === "rapier";
}

export function physicsBodyCommandHasUnsupportedAssetCollider(
  body: Extract<PhysicsCommand, { readonly kind: "upsertBody" }>,
): boolean {
  return colliderDescriptorsForBodyCommand(body).some((collider) =>
    isAssetBackedColliderShape(collider.shape),
  );
}

export function physicsBodyCommandHasUnsupportedParentedBody(
  body: Extract<PhysicsCommand, { readonly kind: "upsertBody" }>,
): boolean {
  return body.parented === true;
}

export function physicsBodyCommandHasUnsupportedSyncFeature(
  body: Extract<PhysicsCommand, { readonly kind: "upsertBody" }>,
): boolean {
  return (
    physicsBodyCommandHasUnsupportedAssetCollider(body) ||
    physicsBodyCommandHasUnsupportedParentedBody(body)
  );
}

export function physicsJointCommandHasUnsupportedSyncFeature(
  backend: PhysicsBackendKind,
  joint: PhysicsJointDescriptor,
): boolean {
  return collectUnsupportedPhysicsJointFeatures(backend, "", joint).some(
    (feature) => feature.code === "physics.joint.unsupported",
  );
}

function colliderDescriptorsForBodyCommand(
  body: Extract<PhysicsCommand, { readonly kind: "upsertBody" }>,
): readonly PhysicsColliderDescriptor[] {
  if (body.colliders !== undefined && body.colliders.length > 0) {
    return body.colliders;
  }
  if (body.collider !== undefined) {
    return [body.collider];
  }

  return [];
}

function isAssetBackedColliderShape(shape: PhysicsShape): boolean {
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

export function createUnsupportedJointImpulseReadbackFeature(
  backend: PhysicsBackendKind,
  entity: PhysicsEntityRef,
): PhysicsUnsupportedFeature {
  return {
    code: "physics.joint.impulseReadback.unsupported",
    feature: "joint.impulseReadback",
    backend,
    entity,
    message:
      "The active physics route does not expose native joint impulse readback, so automatic breakForce thresholds cannot be enforced truthfully.",
    suggestedFix:
      "Use explicit gameplay-owned joint breaks for now, or add backend-native joint impulse readback before enforcing automatic breakForce thresholds.",
  };
}

function isIdentityQuat(value: PhysicsQuat): boolean {
  return (
    Math.abs(value[0]) <= 0.000001 &&
    Math.abs(value[1]) <= 0.000001 &&
    Math.abs(value[2]) <= 0.000001 &&
    Math.abs(value[3] - 1) <= 0.000001
  );
}

export function createPhysicsResultBuffer(): PhysicsResultBuffer {
  return {
    bodies: [],
    events: [],
  };
}

export function summarizePhysicsDebugGeometry(
  geometry: PhysicsDebugGeometry,
): PhysicsDebugSummary {
  const colors = new Map<
    string,
    { color: readonly [number, number, number, number]; lineCount: number }
  >();
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  let finiteLineCount = 0;

  for (const line of geometry.lines) {
    if (
      !isFiniteVec3(line.from) ||
      !isFiniteVec3(line.to) ||
      !isFiniteColor(line.color)
    ) {
      continue;
    }

    finiteLineCount += 1;
    includePointInBounds(min, max, line.from);
    includePointInBounds(min, max, line.to);

    const key = line.color.join(",");
    const existing = colors.get(key);

    if (existing === undefined) {
      colors.set(key, { color: [...line.color], lineCount: 1 });
    } else {
      existing.lineCount += 1;
    }
  }

  const colorSummaries = [...colors.values()].sort((left, right) =>
    left.color.join(",").localeCompare(right.color.join(",")),
  );

  return {
    lineCount: geometry.lines.length,
    finiteLineCount,
    invalidLineCount: geometry.lines.length - finiteLineCount,
    colorCount: colorSummaries.length,
    colors: colorSummaries.map((summary) => ({
      color: summary.color,
      lineCount: summary.lineCount,
    })),
    bounds:
      finiteLineCount === 0
        ? null
        : {
            min,
            max,
          },
  };
}

export function createPhysicsRayProbeDebugLines(
  probes: readonly PhysicsDebugRayProbe[] = [],
  raycastFirst: (
    ray: PhysicsRay,
    options?: PhysicsQueryOptions,
  ) => PhysicsRaycastHit | null,
): PhysicsDebugLine[] {
  const lines: PhysicsDebugLine[] = [];

  for (const probe of probes) {
    const hit = raycastFirst(probe.ray, probe.options);

    if (hit === null) {
      lines.push({
        from: vec3(probe.ray.origin),
        to: rayEndpoint(probe.ray),
        color: color(probe.missColor, [0.45, 0.55, 0.65, 1]),
      });
      continue;
    }

    lines.push({
      from: vec3(probe.ray.origin),
      to: vec3(hit.point),
      color: color(probe.hitColor, [1, 0.86, 0.12, 1]),
    });
    lines.push({
      from: vec3(hit.point),
      to: addScaled(
        hit.point,
        hit.normal,
        finitePositive(probe.normalLength, 0.35),
      ),
      color: color(probe.normalColor, [1, 0.2, 0.12, 1]),
    });
  }

  return lines;
}

export function createPhysicsAabbDebugLines(
  aabbs: readonly PhysicsAabb[],
  inputColor: readonly [number, number, number, number] | undefined,
): PhysicsDebugLine[] {
  const lines: PhysicsDebugLine[] = [];
  const lineColor = color(inputColor, [0.95, 0.65, 0.15, 1]);
  const edgeIndices = [
    [0, 1],
    [1, 3],
    [3, 2],
    [2, 0],
    [4, 5],
    [5, 7],
    [7, 6],
    [6, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ] as const;

  for (const aabb of aabbs) {
    if (!isFiniteVec3(aabb.min) || !isFiniteVec3(aabb.max)) {
      continue;
    }

    const vertices: readonly PhysicsVec3[] = [
      [aabb.min[0], aabb.min[1], aabb.min[2]],
      [aabb.max[0], aabb.min[1], aabb.min[2]],
      [aabb.min[0], aabb.max[1], aabb.min[2]],
      [aabb.max[0], aabb.max[1], aabb.min[2]],
      [aabb.min[0], aabb.min[1], aabb.max[2]],
      [aabb.max[0], aabb.min[1], aabb.max[2]],
      [aabb.min[0], aabb.max[1], aabb.max[2]],
      [aabb.max[0], aabb.max[1], aabb.max[2]],
    ];

    for (const [fromIndex, toIndex] of edgeIndices) {
      const from = vertices[fromIndex];
      const to = vertices[toIndex];

      if (from === undefined || to === undefined) {
        continue;
      }

      lines.push({
        from: vec3(from),
        to: vec3(to),
        color: lineColor,
      });
    }
  }

  return lines;
}

function rayEndpoint(ray: PhysicsRay): PhysicsVec3 {
  return addScaled(
    ray.origin,
    ray.direction,
    finitePositive(ray.maxDistance, 1),
  );
}

function addScaled(
  origin: PhysicsVec3,
  direction: PhysicsVec3,
  scale: number,
): PhysicsVec3 {
  return [
    origin[0] + direction[0] * scale,
    origin[1] + direction[1] * scale,
    origin[2] + direction[2] * scale,
  ];
}

function color(
  input: readonly [number, number, number, number] | undefined,
  fallback: readonly [number, number, number, number],
): readonly [number, number, number, number] {
  return input ?? fallback;
}

function vec3(input: PhysicsVec3): PhysicsVec3 {
  return [input[0], input[1], input[2]];
}

function includePointInBounds(
  min: [number, number, number],
  max: [number, number, number],
  point: PhysicsVec3,
): void {
  min[0] = Math.min(min[0], point[0]);
  min[1] = Math.min(min[1], point[1]);
  min[2] = Math.min(min[2], point[2]);
  max[0] = Math.max(max[0], point[0]);
  max[1] = Math.max(max[1], point[1]);
  max[2] = Math.max(max[2], point[2]);
}

function isFiniteVec3(input: PhysicsVec3): boolean {
  return input.every(Number.isFinite);
}

function isFiniteColor(
  input: readonly [number, number, number, number],
): boolean {
  return input.every(Number.isFinite);
}

function finitePositive(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}
