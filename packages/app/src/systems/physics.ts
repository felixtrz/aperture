import type {
  PhysicsBackend,
  PhysicsBackendCapabilities,
  PhysicsCharacterMove,
  PhysicsCharacterMoveResult,
  PhysicsDebugGeometry,
  PhysicsDebugOptions,
  PhysicsDebugSummary,
  PhysicsEvent,
  PhysicsOverlapHit,
  PhysicsPointProjection,
  PhysicsQueryOptions,
  PhysicsRay,
  PhysicsRaycastHit,
  PhysicsShape,
  PhysicsShapeCast,
  PhysicsShapeCastHit,
  PhysicsReadbackReport,
  PhysicsStepReport,
  PhysicsSyncReport,
  PhysicsTransform,
  PhysicsUnsupportedFeature,
  PhysicsVec3,
  PhysicsWorldStepReport,
  PhysicsWorldWritebackReport,
} from "@aperture-engine/physics";
import {
  ExternalForce,
  ExternalImpulse,
  KinematicTarget,
  PhysicsJoint,
  PhysicsVelocity,
  createExternalForce,
  createExternalImpulse,
  createKinematicTarget,
  createPhysicsVelocity,
  registerPhysicsComponents,
  summarizePhysicsDebugGeometry,
} from "@aperture-engine/physics";
import {
  LocalTransform,
  serializeEntityRef,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";

export interface PhysicsApplyForceOptions {
  readonly point?: PhysicsVec3;
  readonly torque?: PhysicsVec3;
}

export interface PhysicsApplyImpulseOptions {
  readonly point?: PhysicsVec3;
  readonly angularImpulse?: PhysicsVec3;
}

export interface PhysicsBreakJointOptions {
  readonly frame?: number;
  readonly fixedStep?: number;
  readonly substep?: number;
}

export interface PhysicsEventFamilySummary {
  readonly contacts: number;
  readonly collisions: number;
  readonly triggers: number;
  readonly sleepWake: number;
  readonly contactForces: number;
  readonly controllerGroundedChanged: number;
  readonly jointBreaks: number;
}

export interface PhysicsAccessSummary {
  readonly backend: PhysicsBackendSummary | null;
  readonly sync: PhysicsSyncSummary | null;
  readonly step: PhysicsStepSummary | null;
  readonly readback: PhysicsReadbackSummary | null;
  readonly writeback: PhysicsWritebackSummary | null;
  readonly unsupportedFeatureCount: number;
  readonly unsupportedFeatures: readonly PhysicsUnsupportedFeature[];
  readonly eventCount: number;
  readonly eventKinds: Readonly<Record<string, number>>;
  readonly eventFamilies: PhysicsEventFamilySummary;
  readonly events: readonly PhysicsEvent[];
}

export interface PhysicsBackendSummary {
  readonly kind: PhysicsBackend["kind"];
  readonly version: string;
  readonly build: PhysicsBackend["build"];
  readonly execution: PhysicsBackend["execution"];
  readonly capabilities: PhysicsBackendCapabilities;
}

export interface PhysicsSyncSummary {
  readonly commandCount: number;
  readonly bodyCount: number;
  readonly colliderCount: number;
  readonly jointCount: number;
  readonly unsupportedFeatureCount: number;
  readonly unsupportedFeatures: readonly PhysicsUnsupportedFeature[];
}

export interface PhysicsStepSummary {
  readonly enabled: boolean;
  readonly backend: PhysicsStepReport["backend"];
  readonly backendVersion: string;
  readonly backendBuild: PhysicsStepReport["backendBuild"];
  readonly execution: PhysicsStepReport["execution"];
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

export interface PhysicsReadbackSummary {
  readonly bodyCount: number;
  readonly eventCount: number;
}

export interface PhysicsWritebackSummary {
  readonly bodyCount: number;
  readonly transformWrites: number;
  readonly velocityWrites: number;
  readonly bodyStateWrites: number;
  readonly missingEntities: number;
}

export interface PhysicsEventAccess {
  (): readonly PhysicsEvent[];
  all(): readonly PhysicsEvent[];
  byKind(kind: PhysicsEvent["kind"]): readonly PhysicsEvent[];
  contacts(): readonly PhysicsEvent[];
  collisionStarted(): readonly PhysicsEvent[];
  collisionStayed(): readonly PhysicsEvent[];
  collisionEnded(): readonly PhysicsEvent[];
  triggerEntered(): readonly PhysicsEvent[];
  triggerStayed(): readonly PhysicsEvent[];
  triggerExited(): readonly PhysicsEvent[];
  sleeping(): readonly PhysicsEvent[];
  waking(): readonly PhysicsEvent[];
  contactForces(): readonly PhysicsEvent[];
  controllerGroundedChanged(): readonly PhysicsEvent[];
  jointBroken(): readonly PhysicsEvent[];
}

export interface PhysicsAccess {
  setBackend(backend: PhysicsBackend | null): void;
  getBackend(): PhysicsBackend | null;
  setEvents(events: readonly PhysicsEvent[]): void;
  setSyncReport(report: PhysicsSyncReport | null): void;
  setStepReport(report: PhysicsWorldStepReport | null): void;
  clearEvents(): void;
  readonly events: PhysicsEventAccess;
  summary(): PhysicsAccessSummary;
  raycastFirst(
    ray: PhysicsRay,
    options?: PhysicsQueryOptions,
  ): PhysicsRaycastHit | null;
  raycastAll(
    ray: PhysicsRay,
    options?: PhysicsQueryOptions,
  ): readonly PhysicsRaycastHit[];
  overlapShape(
    shape: PhysicsShape,
    transform: PhysicsTransform,
    options?: PhysicsQueryOptions,
  ): readonly PhysicsOverlapHit[];
  castShapeFirst(
    shape: PhysicsShape,
    cast: PhysicsShapeCast,
    options?: PhysicsQueryOptions,
  ): PhysicsShapeCastHit | null;
  projectPoint(
    point: PhysicsVec3,
    options?: PhysicsQueryOptions,
  ): PhysicsPointProjection | null;
  applyForce(
    entity: Entity,
    force: PhysicsVec3,
    options?: PhysicsApplyForceOptions,
  ): void;
  applyImpulse(
    entity: Entity,
    impulse: PhysicsVec3,
    options?: PhysicsApplyImpulseOptions,
  ): void;
  setLinearVelocity(entity: Entity, velocity: PhysicsVec3): void;
  setAngularVelocity(entity: Entity, velocity: PhysicsVec3): void;
  setKinematicTarget(entity: Entity, transform: PhysicsTransform): void;
  sleepBody(entity: Entity): boolean;
  wakeBody(entity: Entity): boolean;
  breakJoint(entity: Entity, options?: PhysicsBreakJointOptions): boolean;
  moveCharacter(move: PhysicsCharacterMove): PhysicsCharacterMoveResult | null;
  debugGeometry(options?: PhysicsDebugOptions): PhysicsDebugGeometry;
  debugSummary(options?: PhysicsDebugOptions): PhysicsDebugSummary;
}

export interface CreatePhysicsAccessOptions {
  readonly world?: EcsWorld;
}

export function createPhysicsAccess(
  options: CreatePhysicsAccessOptions = {},
): PhysicsAccess {
  const world = options.world;
  let backend: PhysicsBackend | null = null;
  let syncReport: PhysicsSyncReport | null = null;
  let stepReport: PhysicsStepReport | null = null;
  let readbackReport: PhysicsReadbackReport | null = null;
  let writebackReport: PhysicsWorldWritebackReport | null = null;
  let backendFrameEvents: readonly PhysicsEvent[] = [];
  let accessFrameEvents: readonly PhysicsEvent[] = [];
  const characterGroundedStates = new Map<string, boolean>();
  const readFrameEvents = () =>
    combinedEvents(backendFrameEvents, accessFrameEvents);
  const events = createPhysicsEventAccess(readFrameEvents);

  return {
    setBackend(nextBackend) {
      if (nextBackend !== backend) {
        characterGroundedStates.clear();
      }
      backend = nextBackend;
    },
    getBackend() {
      return backend;
    },
    setEvents(events) {
      backendFrameEvents = [...events];
    },
    setSyncReport(report) {
      syncReport = report;
    },
    setStepReport(report) {
      syncReport = report?.sync ?? null;
      stepReport = report?.step ?? null;
      readbackReport = report?.readback ?? null;
      writebackReport = report?.writeback ?? null;
      backendFrameEvents =
        report?.events === undefined ? [] : [...report.events];
    },
    clearEvents() {
      backendFrameEvents = [];
      accessFrameEvents = [];
      syncReport = null;
      stepReport = null;
      readbackReport = null;
      writebackReport = null;
    },
    events,
    summary() {
      const events = readFrameEvents();

      return {
        backend: backendSummary(backend),
        sync: syncSummary(syncReport),
        step: stepSummary(stepReport),
        readback: readbackSummary(readbackReport),
        writeback: writebackSummary(writebackReport),
        unsupportedFeatureCount: syncReport?.unsupportedFeatureCount ?? 0,
        unsupportedFeatures:
          syncReport?.unsupportedFeatures.map(cloneUnsupportedFeature) ?? [],
        eventCount: events.length,
        eventKinds: physicsEventKinds(events),
        eventFamilies: physicsEventFamilies(events),
        events: events.map(clonePhysicsEvent),
      };
    },
    raycastFirst(ray, options) {
      return backend?.raycastFirst(ray, options) ?? null;
    },
    raycastAll(ray, options) {
      return backend?.raycastAll(ray, options) ?? [];
    },
    overlapShape(shape, transform, options) {
      return backend?.overlapShape?.(shape, transform, options) ?? [];
    },
    castShapeFirst(shape, cast, options) {
      return backend?.castShapeFirst?.(shape, cast, options) ?? null;
    },
    projectPoint(point, options) {
      return backend?.projectPoint?.(point, options) ?? null;
    },
    applyForce(entity, force, options = {}) {
      ensureExternalForce(world, entity);
      addExternalForceField(entity, "force", force);
      addExternalForceField(
        entity,
        "torque",
        addVec3(
          options.torque ?? [0, 0, 0],
          options.point === undefined
            ? [0, 0, 0]
            : torqueForForceAtPoint(entity, force, options.point),
        ),
      );
    },
    applyImpulse(entity, impulse, options = {}) {
      ensureExternalImpulse(world, entity);
      addExternalImpulseField(entity, "impulse", impulse);
      addExternalImpulseField(
        entity,
        "angularImpulse",
        addVec3(
          options.angularImpulse ?? [0, 0, 0],
          options.point === undefined
            ? [0, 0, 0]
            : torqueForForceAtPoint(entity, impulse, options.point),
        ),
      );
    },
    setLinearVelocity(entity, velocity) {
      ensurePhysicsVelocity(world, entity);
      setPhysicsVelocityField(entity, "linear", velocity);
    },
    setAngularVelocity(entity, velocity) {
      ensurePhysicsVelocity(world, entity);
      setPhysicsVelocityField(entity, "angular", velocity);
    },
    setKinematicTarget(entity, transform) {
      ensureKinematicTarget(world, entity);
      entity.setValue(KinematicTarget, "enabled", true);
      setKinematicTargetVec3Field(entity, "translation", transform.translation);
      entity.getVectorView(KinematicTarget, "rotation").set(transform.rotation);
    },
    sleepBody(entity) {
      return entity.active
        ? (backend?.sleepBody?.(serializeEntityRef(entity)) ?? false)
        : false;
    },
    wakeBody(entity) {
      return entity.active
        ? (backend?.wakeBody?.(serializeEntityRef(entity)) ?? false)
        : false;
    },
    breakJoint(entity, options = {}) {
      if (!entity.hasComponent(PhysicsJoint)) {
        return false;
      }
      if (entity.getValue(PhysicsJoint, "enabled") !== true) {
        return false;
      }

      prepareMutation(world, entity);
      entity.setValue(PhysicsJoint, "enabled", false);
      accessFrameEvents = [
        ...accessFrameEvents,
        jointBreakEvent(entity, options),
      ];

      return true;
    },
    moveCharacter(move) {
      const result = backend?.moveCharacter?.(move) ?? null;

      if (result !== null) {
        const previousGrounded = characterGroundedStates.get(result.entity);
        characterGroundedStates.set(result.entity, result.grounded);

        if (
          previousGrounded !== undefined &&
          previousGrounded !== result.grounded
        ) {
          accessFrameEvents = [
            ...accessFrameEvents,
            controllerGroundedChangedEvent(result),
          ];
        }
      }

      return result;
    },
    debugGeometry(options) {
      return backend?.debugGeometry?.(options) ?? { lines: [] };
    },
    debugSummary(options) {
      return summarizePhysicsDebugGeometry(
        backend?.debugGeometry?.(options) ?? { lines: [] },
      );
    },
  };
}

function syncSummary(
  report: PhysicsSyncReport | null,
): PhysicsSyncSummary | null {
  return report === null
    ? null
    : {
        commandCount: report.commandCount,
        bodyCount: report.bodyCount,
        colliderCount: report.colliderCount,
        jointCount: report.jointCount,
        unsupportedFeatureCount: report.unsupportedFeatureCount,
        unsupportedFeatures: report.unsupportedFeatures.map(
          cloneUnsupportedFeature,
        ),
      };
}

function stepSummary(
  report: PhysicsStepReport | null,
): PhysicsStepSummary | null {
  return report === null
    ? null
    : {
        enabled: report.enabled,
        backend: report.backend,
        backendVersion: report.backendVersion,
        backendBuild: report.backendBuild,
        execution: report.execution,
        fixedDelta: report.fixedDelta,
        fixedStep: report.fixedStep,
        bodyCount: report.bodyCount,
        colliderCount: report.colliderCount,
        jointCount: report.jointCount,
        eventCount: report.eventCount,
        queryCount: report.queryCount,
        syncToBackendMs: report.syncToBackendMs,
        backendStepMs: report.backendStepMs,
        writebackMs: report.writebackMs,
      };
}

function readbackSummary(
  report: PhysicsReadbackReport | null,
): PhysicsReadbackSummary | null {
  return report === null
    ? null
    : {
        bodyCount: report.bodyCount,
        eventCount: report.eventCount,
      };
}

function writebackSummary(
  report: PhysicsWorldWritebackReport | null,
): PhysicsWritebackSummary | null {
  return report === null
    ? null
    : {
        bodyCount: report.bodyCount,
        transformWrites: report.transformWrites,
        velocityWrites: report.velocityWrites,
        bodyStateWrites: report.bodyStateWrites,
        missingEntities: report.missingEntities,
      };
}

function cloneUnsupportedFeature(
  feature: PhysicsUnsupportedFeature,
): PhysicsUnsupportedFeature {
  return {
    code: feature.code,
    feature: feature.feature,
    backend: feature.backend,
    entity: feature.entity,
    ...(feature.value === undefined ? {} : { value: feature.value }),
    ...(feature.details === undefined ? {} : { details: feature.details }),
    message: feature.message,
    suggestedFix: feature.suggestedFix,
  };
}

function createPhysicsEventAccess(
  readEvents: () => readonly PhysicsEvent[],
): PhysicsEventAccess {
  const all = () => [...readEvents()];
  const byKind = (kind: PhysicsEvent["kind"]) =>
    all().filter((event) => event.kind === kind);
  const access = (() => all()) as unknown as PhysicsEventAccess;

  access.all = all;
  access.byKind = byKind;
  access.contacts = () =>
    all().filter(
      (event) =>
        event.kind === "collisionStart" ||
        event.kind === "collisionStay" ||
        event.kind === "collisionEnd" ||
        event.kind === "contactForce",
    );
  access.collisionStarted = () => byKind("collisionStart");
  access.collisionStayed = () => byKind("collisionStay");
  access.collisionEnded = () => byKind("collisionEnd");
  access.triggerEntered = () => byKind("triggerEnter");
  access.triggerStayed = () => byKind("triggerStay");
  access.triggerExited = () => byKind("triggerExit");
  access.sleeping = () => byKind("sleep");
  access.waking = () => byKind("wake");
  access.contactForces = () => byKind("contactForce");
  access.controllerGroundedChanged = () => byKind("controllerGroundedChanged");
  access.jointBroken = () => byKind("jointBreak");

  return access;
}

function combinedEvents(
  backendEvents: readonly PhysicsEvent[],
  accessEvents: readonly PhysicsEvent[],
): readonly PhysicsEvent[] {
  return [...backendEvents, ...accessEvents].sort(comparePhysicsEvents);
}

function backendSummary(
  backend: PhysicsBackend | null,
): PhysicsBackendSummary | null {
  return backend === null
    ? null
    : {
        kind: backend.kind,
        version: backend.version,
        build: backend.build,
        execution: backend.execution,
        capabilities: clonePhysicsBackendCapabilities(backend.capabilities),
      };
}

function clonePhysicsBackendCapabilities(
  capabilities: PhysicsBackendCapabilities,
): PhysicsBackendCapabilities {
  return {
    compoundColliders: capabilities.compoundColliders,
    continuousCollisionDetection: capabilities.continuousCollisionDetection,
    characterController: capabilities.characterController,
    linkedBodyContacts: capabilities.linkedBodyContacts,
    combinedPositionVelocityMotors: capabilities.combinedPositionVelocityMotors,
    motorForceLimits: capabilities.motorForceLimits,
    automaticBreakForce: capabilities.automaticBreakForce,
    jointImpulseReadback: capabilities.jointImpulseReadback,
    pairedNonFixedFrameB: capabilities.pairedNonFixedFrameB,
  };
}

function physicsEventKinds(
  events: readonly PhysicsEvent[],
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};

  for (const event of events) {
    counts[event.kind] = (counts[event.kind] ?? 0) + 1;
  }

  return counts;
}

function physicsEventFamilies(
  events: readonly PhysicsEvent[],
): PhysicsEventFamilySummary {
  let collisions = 0;
  let triggers = 0;
  let sleepWake = 0;
  let contactForces = 0;
  let controllerGroundedChanged = 0;
  let jointBreaks = 0;

  for (const event of events) {
    switch (event.kind) {
      case "collisionStart":
      case "collisionStay":
      case "collisionEnd":
        collisions += 1;
        break;
      case "triggerEnter":
      case "triggerStay":
      case "triggerExit":
        triggers += 1;
        break;
      case "sleep":
      case "wake":
        sleepWake += 1;
        break;
      case "contactForce":
        contactForces += 1;
        break;
      case "controllerGroundedChanged":
        controllerGroundedChanged += 1;
        break;
      case "jointBreak":
        jointBreaks += 1;
        break;
    }
  }

  return {
    contacts: collisions + contactForces,
    collisions,
    triggers,
    sleepWake,
    contactForces,
    controllerGroundedChanged,
    jointBreaks,
  };
}

function clonePhysicsEvent(event: PhysicsEvent): PhysicsEvent {
  return {
    kind: event.kind,
    frame: event.frame,
    fixedStep: event.fixedStep,
    substep: event.substep,
    ...(event.joint === undefined ? {} : { joint: event.joint }),
    entityA: event.entityA,
    entityB: event.entityB,
    colliderA: event.colliderA,
    colliderB: event.colliderB,
    ...(event.point === undefined ? {} : { point: vec3(event.point) }),
    ...(event.normal === undefined ? {} : { normal: vec3(event.normal) }),
    ...(event.force === undefined ? {} : { force: vec3(event.force) }),
    ...(event.forceMagnitude === undefined
      ? {}
      : { forceMagnitude: event.forceMagnitude }),
    ...(event.maxForceMagnitude === undefined
      ? {}
      : { maxForceMagnitude: event.maxForceMagnitude }),
    ...(event.impulse === undefined ? {} : { impulse: event.impulse }),
    ...(event.grounded === undefined ? {} : { grounded: event.grounded }),
  };
}

function controllerGroundedChangedEvent(
  result: PhysicsCharacterMoveResult,
): PhysicsEvent {
  return {
    kind: "controllerGroundedChanged",
    frame: 0,
    fixedStep: 0,
    substep: 0,
    entityA: result.entity,
    entityB: result.entity,
    colliderA: result.entity,
    colliderB: result.entity,
    grounded: result.grounded,
  };
}

function jointBreakEvent(
  entity: Entity,
  options: PhysicsBreakJointOptions,
): PhysicsEvent {
  const joint = serializeEntityRef(entity);
  const bodyARef = stringValue(
    entity.getValue(PhysicsJoint, "bodyARef"),
    joint,
  );
  const bodyBRef = stringValue(
    entity.getValue(PhysicsJoint, "bodyBRef"),
    joint,
  );

  return {
    kind: "jointBreak",
    frame: finiteOrZero(options.frame),
    fixedStep: finiteOrZero(options.fixedStep),
    substep: finiteOrZero(options.substep),
    joint,
    entityA: bodyARef,
    entityB: bodyBRef,
    colliderA: bodyARef,
    colliderB: bodyBRef,
  };
}

function comparePhysicsEvents(left: PhysicsEvent, right: PhysicsEvent): number {
  return (
    left.fixedStep - right.fixedStep ||
    left.substep - right.substep ||
    left.kind.localeCompare(right.kind) ||
    (left.joint ?? "").localeCompare(right.joint ?? "") ||
    left.entityA.localeCompare(right.entityA) ||
    left.entityB.localeCompare(right.entityB) ||
    left.colliderA.localeCompare(right.colliderA) ||
    left.colliderB.localeCompare(right.colliderB)
  );
}

function vec3(value: PhysicsVec3): PhysicsVec3 {
  return [value[0], value[1], value[2]];
}

function finiteOrZero(value: number | undefined): number {
  return value === undefined || !Number.isFinite(value) ? 0 : value;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function ensureExternalForce(
  world: EcsWorld | undefined,
  entity: Entity,
): void {
  prepareMutation(world, entity);
  if (!entity.hasComponent(ExternalForce)) {
    entity.addComponent(ExternalForce, createExternalForce());
  }
}

function ensureExternalImpulse(
  world: EcsWorld | undefined,
  entity: Entity,
): void {
  prepareMutation(world, entity);
  if (!entity.hasComponent(ExternalImpulse)) {
    entity.addComponent(ExternalImpulse, createExternalImpulse());
  }
}

function ensurePhysicsVelocity(
  world: EcsWorld | undefined,
  entity: Entity,
): void {
  prepareMutation(world, entity);
  if (!entity.hasComponent(PhysicsVelocity)) {
    entity.addComponent(PhysicsVelocity, createPhysicsVelocity());
  }
}

function ensureKinematicTarget(
  world: EcsWorld | undefined,
  entity: Entity,
): void {
  prepareMutation(world, entity);
  if (!entity.hasComponent(KinematicTarget)) {
    entity.addComponent(KinematicTarget, createKinematicTarget());
  }
}

function prepareMutation(world: EcsWorld | undefined, entity: Entity): void {
  if (!entity.active) {
    throw new Error(
      `Cannot mutate physics command components on inactive entity ${entity.index}:${entity.generation}.`,
    );
  }
  if (world !== undefined) {
    registerPhysicsComponents(world);
  }
}

function addExternalForceField(
  entity: Entity,
  field: "force" | "torque",
  value: PhysicsVec3,
): void {
  const view = entity.getVectorView(ExternalForce, field);

  view.set(addVec3([view[0] ?? 0, view[1] ?? 0, view[2] ?? 0], value));
}

function addExternalImpulseField(
  entity: Entity,
  field: "impulse" | "angularImpulse",
  value: PhysicsVec3,
): void {
  const view = entity.getVectorView(ExternalImpulse, field);

  view.set(addVec3([view[0] ?? 0, view[1] ?? 0, view[2] ?? 0], value));
}

function setPhysicsVelocityField(
  entity: Entity,
  field: "linear" | "angular",
  value: PhysicsVec3,
): void {
  entity.getVectorView(PhysicsVelocity, field).set(value);
}

function setKinematicTargetVec3Field(
  entity: Entity,
  field: "translation",
  value: PhysicsVec3,
): void {
  entity.getVectorView(KinematicTarget, field).set(value);
}

function torqueForForceAtPoint(
  entity: Entity,
  force: PhysicsVec3,
  point: PhysicsVec3,
): PhysicsVec3 {
  return crossVec3(subVec3(point, entityCenter(entity)), force);
}

function entityCenter(entity: Entity): PhysicsVec3 {
  if (!entity.hasComponent(LocalTransform)) {
    return [0, 0, 0];
  }

  const translation = entity.getVectorView(LocalTransform, "translation");

  return [translation[0] ?? 0, translation[1] ?? 0, translation[2] ?? 0];
}

function addVec3(left: PhysicsVec3, right: PhysicsVec3): PhysicsVec3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function subVec3(left: PhysicsVec3, right: PhysicsVec3): PhysicsVec3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function crossVec3(left: PhysicsVec3, right: PhysicsVec3): PhysicsVec3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}
