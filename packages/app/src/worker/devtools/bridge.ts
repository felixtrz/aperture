import type {
  PhysicsCharacterControllerSettings,
  PhysicsCharacterMove,
  PhysicsDebugOptions,
  PhysicsEvent,
  PhysicsQueryOptions,
  PhysicsRay,
  PhysicsShape,
  PhysicsShapeCast,
  PhysicsTransform,
  PhysicsJointDescriptor,
} from "@aperture-engine/physics";
import {
  PhysicsCharacterController,
  PhysicsCharacterMassMode,
  PhysicsDebug,
  PhysicsJoint,
  collectUnsupportedPhysicsJointFeatures,
  createUnsupportedJointImpulseReadbackFeature,
  validatePhysicsCharacterMove,
} from "@aperture-engine/physics";
import type { SimulationMessagePort } from "@aperture-engine/runtime";
import {
  LocalTransform,
  serializeEntityRef,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import type { ApertureApp } from "../../advanced.js";
import {
  createApertureDevtoolsResponse,
  type ApertureDevtoolsRequest,
} from "../../commands.js";
import { createAssetSummary } from "../assets.js";
import { resolveActiveEntity } from "../../entities/lookup/resolve.js";
import { entityRefKey, entitySummary } from "../../entities/lookup/summary.js";
import type { AperturePhysicsJointSummary } from "../../entities/lookup/types.js";
import {
  booleanFromValue,
  isRecord,
  numberFromValue,
  stringFromValue,
  tuple3FromValue,
  tuple4FromValue,
} from "../payload.js";
import { callCameraTool, type CameraToolState } from "./camera.js";
import {
  entityRefFromValue,
  type GeneratedEntityToolBridge,
} from "./entities.js";
import { callInputDevtoolsTool } from "./input.js";
import type { GeneratedDevtoolsToolResult } from "./types.js";

type MutablePhysicsCharacterControllerSettings = {
  -readonly [Key in keyof PhysicsCharacterControllerSettings]?: PhysicsCharacterControllerSettings[Key];
};

type MutablePhysicsDebugOptions = {
  -readonly [Key in keyof PhysicsDebugOptions]?: PhysicsDebugOptions[Key];
};

export interface GeneratedDevtoolsBridge {
  handle(request: ApertureDevtoolsRequest): void;
}

export function createGeneratedDevtoolsBridge(options: {
  readonly app: ApertureApp;
  readonly entityTools: GeneratedEntityToolBridge;
  readonly port: SimulationMessagePort;
  readonly setPaused: (paused: boolean) => void;
  readonly step: (delta: number) => Readonly<Record<string, unknown>>;
  readonly getSimulationState: () => Readonly<Record<string, unknown>>;
}): GeneratedDevtoolsBridge {
  const savedCameraStates = new Map<string, CameraToolState>();

  return {
    handle(request) {
      try {
        const result = callGeneratedDevtoolsTool(
          options,
          request,
          savedCameraStates,
        );

        options.port.postMessage(
          createApertureDevtoolsResponse({
            requestId: request.requestId,
            ok: result.ok,
            ...(Object.prototype.hasOwnProperty.call(result, "result")
              ? { result: result.result }
              : {}),
            ...(result.diagnostics === undefined
              ? {}
              : { diagnostics: result.diagnostics }),
          }),
        );
      } catch (error: unknown) {
        options.port.postMessage(
          createApertureDevtoolsResponse({
            requestId: request.requestId,
            ok: false,
            diagnostics: [
              {
                code: "aperture.devtools.toolFailed",
                severity: "error",
                message: error instanceof Error ? error.message : String(error),
                suggestedFix:
                  "Inspect the tool payload and generated worker diagnostics.",
              },
            ],
          }),
        );
      }
    },
  };
}

function callGeneratedDevtoolsTool(
  bridge: {
    readonly app: ApertureApp;
    readonly entityTools: GeneratedEntityToolBridge;
    readonly setPaused: (paused: boolean) => void;
    readonly step: (delta: number) => Readonly<Record<string, unknown>>;
    readonly getSimulationState: () => Readonly<Record<string, unknown>>;
  },
  request: ApertureDevtoolsRequest,
  savedCameraStates: Map<string, CameraToolState>,
): GeneratedDevtoolsToolResult {
  if (request.tool === "ecs_pause") {
    bridge.setPaused(true);
    return { ok: true, result: bridge.getSimulationState() };
  }

  if (request.tool === "ecs_resume") {
    bridge.setPaused(false);
    return { ok: true, result: bridge.getSimulationState() };
  }

  if (request.tool === "ecs_step") {
    return {
      ok: true,
      result: bridge.step(devtoolsStepDelta(request.payload)),
    };
  }

  if (request.tool === "ecs_step_and_diff") {
    return callStepAndDiffTool(bridge, request.payload);
  }

  if (request.tool.startsWith("input_")) {
    const result = callInputDevtoolsTool(
      bridge.app,
      request.tool,
      request.payload,
    );

    if (result !== null) {
      return result;
    }
  }

  if (request.tool === "asset_list") {
    return {
      ok: true,
      result: {
        assets: createAssetSummary(bridge.app.context.assets.list()),
      },
    };
  }

  if (request.tool === "resource_get") {
    return callResourceGetTool(bridge.app, request.payload);
  }

  if (request.tool === "physics_summary") {
    return {
      ok: true,
      result: bridge.app.context.physics.summary(),
    };
  }

  if (request.tool === "physics_events") {
    return callPhysicsEventsTool(bridge.app, request.payload);
  }

  if (request.tool === "physics_joint_status") {
    return callPhysicsJointStatusTool(bridge.app, request.payload);
  }

  if (
    request.tool === "physics_apply_force" ||
    request.tool === "physics_apply_impulse" ||
    request.tool === "physics_set_linear_velocity" ||
    request.tool === "physics_set_angular_velocity" ||
    request.tool === "physics_set_kinematic_target"
  ) {
    return callPhysicsCommandTool(bridge.app, request.tool, request.payload);
  }

  if (request.tool === "physics_break_joint") {
    return callPhysicsBreakJointTool(bridge.app, request.payload);
  }

  if (
    request.tool === "physics_sleep_body" ||
    request.tool === "physics_wake_body"
  ) {
    return callPhysicsSleepWakeBodyTool(
      bridge.app,
      request.tool,
      request.payload,
    );
  }

  if (
    request.tool === "physics_raycast_first" ||
    request.tool === "physics_raycast_all"
  ) {
    return callPhysicsRaycastTool(bridge.app, request.tool, request.payload);
  }

  if (request.tool === "physics_overlap_shape") {
    return callPhysicsOverlapShapeTool(bridge.app, request.payload);
  }

  if (request.tool === "physics_cast_shape_first") {
    return callPhysicsCastShapeFirstTool(bridge.app, request.payload);
  }

  if (request.tool === "physics_project_point") {
    return callPhysicsProjectPointTool(bridge.app, request.payload);
  }

  if (request.tool === "physics_move_character") {
    return callPhysicsMoveCharacterTool(bridge.app, request.payload);
  }

  if (
    request.tool === "physics_debug_geometry" ||
    request.tool === "physics_debug_summary"
  ) {
    return callPhysicsDebugTool(bridge.app, request.tool, request.payload);
  }

  if (request.tool.startsWith("camera_")) {
    return callCameraTool(bridge.app, request, savedCameraStates);
  }

  return bridge.entityTools.call(request.tool, request.payload);
}

function callStepAndDiffTool(
  bridge: {
    readonly entityTools: GeneratedEntityToolBridge;
    readonly step: (delta: number) => Readonly<Record<string, unknown>>;
  },
  payload: unknown,
): GeneratedDevtoolsToolResult {
  if (bridge.entityTools.summary().lastSnapshot === null) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "aperture.devtools.stepAndDiffMissingSnapshot",
          severity: "error",
          message: "ecs_step_and_diff requires a previous ECS snapshot.",
          suggestedFix:
            "Call ecs_snapshot with the entities or query you want to compare, then call ecs_step_and_diff.",
        },
      ],
      result: null,
    };
  }

  const step = bridge.step(devtoolsStepDelta(payload));
  const diff = bridge.entityTools.call("ecs_diff", payload);

  return {
    ok: diff.ok,
    result: {
      step,
      diff: diff.result,
    },
    ...(diff.diagnostics === undefined
      ? {}
      : { diagnostics: diff.diagnostics }),
  };
}

function devtoolsStepDelta(payload: unknown): number {
  const record = isRecord(payload) ? payload : {};
  const delta = numberFromValue(record["delta"]);

  return delta === undefined || delta < 0 ? 1 / 60 : delta;
}

function callResourceGetTool(
  app: ApertureApp,
  payload: unknown,
): GeneratedDevtoolsToolResult {
  const record = isRecord(payload) ? payload : {};
  const rawId = record["id"];
  const id = stringFromValue(rawId);

  if (Object.prototype.hasOwnProperty.call(record, "id")) {
    if (id === undefined || id.trim().length === 0) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "aperture.resource.invalidDevtoolsId",
            severity: "error",
            message: "resource_get id must be a non-empty string.",
            suggestedFix:
              "Pass { id: 'your.resource.id' }, or omit id to list all generated app resources.",
          },
        ],
      };
    }
  }

  const summary = app.context.resources.summary();

  if (id === undefined) {
    return {
      ok: true,
      result: {
        resources: summary,
      },
    };
  }

  const resource = summary.entries.find((entry) => entry.id === id) ?? null;

  if (resource === null) {
    return {
      ok: false,
      result: {
        id,
        resource: null,
        resources: {
          count: 0,
          entries: [],
        },
      },
      diagnostics: [
        {
          code: "aperture.resource.notFound",
          severity: "warning",
          message: `Generated app resource '${id}' was not found.`,
          suggestedFix:
            "Call resource_get without an id to list resources currently initialized by generated worker systems.",
        },
      ],
    };
  }

  return {
    ok: true,
    result: {
      id,
      resource,
      resources: {
        count: 1,
        entries: [resource],
      },
    },
  };
}

function physicsEntityFromPayload(
  app: ApertureApp,
  payload: unknown,
  diagnostic: {
    readonly code: string;
    readonly message: string;
    readonly suggestedFix: string;
  },
):
  | {
      readonly ok: true;
      readonly entity: Entity;
      readonly ref: { readonly index: number; readonly generation: number };
    }
  | {
      readonly ok: false;
      readonly diagnostic: Readonly<Record<string, unknown>>;
    } {
  const record = isRecord(payload) ? payload : {};
  const ref = entityRefFromValue(record["entity"] ?? record["ref"] ?? payload);

  if (ref === null) {
    return {
      ok: false,
      diagnostic: {
        code: diagnostic.code,
        severity: "error",
        message: diagnostic.message,
        suggestedFix: diagnostic.suggestedFix,
      },
    };
  }

  const resolved = resolveActiveEntity(app.lowLevel.world, ref);

  return resolved.ok
    ? { ok: true, entity: resolved.entity, ref }
    : { ok: false, diagnostic: { ...resolved.diagnostic } };
}

function callPhysicsCommandTool(
  app: ApertureApp,
  tool:
    | "physics_apply_force"
    | "physics_apply_impulse"
    | "physics_set_linear_velocity"
    | "physics_set_angular_velocity"
    | "physics_set_kinematic_target",
  payload: unknown,
): GeneratedDevtoolsToolResult {
  const record = isRecord(payload) ? payload : {};
  const resolved = physicsEntityFromPayload(app, payload, {
    code: "aperture.physics.command.missingEntity",
    message: `${tool} requires an entity reference with { index, generation }.`,
    suggestedFix:
      "Run ecs_find_entities or ecs_snapshot, then pass the returned entity reference as { entity }.",
  });

  if (!resolved.ok) {
    return { ok: false, diagnostics: [resolved.diagnostic] };
  }

  if (tool === "physics_apply_force") {
    const force = tuple3FromValue(record["force"] ?? record["value"]);

    if (force === null) {
      return invalidPhysicsCommandDiagnostic(
        "aperture.physics.applyForce.invalidPayload",
        "physics_apply_force requires a finite force [x, y, z] tuple.",
        "Pass { entity: { index, generation }, force: [x, y, z] } and optional point/torque tuples.",
      );
    }

    const point = optionalTuple3FromRecord(record, "point");
    const torque = optionalTuple3FromRecord(record, "torque");

    if (point === null || torque === null) {
      return invalidPhysicsCommandDiagnostic(
        "aperture.physics.applyForce.invalidOptions",
        "physics_apply_force received a malformed point or torque tuple.",
        "Use finite [x, y, z] tuples for optional point and torque fields.",
      );
    }

    app.context.physics.applyForce(resolved.entity, force, {
      ...(point === undefined ? {} : { point }),
      ...(torque === undefined ? {} : { torque }),
    });

    return {
      ok: true,
      result: physicsCommandResult(app, resolved.entity, {
        tool,
        force,
        ...(point === undefined ? {} : { point }),
        ...(torque === undefined ? {} : { torque }),
      }),
    };
  }

  if (tool === "physics_apply_impulse") {
    const impulse = tuple3FromValue(record["impulse"] ?? record["value"]);

    if (impulse === null) {
      return invalidPhysicsCommandDiagnostic(
        "aperture.physics.applyImpulse.invalidPayload",
        "physics_apply_impulse requires a finite impulse [x, y, z] tuple.",
        "Pass { entity: { index, generation }, impulse: [x, y, z] } and optional point/angularImpulse tuples.",
      );
    }

    const point = optionalTuple3FromRecord(record, "point");
    const angularImpulse = optionalTuple3FromRecord(record, "angularImpulse");

    if (point === null || angularImpulse === null) {
      return invalidPhysicsCommandDiagnostic(
        "aperture.physics.applyImpulse.invalidOptions",
        "physics_apply_impulse received a malformed point or angularImpulse tuple.",
        "Use finite [x, y, z] tuples for optional point and angularImpulse fields.",
      );
    }

    app.context.physics.applyImpulse(resolved.entity, impulse, {
      ...(point === undefined ? {} : { point }),
      ...(angularImpulse === undefined ? {} : { angularImpulse }),
    });

    return {
      ok: true,
      result: physicsCommandResult(app, resolved.entity, {
        tool,
        impulse,
        ...(point === undefined ? {} : { point }),
        ...(angularImpulse === undefined ? {} : { angularImpulse }),
      }),
    };
  }

  if (
    tool === "physics_set_linear_velocity" ||
    tool === "physics_set_angular_velocity"
  ) {
    const velocity = tuple3FromValue(
      record["velocity"] ??
        record["value"] ??
        (tool === "physics_set_linear_velocity"
          ? record["linear"]
          : record["angular"]),
    );

    if (velocity === null) {
      return invalidPhysicsCommandDiagnostic(
        tool === "physics_set_linear_velocity"
          ? "aperture.physics.setLinearVelocity.invalidPayload"
          : "aperture.physics.setAngularVelocity.invalidPayload",
        `${tool} requires a finite velocity [x, y, z] tuple.`,
        "Pass { entity: { index, generation }, velocity: [x, y, z] }.",
      );
    }

    if (tool === "physics_set_linear_velocity") {
      app.context.physics.setLinearVelocity(resolved.entity, velocity);
    } else {
      app.context.physics.setAngularVelocity(resolved.entity, velocity);
    }

    return {
      ok: true,
      result: physicsCommandResult(app, resolved.entity, { tool, velocity }),
    };
  }

  const transform = physicsTransformFromPayload(
    isRecord(record["transform"]) ? record["transform"] : record,
  );

  if (transform === null) {
    return invalidPhysicsCommandDiagnostic(
      "aperture.physics.setKinematicTarget.invalidPayload",
      "physics_set_kinematic_target requires a finite target transform.",
      "Pass { entity: { index, generation }, translation: [x, y, z], rotation?: [x, y, z, w] } or { transform }.",
    );
  }

  app.context.physics.setKinematicTarget(resolved.entity, transform);

  return {
    ok: true,
    result: physicsCommandResult(app, resolved.entity, { tool, transform }),
  };
}

function physicsCommandResult(
  app: ApertureApp,
  entity: Entity,
  command: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return {
    entity: {
      index: entity.index,
      generation: entity.generation,
    },
    ref: serializeEntityRef(entity),
    command,
    physics: app.context.physics.summary(),
  };
}

function invalidPhysicsCommandDiagnostic(
  code: string,
  message: string,
  suggestedFix: string,
): GeneratedDevtoolsToolResult {
  return {
    ok: false,
    diagnostics: [
      {
        code,
        severity: "error",
        message,
        suggestedFix,
      },
    ],
  };
}

function callPhysicsSleepWakeBodyTool(
  app: ApertureApp,
  tool: "physics_sleep_body" | "physics_wake_body",
  payload: unknown,
): GeneratedDevtoolsToolResult {
  const resolved = physicsEntityFromPayload(app, payload, {
    code:
      tool === "physics_sleep_body"
        ? "aperture.physics.sleepBody.missingEntity"
        : "aperture.physics.wakeBody.missingEntity",
    message: `${tool} requires an entity reference with { index, generation }.`,
    suggestedFix:
      "Run ecs_find_entities or ecs_snapshot, then pass the returned body entity reference as { entity }.",
  });

  if (!resolved.ok) {
    return { ok: false, diagnostics: [resolved.diagnostic] };
  }

  const changed =
    tool === "physics_sleep_body"
      ? app.context.physics.sleepBody(resolved.entity)
      : app.context.physics.wakeBody(resolved.entity);
  const result = physicsCommandResult(app, resolved.entity, {
    tool,
    [tool === "physics_sleep_body" ? "slept" : "woke"]: changed,
  });

  if (!changed) {
    return {
      ok: false,
      result,
      diagnostics: [
        {
          code:
            tool === "physics_sleep_body"
              ? "aperture.physics.sleepBody.noop"
              : "aperture.physics.wakeBody.noop",
          severity: "warning",
          message: `${tool} did not change backend body state.`,
          suggestedFix:
            "Step once to sync the ECS body into the active same-worker backend, confirm the backend supports body sleep/wake controls, then retry with an active RigidBody entity.",
        },
      ],
    };
  }

  return { ok: true, result };
}

const physicsEventKinds = [
  "collisionStart",
  "collisionStay",
  "collisionEnd",
  "triggerEnter",
  "triggerStay",
  "triggerExit",
  "sleep",
  "wake",
  "contactForce",
  "controllerGroundedChanged",
  "jointBreak",
] as const satisfies readonly PhysicsEvent["kind"][];

type PhysicsEventFamilyFilter =
  | "contacts"
  | "collisions"
  | "triggers"
  | "sleepWake"
  | "contactForces"
  | "controllerGroundedChanged"
  | "jointBreaks";

const physicsEventFamilies = [
  "contacts",
  "collisions",
  "triggers",
  "sleepWake",
  "contactForces",
  "controllerGroundedChanged",
  "jointBreaks",
] as const satisfies readonly PhysicsEventFamilyFilter[];

function callPhysicsEventsTool(
  app: ApertureApp,
  payload: unknown,
): GeneratedDevtoolsToolResult {
  const record = isRecord(payload) ? payload : {};
  const kind = stringFromValue(record["kind"]);
  const family = stringFromValue(record["family"]);
  const entity = eventEntityRefFromValue(
    record["entity"] ?? record["entityRef"] ?? record["ref"],
  );
  const joint = eventEntityRefFromValue(record["joint"] ?? record["jointRef"]);
  const limit = normalizedEventLimit(record["limit"]);

  if (kind !== undefined && !isPhysicsEventKind(kind)) {
    return invalidPhysicsCommandDiagnostic(
      "aperture.physics.events.invalidKind",
      `physics_events does not recognize event kind '${kind}'.`,
      `Pass one of: ${physicsEventKinds.join(", ")}.`,
    );
  }

  if (family !== undefined && !isPhysicsEventFamily(family)) {
    return invalidPhysicsCommandDiagnostic(
      "aperture.physics.events.invalidFamily",
      `physics_events does not recognize event family '${family}'.`,
      `Pass one of: ${physicsEventFamilies.join(", ")}.`,
    );
  }

  if (hasPayloadKey(record, "entity") && entity === undefined) {
    return invalidPhysicsCommandDiagnostic(
      "aperture.physics.events.invalidEntity",
      "physics_events received a malformed entity filter.",
      "Pass an entity ref as { index, generation } or an existing backend entity token like '12:0'.",
    );
  }

  if (hasPayloadKey(record, "joint") && joint === undefined) {
    return invalidPhysicsCommandDiagnostic(
      "aperture.physics.events.invalidJoint",
      "physics_events received a malformed joint filter.",
      "Pass a joint entity ref as { index, generation } or an existing backend entity token like '12:0'.",
    );
  }

  const physics = app.context.physics.summary();
  const matchedEvents = physics.events.filter((event) =>
    physicsEventMatches(event, { kind, family, entity, joint }),
  );
  const events =
    limit === undefined ? matchedEvents : matchedEvents.slice(0, limit);

  return {
    ok: true,
    result: {
      filters: {
        ...(kind === undefined ? {} : { kind }),
        ...(family === undefined ? {} : { family }),
        ...(entity === undefined ? {} : { entity }),
        ...(joint === undefined ? {} : { joint }),
        ...(limit === undefined ? {} : { limit }),
      },
      returnedCount: events.length,
      matchedCount: matchedEvents.length,
      totalCount: physics.eventCount,
      events,
      physics,
    },
  };
}

function hasPayloadKey(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function normalizedEventLimit(value: unknown): number | undefined {
  const limit = numberFromValue(value);

  if (limit === undefined) {
    return undefined;
  }

  return Math.max(0, Math.floor(limit));
}

function eventEntityRefFromValue(value: unknown): string | undefined {
  const direct = stringFromValue(value);
  if (direct !== undefined) {
    return direct;
  }

  const ref = entityRefFromValue(value);
  return ref === null ? undefined : entityRefKey(ref);
}

function isPhysicsEventKind(kind: string): kind is PhysicsEvent["kind"] {
  return (physicsEventKinds as readonly string[]).includes(kind);
}

function isPhysicsEventFamily(
  family: string,
): family is PhysicsEventFamilyFilter {
  return (physicsEventFamilies as readonly string[]).includes(family);
}

function physicsEventMatches(
  event: PhysicsEvent,
  filters: {
    readonly kind: string | undefined;
    readonly family: string | undefined;
    readonly entity: string | undefined;
    readonly joint: string | undefined;
  },
): boolean {
  return (
    (filters.kind === undefined || event.kind === filters.kind) &&
    (filters.family === undefined ||
      physicsEventIsInFamily(event, filters.family)) &&
    (filters.entity === undefined ||
      event.entityA === filters.entity ||
      event.entityB === filters.entity ||
      event.colliderA === filters.entity ||
      event.colliderB === filters.entity) &&
    (filters.joint === undefined || event.joint === filters.joint)
  );
}

function physicsEventIsInFamily(event: PhysicsEvent, family: string): boolean {
  switch (family) {
    case "contacts":
      return (
        event.kind === "collisionStart" ||
        event.kind === "collisionStay" ||
        event.kind === "collisionEnd" ||
        event.kind === "contactForce"
      );
    case "collisions":
      return (
        event.kind === "collisionStart" ||
        event.kind === "collisionStay" ||
        event.kind === "collisionEnd"
      );
    case "triggers":
      return (
        event.kind === "triggerEnter" ||
        event.kind === "triggerStay" ||
        event.kind === "triggerExit"
      );
    case "sleepWake":
      return event.kind === "sleep" || event.kind === "wake";
    case "contactForces":
      return event.kind === "contactForce";
    case "controllerGroundedChanged":
      return event.kind === "controllerGroundedChanged";
    case "jointBreaks":
      return event.kind === "jointBreak";
    default:
      return false;
  }
}

function callPhysicsJointStatusTool(
  app: ApertureApp,
  payload: unknown,
): GeneratedDevtoolsToolResult {
  const resolved = physicsEntityFromPayload(app, payload, {
    code: "aperture.physics.jointStatus.missingEntity",
    message:
      "physics_joint_status requires an entity reference with { index, generation }.",
    suggestedFix:
      "Run ecs_find_entities or ecs_snapshot, then pass the returned joint entity reference as { entity }.",
  });

  if (!resolved.ok) {
    return { ok: false, diagnostics: [resolved.diagnostic] };
  }

  if (!resolved.entity.hasComponent(PhysicsJoint)) {
    const result = {
      entity: resolved.ref,
      ref: serializeEntityRef(resolved.entity),
      physics: app.context.physics.summary(),
    };

    return {
      ok: false,
      result,
      diagnostics: [
        {
          code: "aperture.physics.jointStatus.missingJoint",
          severity: "warning",
          message:
            "physics_joint_status received an entity without a PhysicsJoint component.",
          suggestedFix:
            "Pass a joint entity from ecs_find_entities or ecs_snapshot with PhysicsJoint in withComponents.",
        },
      ],
    };
  }

  const summary = entitySummary(resolved.entity);
  const joint = summary.physicsJoint;
  const physics = app.context.physics.summary();
  const ref = serializeEntityRef(resolved.entity);
  const backend = physics.backend;
  const authoredUnsupportedFeatures =
    backend === null || joint === undefined
      ? []
      : collectUnsupportedPhysicsJointFeatures(
          backend.kind,
          ref,
          physicsJointDescriptorFromSummary(joint),
        );
  const syncUnsupportedFeatures = physics.unsupportedFeatures.filter(
    (feature) => feature.entity === ref,
  );
  const capabilities = backend?.capabilities ?? null;
  const isUnitJoint = joint?.kind === "revolute" || joint?.kind === "prismatic";
  const jointImpulseReadbackSupported =
    capabilities?.jointImpulseReadback === true;
  const jointImpulseReadbackUnsupportedFeature =
    backend === null || jointImpulseReadbackSupported
      ? null
      : createUnsupportedJointImpulseReadbackFeature(backend.kind, ref);

  return {
    ok: true,
    result: {
      entity: resolved.ref,
      ref,
      joint,
      backend,
      sync: physics.sync,
      unsupportedFeatures: syncUnsupportedFeatures,
      authoredUnsupportedFeatures,
      capabilities: {
        explicitBreakJoint: true,
        automaticBreakForce: capabilities?.automaticBreakForce ?? false,
        jointImpulseReadback: jointImpulseReadbackSupported,
        motorForceLimits: capabilities?.motorForceLimits ?? false,
        linkedBodyContacts: capabilities?.linkedBodyContacts ?? false,
        combinedPositionVelocityMotors:
          (capabilities?.combinedPositionVelocityMotors ?? false) &&
          isUnitJoint,
        pairedNonFixedFrameB:
          joint?.kind === "fixed" ||
          (capabilities?.pairedNonFixedFrameB ?? false),
      },
      readback: {
        jointImpulse: null,
        supported: jointImpulseReadbackSupported,
        unsupportedFeature: jointImpulseReadbackUnsupportedFeature,
        code: jointImpulseReadbackUnsupportedFeature?.code ?? null,
        message: jointImpulseReadbackUnsupportedFeature?.message ?? null,
      },
      physics,
    },
  };
}

function physicsJointDescriptorFromSummary(
  joint: AperturePhysicsJointSummary,
): PhysicsJointDescriptor {
  return {
    kind: joint.kind,
    bodyARef: joint.bodyARef,
    bodyBRef: joint.bodyBRef,
    anchorA: joint.anchorA,
    anchorB: joint.anchorB,
    frameA: joint.frameA,
    frameB: joint.frameB,
    axis: joint.axis,
    minLimit: joint.minLimit,
    maxLimit: joint.maxLimit,
    motorMode: joint.motorMode,
    motorModel: joint.motorModel,
    motorTarget: joint.motorTarget,
    motorVelocity: joint.motorVelocity,
    motorStiffness: joint.motorStiffness,
    motorDamping: joint.motorDamping,
    motorFactor: joint.motorFactor,
    motorMaxForce: joint.motorMaxForce,
    contactsEnabled: joint.contactsEnabled,
    breakForce: joint.breakForce,
  };
}

function callPhysicsBreakJointTool(
  app: ApertureApp,
  payload: unknown,
): GeneratedDevtoolsToolResult {
  const record = isRecord(payload) ? payload : {};
  const resolved = physicsEntityFromPayload(app, payload, {
    code: "aperture.physics.breakJoint.missingEntity",
    message:
      "physics_break_joint requires an entity reference with { index, generation }.",
    suggestedFix:
      "Run ecs_find_entities or ecs_snapshot, then pass the returned entity reference as { entity }.",
  });

  if (!resolved.ok) {
    return { ok: false, diagnostics: [resolved.diagnostic] };
  }

  const frame = numberFromValue(record["frame"]);
  const fixedStep = numberFromValue(record["fixedStep"]);
  const substep = numberFromValue(record["substep"]);
  const broke = app.context.physics.breakJoint(resolved.entity, {
    ...(frame === undefined ? {} : { frame }),
    ...(fixedStep === undefined ? {} : { fixedStep }),
    ...(substep === undefined ? {} : { substep }),
  });
  const result = {
    entity: resolved.ref,
    broke,
    physics: app.context.physics.summary(),
  };

  if (!broke) {
    return {
      ok: false,
      result,
      diagnostics: [
        {
          code: "aperture.physics.breakJoint.noop",
          severity: "warning",
          message:
            "physics_break_joint did not break a joint because the entity has no enabled PhysicsJoint component.",
          suggestedFix:
            "Pass an active entity with an enabled PhysicsJoint component, or inspect it with ecs_get_entity first.",
        },
      ],
    };
  }

  return { ok: true, result };
}

function callPhysicsRaycastTool(
  app: ApertureApp,
  tool: "physics_raycast_first" | "physics_raycast_all",
  payload: unknown,
): GeneratedDevtoolsToolResult {
  const parsed = physicsRaycastPayload(app, payload);

  if (!parsed.ok) {
    return { ok: false, diagnostics: [parsed.diagnostic] };
  }

  if (tool === "physics_raycast_first") {
    return {
      ok: true,
      result: {
        physics: app.context.physics.summary(),
        options: parsed.options ?? null,
        hit: app.context.physics.raycastFirst(parsed.ray, parsed.options),
      },
    };
  }

  return {
    ok: true,
    result: {
      physics: app.context.physics.summary(),
      options: parsed.options ?? null,
      hits: app.context.physics.raycastAll(parsed.ray, parsed.options),
    },
  };
}

function callPhysicsOverlapShapeTool(
  app: ApertureApp,
  payload: unknown,
): GeneratedDevtoolsToolResult {
  const parsed = physicsShapeQueryPayload(app, payload);

  if (!parsed.ok) {
    return { ok: false, diagnostics: [parsed.diagnostic] };
  }

  return {
    ok: true,
    result: {
      physics: app.context.physics.summary(),
      options: parsed.options ?? null,
      hits: app.context.physics.overlapShape(
        parsed.shape,
        parsed.transform,
        parsed.options,
      ),
    },
  };
}

function callPhysicsCastShapeFirstTool(
  app: ApertureApp,
  payload: unknown,
): GeneratedDevtoolsToolResult {
  const parsed = physicsShapeCastPayload(app, payload);

  if (!parsed.ok) {
    return { ok: false, diagnostics: [parsed.diagnostic] };
  }

  return {
    ok: true,
    result: {
      physics: app.context.physics.summary(),
      options: parsed.options ?? null,
      hit: app.context.physics.castShapeFirst(
        parsed.shape,
        parsed.cast,
        parsed.options,
      ),
    },
  };
}

function callPhysicsProjectPointTool(
  app: ApertureApp,
  payload: unknown,
): GeneratedDevtoolsToolResult {
  const record = isRecord(payload) ? payload : {};
  const point = tuple3FromValue(record["point"] ?? payload);

  if (point === null) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "aperture.physics.projectPoint.invalidPoint",
          severity: "error",
          message:
            "physics_project_point requires a finite point [x, y, z] tuple.",
          suggestedFix: "Pass { point: [x, y, z] } and optional query filters.",
        },
      ],
    };
  }

  const options = physicsQueryOptionsFromPayload(
    app,
    isRecord(record["options"]) ? record["options"] : record,
  );

  return {
    ok: true,
    result: {
      physics: app.context.physics.summary(),
      options: options ?? null,
      projection: app.context.physics.projectPoint(point, options),
    },
  };
}

function callPhysicsMoveCharacterTool(
  app: ApertureApp,
  payload: unknown,
): GeneratedDevtoolsToolResult {
  const parsed = physicsCharacterMovePayload(app, payload);

  if (!parsed.ok) {
    return { ok: false, diagnostics: [parsed.diagnostic] };
  }

  const move = app.context.physics.moveCharacter(parsed.move);
  let appliedTarget = false;

  if (move !== null && parsed.applyTarget && parsed.entity !== undefined) {
    app.context.physics.setKinematicTarget(parsed.entity, {
      translation: move.targetTranslation,
      rotation: physicsEntityRotation(parsed.entity),
    });
    appliedTarget = true;
  }

  const result = {
    move,
    appliedTarget,
    settings: parsed.move.settings ?? null,
    physics: app.context.physics.summary(),
  };

  if (move === null) {
    return {
      ok: false,
      result,
      diagnostics: [
        {
          code: "aperture.physics.moveCharacter.noResult",
          severity: "warning",
          message:
            "physics_move_character could not move the requested entity because no backend character body/collider was found.",
          suggestedFix:
            "Run ecs_step once to sync authored physics, then pass an active entity with a kinematic body and collider.",
        },
      ],
    };
  }

  return { ok: true, result };
}

function callPhysicsDebugTool(
  app: ApertureApp,
  tool: "physics_debug_geometry" | "physics_debug_summary",
  payload: unknown,
): GeneratedDevtoolsToolResult {
  const parsed = physicsDebugOptionsPayload(payload);

  if (!parsed.ok) {
    return { ok: false, diagnostics: [parsed.diagnostic] };
  }

  const options =
    Object.keys(parsed.options).length === 0
      ? physicsDebugOptionsFromWorld(app.lowLevel.world)
      : parsed.options;

  return {
    ok: true,
    result: {
      ...(tool === "physics_debug_geometry"
        ? { geometry: app.context.physics.debugGeometry(options) }
        : { summary: app.context.physics.debugSummary(options) }),
      options,
      physics: app.context.physics.summary(),
    },
  };
}

function physicsDebugOptionsFromWorld(world: EcsWorld): PhysicsDebugOptions {
  const query = world.queryManager.registerQuery({ required: [PhysicsDebug] });
  const options: MutablePhysicsDebugOptions = {};

  for (const entity of query.entities) {
    if (!entity.active) {
      continue;
    }
    if (entity.getValue(PhysicsDebug, "colliderWireframes") === true) {
      options.colliderWireframes = true;
    }
    if (entity.getValue(PhysicsDebug, "contactNormals") === true) {
      options.contactNormals = true;
    }
    if (entity.getValue(PhysicsDebug, "bodyStateMarkers") === true) {
      options.bodyStateMarkers = true;
    }
    if (entity.getValue(PhysicsDebug, "broadphaseAabbs") === true) {
      options.broadphaseAabbs = true;
    }
    if (entity.getValue(PhysicsDebug, "jointFrames") === true) {
      options.jointFrames = true;
    }
  }

  return options;
}

function physicsEntityRotation(
  entity: Entity,
): readonly [number, number, number, number] {
  if (!entity.hasComponent(LocalTransform)) {
    return [0, 0, 0, 1];
  }

  const rotation = entity.getVectorView(LocalTransform, "rotation");

  return [
    rotation[0] ?? 0,
    rotation[1] ?? 0,
    rotation[2] ?? 0,
    rotation[3] ?? 1,
  ];
}

function physicsDebugOptionsPayload(payload: unknown):
  | { readonly ok: true; readonly options: PhysicsDebugOptions }
  | {
      readonly ok: false;
      readonly diagnostic: Readonly<Record<string, unknown>>;
    } {
  const record = isRecord(payload) ? payload : {};
  const optionsRecord = isRecord(record["options"])
    ? record["options"]
    : record;
  const colliderWireframes = optionalBooleanFromRecord(
    optionsRecord,
    "colliderWireframes",
  );
  const contactNormals = optionalBooleanFromRecord(
    optionsRecord,
    "contactNormals",
  );
  const bodyStateMarkers = optionalBooleanFromRecord(
    optionsRecord,
    "bodyStateMarkers",
  );
  const broadphaseAabbs = optionalBooleanFromRecord(
    optionsRecord,
    "broadphaseAabbs",
  );
  const jointFrames = optionalBooleanFromRecord(optionsRecord, "jointFrames");
  const contactNormalLength = optionalNumberFromRecord(
    optionsRecord,
    "contactNormalLength",
  );
  const bodyStateMarkerLength = optionalNumberFromRecord(
    optionsRecord,
    "bodyStateMarkerLength",
  );
  const jointFrameLength = optionalNumberFromRecord(
    optionsRecord,
    "jointFrameLength",
  );
  const contactNormalColor = optionalTuple4FromRecord(
    optionsRecord,
    "contactNormalColor",
  );
  const activeBodyColor = optionalTuple4FromRecord(
    optionsRecord,
    "activeBodyColor",
  );
  const sleepingBodyColor = optionalTuple4FromRecord(
    optionsRecord,
    "sleepingBodyColor",
  );
  const broadphaseAabbColor = optionalTuple4FromRecord(
    optionsRecord,
    "broadphaseAabbColor",
  );
  const jointFrameColor = optionalTuple4FromRecord(
    optionsRecord,
    "jointFrameColor",
  );
  const jointAxisColor = optionalTuple4FromRecord(
    optionsRecord,
    "jointAxisColor",
  );

  if (
    colliderWireframes === null ||
    contactNormals === null ||
    bodyStateMarkers === null ||
    broadphaseAabbs === null ||
    jointFrames === null ||
    contactNormalLength === null ||
    bodyStateMarkerLength === null ||
    jointFrameLength === null ||
    contactNormalColor === null ||
    activeBodyColor === null ||
    sleepingBodyColor === null ||
    broadphaseAabbColor === null ||
    jointFrameColor === null ||
    jointAxisColor === null
  ) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.physics.debugGeometry.invalidOptions",
        severity: "error",
        message:
          "physics_debug_geometry received malformed debug geometry options.",
        suggestedFix:
          "Use boolean debug flags, finite positive lengths, and RGBA color tuples such as { broadphaseAabbs: true, broadphaseAabbColor: [1, 0.65, 0.15, 1] }.",
      },
    };
  }

  const options: MutablePhysicsDebugOptions = {
    ...(colliderWireframes === undefined ? {} : { colliderWireframes }),
    ...(contactNormals === undefined ? {} : { contactNormals }),
    ...(bodyStateMarkers === undefined ? {} : { bodyStateMarkers }),
    ...(broadphaseAabbs === undefined ? {} : { broadphaseAabbs }),
    ...(jointFrames === undefined ? {} : { jointFrames }),
    ...(contactNormalLength === undefined ? {} : { contactNormalLength }),
    ...(bodyStateMarkerLength === undefined ? {} : { bodyStateMarkerLength }),
    ...(jointFrameLength === undefined ? {} : { jointFrameLength }),
    ...(contactNormalColor === undefined ? {} : { contactNormalColor }),
    ...(activeBodyColor === undefined ? {} : { activeBodyColor }),
    ...(sleepingBodyColor === undefined ? {} : { sleepingBodyColor }),
    ...(broadphaseAabbColor === undefined ? {} : { broadphaseAabbColor }),
    ...(jointFrameColor === undefined ? {} : { jointFrameColor }),
    ...(jointAxisColor === undefined ? {} : { jointAxisColor }),
  };

  return { ok: true, options };
}

function physicsRaycastPayload(
  app: ApertureApp,
  payload: unknown,
):
  | {
      readonly ok: true;
      readonly ray: PhysicsRay;
      readonly options?: PhysicsQueryOptions;
    }
  | {
      readonly ok: false;
      readonly diagnostic: Readonly<Record<string, unknown>>;
    } {
  const record = isRecord(payload) ? payload : {};
  const rayRecord = isRecord(record["ray"]) ? record["ray"] : record;
  const origin = tuple3FromValue(rayRecord["origin"]);
  const direction = normalizedDirection(rayRecord["direction"]);

  if (origin === null || direction === null) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.physics.raycast.invalidRay",
        severity: "error",
        message:
          "Physics raycast tools require finite origin and nonzero direction [x, y, z] tuples.",
        suggestedFix:
          "Pass { origin: [x, y, z], direction: [x, y, z] } or { ray: { origin, direction } }.",
      },
    };
  }

  const maxDistance = numberFromValue(rayRecord["maxDistance"]);
  const options = physicsQueryOptionsFromPayload(
    app,
    isRecord(record["options"]) ? record["options"] : record,
  );

  return {
    ok: true,
    ray: {
      origin,
      direction,
      ...(maxDistance === undefined ? {} : { maxDistance }),
    },
    ...(options === undefined ? {} : { options }),
  };
}

function physicsCharacterMovePayload(
  app: ApertureApp,
  payload: unknown,
):
  | {
      readonly ok: true;
      readonly move: PhysicsCharacterMove;
      readonly entity?: Entity;
      readonly applyTarget: boolean;
    }
  | {
      readonly ok: false;
      readonly diagnostic: Readonly<Record<string, unknown>>;
    } {
  const record = isRecord(payload) ? payload : {};
  const entity = physicsCharacterEntityFromPayload(app, record);

  if (!entity.ok) {
    return entity;
  }

  const desiredTranslation = tuple3FromValue(
    record["desiredTranslation"] ?? record["translation"] ?? record["movement"],
  );

  if (desiredTranslation === null) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.physics.moveCharacter.invalidPayload",
        severity: "error",
        message:
          "physics_move_character requires finite desiredTranslation [x, y, z] values.",
        suggestedFix:
          "Pass { entity: { index, generation }, desiredTranslation: [x, y, z] } and optional settings/options.",
      },
    };
  }

  const settings = physicsCharacterSettingsFromPayload(record["settings"]);

  if (!settings.ok) {
    return settings;
  }

  const ecsSettings =
    entity.entityObject === undefined
      ? undefined
      : physicsCharacterSettingsFromEntity(entity.entityObject);
  const moveSettings = mergePhysicsCharacterSettings(
    ecsSettings,
    settings.settings,
  );

  const options = physicsQueryOptionsFromPayload(
    app,
    isRecord(record["options"]) ? record["options"] : record,
  );
  const move: PhysicsCharacterMove = {
    entity: entity.entity,
    desiredTranslation,
    ...(moveSettings === undefined ? {} : { settings: moveSettings }),
    ...(options === undefined ? {} : { options }),
  };
  const applyTarget = booleanFromValue(record["applyTarget"]) ?? true;
  const diagnostics = validatePhysicsCharacterMove(move);

  if (diagnostics.length > 0) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.physics.moveCharacter.invalidPayload",
        severity: "error",
        message:
          "physics_move_character received invalid character movement settings.",
        data: { diagnostics },
        suggestedFix:
          "Use finite movement vectors, positive controller dimensions, nonnegative snap distances, and a nonempty entity ref.",
      },
    };
  }

  return {
    ok: true,
    move,
    ...(entity.entityObject === undefined
      ? {}
      : { entity: entity.entityObject }),
    applyTarget,
  };
}

function physicsCharacterEntityFromPayload(
  app: ApertureApp,
  record: Record<string, unknown>,
):
  | {
      readonly ok: true;
      readonly entity: string;
      readonly entityObject?: Entity;
    }
  | {
      readonly ok: false;
      readonly diagnostic: Readonly<Record<string, unknown>>;
    } {
  const value = record["entity"] ?? record["ref"];
  const direct = stringFromValue(value);

  if (direct !== undefined) {
    return { ok: true, entity: direct };
  }

  const ref = entityRefFromValue(value);

  if (ref === null) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.physics.moveCharacter.missingEntity",
        severity: "error",
        message:
          "physics_move_character requires an entity reference string or { index, generation } object.",
        suggestedFix:
          "Run ecs_find_entities or ecs_snapshot, then pass the returned entity reference as { entity }.",
      },
    };
  }

  const resolved = resolveActiveEntity(app.lowLevel.world, ref);

  return resolved.ok
    ? {
        ok: true,
        entity: `${resolved.entity.index}:${resolved.entity.generation}`,
        entityObject: resolved.entity,
      }
    : { ok: false, diagnostic: { ...resolved.diagnostic } };
}

function physicsCharacterSettingsFromPayload(value: unknown):
  | {
      readonly ok: true;
      readonly settings?: PhysicsCharacterControllerSettings;
    }
  | {
      readonly ok: false;
      readonly diagnostic: Readonly<Record<string, unknown>>;
    } {
  if (value === undefined) {
    return { ok: true };
  }

  if (!isRecord(value)) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.physics.moveCharacter.invalidSettings",
        severity: "error",
        message:
          "physics_move_character settings must be an object when provided.",
        suggestedFix:
          "Pass settings such as { snapToGroundDistance, slide, autostep } or omit settings.",
      },
    };
  }

  const settings: MutablePhysicsCharacterControllerSettings = {};
  const offset = optionalNumberFromRecord(value, "offset");
  const maxSlopeClimbAngle = optionalNumberFromRecord(
    value,
    "maxSlopeClimbAngle",
  );
  const minSlopeSlideAngle = optionalNumberFromRecord(
    value,
    "minSlopeSlideAngle",
  );
  const snapToGroundDistance = optionalNumberFromRecord(
    value,
    "snapToGroundDistance",
  );
  let characterMass: number | null | undefined;
  let invalidCharacterMass = false;
  if (value["characterMass"] === null) {
    characterMass = null;
  } else {
    const parsedCharacterMass = optionalNumberFromRecord(
      value,
      "characterMass",
    );

    if (parsedCharacterMass === null) {
      invalidCharacterMass = true;
    } else {
      characterMass = parsedCharacterMass;
    }
  }
  const up = optionalTuple3FromRecord(value, "up");
  const slide = optionalBooleanFromRecord(value, "slide");
  const applyImpulsesToDynamicBodies = optionalBooleanFromRecord(
    value,
    "applyImpulsesToDynamicBodies",
  );

  if (
    offset === null ||
    maxSlopeClimbAngle === null ||
    minSlopeSlideAngle === null ||
    snapToGroundDistance === null ||
    invalidCharacterMass ||
    up === null ||
    slide === null ||
    applyImpulsesToDynamicBodies === null
  ) {
    return invalidCharacterSettingsDiagnostic();
  }

  if (offset !== undefined) {
    settings.offset = offset;
  }
  if (maxSlopeClimbAngle !== undefined) {
    settings.maxSlopeClimbAngle = maxSlopeClimbAngle;
  }
  if (minSlopeSlideAngle !== undefined) {
    settings.minSlopeSlideAngle = minSlopeSlideAngle;
  }
  if (snapToGroundDistance !== undefined) {
    settings.snapToGroundDistance = snapToGroundDistance;
  }
  if (characterMass !== undefined) {
    settings.characterMass = characterMass;
  }
  if (up !== undefined) {
    settings.up = up;
  }
  if (slide !== undefined) {
    settings.slide = slide;
  }
  if (applyImpulsesToDynamicBodies !== undefined) {
    settings.applyImpulsesToDynamicBodies = applyImpulsesToDynamicBodies;
  }

  if (value["autostep"] === false) {
    settings.autostep = false;
  } else if (value["autostep"] !== undefined) {
    const autostep = isRecord(value["autostep"]) ? value["autostep"] : null;
    const maxHeight =
      autostep === null
        ? null
        : optionalNumberFromRecord(autostep, "maxHeight");
    const minWidth =
      autostep === null ? null : optionalNumberFromRecord(autostep, "minWidth");
    const includeDynamicBodies =
      autostep === null
        ? null
        : optionalBooleanFromRecord(autostep, "includeDynamicBodies");

    if (
      autostep === null ||
      maxHeight === null ||
      minWidth === null ||
      maxHeight === undefined ||
      minWidth === undefined ||
      includeDynamicBodies === null
    ) {
      return invalidCharacterSettingsDiagnostic();
    }

    settings.autostep = {
      maxHeight,
      minWidth,
      ...(includeDynamicBodies === undefined ? {} : { includeDynamicBodies }),
    };
  }

  return { ok: true, settings };
}

function physicsCharacterSettingsFromEntity(
  entity: Entity,
): PhysicsCharacterControllerSettings | undefined {
  if (
    !entity.hasComponent(PhysicsCharacterController) ||
    entity.getValue(PhysicsCharacterController, "enabled") !== true
  ) {
    return undefined;
  }

  const characterMassMode = entity.getValue(
    PhysicsCharacterController,
    "characterMassMode",
  );
  const settings: MutablePhysicsCharacterControllerSettings = {
    offset: entity.getValue(PhysicsCharacterController, "offset") ?? 0.01,
    up: tuple3FromView(entity.getVectorView(PhysicsCharacterController, "up")),
    slide: entity.getValue(PhysicsCharacterController, "slide") !== false,
    snapToGroundDistance:
      entity.getValue(PhysicsCharacterController, "snapToGroundDistance") ?? 0,
    autostep:
      entity.getValue(PhysicsCharacterController, "autostepEnabled") === true
        ? {
            maxHeight:
              entity.getValue(
                PhysicsCharacterController,
                "autostepMaxHeight",
              ) ?? 0.1,
            minWidth:
              entity.getValue(PhysicsCharacterController, "autostepMinWidth") ??
              0.1,
            includeDynamicBodies:
              entity.getValue(
                PhysicsCharacterController,
                "autostepIncludeDynamicBodies",
              ) === true,
          }
        : false,
    applyImpulsesToDynamicBodies:
      entity.getValue(
        PhysicsCharacterController,
        "applyImpulsesToDynamicBodies",
      ) === true,
  };

  if (
    entity.getValue(PhysicsCharacterController, "maxSlopeClimbAngleEnabled") ===
    true
  ) {
    settings.maxSlopeClimbAngle =
      entity.getValue(PhysicsCharacterController, "maxSlopeClimbAngle") ??
      Math.PI / 4;
  }
  if (
    entity.getValue(PhysicsCharacterController, "minSlopeSlideAngleEnabled") ===
    true
  ) {
    settings.minSlopeSlideAngle =
      entity.getValue(PhysicsCharacterController, "minSlopeSlideAngle") ??
      Math.PI / 3;
  }
  if (characterMassMode === PhysicsCharacterMassMode.Disabled) {
    settings.characterMass = null;
  } else if (characterMassMode === PhysicsCharacterMassMode.Mass) {
    settings.characterMass =
      entity.getValue(PhysicsCharacterController, "characterMass") ?? 0;
  }

  return settings;
}

function mergePhysicsCharacterSettings(
  base: PhysicsCharacterControllerSettings | undefined,
  override: PhysicsCharacterControllerSettings | undefined,
): PhysicsCharacterControllerSettings | undefined {
  if (base === undefined) {
    return override;
  }
  if (override === undefined) {
    return base;
  }

  return { ...base, ...override };
}

function tuple3FromView(
  view: ArrayLike<number>,
): readonly [number, number, number] {
  return [view[0] ?? 0, view[1] ?? 0, view[2] ?? 0];
}

function optionalNumberFromRecord(
  record: Record<string, unknown>,
  field: string,
): number | undefined | null {
  if (record[field] === undefined) {
    return undefined;
  }

  return numberFromValue(record[field]) ?? null;
}

function optionalBooleanFromRecord(
  record: Record<string, unknown>,
  field: string,
): boolean | undefined | null {
  if (record[field] === undefined) {
    return undefined;
  }

  return booleanFromValue(record[field]) ?? null;
}

function optionalTuple3FromRecord(
  record: Record<string, unknown>,
  field: string,
): readonly [number, number, number] | undefined | null {
  if (record[field] === undefined) {
    return undefined;
  }

  return tuple3FromValue(record[field]) ?? null;
}

function optionalTuple4FromRecord(
  record: Record<string, unknown>,
  field: string,
): readonly [number, number, number, number] | undefined | null {
  if (record[field] === undefined) {
    return undefined;
  }

  return tuple4FromValue(record[field]) ?? null;
}

function invalidCharacterSettingsDiagnostic(): {
  readonly ok: false;
  readonly diagnostic: Readonly<Record<string, unknown>>;
} {
  return {
    ok: false,
    diagnostic: {
      code: "aperture.physics.moveCharacter.invalidSettings",
      severity: "error",
      message:
        "physics_move_character settings contain malformed controller values.",
      suggestedFix:
        "Use finite numeric settings, finite up vectors, boolean flags, and autostep { maxHeight, minWidth } or false.",
    },
  };
}

function physicsQueryOptionsFromPayload(
  app: ApertureApp,
  record: Record<string, unknown>,
): PhysicsQueryOptions | undefined {
  const collisionGroups = numberFromValue(record["collisionGroups"]);
  const includeSensors = booleanFromValue(record["includeSensors"]);
  const excludeEntity = physicsExcludeEntityFromPayload(
    app,
    record["excludeEntity"] ?? record["excludeEntityRef"],
  );
  const options: PhysicsQueryOptions = {
    ...(collisionGroups === undefined ? {} : { collisionGroups }),
    ...(includeSensors === undefined ? {} : { includeSensors }),
    ...(excludeEntity === undefined ? {} : { excludeEntity }),
  };

  return Object.keys(options).length === 0 ? undefined : options;
}

function physicsExcludeEntityFromPayload(
  app: ApertureApp,
  value: unknown,
): string | undefined {
  const explicit = stringFromValue(value);

  if (explicit !== undefined) {
    return explicit;
  }

  const ref = entityRefFromValue(value);

  if (ref === null) {
    return undefined;
  }

  const resolved = resolveActiveEntity(app.lowLevel.world, ref);

  return resolved.ok ? serializeEntityRef(resolved.entity) : undefined;
}

function physicsShapeQueryPayload(
  app: ApertureApp,
  payload: unknown,
):
  | {
      readonly ok: true;
      readonly shape: PhysicsShape;
      readonly transform: PhysicsTransform;
      readonly options?: PhysicsQueryOptions;
    }
  | {
      readonly ok: false;
      readonly diagnostic: Readonly<Record<string, unknown>>;
    } {
  const record = isRecord(payload) ? payload : {};
  const shape = physicsShapeFromPayload(record["shape"]);
  const transform = physicsTransformFromPayload(record["transform"]);

  if (shape === null || transform === null) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.physics.shapeQuery.invalidPayload",
        severity: "error",
        message:
          "physics_overlap_shape requires { shape, transform } with finite primitive shape and transform values.",
        suggestedFix:
          "Pass a shape such as { kind: 'sphere', radius } and transform { translation, rotation? }.",
      },
    };
  }

  const options = physicsQueryOptionsFromPayload(
    app,
    isRecord(record["options"]) ? record["options"] : record,
  );

  return {
    ok: true,
    shape,
    transform,
    ...(options === undefined ? {} : { options }),
  };
}

function physicsShapeCastPayload(
  app: ApertureApp,
  payload: unknown,
):
  | {
      readonly ok: true;
      readonly shape: PhysicsShape;
      readonly cast: PhysicsShapeCast;
      readonly options?: PhysicsQueryOptions;
    }
  | {
      readonly ok: false;
      readonly diagnostic: Readonly<Record<string, unknown>>;
    } {
  const record = isRecord(payload) ? payload : {};
  const castRecord = isRecord(record["cast"]) ? record["cast"] : record;
  const shape = physicsShapeFromPayload(record["shape"]);
  const from = physicsTransformFromPayload(castRecord["from"]);
  const to = physicsTransformFromPayload(castRecord["to"]);

  if (shape === null || from === null || to === null) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.physics.shapeCast.invalidPayload",
        severity: "error",
        message:
          "physics_cast_shape_first requires { shape, from, to } with finite primitive shape and transform values.",
        suggestedFix:
          "Pass a shape plus from/to transforms, each with translation and optional rotation.",
      },
    };
  }

  const options = physicsQueryOptionsFromPayload(
    app,
    isRecord(record["options"]) ? record["options"] : record,
  );

  return {
    ok: true,
    shape,
    cast: { from, to },
    ...(options === undefined ? {} : { options }),
  };
}

function physicsTransformFromPayload(value: unknown): PhysicsTransform | null {
  if (!isRecord(value)) {
    return null;
  }

  const translation = tuple3FromValue(value["translation"]);
  const rotation = tuple4FromValue(value["rotation"] ?? [0, 0, 0, 1]);

  return translation === null || rotation === null
    ? null
    : { translation, rotation };
}

function physicsShapeFromPayload(value: unknown): PhysicsShape | null {
  if (!isRecord(value)) {
    return null;
  }

  const kind = stringFromValue(value["kind"]);

  if (kind === "box") {
    const halfExtents = tuple3FromValue(value["halfExtents"]);

    return halfExtents !== null && halfExtents.every(isPositiveFinite)
      ? { kind, halfExtents }
      : null;
  }

  if (kind === "sphere") {
    const radius = numberFromValue(value["radius"]);

    return radius !== undefined && isPositiveFinite(radius)
      ? { kind, radius }
      : null;
  }

  if (kind === "capsule" || kind === "cylinder" || kind === "cone") {
    const radius = numberFromValue(value["radius"]);
    const halfHeight = numberFromValue(value["halfHeight"]);
    const axis = physicsColliderAxisFromValue(value["axis"]);

    return radius !== undefined &&
      halfHeight !== undefined &&
      isPositiveFinite(radius) &&
      isPositiveFinite(halfHeight) &&
      (value["axis"] === undefined || axis !== null)
      ? {
          kind,
          radius,
          halfHeight,
          ...(axis === null ? {} : { axis }),
        }
      : null;
  }

  if (kind === "convexHull" || kind === "trimesh") {
    const meshId = stringFromValue(value["meshId"]);

    return meshId === undefined ? null : { kind, meshId };
  }

  if (kind === "heightfield") {
    const assetId = stringFromValue(value["assetId"]);

    return assetId === undefined ? null : { kind, assetId };
  }

  return null;
}

function physicsColliderAxisFromValue(value: unknown): "x" | "y" | "z" | null {
  return value === undefined || value === "x" || value === "y" || value === "z"
    ? (value ?? null)
    : null;
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function normalizedDirection(
  value: unknown,
): readonly [number, number, number] | null {
  const direction = tuple3FromValue(value);

  if (direction === null) {
    return null;
  }

  const length = Math.hypot(direction[0], direction[1], direction[2]);

  if (!Number.isFinite(length) || length <= 0) {
    return null;
  }

  return [direction[0] / length, direction[1] / length, direction[2] / length];
}
