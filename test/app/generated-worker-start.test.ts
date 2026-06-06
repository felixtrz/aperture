import { describe, expect, it } from "vitest";

import { createApertureDevtoolsRequest } from "@aperture-engine/app/commands";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { Pickable, createPickable } from "@aperture-engine/render";
import {
  LocalTransform,
  serializeEntityRef,
  type Entity,
} from "@aperture-engine/simulation";
import {
  Collider,
  createPhysicsWorldSyncState,
  ExternalForce,
  ExternalImpulse,
  KinematicTarget,
  PhysicsBodyState,
  PhysicsCharacterController,
  PhysicsColliderAxis,
  PhysicsColliderShapeKind,
  PhysicsDebug,
  PhysicsGravity,
  PhysicsJoint,
  PhysicsJointKind,
  PhysicsMaterial,
  PhysicsMaterialCombineRule,
  PhysicsRigidBodyType,
  PhysicsVelocity,
  RigidBody,
  stepPhysicsWorld,
  type PhysicsEvent,
  type PhysicsBackend,
  type PhysicsColliderGeometryProvider,
  type PhysicsTriangleMeshGeometry,
} from "@aperture-engine/physics";
import { createRapierPhysicsBackend } from "@aperture-engine/physics-rapier";
import { createTestPhysicsBackend } from "@aperture-engine/physics/testing";
import { SIMULATION_WORKER_PROTOCOL } from "@aperture-engine/runtime";
import { createGeneratedInputEventMessage } from "../../packages/app/src/input.js";

describe("generated simulation worker start messages", () => {
  it("unwraps start options nested by createSimulationWorker", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: { stop: true },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(port.posted.filter(isSimulationWorkerSnapshotMessage)).toHaveLength(
      1,
    );
  });

  it("accepts serializable nested fixed-step worker start options", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1 / 120, maxSubsteps: 4 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(port.posted.filter(isSimulationWorkerSnapshotMessage)).toHaveLength(
      1,
    );
  });

  it("returns fixed-step execution details from devtools ecs_step", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 0.1, maxSubsteps: 4 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "step-fixed",
        tool: "ecs_step",
        payload: { delta: 0.2 },
      }),
    );
    const response = (await port.nextPostedMessage(
      isDevtoolsResponseMessage,
    )) as DevtoolsStepResponseMessage;

    expect(response).toMatchObject({
      requestId: "step-fixed",
      ok: true,
      result: {
        paused: true,
        frame: expect.any(Number),
        fixedStep: {
          enabled: true,
          fixedDelta: 0.1,
          substeps: expect.any(Number),
          fixedStepStart: expect.any(Number),
          fixedStepEnd: expect.any(Number),
        },
      },
    });
    expect(response.result.fixedStep.substeps).toBeGreaterThan(0);
    expect(response.result.fixedStep.fixedStepEnd).toBeGreaterThan(
      response.result.fixedStep.fixedStepStart,
    );
  });

  it("steps and diffs ECS physics state in one generated-worker devtools call", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerPhysicsProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 10, maxSubsteps: 4 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-pause-for-step-diff",
        tool: "ecs_pause",
      }),
    );
    await port.nextPostedMessage(
      devtoolsResponseWithId("physics-pause-for-step-diff"),
    );

    const query = {
      key: "physics.diff.body",
      withComponents: [RigidBody.id, Collider.id, PhysicsVelocity.id],
    };
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-step-diff-before",
        tool: "ecs_snapshot",
        payload: { label: "physics-step-diff-before", query },
      }),
    );
    const before = (await port.nextPostedMessage(
      devtoolsResponseWithId("physics-step-diff-before"),
    )) as DevtoolsEntitySnapshotResponseMessage;
    const beforeSummary = (
      before.result as {
        readonly summaries: readonly [{ readonly entity: unknown }];
      }
    ).summaries[0];

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-step-diff-mutate",
        tool: "ecs_set_component_field",
        payload: {
          entity: beforeSummary.entity,
          component: PhysicsVelocity.id,
          field: "linear",
          value: [0.2, 0, 0],
        },
      }),
    );
    await port.nextPostedMessage(
      devtoolsResponseWithId("physics-step-diff-mutate"),
    );

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-step-and-diff",
        tool: "ecs_step_and_diff",
        payload: {
          delta: 20,
          label: "physics-step-diff-after",
          query,
        },
      }),
    );
    const response = (await port.nextPostedMessage(
      devtoolsResponseWithId("physics-step-and-diff"),
    )) as DevtoolsStepAndDiffResponseMessage;

    expect(response).toMatchObject({
      requestId: "physics-step-and-diff",
      ok: true,
      result: {
        step: {
          fixedStep: {
            enabled: true,
            fixedDelta: 10,
            substeps: 2,
            fixedStepStart: 0,
            fixedStepEnd: 2,
          },
          physics: {
            backend: {
              kind: "test",
              execution: "simulation-worker",
            },
            writeback: {
              missingEntities: 0,
            },
          },
        },
        diff: {
          fromLabel: "physics-step-diff-before",
          toLabel: "physics-step-diff-after",
          counts: {
            changed: 1,
          },
          changed: [
            {
              fields: expect.arrayContaining([
                "componentIds",
                "localTransform",
                "physicsVelocity",
                "physicsBodyState",
              ]),
              before: {
                key: "physics.diff.body",
              },
              after: {
                key: "physics.diff.body",
                componentIds: expect.arrayContaining([PhysicsBodyState.id]),
                physicsVelocity: {
                  linear: [expect.closeTo(0.2, 6), 0, 0],
                },
                physicsBodyState: {
                  backendBodyId: expect.any(String),
                  sleeping: false,
                },
              },
            },
          ],
        },
      },
    });
  });

  it("diffs ECS physics writeback after a paused generated-worker fixed step", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerPhysicsProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 10, maxSubsteps: 4 },
        stop: true,
      },
    });

    const startupSnapshot = (await port.nextPostedMessage(
      isSimulationWorkerSnapshotMessage,
    )) as SimulationWorkerSnapshotMessage;
    expect(startupSnapshot.workerSummary.physics).toMatchObject({
      backend: {
        kind: "test",
        build: "test",
        execution: "simulation-worker",
      },
      eventCount: 0,
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-summary-before",
        tool: "physics_summary",
      }),
    );
    const summaryBefore = await port.nextPostedMessage(
      devtoolsResponseWithId("physics-summary-before"),
    );

    expect(summaryBefore).toMatchObject({
      ok: true,
      result: {
        backend: {
          kind: "test",
          build: "test",
          execution: "simulation-worker",
        },
        eventCount: 0,
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-pause",
        tool: "ecs_pause",
      }),
    );
    const pause = await port.nextPostedMessage(
      devtoolsResponseWithId("physics-pause"),
    );

    expect(pause).toMatchObject({
      requestId: "physics-pause",
      ok: true,
      result: { paused: true },
    });

    const query = {
      key: "physics.diff.body",
      withComponents: [
        RigidBody.id,
        Collider.id,
        PhysicsVelocity.id,
        ExternalForce.id,
        ExternalImpulse.id,
        PhysicsMaterial.id,
        PhysicsDebug.id,
      ],
    };
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-before",
        tool: "ecs_snapshot",
        payload: { label: "physics-before", query },
      }),
    );
    const before = (await port.nextPostedMessage(
      devtoolsResponseWithId("physics-before"),
    )) as DevtoolsEntitySnapshotResponseMessage;

    expect(before).toMatchObject({
      ok: true,
      result: {
        label: "physics-before",
        total: 1,
        summaries: [
          {
            key: "physics.diff.body",
            componentIds: expect.arrayContaining([
              RigidBody.id,
              Collider.id,
              PhysicsVelocity.id,
              ExternalForce.id,
              ExternalImpulse.id,
              PhysicsMaterial.id,
              PhysicsDebug.id,
            ]),
            localTransform: {
              translation: [0, 0, 0],
            },
            physicsVelocity: {
              linear: [expect.closeTo(0.05, 6), 0, 0],
              angular: [0, 0, 0],
            },
            physicsExternalForce: {
              force: [0, 0, 0],
              torque: [0, 0, 0],
            },
            physicsExternalImpulse: {
              impulse: [0, 0, 0],
              angularImpulse: [0, 0, 0],
            },
            physicsMaterial: {
              friction: expect.closeTo(0.4, 6),
              restitution: expect.closeTo(0.1, 6),
              density: 2,
              frictionCombine: PhysicsMaterialCombineRule.Max,
              restitutionCombine: PhysicsMaterialCombineRule.Average,
            },
            physicsDebug: {
              broadphaseAabbs: false,
            },
          },
        ],
      },
    });
    expect(
      (before.result as { readonly summaries: readonly unknown[] })
        .summaries[0],
    ).not.toHaveProperty("physicsBodyState");
    const beforeSummary = (
      before.result as {
        readonly summaries: readonly [{ readonly entity: unknown }];
      }
    ).summaries[0];

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-mutate-velocity",
        tool: "ecs_set_component_field",
        payload: {
          entity: beforeSummary.entity,
          component: PhysicsVelocity.id,
          field: "linear",
          value: [0.1, 0, 0],
        },
      }),
    );
    const mutation = (await port.nextPostedMessage(
      devtoolsResponseWithId("physics-mutate-velocity"),
    )) as DevtoolsEntityMutationResponseMessage;

    expect(mutation).toMatchObject({
      ok: true,
      result: {
        component: PhysicsVelocity.id,
        field: "linear",
        value: [0.1, 0, 0],
        summary: {
          key: "physics.diff.body",
          physicsVelocity: {
            linear: [expect.closeTo(0.1, 6), 0, 0],
            angular: [0, 0, 0],
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-mutate-transform",
        tool: "ecs_set_component_field",
        payload: {
          entity: beforeSummary.entity,
          component: LocalTransform.id,
          field: "translation",
          value: [0.5, 0, 0],
        },
      }),
    );
    const transformMutation = (await port.nextPostedMessage(
      devtoolsResponseWithId("physics-mutate-transform"),
    )) as DevtoolsEntityMutationResponseMessage;

    expect(transformMutation).toMatchObject({
      ok: true,
      result: {
        component: LocalTransform.id,
        field: "translation",
        value: [0.5, 0, 0],
        summary: {
          key: "physics.diff.body",
          localTransform: {
            translation: [0.5, 0, 0],
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-mutate-force",
        tool: "ecs_set_component_field",
        payload: {
          entity: beforeSummary.entity,
          component: ExternalForce.id,
          field: "force",
          value: [0.01, 0, 0],
        },
      }),
    );
    const forceMutation = (await port.nextPostedMessage(
      devtoolsResponseWithId("physics-mutate-force"),
    )) as DevtoolsEntityMutationResponseMessage;

    expect(forceMutation).toMatchObject({
      ok: true,
      result: {
        component: ExternalForce.id,
        field: "force",
        value: [0.01, 0, 0],
        summary: {
          key: "physics.diff.body",
          physicsExternalForce: {
            force: [expect.closeTo(0.01, 6), 0, 0],
            torque: [0, 0, 0],
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-mutate-impulse",
        tool: "ecs_set_component_field",
        payload: {
          entity: beforeSummary.entity,
          component: ExternalImpulse.id,
          field: "impulse",
          value: [0.2, 0, 0],
        },
      }),
    );
    const impulseMutation = (await port.nextPostedMessage(
      devtoolsResponseWithId("physics-mutate-impulse"),
    )) as DevtoolsEntityMutationResponseMessage;

    expect(impulseMutation).toMatchObject({
      ok: true,
      result: {
        component: ExternalImpulse.id,
        field: "impulse",
        value: [0.2, 0, 0],
        summary: {
          key: "physics.diff.body",
          physicsExternalImpulse: {
            impulse: [expect.closeTo(0.2, 6), 0, 0],
            angularImpulse: [0, 0, 0],
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-mutate-material",
        tool: "ecs_set_component_field",
        payload: {
          entity: beforeSummary.entity,
          component: PhysicsMaterial.id,
          field: "friction",
          value: 0.7,
        },
      }),
    );
    const materialMutation = (await port.nextPostedMessage(
      devtoolsResponseWithId("physics-mutate-material"),
    )) as DevtoolsEntityMutationResponseMessage;

    expect(materialMutation).toMatchObject({
      ok: true,
      result: {
        component: PhysicsMaterial.id,
        field: "friction",
        value: 0.7,
        summary: {
          key: "physics.diff.body",
          physicsMaterial: {
            friction: expect.closeTo(0.7, 6),
            frictionCombine: PhysicsMaterialCombineRule.Max,
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-mutate-debug",
        tool: "ecs_set_component_field",
        payload: {
          entity: beforeSummary.entity,
          component: PhysicsDebug.id,
          field: "broadphaseAabbs",
          value: true,
        },
      }),
    );
    const debugMutation = (await port.nextPostedMessage(
      devtoolsResponseWithId("physics-mutate-debug"),
    )) as DevtoolsEntityMutationResponseMessage;

    expect(debugMutation).toMatchObject({
      ok: true,
      result: {
        component: PhysicsDebug.id,
        field: "broadphaseAabbs",
        value: true,
        summary: {
          key: "physics.diff.body",
          physicsDebug: {
            broadphaseAabbs: true,
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-step",
        tool: "ecs_step",
        payload: { delta: 20 },
      }),
    );
    const step = (await port.nextPostedMessage(
      devtoolsResponseWithId("physics-step"),
    )) as DevtoolsStepResponseMessage;

    expect(step).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          enabled: true,
          fixedDelta: 10,
          substeps: 2,
          fixedStepStart: 0,
          fixedStepEnd: 2,
        },
        physics: {
          backend: {
            kind: "test",
            build: "test",
            execution: "simulation-worker",
          },
          step: {
            enabled: true,
            backend: "test",
            backendBuild: "test",
            execution: "simulation-worker",
            fixedDelta: 10,
            fixedStep: 1,
            bodyCount: expect.any(Number),
            colliderCount: expect.any(Number),
          },
          readback: {
            bodyCount: expect.any(Number),
            eventCount: expect.any(Number),
          },
          writeback: {
            bodyCount: expect.any(Number),
            transformWrites: expect.any(Number),
            velocityWrites: expect.any(Number),
            bodyStateWrites: expect.any(Number),
            missingEntities: 0,
          },
          eventCount: 2,
          eventKinds: {
            controllerGroundedChanged: 1,
            triggerEnter: 1,
          },
          eventFamilies: {
            controllerGroundedChanged: 1,
            triggers: 1,
          },
          events: expect.arrayContaining([
            expect.objectContaining({
              kind: "controllerGroundedChanged",
              grounded: false,
              entityA: expect.any(String),
              entityB: expect.any(String),
            }),
            expect.objectContaining({
              kind: "triggerEnter",
              fixedStep: 1,
              entityA: expect.any(String),
              entityB: expect.any(String),
            }),
          ]),
        },
      },
    });
    const stepPhysics = step.result.physics as {
      readonly step?: { readonly bodyCount?: number };
      readonly readback?: { readonly bodyCount?: number };
      readonly writeback?: {
        readonly transformWrites?: number;
        readonly velocityWrites?: number;
        readonly bodyStateWrites?: number;
      };
    };
    expect(stepPhysics.step?.bodyCount).toBeGreaterThan(0);
    expect(stepPhysics.readback?.bodyCount).toBeGreaterThan(0);
    expect(stepPhysics.writeback?.transformWrites).toBeGreaterThan(0);
    expect(stepPhysics.writeback?.velocityWrites).toBeGreaterThan(0);
    expect(stepPhysics.writeback?.bodyStateWrites).toBeGreaterThan(0);
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-summary-after",
        tool: "physics_summary",
      }),
    );
    const summaryAfter = await port.nextPostedMessage(
      devtoolsResponseWithId("physics-summary-after"),
    );

    expect(summaryAfter).toMatchObject({
      ok: true,
      result: {
        backend: {
          kind: "test",
          build: "test",
          execution: "simulation-worker",
        },
        step: {
          fixedStep: 1,
          execution: "simulation-worker",
        },
        readback: {
          bodyCount: expect.any(Number),
        },
        writeback: {
          transformWrites: expect.any(Number),
          velocityWrites: expect.any(Number),
          bodyStateWrites: expect.any(Number),
          missingEntities: 0,
        },
        eventCount: 2,
        eventKinds: {
          controllerGroundedChanged: 1,
          triggerEnter: 1,
        },
        eventFamilies: {
          controllerGroundedChanged: 1,
          triggers: 1,
        },
        events: expect.arrayContaining([
          expect.objectContaining({
            kind: "controllerGroundedChanged",
            grounded: false,
          }),
          expect.objectContaining({
            kind: "triggerEnter",
          }),
        ]),
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-debug-authored",
        tool: "physics_debug_geometry",
      }),
    );
    const authoredDebugGeometry = (await port.nextPostedMessage(
      devtoolsResponseWithId("physics-debug-authored"),
    )) as DevtoolsPhysicsDebugGeometryResponseMessage;

    expect(authoredDebugGeometry).toMatchObject({
      ok: true,
      result: {
        options: {
          broadphaseAabbs: true,
        },
        geometry: {
          lines: expect.arrayContaining([
            expect.objectContaining({
              color: [0.95, 0.65, 0.15, 1],
            }),
          ]),
        },
      },
    });
    expect(
      authoredDebugGeometry.result.geometry.lines.length,
    ).toBeGreaterThanOrEqual(12);

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-events-trigger",
        tool: "physics_events",
        payload: {
          kind: "triggerEnter",
          family: "triggers",
          limit: 1,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("physics-events-trigger"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        filters: {
          kind: "triggerEnter",
          family: "triggers",
          limit: 1,
        },
        returnedCount: 1,
        matchedCount: 1,
        totalCount: 2,
        events: [
          expect.objectContaining({
            kind: "triggerEnter",
            entityA: expect.any(String),
            entityB: expect.any(String),
          }),
        ],
        physics: {
          eventKinds: {
            controllerGroundedChanged: 1,
            triggerEnter: 1,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-raycast-first",
        tool: "physics_raycast_first",
        payload: {
          origin: [8, 0, 0],
          direction: [10, 0, 0],
          maxDistance: 4,
        },
      }),
    );
    const firstRaycast = await port.nextPostedMessage(
      devtoolsResponseWithId("physics-raycast-first"),
    );

    expect(firstRaycast).toMatchObject({
      ok: true,
      result: {
        physics: {
          backend: {
            kind: "test",
            execution: "simulation-worker",
          },
        },
        options: null,
        hit: {
          entity: expect.any(String),
          point: [expect.closeTo(9, 6), 0, 0],
          normal: [-1, 0, 0],
          distance: expect.closeTo(1, 6),
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-raycast-all",
        tool: "physics_raycast_all",
        payload: {
          ray: {
            origin: [0, 0, 0],
            direction: [1, 0, 0],
            maxDistance: 12,
          },
          options: {
            includeSensors: true,
            excludeEntity: beforeSummary.entity,
          },
        },
      }),
    );
    const allRaycast = await port.nextPostedMessage(
      devtoolsResponseWithId("physics-raycast-all"),
    );

    expect(allRaycast).toMatchObject({
      ok: true,
      result: {
        physics: {
          backend: {
            kind: "test",
            execution: "simulation-worker",
          },
        },
        options: {
          includeSensors: true,
          excludeEntity: expect.any(String),
        },
        hits: [
          expect.objectContaining({
            entity: expect.any(String),
            distance: expect.closeTo(3.5, 6),
            point: [expect.closeTo(3.5, 6), 0, 0],
            normal: [-1, 0, 0],
          }),
        ],
      },
    });
    const triggerEntity = (
      allRaycast as {
        readonly result?: {
          readonly hits?: readonly { readonly entity?: unknown }[];
        };
      }
    ).result?.hits?.[0]?.entity;

    expect(typeof triggerEntity).toBe("string");

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-overlap-shape-default",
        tool: "physics_overlap_shape",
        payload: {
          shape: { kind: "sphere", radius: 0.6 },
          transform: { translation: [4, 0, 0] },
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("physics-overlap-shape-default"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        physics: {
          backend: {
            kind: "test",
            execution: "simulation-worker",
          },
        },
        options: null,
        hits: [],
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-overlap-shape",
        tool: "physics_overlap_shape",
        payload: {
          shape: { kind: "sphere", radius: 0.6 },
          transform: { translation: [4, 0, 0] },
          options: { includeSensors: true },
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("physics-overlap-shape"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        physics: {
          backend: {
            kind: "test",
            execution: "simulation-worker",
          },
        },
        options: { includeSensors: true },
        hits: [{ entity: triggerEntity }],
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-cast-shape",
        tool: "physics_cast_shape_first",
        payload: {
          shape: { kind: "sphere", radius: 0.25 },
          from: { translation: [2, 0, 0] },
          to: { translation: [5, 0, 0] },
          options: { includeSensors: true },
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("physics-cast-shape"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        physics: {
          backend: {
            kind: "test",
            execution: "simulation-worker",
          },
        },
        options: { includeSensors: true },
        hit: {
          entity: triggerEntity,
          timeOfImpact: expect.closeTo(0.416666, 5),
          point: [expect.closeTo(3.5, 6), 0, 0],
          normal: [-1, 0, 0],
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-project-point",
        tool: "physics_project_point",
        payload: { point: [4.2, 0, 0], options: { includeSensors: true } },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("physics-project-point"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        physics: {
          backend: {
            kind: "test",
            execution: "simulation-worker",
          },
        },
        options: { includeSensors: true },
        projection: {
          entity: triggerEntity,
          point: [expect.closeTo(4.5, 6), 0, 0],
          normal: [1, 0, 0],
          distance: expect.closeTo(0.3, 6),
          inside: true,
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-debug-aabbs",
        tool: "physics_debug_geometry",
        payload: { broadphaseAabbs: true },
      }),
    );
    const debugGeometry = (await port.nextPostedMessage(
      devtoolsResponseWithId("physics-debug-aabbs"),
    )) as DevtoolsPhysicsDebugGeometryResponseMessage;

    expect(debugGeometry).toMatchObject({
      ok: true,
      result: {
        physics: {
          backend: {
            kind: "test",
            build: "test",
            execution: "simulation-worker",
          },
        },
        geometry: {
          lines: expect.arrayContaining([
            expect.objectContaining({
              color: [0.95, 0.65, 0.15, 1],
            }),
          ]),
        },
      },
    });
    expect(debugGeometry.result.geometry.lines.length).toBeGreaterThanOrEqual(
      12,
    );
    expect(debugGeometry.result.geometry.lines.length % 12).toBe(0);
    expect(
      debugGeometry.result.geometry.lines.every(
        (line) =>
          line.from.every(Number.isFinite) &&
          line.to.every(Number.isFinite) &&
          line.color.every(Number.isFinite),
      ),
    ).toBe(true);

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-debug-summary",
        tool: "physics_debug_summary",
        payload: { broadphaseAabbs: true },
      }),
    );
    const debugSummary = (await port.nextPostedMessage(
      devtoolsResponseWithId("physics-debug-summary"),
    )) as DevtoolsPhysicsDebugSummaryResponseMessage;

    expect(debugSummary).toMatchObject({
      ok: true,
      result: {
        physics: {
          backend: {
            kind: "test",
            build: "test",
            execution: "simulation-worker",
          },
        },
        options: { broadphaseAabbs: true },
        summary: {
          lineCount: debugGeometry.result.geometry.lines.length,
          finiteLineCount: debugGeometry.result.geometry.lines.length,
          invalidLineCount: 0,
          colorCount: 1,
          colors: [
            {
              color: [0.95, 0.65, 0.15, 1],
              lineCount: debugGeometry.result.geometry.lines.length,
            },
          ],
          bounds: {
            min: expect.arrayContaining([expect.any(Number)]),
            max: expect.arrayContaining([expect.any(Number)]),
          },
        },
      },
    });
    expect(debugSummary.result.summary.bounds?.min.every(Number.isFinite)).toBe(
      true,
    );
    expect(debugSummary.result.summary.bounds?.max.every(Number.isFinite)).toBe(
      true,
    );

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-overlap-invalid",
        tool: "physics_overlap_shape",
        payload: {
          shape: { kind: "sphere" },
          transform: { translation: [4, 0, 0] },
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("physics-overlap-invalid"),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "aperture.physics.shapeQuery.invalidPayload",
        }),
      ],
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-raycast-invalid",
        tool: "physics_raycast_first",
        payload: {
          origin: [0, 0, 0],
          direction: [0, 0, 0],
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("physics-raycast-invalid"),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "aperture.physics.raycast.invalidRay",
        }),
      ],
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-after",
        tool: "ecs_diff",
        payload: { label: "physics-after", query },
      }),
    );
    const diff = (await port.nextPostedMessage(
      devtoolsResponseWithId("physics-after"),
    )) as DevtoolsEntityDiffResponseMessage;

    expect(diff).toMatchObject({
      ok: true,
      result: {
        fromLabel: "physics-before",
        toLabel: "physics-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 1,
          unchanged: 0,
        },
        changed: [
          {
            fields: expect.arrayContaining([
              "componentIds",
              "localTransform",
              "physicsExternalForce",
              "physicsMaterial",
              "physicsDebug",
              "physicsVelocity",
              "physicsBodyState",
              "worldTransform",
            ]),
            before: {
              key: "physics.diff.body",
              localTransform: {
                translation: [0, 0, 0],
              },
              physicsVelocity: {
                linear: [expect.closeTo(0.05, 6), 0, 0],
                angular: [0, 0, 0],
              },
              physicsExternalForce: {
                force: [0, 0, 0],
                torque: [0, 0, 0],
              },
              physicsExternalImpulse: {
                impulse: [0, 0, 0],
                angularImpulse: [0, 0, 0],
              },
              physicsMaterial: {
                friction: expect.closeTo(0.4, 6),
              },
              physicsDebug: {
                broadphaseAabbs: false,
              },
            },
            after: {
              key: "physics.diff.body",
              componentIds: expect.arrayContaining([PhysicsBodyState.id]),
              localTransform: {
                translation: [expect.closeTo(9.5, 6), 0, 0],
              },
              physicsVelocity: {
                linear: [expect.closeTo(0.5, 6), 0, 0],
                angular: [0, 0, 0],
              },
              physicsExternalForce: {
                force: [expect.closeTo(0.01, 6), 0, 0],
                torque: [0, 0, 0],
              },
              physicsExternalImpulse: {
                impulse: [0, 0, 0],
                angularImpulse: [0, 0, 0],
              },
              physicsMaterial: {
                friction: expect.closeTo(0.7, 6),
              },
              physicsDebug: {
                broadphaseAabbs: true,
              },
              physicsBodyState: {
                sleeping: false,
                currentTranslation: [expect.closeTo(9.5, 6), 0, 0],
                currentRotation: [0, 0, 0, 1],
                previousTranslation: [expect.closeTo(4.5, 6), 0, 0],
                previousRotation: [0, 0, 0, 1],
                backendBodyId: expect.any(String),
              },
            },
          },
        ],
      },
    });
  });

  it("diffs ECS-authored gravity after a paused generated-worker fixed step", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerPhysicsGravityProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1, maxSubsteps: 1 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "gravity-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("gravity-pause")),
    ).toMatchObject({
      ok: true,
      result: { paused: true },
    });

    const query = {
      key: "physics.gravity.body",
      withComponents: [RigidBody.id, Collider.id, PhysicsGravity.id],
    };
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "gravity-before",
        tool: "ecs_snapshot",
        payload: { label: "gravity-before", query },
      }),
    );
    const before = (await port.nextPostedMessage(
      devtoolsResponseWithId("gravity-before"),
    )) as DevtoolsEntitySnapshotResponseMessage;

    expect(before).toMatchObject({
      ok: true,
      result: {
        label: "gravity-before",
        total: 1,
        summaries: [
          {
            key: "physics.gravity.body",
            physicsGravity: {
              gravity: [0, 0, 0],
            },
            physicsVelocity: {
              linear: [0, 0, 0],
            },
            localTransform: {
              translation: [0, 0, 0],
            },
          },
        ],
      },
    });
    const gravityEntity = (
      before.result as {
        readonly summaries: readonly [{ readonly entity: unknown }];
      }
    ).summaries[0].entity;

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "gravity-mutate",
        tool: "ecs_set_component_field",
        payload: {
          entity: gravityEntity,
          component: PhysicsGravity.id,
          field: "gravity",
          value: [0, -1, 0],
        },
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("gravity-mutate")),
    ).toMatchObject({
      ok: true,
      result: {
        component: PhysicsGravity.id,
        field: "gravity",
        value: [0, -1, 0],
        summary: {
          key: "physics.gravity.body",
          physicsGravity: {
            gravity: [0, -1, 0],
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "gravity-step",
        tool: "ecs_step",
        payload: { delta: 1 },
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("gravity-step")),
    ).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          enabled: true,
          fixedDelta: 1,
          substeps: 1,
        },
        physics: {
          backend: {
            kind: "test",
            execution: "simulation-worker",
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "gravity-after",
        tool: "ecs_diff",
        payload: { label: "gravity-after", query },
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("gravity-after")),
    ).toMatchObject({
      ok: true,
      result: {
        fromLabel: "gravity-before",
        toLabel: "gravity-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 1,
          unchanged: 0,
        },
        changed: [
          {
            fields: expect.arrayContaining([
              "componentIds",
              "localTransform",
              "physicsGravity",
              "physicsVelocity",
              "physicsBodyState",
              "worldTransform",
            ]),
            before: {
              key: "physics.gravity.body",
              physicsGravity: {
                gravity: [0, 0, 0],
              },
              localTransform: {
                translation: [0, 0, 0],
              },
            },
            after: {
              key: "physics.gravity.body",
              componentIds: expect.arrayContaining([PhysicsBodyState.id]),
              physicsGravity: {
                gravity: [0, -1, 0],
              },
              physicsVelocity: {
                linear: [0, -1, 0],
              },
              localTransform: {
                translation: [0, -1, 0],
              },
              physicsBodyState: {
                sleeping: false,
                currentTranslation: [0, -1, 0],
                previousTranslation: [0, -1, 0],
              },
            },
          },
        ],
      },
    });
  });

  it("picks post-physics writeback state during a paused generated-worker fixed step", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [{ default: GeneratedWorkerPhysicsInteractionProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1, maxSubsteps: 1 },
        stop: true,
      },
    });
    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);

    const query = { key: "physics.interaction.body" };
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-interaction-before",
        tool: "ecs_snapshot",
        payload: { label: "physics-interaction-before", query },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("physics-interaction-before"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        label: "physics-interaction-before",
        total: 1,
        summaries: [
          {
            key: "physics.interaction.body",
            localTransform: {
              translation: [2, 0, 0],
            },
            physicsVelocity: {
              linear: [-2, 0, 0],
              angular: [0, 0, 0],
            },
          },
        ],
      },
    });

    port.dispatch(
      createGeneratedInputEventMessage({
        kind: "pointer",
        pointer: "primary",
        position: [0.5, 0.5],
        pressed: false,
      }),
    );
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-interaction-step",
        tool: "ecs_step",
        payload: { delta: 1 },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("physics-interaction-step"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        paused: true,
        fixedStep: {
          enabled: true,
          fixedDelta: 1,
          substeps: 1,
        },
        physics: {
          backend: {
            kind: "test",
            execution: "simulation-worker",
          },
          sync: {
            bodyCount: 1,
            colliderCount: 1,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "physics-interaction-after",
        tool: "ecs_diff",
        payload: { label: "physics-interaction-after", query },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("physics-interaction-after"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        fromLabel: "physics-interaction-before",
        toLabel: "physics-interaction-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 1,
          unchanged: 0,
        },
        changed: [
          {
            fields: expect.arrayContaining([
              "componentIds",
              "localTransform",
              "physicsVelocity",
              "physicsBodyState",
              "worldTransform",
            ]),
            before: {
              key: "physics.interaction.body",
              localTransform: {
                translation: [2, 0, 0],
              },
              physicsVelocity: {
                linear: [-2, 0, 0],
                angular: [0, 0, 0],
              },
            },
            after: {
              key: "physics.interaction.body",
              componentIds: expect.arrayContaining([PhysicsBodyState.id]),
              localTransform: {
                translation: [0, 0, 0],
              },
              physicsVelocity: {
                linear: [-2, 0, 0],
                angular: [0, 1, 0],
              },
              physicsBodyState: {
                currentTranslation: [0, 0, 0],
                previousTranslation: [0, 0, 0],
                backendBodyId: expect.any(String),
              },
            },
          },
        ],
      },
    });
  });

  it("moves characters through generated-worker devtools and diffs ECS writeback", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerPhysicsProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 10, maxSubsteps: 4 },
        stop: true,
      },
    });
    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "character-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("character-pause")),
    ).toMatchObject({ ok: true });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "character-initial-step",
        tool: "ecs_step",
        payload: { delta: 10 },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("character-initial-step"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          substeps: 1,
        },
        physics: {
          backend: {
            kind: "test",
            execution: "simulation-worker",
          },
        },
      },
    });

    const query = {
      key: "physics.diff.character",
      withComponents: [
        RigidBody.id,
        Collider.id,
        PhysicsCharacterController.id,
      ],
    };
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "character-before",
        tool: "ecs_snapshot",
        payload: { label: "character-before", query },
      }),
    );
    const before = (await port.nextPostedMessage(
      devtoolsResponseWithId("character-before"),
    )) as DevtoolsEntitySnapshotResponseMessage;

    expect(before).toMatchObject({
      ok: true,
      result: {
        total: 1,
        summaries: [
          {
            key: "physics.diff.character",
            localTransform: {
              translation: [0, 1, 0],
            },
            physicsCharacterController: {
              snapToGroundDistance: expect.closeTo(0.05, 5),
              slide: true,
              autostepEnabled: false,
              characterMassMode: "disabled",
            },
          },
        ],
      },
    });
    const character = (
      before.result as {
        readonly summaries: readonly [{ readonly entity: unknown }];
      }
    ).summaries[0].entity;

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "character-controller-edit",
        tool: "ecs_set_component_field",
        payload: {
          entity: character,
          component: PhysicsCharacterController.id,
          field: "snapToGroundDistance",
          value: 0.08,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("character-controller-edit"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        summary: {
          physicsCharacterController: {
            snapToGroundDistance: expect.closeTo(0.08, 5),
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "character-move",
        tool: "physics_move_character",
        payload: {
          entity: character,
          desiredTranslation: [0, 0, 1],
        },
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("character-move")),
    ).toMatchObject({
      ok: true,
      result: {
        appliedTarget: true,
        move: {
          desiredTranslation: [0, 0, 1],
          movement: [0, 0, 1],
          targetTranslation: [0, 1, 1],
          collisions: [],
        },
        settings: {
          snapToGroundDistance: expect.closeTo(0.08, 5),
          slide: true,
          autostep: false,
          characterMass: null,
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "character-invalid-move",
        tool: "physics_move_character",
        payload: {
          entity: character,
          desiredTranslation: [0, 0, 0],
          settings: {
            autostep: { maxHeight: 0.2 },
          },
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("character-invalid-move"),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "aperture.physics.moveCharacter.invalidSettings",
        }),
      ],
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "character-apply-step",
        tool: "ecs_step",
        payload: { delta: 10 },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("character-apply-step"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          substeps: 1,
        },
        physics: {
          eventFamilies: {
            controllerGroundedChanged: 1,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "character-after",
        tool: "ecs_diff",
        payload: { label: "character-after", query },
      }),
    );
    const diff = (await port.nextPostedMessage(
      devtoolsResponseWithId("character-after"),
    )) as DevtoolsEntityDiffResponseMessage;

    expect(diff).toMatchObject({
      ok: true,
      result: {
        fromLabel: "character-before",
        toLabel: "character-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 1,
          unchanged: 0,
        },
        changed: [
          {
            fields: expect.arrayContaining([
              "componentIds",
              "localTransform",
              "physicsCharacterController",
              "physicsKinematicTarget",
              "physicsBodyState",
              "worldTransform",
            ]),
            before: {
              key: "physics.diff.character",
              localTransform: {
                translation: [0, 1, 0],
              },
            },
            after: {
              key: "physics.diff.character",
              componentIds: expect.arrayContaining([
                KinematicTarget.id,
                PhysicsCharacterController.id,
                PhysicsBodyState.id,
              ]),
              localTransform: {
                translation: [0, 1, 1],
              },
              physicsCharacterController: {
                snapToGroundDistance: expect.closeTo(0.08, 5),
              },
              physicsKinematicTarget: {
                enabled: true,
                translation: [0, 1, 1],
                rotation: [0, 0, 0, 1],
              },
              physicsBodyState: {
                sleeping: false,
                currentTranslation: [0, 1, 1],
                currentRotation: [0, 0, 0, 1],
                previousTranslation: [0, 1, 0],
                previousRotation: [0, 0, 0, 1],
                backendBodyId: expect.any(String),
              },
            },
          },
        ],
      },
    });
  });

  it("edits and diffs rigid body and collider authoring in a paused generated worker", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerPhysicsProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 10, maxSubsteps: 4 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "body-collider-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("body-collider-pause"),
      ),
    ).toMatchObject({
      ok: true,
      result: { paused: true },
    });

    const query = {
      key: "physics.diff.body",
      withComponents: [RigidBody.id, Collider.id, PhysicsVelocity.id],
    };
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "body-collider-before",
        tool: "ecs_snapshot",
        payload: { label: "body-collider-before", query },
      }),
    );
    const before = (await port.nextPostedMessage(
      devtoolsResponseWithId("body-collider-before"),
    )) as DevtoolsEntitySnapshotResponseMessage;

    expect(before).toMatchObject({
      ok: true,
      result: {
        label: "body-collider-before",
        total: 1,
        summaries: [
          {
            key: "physics.diff.body",
            physicsRigidBody: {
              enabled: true,
              type: PhysicsRigidBodyType.Dynamic,
            },
            physicsCollider: {
              enabled: true,
              shapeKind: "sphere",
              radius: 0.5,
            },
            physicsVelocity: {
              linear: [expect.closeTo(0.05, 6), 0, 0],
            },
            localTransform: {
              translation: [0, 0, 0],
            },
          },
        ],
      },
    });
    const entity = (
      before.result as {
        readonly summaries: readonly [{ readonly entity: unknown }];
      }
    ).summaries[0].entity;

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "body-collider-mutate-type",
        tool: "ecs_set_component_field",
        payload: {
          entity,
          component: RigidBody.id,
          field: "type",
          value: PhysicsRigidBodyType.Static,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("body-collider-mutate-type"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: RigidBody.id,
        field: "type",
        value: PhysicsRigidBodyType.Static,
        summary: {
          key: "physics.diff.body",
          physicsRigidBody: {
            type: PhysicsRigidBodyType.Static,
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "body-collider-mutate-radius",
        tool: "ecs_set_component_field",
        payload: {
          entity,
          component: Collider.id,
          field: "radius",
          value: 1.25,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("body-collider-mutate-radius"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: Collider.id,
        field: "radius",
        value: 1.25,
        summary: {
          key: "physics.diff.body",
          physicsCollider: {
            radius: expect.closeTo(1.25, 6),
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "body-collider-mutate-shape-kind",
        tool: "ecs_set_component_field",
        payload: {
          entity,
          component: Collider.id,
          field: "shapeKind",
          value: PhysicsColliderShapeKind.Cylinder,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("body-collider-mutate-shape-kind"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: Collider.id,
        field: "shapeKind",
        value: PhysicsColliderShapeKind.Cylinder,
        summary: {
          key: "physics.diff.body",
          physicsCollider: {
            shapeKind: PhysicsColliderShapeKind.Cylinder,
            radius: expect.closeTo(1.25, 6),
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "body-collider-mutate-half-height",
        tool: "ecs_set_component_field",
        payload: {
          entity,
          component: Collider.id,
          field: "halfHeight",
          value: 2,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("body-collider-mutate-half-height"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: Collider.id,
        field: "halfHeight",
        value: 2,
        summary: {
          key: "physics.diff.body",
          physicsCollider: {
            shapeKind: PhysicsColliderShapeKind.Cylinder,
            halfHeight: expect.closeTo(2, 6),
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "body-collider-mutate-axis",
        tool: "ecs_set_component_field",
        payload: {
          entity,
          component: Collider.id,
          field: "axis",
          value: PhysicsColliderAxis.X,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("body-collider-mutate-axis"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: Collider.id,
        field: "axis",
        value: PhysicsColliderAxis.X,
        summary: {
          key: "physics.diff.body",
          physicsCollider: {
            shapeKind: PhysicsColliderShapeKind.Cylinder,
            axis: PhysicsColliderAxis.X,
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "body-collider-mutate-offset",
        tool: "ecs_set_component_field",
        payload: {
          entity,
          component: Collider.id,
          field: "offsetTranslation",
          value: [2, 3, 0],
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("body-collider-mutate-offset"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: Collider.id,
        field: "offsetTranslation",
        value: [2, 3, 0],
        summary: {
          key: "physics.diff.body",
          physicsCollider: {
            shapeKind: PhysicsColliderShapeKind.Cylinder,
            offsetTranslation: [2, 3, 0],
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "body-collider-step",
        tool: "ecs_step",
        payload: { delta: 10 },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("body-collider-step"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          enabled: true,
          fixedDelta: 10,
          substeps: 1,
        },
        physics: {
          backend: {
            kind: "test",
            build: "test",
            execution: "simulation-worker",
          },
        },
      },
    });
    const cylinderBoundsRadius = Math.hypot(1.25, 2);
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "body-collider-cylinder-ray",
        tool: "physics_raycast_first",
        payload: {
          origin: [-4, 3, 0],
          direction: [1, 0, 0],
          maxDistance: 10,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("body-collider-cylinder-ray"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        hit: {
          entity: expect.any(String),
          distance: expect.closeTo(6 - cylinderBoundsRadius, 6),
          normal: [-1, 0, 0],
        },
        physics: {
          step: {
            execution: "simulation-worker",
          },
          writeback: {
            missingEntities: 0,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "body-collider-after",
        tool: "ecs_diff",
        payload: { label: "body-collider-after", query },
      }),
    );
    const diff = (await port.nextPostedMessage(
      devtoolsResponseWithId("body-collider-after"),
    )) as DevtoolsEntityDiffResponseMessage;

    expect(diff).toMatchObject({
      ok: true,
      result: {
        fromLabel: "body-collider-before",
        toLabel: "body-collider-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 1,
          unchanged: 0,
        },
        changed: [
          {
            fields: expect.arrayContaining([
              "componentIds",
              "physicsRigidBody",
              "physicsCollider",
              "physicsBodyState",
            ]),
            before: {
              key: "physics.diff.body",
              physicsRigidBody: {
                type: PhysicsRigidBodyType.Dynamic,
              },
              physicsCollider: {
                shapeKind: "sphere",
                radius: 0.5,
              },
              localTransform: {
                translation: [0, 0, 0],
              },
            },
            after: {
              key: "physics.diff.body",
              componentIds: expect.arrayContaining([PhysicsBodyState.id]),
              physicsRigidBody: {
                type: PhysicsRigidBodyType.Static,
              },
              physicsCollider: {
                shapeKind: PhysicsColliderShapeKind.Cylinder,
                radius: expect.closeTo(1.25, 6),
                halfHeight: expect.closeTo(2, 6),
                axis: PhysicsColliderAxis.X,
                offsetTranslation: [2, 3, 0],
              },
              localTransform: {
                translation: [0, 0, 0],
              },
              physicsBodyState: {
                sleeping: false,
                currentTranslation: [0, 0, 0],
                previousTranslation: [0, 0, 0],
                backendBodyId: expect.any(String),
              },
            },
          },
        ],
      },
    });
  });

  it("diffs parent body writeback from a child collider in a paused generated worker", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerChildColliderProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1, maxSubsteps: 1 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "child-collider-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("child-collider-pause"),
      ),
    ).toMatchObject({
      ok: true,
      result: { paused: true },
    });

    const bodyQuery = {
      key: "physics.child.body",
      withComponents: [RigidBody.id, PhysicsVelocity.id],
    };
    const before = await waitForEntitySnapshot(port, {
      requestIdPrefix: "child-collider-before",
      label: "child-collider-before",
      query: bodyQuery,
      total: 1,
    });
    const beforeSummary = (
      before.result as {
        readonly summaries: readonly [
          {
            readonly key?: string;
            readonly componentIds?: readonly string[];
            readonly localTransform?: {
              readonly translation?: readonly number[];
            };
            readonly physicsVelocity?: {
              readonly linear?: readonly number[];
            };
          },
        ];
      }
    ).summaries[0];

    expect(beforeSummary).toMatchObject({
      key: "physics.child.body",
      componentIds: expect.arrayContaining([RigidBody.id, PhysicsVelocity.id]),
      localTransform: {
        translation: [0, 0, 0],
      },
      physicsVelocity: {
        linear: [1, 0, 0],
      },
    });
    expect(beforeSummary.componentIds ?? []).not.toContain(Collider.id);
    expect(beforeSummary.componentIds ?? []).not.toContain(PhysicsBodyState.id);

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "child-collider-step",
        tool: "ecs_step",
        payload: { delta: 1 },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("child-collider-step"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          enabled: true,
          fixedDelta: 1,
          substeps: 1,
        },
        physics: {
          backend: {
            kind: "test",
            build: "test",
            execution: "simulation-worker",
          },
          sync: {
            bodyCount: 1,
            colliderCount: 2,
          },
          step: {
            bodyCount: 1,
            colliderCount: 2,
          },
          writeback: {
            bodyCount: 1,
            transformWrites: 1,
            velocityWrites: 1,
            bodyStateWrites: 1,
            missingEntities: 0,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "child-collider-ray",
        tool: "physics_raycast_first",
        payload: {
          origin: [0, 0, 0],
          direction: [1, 0, 0],
          maxDistance: 3,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("child-collider-ray"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        hit: {
          entity: expect.any(String),
          collider: expect.any(String),
          distance: expect.closeTo(1.75, 6),
          point: [expect.closeTo(1.75, 6), 0, 0],
          normal: [-1, 0, 0],
        },
        physics: {
          sync: {
            bodyCount: 1,
            colliderCount: 2,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "child-collider-ray-all",
        tool: "physics_raycast_all",
        payload: {
          ray: {
            origin: [0, 0, 0],
            direction: [1, 0, 0],
            maxDistance: 5,
          },
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("child-collider-ray-all"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        hits: [
          expect.objectContaining({
            entity: expect.any(String),
            collider: expect.any(String),
            distance: expect.closeTo(1.75, 6),
          }),
          expect.objectContaining({
            entity: expect.any(String),
            collider: expect.any(String),
            distance: expect.closeTo(3.75, 6),
          }),
        ],
        physics: {
          sync: {
            bodyCount: 1,
            colliderCount: 2,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "child-collider-after",
        tool: "ecs_diff",
        payload: { label: "child-collider-after", query: bodyQuery },
      }),
    );
    const diff = (await port.nextPostedMessage(
      devtoolsResponseWithId("child-collider-after"),
    )) as DevtoolsEntityDiffResponseMessage;

    expect(diff).toMatchObject({
      ok: true,
      result: {
        fromLabel: "child-collider-before",
        toLabel: "child-collider-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 1,
          unchanged: 0,
        },
        changed: [
          {
            fields: expect.arrayContaining([
              "componentIds",
              "localTransform",
              "physicsBodyState",
            ]),
            before: {
              key: "physics.child.body",
              localTransform: {
                translation: [0, 0, 0],
              },
            },
            after: {
              key: "physics.child.body",
              componentIds: expect.arrayContaining([PhysicsBodyState.id]),
              localTransform: {
                translation: [1, 0, 0],
              },
              physicsBodyState: {
                currentTranslation: [1, 0, 0],
                previousTranslation: [1, 0, 0],
                backendBodyId: expect.any(String),
              },
            },
          },
        ],
      },
    });
    const after = (
      diff.result as {
        readonly changed: readonly [
          {
            readonly after: {
              readonly componentIds?: readonly string[];
            };
          },
        ];
      }
    ).changed[0]?.after;
    expect(after?.componentIds ?? []).not.toContain(Collider.id);
  });

  it("diffs parented rigid-body parent-local writeback in a paused generated worker", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerParentedBodyProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1, maxSubsteps: 1 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "parented-body-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("parented-body-pause"),
      ),
    ).toMatchObject({
      ok: true,
      result: { paused: true },
    });

    const query = {
      key: "physics.parented.body",
      withComponents: [RigidBody.id, Collider.id, PhysicsVelocity.id],
    };
    const before = await waitForEntitySnapshot(port, {
      requestIdPrefix: "parented-body-before",
      label: "parented-body-before",
      query,
      total: 1,
    });
    const beforeSummary = (
      before.result as {
        readonly summaries: readonly [
          {
            readonly componentIds?: readonly string[];
            readonly localTransform?: {
              readonly translation?: readonly number[];
            };
          },
        ];
      }
    ).summaries[0];

    expect(beforeSummary).toMatchObject({
      componentIds: expect.arrayContaining([
        RigidBody.id,
        Collider.id,
        PhysicsVelocity.id,
      ]),
      localTransform: {
        translation: [1, 0, 0],
      },
    });
    expect(beforeSummary.componentIds ?? []).not.toContain(PhysicsBodyState.id);

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "parented-body-step",
        tool: "ecs_step",
        payload: { delta: 1 },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("parented-body-step"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        physics: {
          sync: {
            bodyCount: 1,
            colliderCount: 1,
            unsupportedFeatureCount: 0,
            unsupportedFeatures: [],
          },
          step: {
            bodyCount: 1,
            colliderCount: 1,
          },
          readback: {
            bodyCount: 1,
          },
          writeback: {
            bodyCount: 1,
            transformWrites: 1,
            velocityWrites: 1,
            bodyStateWrites: 1,
            missingEntities: 0,
          },
          unsupportedFeatureCount: 0,
          unsupportedFeatures: [],
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "parented-body-after",
        tool: "ecs_diff",
        payload: { label: "parented-body-after", query },
      }),
    );
    const diff = (await port.nextPostedMessage(
      devtoolsResponseWithId("parented-body-after"),
    )) as DevtoolsEntityDiffResponseMessage;

    expect(diff).toMatchObject({
      ok: true,
      result: {
        fromLabel: "parented-body-before",
        toLabel: "parented-body-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 1,
          unchanged: 0,
        },
        changed: [
          expect.objectContaining({
            fields: expect.arrayContaining([
              "componentIds",
              "localTransform",
              "physicsBodyState",
              "worldTransform",
            ]),
            after: expect.objectContaining({
              key: "physics.parented.body",
              componentIds: expect.arrayContaining([PhysicsBodyState.id]),
              localTransform: expect.objectContaining({
                translation: [2, 0, 0],
              }),
              physicsVelocity: expect.objectContaining({
                linear: [1, 0, 0],
              }),
              physicsBodyState: expect.objectContaining({
                currentTranslation: [12, 0, 0],
                previousTranslation: [12, 0, 0],
              }),
            }),
          }),
        ],
      },
    });
    const changed = (
      diff.result as {
        readonly changed: readonly [
          {
            readonly after?: {
              readonly componentIds?: readonly string[];
            };
            readonly componentIds?: readonly string[];
          },
        ];
      }
    ).changed[0];
    expect(changed.after?.componentIds ?? []).toContain(PhysicsBodyState.id);
  });

  it("diffs ECS kinematic-target writeback after a paused generated-worker fixed step", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerPhysicsProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1, maxSubsteps: 4 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "kinematic-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("kinematic-pause")),
    ).toMatchObject({
      requestId: "kinematic-pause",
      ok: true,
      result: { paused: true },
    });

    const query = {
      key: "physics.diff.kinematicTarget",
      withComponents: [RigidBody.id, Collider.id, KinematicTarget.id],
    };
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "kinematic-before",
        tool: "ecs_snapshot",
        payload: { label: "kinematic-before", query },
      }),
    );
    const before = (await port.nextPostedMessage(
      devtoolsResponseWithId("kinematic-before"),
    )) as DevtoolsEntitySnapshotResponseMessage;

    expect(before).toMatchObject({
      ok: true,
      result: {
        label: "kinematic-before",
        total: 1,
        summaries: [
          {
            key: "physics.diff.kinematicTarget",
            componentIds: expect.arrayContaining([
              RigidBody.id,
              Collider.id,
              KinematicTarget.id,
            ]),
            localTransform: {
              translation: [0, 2, 0],
            },
            physicsKinematicTarget: {
              enabled: true,
              translation: [0, 2, 0],
              rotation: [0, 0, 0, 1],
            },
          },
        ],
      },
    });

    const entity = (
      before.result as {
        readonly summaries: readonly [{ readonly entity: unknown }];
      }
    ).summaries[0].entity;

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "kinematic-set-target",
        tool: "physics_set_kinematic_target",
        payload: {
          entity,
          translation: [3, 2, 0],
        },
      }),
    );
    const mutation = (await port.nextPostedMessage(
      devtoolsResponseWithId("kinematic-set-target"),
    )) as DevtoolsEntityMutationResponseMessage;

    expect(mutation).toMatchObject({
      ok: true,
      result: {
        entity,
        command: {
          tool: "physics_set_kinematic_target",
          transform: {
            translation: [3, 2, 0],
            rotation: [0, 0, 0, 1],
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "kinematic-step",
        tool: "ecs_step",
        payload: { delta: 1 },
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("kinematic-step")),
    ).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          enabled: true,
          fixedDelta: 1,
          substeps: 1,
        },
        physics: {
          backend: {
            kind: "test",
            build: "test",
            execution: "simulation-worker",
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "kinematic-after",
        tool: "ecs_diff",
        payload: { label: "kinematic-after", query },
      }),
    );
    const diff = (await port.nextPostedMessage(
      devtoolsResponseWithId("kinematic-after"),
    )) as DevtoolsEntityDiffResponseMessage;

    expect(diff).toMatchObject({
      ok: true,
      result: {
        fromLabel: "kinematic-before",
        toLabel: "kinematic-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 1,
          unchanged: 0,
        },
        changed: [
          {
            fields: expect.arrayContaining([
              "componentIds",
              "localTransform",
              "physicsKinematicTarget",
              "physicsBodyState",
              "worldTransform",
            ]),
            before: {
              key: "physics.diff.kinematicTarget",
              localTransform: {
                translation: [0, 2, 0],
              },
              physicsKinematicTarget: {
                enabled: true,
                translation: [0, 2, 0],
                rotation: [0, 0, 0, 1],
              },
            },
            after: {
              key: "physics.diff.kinematicTarget",
              componentIds: expect.arrayContaining([PhysicsBodyState.id]),
              localTransform: {
                translation: [3, 2, 0],
              },
              physicsKinematicTarget: {
                enabled: true,
                translation: [3, 2, 0],
                rotation: [0, 0, 0, 1],
              },
              physicsBodyState: {
                sleeping: false,
                currentTranslation: [3, 2, 0],
                currentRotation: [0, 0, 0, 1],
                previousTranslation: [3, 2, 0],
                previousRotation: [0, 0, 0, 1],
                backendBodyId: expect.any(String),
              },
            },
          },
        ],
      },
    });
  });

  it("diffs ECS writeback from gameplay physics helpers in a generated-worker fixed step", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerPhysicsApiProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1, maxSubsteps: 4 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "api-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("api-pause")),
    ).toMatchObject({
      requestId: "api-pause",
      ok: true,
      result: { paused: true },
    });

    const query = {
      tags: ["physics.api"],
      withComponents: [RigidBody.id, Collider.id],
    };
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "api-before",
        tool: "ecs_snapshot",
        payload: { label: "api-before", query },
      }),
    );
    const before = (await port.nextPostedMessage(
      devtoolsResponseWithId("api-before"),
    )) as DevtoolsEntitySnapshotResponseMessage;

    expect(before).toMatchObject({
      ok: true,
      result: {
        label: "api-before",
        total: 2,
        summaries: expect.arrayContaining([
          expect.objectContaining({
            key: "physics.api.dynamic",
            localTransform: expect.objectContaining({
              translation: [0, 0, 0],
            }),
          }),
          expect.objectContaining({
            key: "physics.api.kinematic",
            localTransform: expect.objectContaining({
              translation: [0, 2, 0],
            }),
          }),
        ]),
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "api-step",
        tool: "ecs_step",
        payload: { delta: 1 },
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("api-step")),
    ).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          enabled: true,
          fixedDelta: 1,
          substeps: 1,
        },
        physics: {
          backend: {
            kind: "test",
            build: "test",
            execution: "simulation-worker",
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "api-after",
        tool: "ecs_diff",
        payload: { label: "api-after", query },
      }),
    );
    const diff = (await port.nextPostedMessage(
      devtoolsResponseWithId("api-after"),
    )) as DevtoolsEntityDiffResponseMessage;

    expect(diff).toMatchObject({
      ok: true,
      result: {
        fromLabel: "api-before",
        toLabel: "api-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 2,
          unchanged: 0,
        },
      },
    });

    const changed = (
      diff.result as {
        readonly changed: readonly {
          readonly fields: readonly string[];
          readonly after: {
            readonly key?: string;
            readonly componentIds?: readonly string[];
            readonly localTransform?: {
              readonly translation: readonly [number, number, number];
            };
            readonly physicsVelocity?: {
              readonly linear: readonly [number, number, number];
            };
            readonly physicsExternalForce?: {
              readonly force: readonly [number, number, number];
            };
            readonly physicsExternalImpulse?: {
              readonly impulse: readonly [number, number, number];
            };
            readonly physicsKinematicTarget?: {
              readonly translation: readonly [number, number, number];
            };
            readonly physicsBodyState?: {
              readonly currentTranslation: readonly [number, number, number];
            };
          };
        }[];
      }
    ).changed;
    const dynamic = changed.find(
      (entry) => entry.after.key === "physics.api.dynamic",
    );
    const kinematic = changed.find(
      (entry) => entry.after.key === "physics.api.kinematic",
    );

    expect(dynamic).toMatchObject({
      fields: expect.arrayContaining([
        "componentIds",
        "localTransform",
        "physicsVelocity",
        "physicsExternalForce",
        "physicsExternalImpulse",
        "physicsBodyState",
        "worldTransform",
      ]),
      after: {
        componentIds: expect.arrayContaining([
          PhysicsVelocity.id,
          ExternalForce.id,
          ExternalImpulse.id,
          PhysicsBodyState.id,
        ]),
        localTransform: {
          translation: [expect.closeTo(0.6, 6), 0, 0],
        },
        physicsVelocity: {
          linear: [expect.closeTo(0.6, 6), 0, 0],
        },
        physicsExternalForce: {
          force: [expect.closeTo(0.1, 6), 0, 0],
        },
        physicsExternalImpulse: {
          impulse: [0, 0, 0],
        },
        physicsBodyState: {
          currentTranslation: [expect.closeTo(0.6, 6), 0, 0],
        },
      },
    });
    expect(kinematic).toMatchObject({
      fields: expect.arrayContaining([
        "componentIds",
        "localTransform",
        "physicsKinematicTarget",
        "physicsBodyState",
        "worldTransform",
      ]),
      after: {
        componentIds: expect.arrayContaining([
          KinematicTarget.id,
          PhysicsBodyState.id,
        ]),
        localTransform: {
          translation: [2, 2, 0],
        },
        physicsKinematicTarget: {
          translation: [2, 2, 0],
        },
        physicsBodyState: {
          currentTranslation: [2, 2, 0],
        },
      },
    });
  });

  it("runs gameplay physics command tools in a paused generated worker and diffs writeback", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerPhysicsProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1, maxSubsteps: 4 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "command-tools-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("command-tools-pause"),
      ),
    ).toMatchObject({
      ok: true,
      result: { paused: true },
    });

    const query = {
      key: "physics.diff.body",
      withComponents: [
        RigidBody.id,
        Collider.id,
        PhysicsVelocity.id,
        ExternalForce.id,
        ExternalImpulse.id,
      ],
    };
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "command-tools-before",
        tool: "ecs_snapshot",
        payload: { label: "command-tools-before", query },
      }),
    );
    const before = (await port.nextPostedMessage(
      devtoolsResponseWithId("command-tools-before"),
    )) as DevtoolsEntitySnapshotResponseMessage;
    const summary = (
      before.result as {
        readonly summaries: readonly [
          {
            readonly entity: unknown;
            readonly localTransform: {
              readonly translation: readonly [number, number, number];
            };
            readonly physicsVelocity: {
              readonly linear: readonly [number, number, number];
              readonly angular: readonly [number, number, number];
            };
            readonly physicsExternalForce: {
              readonly force: readonly [number, number, number];
              readonly torque: readonly [number, number, number];
            };
            readonly physicsExternalImpulse: {
              readonly impulse: readonly [number, number, number];
              readonly angularImpulse: readonly [number, number, number];
            };
          },
        ];
      }
    ).summaries[0];
    const entity = summary.entity;

    expect(before).toMatchObject({
      ok: true,
      result: {
        total: 1,
      },
    });
    expect(summary.localTransform.translation).toEqual([0, 0, 0]);
    expect(summary.physicsVelocity.linear[0]).toBeCloseTo(0.05, 6);
    expect(summary.physicsVelocity.linear.slice(1)).toEqual([0, 0]);
    expect(summary.physicsVelocity.angular).toEqual([0, 0, 0]);
    expect(summary.physicsExternalForce.force).toEqual([0, 0, 0]);
    expect(summary.physicsExternalForce.torque).toEqual([0, 0, 0]);
    expect(summary.physicsExternalImpulse.impulse).toEqual([0, 0, 0]);
    expect(summary.physicsExternalImpulse.angularImpulse).toEqual([0, 0, 0]);

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "command-tools-set-linear",
        tool: "physics_set_linear_velocity",
        payload: { entity, velocity: [0.2, 0, 0] },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("command-tools-set-linear"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        entity,
        command: {
          tool: "physics_set_linear_velocity",
          velocity: [0.2, 0, 0],
        },
        physics: {
          backend: {
            kind: "test",
            execution: "simulation-worker",
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "command-tools-set-angular",
        tool: "physics_set_angular_velocity",
        payload: { entity, velocity: [0, 0, 0.25] },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("command-tools-set-angular"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        entity,
        command: {
          tool: "physics_set_angular_velocity",
          velocity: [0, 0, 0.25],
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "command-tools-apply-force",
        tool: "physics_apply_force",
        payload: {
          entity,
          force: [0.1, 0, 0],
          torque: [0, 0, 0.05],
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("command-tools-apply-force"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        entity,
        command: {
          tool: "physics_apply_force",
          force: [0.1, 0, 0],
          torque: [0, 0, 0.05],
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "command-tools-apply-impulse",
        tool: "physics_apply_impulse",
        payload: {
          entity,
          impulse: [0.3, 0, 0],
          angularImpulse: [0, 0, 0.15],
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("command-tools-apply-impulse"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        entity,
        command: {
          tool: "physics_apply_impulse",
          impulse: [0.3, 0, 0],
          angularImpulse: [0, 0, 0.15],
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "command-tools-invalid-force",
        tool: "physics_apply_force",
        payload: { entity, force: [0, Number.NaN, 0] },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("command-tools-invalid-force"),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "aperture.physics.applyForce.invalidPayload",
        }),
      ],
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "command-tools-step",
        tool: "ecs_step",
        payload: { delta: 1 },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("command-tools-step"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          enabled: true,
          fixedDelta: 1,
          substeps: 1,
          fixedStepStart: 0,
          fixedStepEnd: 1,
        },
        physics: {
          backend: {
            kind: "test",
            build: "test",
            execution: "simulation-worker",
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "command-tools-after",
        tool: "ecs_diff",
        payload: { label: "command-tools-after", query },
      }),
    );
    const diff = (await port.nextPostedMessage(
      devtoolsResponseWithId("command-tools-after"),
    )) as DevtoolsEntityDiffResponseMessage;

    expect(diff).toMatchObject({
      ok: true,
      result: {
        fromLabel: "command-tools-before",
        toLabel: "command-tools-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 1,
          unchanged: 0,
        },
        changed: [
          {
            fields: expect.arrayContaining([
              "componentIds",
              "localTransform",
              "physicsExternalForce",
              "physicsVelocity",
              "physicsBodyState",
              "worldTransform",
            ]),
            before: {
              key: "physics.diff.body",
              localTransform: { translation: [0, 0, 0] },
              physicsVelocity: {
                linear: [expect.closeTo(0.05, 6), 0, 0],
                angular: [0, 0, 0],
              },
            },
            after: {
              key: "physics.diff.body",
              componentIds: expect.arrayContaining([PhysicsBodyState.id]),
              localTransform: {
                translation: [expect.closeTo(0.6, 6), 0, 0],
              },
              physicsVelocity: {
                linear: [expect.closeTo(0.6, 6), 0, 0],
                angular: [0, 0, expect.closeTo(0.45, 6)],
              },
              physicsExternalForce: {
                force: [expect.closeTo(0.1, 6), 0, 0],
                torque: [0, 0, expect.closeTo(0.05, 6)],
              },
              physicsExternalImpulse: {
                impulse: [0, 0, 0],
                angularImpulse: [0, 0, 0],
              },
              physicsBodyState: {
                sleeping: false,
                currentTranslation: [expect.closeTo(0.6, 6), 0, 0],
                previousTranslation: [expect.closeTo(0.6, 6), 0, 0],
                backendBodyId: expect.any(String),
              },
            },
          },
        ],
      },
    });
  });

  it("breaks joints through devtools and diffs disabled joints in a generated-worker fixed step", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerJointBreakProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1, maxSubsteps: 4 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "joint-break-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("joint-break-pause")),
    ).toMatchObject({
      requestId: "joint-break-pause",
      ok: true,
      result: { paused: true },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "joint-break-sync",
        tool: "ecs_step",
        payload: { delta: 1 },
      }),
    );
    const syncStep = (await port.nextPostedMessage(
      devtoolsResponseWithId("joint-break-sync"),
    )) as DevtoolsStepResponseMessage;

    expect(syncStep).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          fixedDelta: 1,
          substeps: 1,
          fixedStepStart: 0,
          fixedStepEnd: 1,
        },
        physics: {
          sync: {
            jointCount: 1,
          },
        },
      },
    });

    const query = {
      key: "physics.break.joint",
      withComponents: [PhysicsJoint.id],
    };
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "joint-break-before",
        tool: "ecs_snapshot",
        payload: { label: "joint-break-before", query },
      }),
    );
    const before = (await port.nextPostedMessage(
      devtoolsResponseWithId("joint-break-before"),
    )) as DevtoolsEntitySnapshotResponseMessage;
    const jointEntity = (
      before.result as {
        readonly summaries: readonly [{ readonly entity: unknown }];
      }
    ).summaries[0].entity;

    expect(before).toMatchObject({
      ok: true,
      result: {
        total: 1,
        summaries: [
          expect.objectContaining({
            key: "physics.break.joint",
            physicsJoint: expect.objectContaining({
              enabled: true,
              kind: PhysicsJointKind.Fixed,
            }),
          }),
        ],
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "joint-break-tool",
        tool: "physics_break_joint",
        payload: { entity: jointEntity, fixedStep: 1 },
      }),
    );
    const breakResult = await port.nextPostedMessage(
      devtoolsResponseWithId("joint-break-tool"),
    );

    expect(breakResult).toMatchObject({
      requestId: "joint-break-tool",
      ok: true,
      result: {
        entity: jointEntity,
        broke: true,
        physics: {
          sync: {
            jointCount: 1,
          },
          eventKinds: {
            jointBreak: 1,
          },
          eventFamilies: {
            jointBreaks: 1,
          },
          events: [
            expect.objectContaining({
              kind: "jointBreak",
              fixedStep: 1,
              joint: expect.any(String),
              entityA: expect.any(String),
              entityB: expect.any(String),
            }),
          ],
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "joint-break-events",
        tool: "physics_events",
        payload: { family: "jointBreaks", joint: jointEntity },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("joint-break-events"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        filters: {
          family: "jointBreaks",
          joint: expect.any(String),
        },
        returnedCount: 1,
        matchedCount: 1,
        totalCount: 1,
        events: [
          expect.objectContaining({
            kind: "jointBreak",
            fixedStep: 1,
            joint: expect.any(String),
            entityA: expect.any(String),
            entityB: expect.any(String),
          }),
        ],
        physics: {
          eventKinds: {
            jointBreak: 1,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "joint-break-step",
        tool: "ecs_step",
        payload: { delta: 1 },
      }),
    );
    const step = (await port.nextPostedMessage(
      devtoolsResponseWithId("joint-break-step"),
    )) as DevtoolsStepResponseMessage;

    expect(step).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          fixedDelta: 1,
          substeps: 1,
          fixedStepStart: 1,
          fixedStepEnd: 2,
        },
        physics: {
          backend: {
            kind: "test",
            build: "test",
            execution: "simulation-worker",
          },
          sync: {
            jointCount: 0,
          },
          eventKinds: {
            jointBreak: 1,
          },
          eventFamilies: {
            jointBreaks: 1,
          },
          events: [
            expect.objectContaining({
              kind: "jointBreak",
              fixedStep: 1,
              joint: expect.any(String),
              entityA: expect.any(String),
              entityB: expect.any(String),
            }),
          ],
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "joint-break-after",
        tool: "ecs_diff",
        payload: { label: "joint-break-after", query },
      }),
    );
    const diff = (await port.nextPostedMessage(
      devtoolsResponseWithId("joint-break-after"),
    )) as DevtoolsEntityDiffResponseMessage;

    expect(diff).toMatchObject({
      ok: true,
      result: {
        counts: {
          added: 0,
          removed: 0,
          changed: 1,
          unchanged: 0,
        },
        changed: [
          expect.objectContaining({
            fields: expect.arrayContaining(["physicsJoint"]),
            after: expect.objectContaining({
              key: "physics.break.joint",
              physicsJoint: expect.objectContaining({
                enabled: false,
                kind: PhysicsJointKind.Fixed,
              }),
            }),
          }),
        ],
      },
    });
  });

  it("interpolates physics render snapshots without mutating fixed ECS state", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerPhysicsInterpolationProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1, maxSubsteps: 4 },
        physicsInterpolation: { enabled: true },
        stop: true,
      },
    });

    await port.nextPostedMessage(simulationSnapshotWithFrame(0));
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "interpolation-step-1",
        tool: "ecs_step",
        payload: { delta: 1 },
      }),
    );
    await port.nextPostedMessage(simulationSnapshotWithFrame(1));
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("interpolation-step-1"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          substeps: 1,
          overstepAlpha: expect.closeTo(0, 4),
        },
      },
    });

    const query = {
      key: "physics.interpolate.body",
      withComponents: [
        RigidBody.id,
        Collider.id,
        PhysicsVelocity.id,
        PhysicsBodyState.id,
      ],
    };
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "interpolation-before",
        tool: "ecs_snapshot",
        payload: { label: "interpolation-before", query },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("interpolation-before"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        summaries: [
          {
            key: "physics.interpolate.body",
            localTransform: {
              translation: [1, 0, -5],
            },
            physicsBodyState: {
              currentTranslation: [1, 0, -5],
              previousTranslation: [1, 0, -5],
            },
          },
        ],
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "interpolation-step-2",
        tool: "ecs_step",
        payload: { delta: 1.5 },
      }),
    );
    const rendered = (await port.nextPostedMessage(
      simulationSnapshotWithFrame(2),
    )) as SimulationWorkerSnapshotMessage;
    const step = (await port.nextPostedMessage(
      devtoolsResponseWithId("interpolation-step-2"),
    )) as DevtoolsStepResponseMessage;

    expect(step).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          substeps: 1,
          overstepAlpha: expect.closeTo(0.5, 4),
        },
      },
    });

    const draw = rendered.snapshot.meshDraws.find(
      (packet) => packet.entity.index >= 0,
    );

    expect(draw).toBeDefined();
    if (draw === undefined) {
      throw new Error("Expected interpolated physics proof to render a mesh.");
    }
    const renderMatrix = Array.from(
      rendered.snapshot.transforms.slice(
        draw.worldTransformOffset,
        draw.worldTransformOffset + 16,
      ),
    );

    expect(renderMatrix[12]).toBeCloseTo(1.5, 4);
    expect(renderMatrix[13]).toBeCloseTo(0, 6);
    expect(renderMatrix[14]).toBeCloseTo(-5, 6);

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "interpolation-after",
        tool: "ecs_diff",
        payload: { label: "interpolation-after", query },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("interpolation-after"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        counts: {
          changed: 1,
        },
        changed: [
          {
            fields: expect.arrayContaining([
              "localTransform",
              "physicsBodyState",
              "worldTransform",
            ]),
            after: {
              key: "physics.interpolate.body",
              localTransform: {
                translation: [2, 0, -5],
              },
              physicsBodyState: {
                currentTranslation: [2, 0, -5],
                previousTranslation: [1, 0, -5],
              },
            },
          },
        ],
      },
    });
  });

  it("diffs ECS physics writeback after an async Rapier generated-worker fixed step", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerRapierPhysicsProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 8 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    const query = {
      key: "physics.rapier.body",
      withComponents: [RigidBody.id, Collider.id, PhysicsVelocity.id],
    };
    const before = await waitForEntitySnapshot(port, {
      requestIdPrefix: "rapier-before",
      label: "rapier-before",
      query,
      total: 1,
    });

    expect(before).toMatchObject({
      ok: true,
      result: {
        label: "rapier-before",
        total: 1,
        summaries: [
          {
            key: "physics.rapier.body",
            localTransform: {
              translation: [0, 2, 0],
            },
            physicsVelocity: {
              linear: [0, -1, 0],
              angular: [0, 0, 0],
            },
          },
        ],
      },
    });
    const axisQuery = {
      key: "physics.rapier.axisCylinder",
      withComponents: [RigidBody.id, Collider.id],
    };
    const axisBefore = await waitForEntitySnapshot(port, {
      requestIdPrefix: "rapier-axis-before",
      label: "rapier-axis-before",
      query: axisQuery,
      total: 1,
    });
    const axisSummary = (
      axisBefore.result as {
        readonly summaries: readonly [
          {
            readonly entity: {
              readonly index: number;
              readonly generation: number;
            };
          },
        ];
      }
    ).summaries[0];
    const axisEntityRef = `${axisSummary.entity.index}:${axisSummary.entity.generation}`;

    expect(axisBefore).toMatchObject({
      ok: true,
      result: {
        label: "rapier-axis-before",
        total: 1,
        summaries: [
          {
            key: "physics.rapier.axisCylinder",
            physicsCollider: {
              shapeKind: PhysicsColliderShapeKind.Cylinder,
              radius: 0.25,
              halfHeight: 2,
              axis: PhysicsColliderAxis.X,
            },
          },
        ],
      },
    });
    const targetQuery = {
      key: "physics.rapier.axisTarget",
      withComponents: [RigidBody.id, Collider.id],
    };
    const targetBefore = await waitForEntitySnapshot(port, {
      requestIdPrefix: "rapier-axis-target-before",
      label: "rapier-axis-target-before",
      query: targetQuery,
      total: 1,
    });
    const targetSummary = (
      targetBefore.result as {
        readonly summaries: readonly [
          {
            readonly entity: {
              readonly index: number;
              readonly generation: number;
            };
          },
        ];
      }
    ).summaries[0];
    const targetEntityRef = `${targetSummary.entity.index}:${targetSummary.entity.generation}`;

    expect(targetBefore).toMatchObject({
      ok: true,
      result: {
        label: "rapier-axis-target-before",
        total: 1,
        summaries: [
          {
            key: "physics.rapier.axisTarget",
            physicsCollider: {
              shapeKind: PhysicsColliderShapeKind.Box,
            },
          },
        ],
      },
    });
    await waitForEntitySnapshot(port, {
      requestIdPrefix: "rapier-before-baseline",
      label: "rapier-before",
      query,
      total: 1,
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("rapier-pause")),
    ).toMatchObject({
      ok: true,
      result: { paused: true },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-step",
        tool: "ecs_step",
        payload: { delta: 0.1 },
      }),
    );
    const step = (await port.nextPostedMessage(
      devtoolsResponseWithId("rapier-step"),
    )) as DevtoolsStepResponseMessage;

    expect(step).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          enabled: true,
          fixedDelta: 1 / 60,
          substeps: 6,
        },
        physics: {
          backend: {
            kind: "rapier",
            build: "performance",
            execution: "simulation-worker",
            capabilities: {
              compoundColliders: true,
              continuousCollisionDetection: true,
              characterController: true,
              linkedBodyContacts: true,
              combinedPositionVelocityMotors: true,
              motorForceLimits: false,
              automaticBreakForce: false,
              jointImpulseReadback: false,
              pairedNonFixedFrameB: false,
            },
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-axis-raycast",
        tool: "physics_raycast_first",
        payload: {
          origin: [4, 3, 0],
          direction: [1, 0, 0],
          maxDistance: 10,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-axis-raycast"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        hit: {
          entity: axisEntityRef,
          distance: expect.closeTo(2, 5),
        },
        physics: {
          backend: {
            kind: "rapier",
            execution: "simulation-worker",
          },
          writeback: {
            missingEntities: 0,
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-axis-shape-cast",
        tool: "physics_cast_shape_first",
        payload: {
          shape: {
            kind: "cylinder",
            radius: 0.25,
            halfHeight: 2,
            axis: PhysicsColliderAxis.X,
          },
          from: { translation: [4, 3, 0] },
          to: { translation: [8, 3, 0] },
          options: { excludeEntity: axisEntityRef },
        },
      }),
    );
    const shapeCast = await port.nextPostedMessage(
      devtoolsResponseWithId("rapier-axis-shape-cast"),
    );

    expect(shapeCast).toMatchObject({
      ok: true,
      result: {
        hit: {
          entity: targetEntityRef,
          timeOfImpact: expect.any(Number),
        },
        physics: {
          backend: {
            kind: "rapier",
            execution: "simulation-worker",
          },
        },
        options: { excludeEntity: axisEntityRef },
      },
    });
    const shapeCastHit = (
      shapeCast as {
        readonly result: {
          readonly hit: {
            readonly timeOfImpact: number;
          } | null;
        };
      }
    ).result.hit;

    expect(shapeCastHit?.timeOfImpact).toBeGreaterThan(0);
    expect(shapeCastHit?.timeOfImpact).toBeLessThan(1);

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-after",
        tool: "ecs_diff",
        payload: { label: "rapier-after", query },
      }),
    );
    const diff = (await port.nextPostedMessage(
      devtoolsResponseWithId("rapier-after"),
    )) as DevtoolsEntityDiffResponseMessage;
    expect(diff).toMatchObject({
      ok: true,
      result: {
        fromLabel: "rapier-before",
        toLabel: "rapier-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 1,
          unchanged: 0,
        },
        changed: [
          {
            fields: expect.arrayContaining([
              "componentIds",
              "localTransform",
              "physicsVelocity",
              "physicsBodyState",
              "worldTransform",
            ]),
            after: {
              key: "physics.rapier.body",
              componentIds: expect.arrayContaining([PhysicsBodyState.id]),
              physicsBodyState: {
                sleeping: false,
                backendBodyId: expect.any(String),
              },
            },
          },
        ],
      },
    });

    const changed = (
      diff.result as {
        readonly changed: readonly [
          {
            readonly after: {
              readonly localTransform: {
                readonly translation: readonly [number, number, number];
              };
              readonly physicsVelocity: {
                readonly linear: readonly [number, number, number];
              };
              readonly physicsBodyState: {
                readonly currentTranslation: readonly [number, number, number];
                readonly previousTranslation: readonly [number, number, number];
              };
            };
          },
        ];
      }
    ).changed[0];

    expect(changed.after.localTransform.translation[1]).toBeLessThan(2);
    expect(changed.after.localTransform.translation[1]).toBeGreaterThan(1.75);
    expect(changed.after.physicsVelocity.linear[1]).toBeLessThan(0);
    expect(changed.after.physicsBodyState.currentTranslation[1]).toBeCloseTo(
      changed.after.localTransform.translation[1],
      6,
    );
    expect(
      changed.after.physicsBodyState.previousTranslation[1],
    ).toBeGreaterThan(changed.after.physicsBodyState.currentTranslation[1]);
  });

  it("diffs kinematic-velocity body motion in async Rapier generated workers", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerRapierPhysicsProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 30 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    const query = {
      key: "physics.rapier.body",
      withComponents: [RigidBody.id, Collider.id, PhysicsVelocity.id],
    };
    const before = await waitForEntitySnapshot(port, {
      requestIdPrefix: "rapier-kinematic-velocity-before",
      label: "rapier-kinematic-velocity-before",
      query,
      total: 1,
    });
    const summary = (
      before.result as {
        readonly summaries: readonly [
          {
            readonly entity: unknown;
          },
        ];
      }
    ).summaries[0];

    expect(before).toMatchObject({
      ok: true,
      result: {
        label: "rapier-kinematic-velocity-before",
        total: 1,
        summaries: [
          {
            key: "physics.rapier.body",
            physicsRigidBody: {
              type: PhysicsRigidBodyType.Dynamic,
            },
            localTransform: {
              translation: [0, 2, 0],
            },
          },
        ],
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-kinematic-velocity-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-kinematic-velocity-pause"),
      ),
    ).toMatchObject({
      ok: true,
      result: { paused: true },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-kinematic-velocity-type",
        tool: "ecs_set_component_field",
        payload: {
          entity: summary.entity,
          component: RigidBody.id,
          field: "type",
          value: PhysicsRigidBodyType.KinematicVelocity,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-kinematic-velocity-type"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: RigidBody.id,
        field: "type",
        value: PhysicsRigidBodyType.KinematicVelocity,
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-kinematic-velocity-linear",
        tool: "ecs_set_component_field",
        payload: {
          entity: summary.entity,
          component: PhysicsVelocity.id,
          field: "linear",
          value: [1, 0, 0],
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-kinematic-velocity-linear"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: PhysicsVelocity.id,
        field: "linear",
        value: [1, 0, 0],
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-kinematic-velocity-step",
        tool: "ecs_step",
        payload: { delta: 0.5 },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-kinematic-velocity-step"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          substeps: 30,
          fixedDelta: 1 / 60,
        },
        physics: {
          backend: {
            kind: "rapier",
            execution: "simulation-worker",
          },
          writeback: {
            missingEntities: 0,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-kinematic-velocity-after",
        tool: "ecs_diff",
        payload: { label: "rapier-kinematic-velocity-after", query },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-kinematic-velocity-after"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        fromLabel: "rapier-kinematic-velocity-before",
        toLabel: "rapier-kinematic-velocity-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 1,
          unchanged: 0,
        },
        changed: [
          {
            fields: expect.arrayContaining([
              "componentIds",
              "localTransform",
              "physicsRigidBody",
              "physicsVelocity",
              "physicsBodyState",
              "worldTransform",
            ]),
            after: {
              key: "physics.rapier.body",
              componentIds: expect.arrayContaining([PhysicsBodyState.id]),
              physicsRigidBody: {
                type: PhysicsRigidBodyType.KinematicVelocity,
              },
              localTransform: {
                translation: [expect.closeTo(0.5, 5), 2, 0],
              },
              physicsVelocity: {
                linear: [1, 0, 0],
              },
              physicsBodyState: {
                currentTranslation: [expect.closeTo(0.5, 5), 2, 0],
                previousTranslation: [expect.closeTo(0.4833333333, 5), 2, 0],
              },
            },
          },
        ],
      },
    });
  });

  it("honors paused RigidBody axis-lock edits in async Rapier generated workers", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerRapierPhysicsProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 8 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    const query = {
      key: "physics.rapier.body",
      withComponents: [RigidBody.id, Collider.id, PhysicsVelocity.id],
    };
    const before = await waitForEntitySnapshot(port, {
      requestIdPrefix: "rapier-lock-before",
      label: "rapier-lock-before",
      query,
      total: 1,
    });
    const summary = (
      before.result as {
        readonly summaries: readonly [
          {
            readonly entity: unknown;
          },
        ];
      }
    ).summaries[0];
    const entity = summary.entity;

    expect(before).toMatchObject({
      ok: true,
      result: {
        label: "rapier-lock-before",
        total: 1,
        summaries: [
          {
            key: "physics.rapier.body",
            physicsRigidBody: {
              lockTranslationY: false,
            },
            localTransform: {
              translation: [0, 2, 0],
            },
            physicsVelocity: {
              linear: [0, -1, 0],
            },
          },
        ],
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-lock-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("rapier-lock-pause")),
    ).toMatchObject({
      ok: true,
      result: { paused: true },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-lock-mutate-y",
        tool: "ecs_set_component_field",
        payload: {
          entity,
          component: RigidBody.id,
          field: "lockTranslationY",
          value: true,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-lock-mutate-y"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: RigidBody.id,
        field: "lockTranslationY",
        value: true,
        summary: {
          key: "physics.rapier.body",
          physicsRigidBody: {
            lockTranslationY: true,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-lock-step",
        tool: "ecs_step",
        payload: { delta: 0.1 },
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("rapier-lock-step")),
    ).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          substeps: 6,
          fixedDelta: 1 / 60,
        },
        physics: {
          backend: {
            kind: "rapier",
            execution: "simulation-worker",
          },
          writeback: {
            missingEntities: 0,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-lock-after",
        tool: "ecs_diff",
        payload: { label: "rapier-lock-after", query },
      }),
    );
    const diff = (await port.nextPostedMessage(
      devtoolsResponseWithId("rapier-lock-after"),
    )) as DevtoolsEntityDiffResponseMessage;

    expect(diff).toMatchObject({
      ok: true,
      result: {
        fromLabel: "rapier-lock-before",
        toLabel: "rapier-lock-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 1,
          unchanged: 0,
        },
        changed: [
          {
            fields: expect.arrayContaining([
              "componentIds",
              "physicsRigidBody",
              "physicsVelocity",
              "physicsBodyState",
            ]),
            after: {
              key: "physics.rapier.body",
              componentIds: expect.arrayContaining([PhysicsBodyState.id]),
              physicsRigidBody: {
                lockTranslationY: true,
              },
              localTransform: {
                translation: [0, expect.closeTo(2, 6), 0],
              },
              physicsVelocity: {
                linear: [0, expect.closeTo(0, 6), 0],
              },
              physicsBodyState: {
                currentTranslation: [0, expect.closeTo(2, 6), 0],
                previousTranslation: [0, expect.closeTo(2, 6), 0],
              },
            },
          },
        ],
      },
    });
  });

  it("honors paused RigidBody damping edits in async Rapier generated workers", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerRapierPhysicsProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 8 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    const query = {
      key: "physics.rapier.body",
      withComponents: [RigidBody.id, Collider.id, PhysicsVelocity.id],
    };
    const before = await waitForEntitySnapshot(port, {
      requestIdPrefix: "rapier-damping-before",
      label: "rapier-damping-before",
      query,
      total: 1,
    });
    const summary = (
      before.result as {
        readonly summaries: readonly [
          {
            readonly entity: unknown;
          },
        ];
      }
    ).summaries[0];
    const entity = summary.entity;

    expect(before).toMatchObject({
      ok: true,
      result: {
        label: "rapier-damping-before",
        total: 1,
        summaries: [
          {
            key: "physics.rapier.body",
            physicsRigidBody: {
              gravityScale: 1,
              linearDamping: 0,
            },
            localTransform: {
              translation: [0, 2, 0],
            },
            physicsVelocity: {
              linear: [0, -1, 0],
            },
          },
        ],
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-damping-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-damping-pause"),
      ),
    ).toMatchObject({
      ok: true,
      result: { paused: true },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-damping-gravity-scale",
        tool: "ecs_set_component_field",
        payload: {
          entity,
          component: RigidBody.id,
          field: "gravityScale",
          value: 0,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-damping-gravity-scale"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: RigidBody.id,
        field: "gravityScale",
        value: 0,
        summary: {
          key: "physics.rapier.body",
          physicsRigidBody: {
            gravityScale: 0,
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-damping-linear",
        tool: "ecs_set_component_field",
        payload: {
          entity,
          component: RigidBody.id,
          field: "linearDamping",
          value: 1,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-damping-linear"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: RigidBody.id,
        field: "linearDamping",
        value: 1,
        summary: {
          key: "physics.rapier.body",
          physicsRigidBody: {
            linearDamping: 1,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-damping-step",
        tool: "ecs_step",
        payload: { delta: 0.1 },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-damping-step"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          substeps: 6,
          fixedDelta: 1 / 60,
        },
        physics: {
          backend: {
            kind: "rapier",
            execution: "simulation-worker",
          },
          writeback: {
            missingEntities: 0,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-damping-after",
        tool: "ecs_diff",
        payload: { label: "rapier-damping-after", query },
      }),
    );
    const diff = (await port.nextPostedMessage(
      devtoolsResponseWithId("rapier-damping-after"),
    )) as DevtoolsEntityDiffResponseMessage;

    expect(diff).toMatchObject({
      ok: true,
      result: {
        fromLabel: "rapier-damping-before",
        toLabel: "rapier-damping-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 1,
          unchanged: 0,
        },
      },
    });
    const changed = (
      diff.result as {
        readonly changed: readonly [
          {
            readonly after: {
              readonly key?: string;
              readonly componentIds?: readonly string[];
              readonly physicsRigidBody?: {
                readonly gravityScale?: number;
                readonly linearDamping?: number;
              };
              readonly physicsVelocity?: {
                readonly linear: readonly number[];
              };
              readonly localTransform?: {
                readonly translation: readonly number[];
              };
              readonly physicsBodyState?: {
                readonly currentTranslation: readonly number[];
              };
            };
          },
        ];
      }
    ).changed[0]?.after;

    expect(changed).toMatchObject({
      key: "physics.rapier.body",
      physicsRigidBody: {
        gravityScale: 0,
        linearDamping: 1,
      },
      componentIds: expect.arrayContaining([PhysicsBodyState.id]),
    });
    expect(changed?.physicsVelocity?.linear[1]).toBeGreaterThan(-1);
    expect(changed?.physicsVelocity?.linear[1]).toBeLessThan(-0.85);
    expect(changed?.localTransform?.translation[1]).toBeLessThan(2);
    expect(changed?.localTransform?.translation[1]).toBeGreaterThan(1.89);
    expect(changed?.physicsBodyState?.currentTranslation[1]).toBeCloseTo(
      changed?.localTransform?.translation[1] ?? Number.NaN,
      6,
    );
  });

  it("honors paused RigidBody canSleep edits in async Rapier generated workers", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerRapierSleepProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 180 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    const query = {
      key: "physics.rapier.awake",
      withComponents: [RigidBody.id, Collider.id, PhysicsVelocity.id],
    };
    const before = await waitForEntitySnapshot(port, {
      requestIdPrefix: "rapier-awake-before",
      label: "rapier-awake-before",
      query,
      total: 1,
    });
    const summary = (
      before.result as {
        readonly summaries: readonly [
          {
            readonly entity: unknown;
          },
        ];
      }
    ).summaries[0];

    expect(before).toMatchObject({
      ok: true,
      result: {
        label: "rapier-awake-before",
        total: 1,
        summaries: [
          {
            key: "physics.rapier.awake",
            physicsRigidBody: {
              canSleep: true,
            },
            physicsVelocity: {
              linear: [0, 0, 0],
            },
          },
        ],
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-awake-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-awake-pause"),
      ),
    ).toMatchObject({
      ok: true,
      result: { paused: true },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-awake-mutate",
        tool: "ecs_set_component_field",
        payload: {
          entity: summary.entity,
          component: RigidBody.id,
          field: "canSleep",
          value: false,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-awake-mutate"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: RigidBody.id,
        field: "canSleep",
        value: false,
        summary: {
          key: "physics.rapier.awake",
          physicsRigidBody: {
            canSleep: false,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-awake-step",
        tool: "ecs_step",
        payload: { delta: 3 },
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("rapier-awake-step")),
    ).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          substeps: 180,
          fixedDelta: 1 / 60,
        },
        physics: {
          backend: {
            kind: "rapier",
            execution: "simulation-worker",
          },
          writeback: {
            missingEntities: 0,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-awake-after",
        tool: "ecs_diff",
        payload: { label: "rapier-awake-after", query },
      }),
    );
    const diff = (await port.nextPostedMessage(
      devtoolsResponseWithId("rapier-awake-after"),
    )) as DevtoolsEntityDiffResponseMessage;

    expect(diff).toMatchObject({
      ok: true,
      result: {
        fromLabel: "rapier-awake-before",
        toLabel: "rapier-awake-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 1,
          unchanged: 0,
        },
        changed: [
          {
            fields: expect.arrayContaining([
              "componentIds",
              "physicsRigidBody",
              "physicsBodyState",
            ]),
            after: {
              key: "physics.rapier.awake",
              componentIds: expect.arrayContaining([PhysicsBodyState.id]),
              physicsRigidBody: {
                canSleep: false,
              },
              physicsBodyState: {
                sleeping: false,
              },
            },
          },
        ],
      },
    });
  });

  it("exposes explicit body sleep and wake controls in async Rapier generated workers", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerRapierSleepProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 1 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    const query = {
      key: "physics.rapier.sleepControl",
      withComponents: [RigidBody.id, Collider.id],
    };
    const initial = await waitForEntitySnapshot(port, {
      requestIdPrefix: "rapier-sleep-control-initial",
      label: "rapier-sleep-control-initial",
      query,
      total: 1,
    });
    const summary = (
      initial.result as {
        readonly summaries: readonly [
          {
            readonly entity: unknown;
          },
        ];
      }
    ).summaries[0];

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-sleep-control-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-sleep-control-pause"),
      ),
    ).toMatchObject({
      ok: true,
      result: { paused: true },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-sleep-control-sync",
        tool: "ecs_step",
        payload: { delta: 1 / 60 },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-sleep-control-sync"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        physics: {
          backend: {
            kind: "rapier",
            execution: "simulation-worker",
          },
          writeback: {
            missingEntities: 0,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-sleep-control-before",
        tool: "ecs_snapshot",
        payload: {
          label: "rapier-sleep-control-before",
          query,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-sleep-control-before"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        summaries: [
          {
            key: "physics.rapier.sleepControl",
            physicsBodyState: {
              sleeping: false,
            },
          },
        ],
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-sleep-control-sleep",
        tool: "physics_sleep_body",
        payload: { entity: summary.entity },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-sleep-control-sleep"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        command: {
          tool: "physics_sleep_body",
          slept: true,
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-sleep-control-sleep-step",
        tool: "ecs_step",
        payload: { delta: 1 / 60 },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-sleep-control-sleep-step"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        physics: {
          eventKinds: {
            sleep: 1,
          },
          eventFamilies: {
            sleepWake: 1,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-sleep-control-after-sleep",
        tool: "ecs_diff",
        payload: {
          label: "rapier-sleep-control-after-sleep",
          query,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-sleep-control-after-sleep"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        fromLabel: "rapier-sleep-control-before",
        toLabel: "rapier-sleep-control-after-sleep",
        changed: [
          {
            fields: expect.arrayContaining(["physicsBodyState"]),
            after: {
              key: "physics.rapier.sleepControl",
              physicsBodyState: {
                sleeping: true,
              },
            },
          },
        ],
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-sleep-control-wake",
        tool: "physics_wake_body",
        payload: { entity: summary.entity },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-sleep-control-wake"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        command: {
          tool: "physics_wake_body",
          woke: true,
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-sleep-control-wake-step",
        tool: "ecs_step",
        payload: { delta: 1 / 60 },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-sleep-control-wake-step"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        physics: {
          eventKinds: {
            wake: 1,
          },
          eventFamilies: {
            sleepWake: 1,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-sleep-control-after-wake",
        tool: "ecs_diff",
        payload: {
          label: "rapier-sleep-control-after-wake",
          query,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-sleep-control-after-wake"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        fromLabel: "rapier-sleep-control-after-sleep",
        toLabel: "rapier-sleep-control-after-wake",
        changed: [
          {
            fields: expect.arrayContaining(["physicsBodyState"]),
            after: {
              key: "physics.rapier.sleepControl",
              physicsBodyState: {
                sleeping: false,
              },
            },
          },
        ],
      },
    });
  });

  it("clears stale PhysicsBodyState when a paused Rapier body is disabled", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerRapierPhysicsProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 1 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    const query = {
      key: "physics.rapier.body",
      withComponents: [RigidBody.id, Collider.id, PhysicsVelocity.id],
    };
    const initial = await waitForEntitySnapshot(port, {
      requestIdPrefix: "rapier-disable-body-initial",
      label: "rapier-disable-body-initial",
      query,
      total: 1,
    });
    const summary = (
      initial.result as {
        readonly summaries: readonly [
          {
            readonly entity: unknown;
          },
        ];
      }
    ).summaries[0];

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-disable-body-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-disable-body-pause"),
      ),
    ).toMatchObject({
      ok: true,
      result: { paused: true },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-disable-body-sync",
        tool: "ecs_step",
        payload: { delta: 1 / 60 },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-disable-body-sync"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        physics: {
          sync: {
            bodyCount: 4,
          },
          readback: {
            bodyCount: 4,
          },
          writeback: {
            missingEntities: 0,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-disable-body-before",
        tool: "ecs_snapshot",
        payload: {
          label: "rapier-disable-body-before",
          query,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-disable-body-before"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        summaries: [
          {
            key: "physics.rapier.body",
            componentIds: expect.arrayContaining([PhysicsBodyState.id]),
            physicsRigidBody: {
              enabled: true,
            },
            physicsBodyState: {
              sleeping: false,
            },
          },
        ],
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-disable-body-mutate",
        tool: "ecs_set_component_field",
        payload: {
          entity: summary.entity,
          component: RigidBody.id,
          field: "enabled",
          value: false,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-disable-body-mutate"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: RigidBody.id,
        field: "enabled",
        value: false,
        summary: {
          key: "physics.rapier.body",
          physicsRigidBody: {
            enabled: false,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-disable-body-step",
        tool: "ecs_step",
        payload: { delta: 1 / 60 },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-disable-body-step"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        physics: {
          sync: {
            bodyCount: 3,
          },
          readback: {
            bodyCount: 3,
          },
          writeback: {
            missingEntities: 0,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-disable-body-after",
        tool: "ecs_diff",
        payload: {
          label: "rapier-disable-body-after",
          query,
        },
      }),
    );
    const diff = (await port.nextPostedMessage(
      devtoolsResponseWithId("rapier-disable-body-after"),
    )) as DevtoolsEntityDiffResponseMessage;

    expect(diff).toMatchObject({
      ok: true,
      result: {
        fromLabel: "rapier-disable-body-before",
        toLabel: "rapier-disable-body-after",
        changed: [
          {
            fields: expect.arrayContaining([
              "componentIds",
              "physicsRigidBody",
              "physicsBodyState",
            ]),
            after: {
              key: "physics.rapier.body",
              physicsRigidBody: {
                enabled: false,
              },
            },
          },
        ],
      },
    });
    const changed = (
      diff.result as {
        readonly changed: readonly [
          {
            readonly after: {
              readonly componentIds?: readonly string[];
              readonly physicsBodyState?: unknown;
            };
          },
        ];
      }
    ).changed[0]?.after;

    expect(changed?.componentIds).not.toContain(PhysicsBodyState.id);
    expect(changed?.physicsBodyState).toBeUndefined();
  });

  it("surfaces paused RigidBody CCD edits in async Rapier generated workers", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerRapierPhysicsProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 8 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    const query = {
      key: "physics.rapier.body",
      withComponents: [RigidBody.id, Collider.id, PhysicsVelocity.id],
    };
    const before = await waitForEntitySnapshot(port, {
      requestIdPrefix: "rapier-ccd-before",
      label: "rapier-ccd-before",
      query,
      total: 1,
    });
    const summary = (
      before.result as {
        readonly summaries: readonly [
          {
            readonly entity: unknown;
          },
        ];
      }
    ).summaries[0];

    expect(before).toMatchObject({
      ok: true,
      result: {
        label: "rapier-ccd-before",
        total: 1,
        summaries: [
          {
            key: "physics.rapier.body",
            physicsRigidBody: {
              ccdEnabled: false,
            },
          },
        ],
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-ccd-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("rapier-ccd-pause")),
    ).toMatchObject({
      ok: true,
      result: { paused: true },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-ccd-mutate",
        tool: "ecs_set_component_field",
        payload: {
          entity: summary.entity,
          component: RigidBody.id,
          field: "ccdEnabled",
          value: true,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("rapier-ccd-mutate")),
    ).toMatchObject({
      ok: true,
      result: {
        component: RigidBody.id,
        field: "ccdEnabled",
        value: true,
        summary: {
          key: "physics.rapier.body",
          physicsRigidBody: {
            ccdEnabled: true,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-ccd-step",
        tool: "ecs_step",
        payload: { delta: 0.1 },
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("rapier-ccd-step")),
    ).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          substeps: 6,
          fixedDelta: 1 / 60,
        },
        physics: {
          backend: {
            kind: "rapier",
            execution: "simulation-worker",
            capabilities: {
              continuousCollisionDetection: true,
            },
          },
          sync: {
            unsupportedFeatureCount: 0,
          },
          unsupportedFeatureCount: 0,
          writeback: {
            missingEntities: 0,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-ccd-after",
        tool: "ecs_diff",
        payload: { label: "rapier-ccd-after", query },
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("rapier-ccd-after")),
    ).toMatchObject({
      ok: true,
      result: {
        fromLabel: "rapier-ccd-before",
        toLabel: "rapier-ccd-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 1,
          unchanged: 0,
        },
        changed: [
          {
            fields: expect.arrayContaining([
              "componentIds",
              "physicsRigidBody",
              "physicsBodyState",
            ]),
            after: {
              key: "physics.rapier.body",
              componentIds: expect.arrayContaining([PhysicsBodyState.id]),
              physicsRigidBody: {
                ccdEnabled: true,
              },
              physicsBodyState: {
                backendBodyId: expect.any(String),
              },
            },
          },
        ],
      },
    });
  });

  it("steps, queries, and diffs paused asset-backed collider edits in async Rapier generated workers", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerRapierAssetColliderProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 8 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    const query = {
      key: "physics.rapier.body",
      withComponents: [RigidBody.id, Collider.id],
    };
    const before = await waitForEntitySnapshot(port, {
      requestIdPrefix: "rapier-asset-collider-before",
      label: "rapier-asset-collider-before",
      query,
      total: 1,
    });
    const summary = (
      before.result as {
        readonly summaries: readonly [
          {
            readonly entity: {
              readonly index: number;
              readonly generation: number;
            };
          },
        ];
      }
    ).summaries[0];
    const bodyEntityRef = `${summary.entity.index}:${summary.entity.generation}`;

    expect(before).toMatchObject({
      ok: true,
      result: {
        label: "rapier-asset-collider-before",
        total: 1,
        summaries: [
          {
            key: "physics.rapier.body",
            physicsRigidBody: {
              type: PhysicsRigidBodyType.Dynamic,
            },
            physicsCollider: {
              shapeKind: PhysicsColliderShapeKind.Sphere,
              meshId: "",
            },
          },
        ],
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-asset-collider-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-asset-collider-pause"),
      ),
    ).toMatchObject({
      ok: true,
      result: { paused: true },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-asset-collider-static",
        tool: "ecs_set_component_field",
        payload: {
          entity: summary.entity,
          component: RigidBody.id,
          field: "type",
          value: PhysicsRigidBodyType.Static,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-asset-collider-static"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: RigidBody.id,
        field: "type",
        value: PhysicsRigidBodyType.Static,
        summary: {
          key: "physics.rapier.body",
          physicsRigidBody: {
            type: PhysicsRigidBodyType.Static,
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-asset-collider-kind",
        tool: "ecs_set_component_field",
        payload: {
          entity: summary.entity,
          component: Collider.id,
          field: "shapeKind",
          value: PhysicsColliderShapeKind.Trimesh,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-asset-collider-kind"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: Collider.id,
        field: "shapeKind",
        value: PhysicsColliderShapeKind.Trimesh,
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-asset-collider-mesh",
        tool: "ecs_set_component_field",
        payload: {
          entity: summary.entity,
          component: Collider.id,
          field: "meshId",
          value: "mesh:level",
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-asset-collider-mesh"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: Collider.id,
        field: "meshId",
        value: "mesh:level",
        summary: {
          key: "physics.rapier.body",
          physicsCollider: {
            shapeKind: PhysicsColliderShapeKind.Trimesh,
            meshId: "mesh:level",
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-asset-collider-step-and-diff",
        tool: "ecs_step_and_diff",
        payload: {
          delta: 0.1,
          label: "rapier-asset-collider-after",
          query,
        },
      }),
    );
    const stepAndDiff = (await port.nextPostedMessage(
      devtoolsResponseWithId("rapier-asset-collider-step-and-diff"),
    )) as DevtoolsStepAndDiffResponseMessage;

    expect(stepAndDiff).toMatchObject({
      ok: true,
      result: {
        step: {
          fixedStep: {
            substeps: 6,
            fixedDelta: 1 / 60,
          },
          physics: {
            backend: {
              kind: "rapier",
              execution: "simulation-worker",
            },
            sync: {
              bodyCount: 1,
              colliderCount: 1,
              unsupportedFeatureCount: 0,
              unsupportedFeatures: [],
            },
            unsupportedFeatureCount: 0,
            unsupportedFeatures: [],
            writeback: {
              missingEntities: 0,
            },
          },
        },
        diff: {
          fromLabel: "rapier-asset-collider-before",
          toLabel: "rapier-asset-collider-after",
          counts: {
            added: 0,
            removed: 0,
            changed: 1,
            unchanged: 0,
          },
          changed: [
            {
              fields: expect.arrayContaining([
                "componentIds",
                "physicsRigidBody",
                "physicsCollider",
                "physicsBodyState",
              ]),
              after: {
                key: "physics.rapier.body",
                componentIds: expect.arrayContaining([PhysicsBodyState.id]),
                physicsRigidBody: {
                  type: PhysicsRigidBodyType.Static,
                },
                physicsCollider: {
                  shapeKind: PhysicsColliderShapeKind.Trimesh,
                  meshId: "mesh:level",
                },
                physicsBodyState: {
                  backendBodyId: expect.any(String),
                },
              },
            },
          ],
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-asset-collider-raycast",
        tool: "physics_raycast_first",
        payload: {
          origin: [0, 5, 0],
          direction: [0, -1, 0],
          maxDistance: 8,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-asset-collider-raycast"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        hit: {
          entity: bodyEntityRef,
          collider: bodyEntityRef,
          distance: expect.closeTo(3, 5),
        },
        physics: {
          backend: {
            kind: "rapier",
            execution: "simulation-worker",
          },
        },
      },
    });
  });

  it("diffs angular-velocity rotation writeback in async Rapier generated workers", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerRapierPhysicsProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 30 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    const query = {
      key: "physics.rapier.body",
      withComponents: [RigidBody.id, Collider.id, PhysicsVelocity.id],
    };
    const before = await waitForEntitySnapshot(port, {
      requestIdPrefix: "rapier-spin-before",
      label: "rapier-spin-before",
      query,
      total: 1,
    });
    const summary = (
      before.result as {
        readonly summaries: readonly [
          {
            readonly entity: unknown;
          },
        ];
      }
    ).summaries[0];

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-spin-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("rapier-spin-pause")),
    ).toMatchObject({
      ok: true,
      result: { paused: true },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-spin-gravity-scale",
        tool: "ecs_set_component_field",
        payload: {
          entity: summary.entity,
          component: RigidBody.id,
          field: "gravityScale",
          value: 0,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-spin-gravity-scale"),
      ),
    ).toMatchObject({ ok: true });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-spin-angular",
        tool: "ecs_set_component_field",
        payload: {
          entity: summary.entity,
          component: PhysicsVelocity.id,
          field: "angular",
          value: [0, 0, Math.PI],
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-spin-angular"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: PhysicsVelocity.id,
        field: "angular",
        value: [0, 0, Math.PI],
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-spin-step",
        tool: "ecs_step",
        payload: { delta: 0.5 },
      }),
    );
    expect(
      await port.nextPostedMessage(devtoolsResponseWithId("rapier-spin-step")),
    ).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          substeps: 30,
          fixedDelta: 1 / 60,
        },
        physics: {
          backend: {
            kind: "rapier",
            execution: "simulation-worker",
          },
          writeback: {
            missingEntities: 0,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-spin-after",
        tool: "ecs_diff",
        payload: { label: "rapier-spin-after", query },
      }),
    );
    const diff = (await port.nextPostedMessage(
      devtoolsResponseWithId("rapier-spin-after"),
    )) as DevtoolsEntityDiffResponseMessage;

    expect(diff).toMatchObject({
      ok: true,
      result: {
        fromLabel: "rapier-spin-before",
        toLabel: "rapier-spin-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 1,
          unchanged: 0,
        },
        changed: [
          {
            fields: expect.arrayContaining([
              "localTransform",
              "physicsVelocity",
              "physicsBodyState",
            ]),
            after: {
              key: "physics.rapier.body",
              localTransform: {
                rotation: [
                  0,
                  0,
                  expect.closeTo(Math.SQRT1_2, 1),
                  expect.closeTo(Math.SQRT1_2, 1),
                ],
              },
              physicsVelocity: {
                angular: [0, 0, expect.closeTo(Math.PI, 6)],
              },
              physicsBodyState: {
                currentRotation: [
                  0,
                  0,
                  expect.closeTo(Math.SQRT1_2, 1),
                  expect.closeTo(Math.SQRT1_2, 1),
                ],
              },
            },
          },
        ],
      },
    });
  });

  it("reports Rapier contact-force impulse through generated-worker ecs_step physics summaries", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerRapierPhysicsProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 120 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    await waitForEntitySnapshot(port, {
      requestIdPrefix: "rapier-contact-before",
      label: "rapier-contact-before",
      query: {
        key: "physics.rapier.body",
        withComponents: [RigidBody.id, Collider.id, PhysicsVelocity.id],
      },
      total: 1,
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-contact-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-contact-pause"),
      ),
    ).toMatchObject({
      ok: true,
      result: { paused: true },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-contact-step",
        tool: "ecs_step",
        payload: { delta: 1 },
      }),
    );
    const step = (await port.nextPostedMessage(
      devtoolsResponseWithId("rapier-contact-step"),
    )) as DevtoolsStepResponseMessage;
    const physics = step.result.physics as DevtoolsPhysicsSummary;
    const event = physics.events.find(
      (candidate) => candidate.kind === "contactForce",
    );

    expect(step).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          substeps: 60,
          fixedDelta: 1 / 60,
        },
        physics: {
          eventKinds: {
            contactForce: expect.any(Number),
          },
        },
      },
    });
    expect(event).toBeDefined();
    if (event === undefined) {
      throw new Error("Expected generated-worker Rapier contactForce event.");
    }

    expect(event.force?.every(Number.isFinite)).toBe(true);
    expect(event.normal?.every(Number.isFinite)).toBe(true);
    expect(event.forceMagnitude).toBeGreaterThan(0);
    expect(event.maxForceMagnitude).toBeGreaterThan(0);
    expect(event.impulse).toBeGreaterThan(0);
    expect(event.impulse).toBeCloseTo(
      (event.forceMagnitude ?? Number.NaN) / 60,
      5,
    );
  });

  it("edits and diffs a Rapier prismatic joint in a paused generated worker", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: GeneratedWorkerRapierJointFrameProofSystem }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: 1 / 60, maxSubsteps: 60 },
        stop: true,
      },
    });

    await port.nextPostedMessage(isSimulationWorkerSnapshotMessage);
    const sliderQuery = {
      key: "physics.rapier.frameSlider",
      withComponents: [RigidBody.id, Collider.id, PhysicsVelocity.id],
    };
    const sliderSnapshot = await waitForEntitySnapshot(port, {
      requestIdPrefix: "rapier-frame-before",
      label: "rapier-frame-before",
      query: sliderQuery,
      total: 1,
    });
    const jointQuery = {
      key: "physics.rapier.frameJoint",
      withComponents: [PhysicsJoint.id],
    };
    const jointSnapshot = await waitForEntitySnapshot(port, {
      requestIdPrefix: "rapier-frame-joint-before",
      label: "rapier-frame-joint-before",
      query: jointQuery,
      total: 1,
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-frame-pause",
        tool: "ecs_pause",
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-frame-pause"),
      ),
    ).toMatchObject({
      ok: true,
      result: { paused: true },
    });

    const sliderEntity = (
      sliderSnapshot.result as {
        readonly summaries: readonly [{ readonly entity: unknown }];
      }
    ).summaries[0].entity;
    const jointEntity = (
      jointSnapshot.result as {
        readonly summaries: readonly [{ readonly entity: unknown }];
      }
    ).summaries[0].entity;
    const combinedQuery = { entities: [sliderEntity, jointEntity] };

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-frame-combined-before",
        tool: "ecs_snapshot",
        payload: {
          label: "rapier-frame-combined-before",
          query: combinedQuery,
        },
      }),
    );
    const before = (await port.nextPostedMessage(
      devtoolsResponseWithId("rapier-frame-combined-before"),
    )) as DevtoolsEntitySnapshotResponseMessage;

    expect(before).toMatchObject({
      ok: true,
      result: {
        label: "rapier-frame-combined-before",
        total: 2,
        summaries: expect.arrayContaining([
          expect.objectContaining({
            key: "physics.rapier.frameSlider",
            localTransform: expect.objectContaining({
              translation: [0, 0, 0],
            }),
          }),
          expect.objectContaining({
            key: "physics.rapier.frameJoint",
            componentIds: expect.arrayContaining([PhysicsJoint.id]),
            physicsJoint: expect.objectContaining({
              kind: PhysicsJointKind.Prismatic,
              anchorA: [0, 5, 0],
              anchorB: [0, 0, 0],
              axis: [0, 0, 1],
              frameA: [0, 0, 0, 1],
              minLimit: expect.closeTo(-0.6, 6),
              maxLimit: expect.closeTo(0.6, 6),
            }),
          }),
        ]),
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-frame-mutate-axis",
        tool: "ecs_set_component_field",
        payload: {
          entity: jointEntity,
          component: PhysicsJoint.id,
          field: "axis",
          value: [0, 1, 0],
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-frame-mutate-axis"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: PhysicsJoint.id,
        field: "axis",
        value: [0, 1, 0],
        summary: {
          key: "physics.rapier.frameJoint",
          physicsJoint: {
            axis: [0, 1, 0],
            frameA: [0, 0, 0, 1],
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-frame-mutate-frame-a",
        tool: "ecs_set_component_field",
        payload: {
          entity: jointEntity,
          component: PhysicsJoint.id,
          field: "frameA",
          value: [0, 0, -0.70710677, 0.70710677],
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-frame-mutate-frame-a"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: PhysicsJoint.id,
        field: "frameA",
        value: [0, 0, -0.70710677, 0.70710677],
        summary: {
          key: "physics.rapier.frameJoint",
          physicsJoint: {
            axis: [0, 1, 0],
            frameA: [
              0,
              0,
              expect.closeTo(-0.70710677, 7),
              expect.closeTo(0.70710677, 7),
            ],
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-frame-mutate-frame-b",
        tool: "ecs_set_component_field",
        payload: {
          entity: jointEntity,
          component: PhysicsJoint.id,
          field: "frameB",
          value: [0, 0, 0.70710677, 0.70710677],
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-frame-mutate-frame-b"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: PhysicsJoint.id,
        field: "frameB",
        value: [0, 0, 0.70710677, 0.70710677],
        summary: {
          key: "physics.rapier.frameJoint",
          physicsJoint: {
            axis: [0, 1, 0],
            frameA: [
              0,
              0,
              expect.closeTo(-0.70710677, 7),
              expect.closeTo(0.70710677, 7),
            ],
            frameB: [
              0,
              0,
              expect.closeTo(0.70710677, 7),
              expect.closeTo(0.70710677, 7),
            ],
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-frame-mutate-break-force",
        tool: "ecs_set_component_field",
        payload: {
          entity: jointEntity,
          component: PhysicsJoint.id,
          field: "breakForce",
          value: 12,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-frame-mutate-break-force"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: PhysicsJoint.id,
        field: "breakForce",
        value: 12,
        summary: {
          key: "physics.rapier.frameJoint",
          physicsJoint: {
            breakForce: 12,
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-frame-mutate-motor-max-force",
        tool: "ecs_set_component_field",
        payload: {
          entity: jointEntity,
          component: PhysicsJoint.id,
          field: "motorMaxForce",
          value: 9,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-frame-mutate-motor-max-force"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: PhysicsJoint.id,
        field: "motorMaxForce",
        value: 9,
        summary: {
          key: "physics.rapier.frameJoint",
          physicsJoint: {
            motorMaxForce: 9,
          },
        },
      },
    });
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-frame-mutate-contacts-enabled",
        tool: "ecs_set_component_field",
        payload: {
          entity: jointEntity,
          component: PhysicsJoint.id,
          field: "contactsEnabled",
          value: false,
        },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-frame-mutate-contacts-enabled"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        component: PhysicsJoint.id,
        field: "contactsEnabled",
        value: false,
        summary: {
          key: "physics.rapier.frameJoint",
          physicsJoint: {
            contactsEnabled: false,
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-frame-step",
        tool: "ecs_step",
        payload: { delta: 0.5 },
      }),
    );
    const step = (await port.nextPostedMessage(
      devtoolsResponseWithId("rapier-frame-step"),
    )) as DevtoolsStepResponseMessage;

    expect(step).toMatchObject({
      ok: true,
      result: {
        fixedStep: {
          substeps: 30,
          fixedDelta: 1 / 60,
        },
        physics: {
          backend: {
            kind: "rapier",
            build: "performance",
            execution: "simulation-worker",
          },
          sync: {
            unsupportedFeatureCount: 3,
            unsupportedFeatures: expect.arrayContaining([
              expect.objectContaining({
                code: "physics.joint.breakForce.unsupported",
                feature: "joint.breakForce",
                backend: "rapier",
                entity: expect.any(String),
                value: 12,
              }),
              expect.objectContaining({
                code: "physics.joint.motorMaxForce.unsupported",
                feature: "joint.motorMaxForce",
                backend: "rapier",
                entity: expect.any(String),
                value: 9,
              }),
              expect.objectContaining({
                code: "physics.joint.frameB.unsupported",
                feature: "joint.frameB",
                backend: "rapier",
                entity: expect.any(String),
              }),
            ]),
          },
          unsupportedFeatureCount: 3,
          unsupportedFeatures: expect.arrayContaining([
            expect.objectContaining({
              code: "physics.joint.breakForce.unsupported",
              feature: "joint.breakForce",
              backend: "rapier",
              entity: expect.any(String),
              value: 12,
            }),
            expect.objectContaining({
              code: "physics.joint.motorMaxForce.unsupported",
              feature: "joint.motorMaxForce",
              backend: "rapier",
              entity: expect.any(String),
              value: 9,
            }),
            expect.objectContaining({
              code: "physics.joint.frameB.unsupported",
              feature: "joint.frameB",
              backend: "rapier",
              entity: expect.any(String),
            }),
          ]),
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-frame-joint-status",
        tool: "physics_joint_status",
        payload: { entity: jointEntity },
      }),
    );
    expect(
      await port.nextPostedMessage(
        devtoolsResponseWithId("rapier-frame-joint-status"),
      ),
    ).toMatchObject({
      ok: true,
      result: {
        entity: jointEntity,
        joint: {
          kind: PhysicsJointKind.Prismatic,
          breakForce: 12,
          motorMaxForce: 9,
          contactsEnabled: false,
          frameB: [
            0,
            0,
            expect.closeTo(0.70710677, 7),
            expect.closeTo(0.70710677, 7),
          ],
        },
        backend: {
          kind: "rapier",
          build: "performance",
          execution: "simulation-worker",
          capabilities: {
            compoundColliders: true,
            continuousCollisionDetection: true,
            characterController: true,
            linkedBodyContacts: true,
            combinedPositionVelocityMotors: true,
            motorForceLimits: false,
            automaticBreakForce: false,
            jointImpulseReadback: false,
            pairedNonFixedFrameB: false,
          },
        },
        unsupportedFeatures: expect.arrayContaining([
          expect.objectContaining({
            code: "physics.joint.breakForce.unsupported",
            feature: "joint.breakForce",
            backend: "rapier",
            value: 12,
          }),
          expect.objectContaining({
            code: "physics.joint.motorMaxForce.unsupported",
            feature: "joint.motorMaxForce",
            backend: "rapier",
            value: 9,
          }),
          expect.objectContaining({
            code: "physics.joint.frameB.unsupported",
            feature: "joint.frameB",
            backend: "rapier",
          }),
        ]),
        authoredUnsupportedFeatures: expect.arrayContaining([
          expect.objectContaining({
            code: "physics.joint.breakForce.unsupported",
            feature: "joint.breakForce",
            backend: "rapier",
            value: 12,
          }),
          expect.objectContaining({
            code: "physics.joint.motorMaxForce.unsupported",
            feature: "joint.motorMaxForce",
            backend: "rapier",
            value: 9,
          }),
          expect.objectContaining({
            code: "physics.joint.frameB.unsupported",
            feature: "joint.frameB",
            backend: "rapier",
          }),
        ]),
        capabilities: {
          explicitBreakJoint: true,
          automaticBreakForce: false,
          jointImpulseReadback: false,
          motorForceLimits: false,
          linkedBodyContacts: true,
          combinedPositionVelocityMotors: true,
          pairedNonFixedFrameB: false,
        },
        readback: {
          jointImpulse: null,
          supported: false,
          code: "physics.joint.impulseReadback.unsupported",
          unsupportedFeature: {
            code: "physics.joint.impulseReadback.unsupported",
            feature: "joint.impulseReadback",
            backend: "rapier",
            entity: expect.any(String),
          },
        },
        physics: {
          backend: {
            capabilities: {
              compoundColliders: true,
              continuousCollisionDetection: true,
              characterController: true,
              linkedBodyContacts: true,
              combinedPositionVelocityMotors: true,
              motorForceLimits: false,
              automaticBreakForce: false,
              jointImpulseReadback: false,
              pairedNonFixedFrameB: false,
            },
          },
        },
      },
    });

    port.dispatch(
      createApertureDevtoolsRequest({
        requestId: "rapier-frame-after",
        tool: "ecs_diff",
        payload: { label: "rapier-frame-after", query: combinedQuery },
      }),
    );
    const diff = (await port.nextPostedMessage(
      devtoolsResponseWithId("rapier-frame-after"),
    )) as DevtoolsEntityDiffResponseMessage;

    expect(diff).toMatchObject({
      ok: true,
      result: {
        fromLabel: "rapier-frame-combined-before",
        toLabel: "rapier-frame-after",
        counts: {
          added: 0,
          removed: 0,
          changed: 2,
          unchanged: 0,
        },
      },
    });

    const changes = (
      diff.result as {
        readonly changed: readonly {
          readonly fields: readonly string[];
          readonly after: {
            readonly key?: string;
            readonly componentIds?: readonly string[];
            readonly localTransform?: {
              readonly translation: readonly [number, number, number];
            };
            readonly physicsJoint?: {
              readonly axis: readonly [number, number, number];
              readonly frameA: readonly [number, number, number, number];
              readonly frameB: readonly [number, number, number, number];
              readonly breakForce: number;
              readonly motorMaxForce: number;
              readonly contactsEnabled: boolean;
            };
          };
        }[];
      }
    ).changed;
    const sliderChange = changes.find(
      (change) => change.after.key === "physics.rapier.frameSlider",
    );
    const jointChange = changes.find(
      (change) => change.after.key === "physics.rapier.frameJoint",
    );

    expect(sliderChange).toBeDefined();
    expect(sliderChange?.fields).toEqual(
      expect.arrayContaining([
        "componentIds",
        "localTransform",
        "physicsBodyState",
        "worldTransform",
      ]),
    );
    expect(sliderChange?.after.componentIds).toEqual(
      expect.arrayContaining([PhysicsBodyState.id]),
    );
    expect(jointChange).toBeDefined();
    expect(jointChange?.fields).toEqual(
      expect.arrayContaining(["physicsJoint"]),
    );
    expect(jointChange?.after.physicsJoint).toMatchObject({
      axis: [0, 1, 0],
      frameA: [
        0,
        0,
        expect.closeTo(-0.70710677, 7),
        expect.closeTo(0.70710677, 7),
      ],
      frameB: [
        0,
        0,
        expect.closeTo(0.70710677, 7),
        expect.closeTo(0.70710677, 7),
      ],
      breakForce: 12,
      motorMaxForce: 9,
      contactsEnabled: false,
    });

    const translation = sliderChange?.after.localTransform?.translation ?? [
      0, 0, 0,
    ];

    expect(translation[0]).toBeGreaterThan(0.2);
    expect(translation[0]).toBeLessThan(0.65);
    expect(Math.abs(translation[1])).toBeLessThan(0.03);
  });

  it("reports invalid serializable fixed-step worker start options", async () => {
    const port = new TestGeneratedWorkerPort();

    startGeneratedSimulationWorker({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: {
        fixedStep: { fixedDelta: -1 },
        stop: true,
      },
    });

    const error = await port.nextPostedMessage(isSimulationWorkerErrorMessage);

    expect(error).toMatchObject({
      type: SIMULATION_WORKER_PROTOCOL.error,
      reason: "aperture.generatedWorker.failed",
    });
  });
});

const GeneratedWorkerPhysicsProofBase = createSystem();

class GeneratedWorkerPhysicsProofSystem extends GeneratedWorkerPhysicsProofBase {
  private backend: PhysicsBackend | null = null;
  private bodyRef = "";
  private triggerRef = "";
  private characterRef = "";
  private floor: Entity | null = null;
  private disposeFixedStep: (() => void) | null = null;

  override init(): void {
    const backend = createTestPhysicsBackend();
    const syncState = createPhysicsWorldSyncState();

    backend.init({ execution: "simulation-worker" });
    this.backend = backend;
    this.physics.setBackend(backend);
    const body = this.spawn.physics({
      key: "physics.diff.body",
      name: "Physics Diff Body",
      transform: { translation: [0, 0, 0] },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.Dynamic },
        collider: { shape: { kind: "sphere", radius: 0.5 } },
        velocity: { linear: [0.05, 0, 0] },
        externalForce: true,
        externalImpulse: true,
        material: {
          friction: 0.4,
          restitution: 0.1,
          density: 2,
          frictionCombine: PhysicsMaterialCombineRule.Max,
        },
        debug: true,
      },
    });
    const trigger = this.spawn.physics({
      key: "physics.diff.trigger",
      name: "Physics Diff Trigger",
      transform: { translation: [4, 0, 0] },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.Static },
        collider: { shape: { kind: "sphere", radius: 0.5 }, sensor: true },
      },
    });
    this.floor = this.spawn.physics({
      key: "physics.diff.floor",
      name: "Physics Diff Floor",
      transform: { translation: [0, 0, 0] },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.Static },
        collider: { shape: { kind: "sphere", radius: 0.5 } },
      },
    });
    const character = this.spawn.physics({
      key: "physics.diff.character",
      name: "Physics Diff Character",
      transform: { translation: [0, 1, 0] },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.KinematicPosition },
        collider: { shape: { kind: "sphere", radius: 0.5 } },
        characterController: {
          snapToGroundDistance: 0.05,
          slide: true,
          autostep: false,
          characterMass: null,
        },
      },
    });
    this.spawn.physics({
      key: "physics.diff.kinematicTarget",
      name: "Physics Diff Kinematic Target",
      transform: { translation: [0, 2, 0] },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.KinematicPosition },
        collider: { shape: { kind: "sphere", radius: 0.25 } },
        kinematicTarget: { translation: [0, 2, 0] },
      },
    });
    this.bodyRef = serializeEntityRef(body);
    this.triggerRef = serializeEntityRef(trigger);
    this.characterRef = serializeEntityRef(character);
    this.disposeFixedStep = this.fixedStep.register((context) => {
      backend.sync({
        commands: [
          {
            kind: "emitTrigger",
            entityA: this.bodyRef,
            entityB: this.triggerRef,
          },
        ],
      });
      const report = stepPhysicsWorld({
        world: context.world,
        backend,
        fixedDelta: context.fixedDelta,
        fixedStep: context.fixedStep,
        state: syncState,
      });

      this.physics.setStepReport(report);
      this.physics.moveCharacter({
        entity: this.characterRef,
        desiredTranslation: [0, 0, 0],
        settings: { snapToGroundDistance: 0.05 },
      });
      if (context.fixedStep === 0) {
        this.floor?.destroy();
        this.floor = null;
      }
    });
  }

  override destroy(): void {
    this.disposeFixedStep?.();
    this.backend?.dispose();
    this.physics.setBackend(null);
    super.destroy();
  }
}

class GeneratedWorkerChildColliderProofSystem extends GeneratedWorkerPhysicsProofBase {
  private backend: PhysicsBackend | null = null;
  private disposeFixedStep: (() => void) | null = null;

  override init(): void {
    const backend = createTestPhysicsBackend();
    const syncState = createPhysicsWorldSyncState();

    backend.init({ execution: "simulation-worker" });
    this.backend = backend;
    this.physics.setBackend(backend);
    const body = this.spawn.physics({
      key: "physics.child.body",
      name: "Physics Child Collider Body",
      transform: { translation: [0, 0, 0] },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.Dynamic },
        velocity: { linear: [1, 0, 0] },
      },
    });

    this.spawn.physics({
      key: "physics.child.collider.a",
      name: "Physics Child Collider Shape A",
      transform: { translation: [1, 0, 0], parent: body },
      physics: {
        collider: { shape: { kind: "sphere", radius: 0.25 } },
      },
    });
    this.spawn.physics({
      key: "physics.child.collider.b",
      name: "Physics Child Collider Shape B",
      transform: { translation: [3, 0, 0], parent: body },
      physics: {
        collider: { shape: { kind: "sphere", radius: 0.25 } },
      },
    });
    this.disposeFixedStep = this.fixedStep.register((context) => {
      const report = stepPhysicsWorld({
        world: context.world,
        backend,
        fixedDelta: context.fixedDelta,
        fixedStep: context.fixedStep,
        state: syncState,
      });

      this.physics.setStepReport(report);
    });
  }

  override destroy(): void {
    this.disposeFixedStep?.();
    this.backend?.dispose();
    this.physics.setBackend(null);
    super.destroy();
  }
}

class GeneratedWorkerParentedBodyProofSystem extends GeneratedWorkerPhysicsProofBase {
  private backend: PhysicsBackend | null = null;
  private disposeFixedStep: (() => void) | null = null;

  override init(): void {
    const backend = createTestPhysicsBackend();
    const syncState = createPhysicsWorldSyncState();

    backend.init({ execution: "simulation-worker" });
    this.backend = backend;
    this.physics.setBackend(backend);
    const parent = this.spawn.physics({
      key: "physics.parented.parent",
      name: "Physics Parented Body Parent",
      transform: { translation: [10, 0, 0] },
      physics: {},
    });

    this.spawn.physics({
      key: "physics.parented.body",
      name: "Physics Parented Dynamic Body",
      transform: { translation: [1, 0, 0], parent },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.Dynamic },
        collider: { shape: { kind: "sphere", radius: 0.5 } },
        velocity: { linear: [1, 0, 0] },
      },
    });
    this.disposeFixedStep = this.fixedStep.register((context) => {
      const report = stepPhysicsWorld({
        world: context.world,
        backend,
        fixedDelta: context.fixedDelta,
        fixedStep: context.fixedStep,
        state: syncState,
      });

      this.physics.setStepReport(report);
    });
  }

  override destroy(): void {
    this.disposeFixedStep?.();
    this.backend?.dispose();
    this.physics.setBackend(null);
    super.destroy();
  }
}

class GeneratedWorkerPhysicsGravityProofSystem extends GeneratedWorkerPhysicsProofBase {
  private backend: PhysicsBackend | null = null;
  private disposeFixedStep: (() => void) | null = null;

  override init(): void {
    const backend = createTestPhysicsBackend();
    const syncState = createPhysicsWorldSyncState();

    backend.init({ execution: "simulation-worker" });
    this.backend = backend;
    this.physics.setBackend(backend);
    this.spawn.physics({
      key: "physics.gravity.body",
      name: "Physics Gravity Body",
      transform: { translation: [0, 0, 0] },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.Dynamic },
        collider: { shape: { kind: "sphere", radius: 0.5 } },
        velocity: true,
        gravity: { gravity: [0, 0, 0] },
      },
    });
    this.disposeFixedStep = this.fixedStep.register((context) => {
      const report = stepPhysicsWorld({
        world: context.world,
        backend,
        fixedDelta: context.fixedDelta,
        fixedStep: context.fixedStep,
        state: syncState,
      });

      this.physics.setStepReport(report);
    });
  }

  override destroy(): void {
    this.disposeFixedStep?.();
    this.backend?.dispose();
    this.physics.setBackend(null);
    super.destroy();
  }
}

const GeneratedWorkerPhysicsInteractionProofBase = createSystem();

class GeneratedWorkerPhysicsInteractionProofSystem extends GeneratedWorkerPhysicsInteractionProofBase {
  private backend: PhysicsBackend | null = null;
  private disposeFixedStep: (() => void) | null = null;

  override init(): void {
    const backend = createTestPhysicsBackend();
    const syncState = createPhysicsWorldSyncState();

    backend.init({ execution: "simulation-worker" });
    this.backend = backend;
    this.physics.setBackend(backend);
    this.spawn.camera({
      key: "physics.interaction.camera",
      transform: { translation: [0, 0, 5], lookAt: [0, 0, 0] },
      fovYDegrees: 60,
    });
    const body = this.spawn.mesh({
      key: "physics.interaction.body",
      name: "Physics Interaction Body",
      transform: { translation: [2, 0, 0] },
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard(),
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.Dynamic },
        collider: { shape: { kind: "sphere", radius: 0.5 } },
        velocity: { linear: [-2, 0, 0] },
      },
    });
    body.addComponent(Pickable, createPickable({ enabled: true }));
    this.interaction.onEnter(
      { index: body.index, generation: body.generation },
      () => {
        body.getVectorView(PhysicsVelocity, "angular").set([0, 1, 0]);
      },
    );
    this.disposeFixedStep = this.fixedStep.register((context) => {
      const report = stepPhysicsWorld({
        world: context.world,
        backend,
        fixedDelta: context.fixedDelta,
        fixedStep: context.fixedStep,
        state: syncState,
      });

      this.physics.setStepReport(report);
    });
  }

  override destroy(): void {
    this.disposeFixedStep?.();
    this.backend?.dispose();
    this.physics.setBackend(null);
    super.destroy();
  }
}

const GeneratedWorkerPhysicsApiProofBase = createSystem();

class GeneratedWorkerPhysicsApiProofSystem extends GeneratedWorkerPhysicsApiProofBase {
  private backend: PhysicsBackend | null = null;
  private dynamic: Entity | null = null;
  private kinematic: Entity | null = null;
  private disposeFixedStep: (() => void) | null = null;

  override init(): void {
    const backend = createTestPhysicsBackend();
    const syncState = createPhysicsWorldSyncState();

    backend.init({ execution: "simulation-worker" });
    this.backend = backend;
    this.physics.setBackend(backend);
    this.dynamic = this.spawn.physics({
      key: "physics.api.dynamic",
      name: "Physics API Dynamic",
      tags: ["physics.api"],
      transform: { translation: [0, 0, 0] },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.Dynamic },
        collider: { shape: { kind: "sphere", radius: 0.5 } },
      },
    });
    this.kinematic = this.spawn.physics({
      key: "physics.api.kinematic",
      name: "Physics API Kinematic",
      tags: ["physics.api"],
      transform: { translation: [0, 2, 0] },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.KinematicPosition },
        collider: { shape: { kind: "sphere", radius: 0.25 } },
      },
    });
    this.disposeFixedStep = this.fixedStep.register((context) => {
      if (context.fixedStep === 0 && this.dynamic !== null) {
        this.physics.setLinearVelocity(this.dynamic, [0.2, 0, 0]);
        this.physics.applyForce(this.dynamic, [0.1, 0, 0]);
        this.physics.applyImpulse(this.dynamic, [0.3, 0, 0]);
      }
      if (context.fixedStep === 0 && this.kinematic !== null) {
        this.physics.setKinematicTarget(this.kinematic, {
          translation: [2, 2, 0],
          rotation: [0, 0, 0, 1],
        });
      }

      const report = stepPhysicsWorld({
        world: context.world,
        backend,
        fixedDelta: context.fixedDelta,
        fixedStep: context.fixedStep,
        state: syncState,
      });

      this.physics.setStepReport(report);
    });
  }

  override destroy(): void {
    this.disposeFixedStep?.();
    this.backend?.dispose();
    this.physics.setBackend(null);
    super.destroy();
  }
}

const GeneratedWorkerJointBreakProofBase = createSystem();

class GeneratedWorkerJointBreakProofSystem extends GeneratedWorkerJointBreakProofBase {
  private backend: PhysicsBackend | null = null;
  private disposeFixedStep: (() => void) | null = null;

  override init(): void {
    const backend = createTestPhysicsBackend();
    const syncState = createPhysicsWorldSyncState();

    backend.init({ execution: "simulation-worker" });
    this.backend = backend;
    this.physics.setBackend(backend);
    const anchor = this.spawn.physics({
      key: "physics.break.anchor",
      transform: { translation: [0, 0, 0] },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.Static },
        collider: { shape: { kind: "sphere", radius: 0.25 } },
      },
    });
    const body = this.spawn.physics({
      key: "physics.break.body",
      transform: { translation: [0, 1, 0] },
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.Dynamic },
        collider: { shape: { kind: "sphere", radius: 0.25 } },
      },
    });
    this.spawn.physics({
      key: "physics.break.joint",
      physics: {
        joint: {
          kind: PhysicsJointKind.Fixed,
          bodyARef: serializeEntityRef(anchor),
          bodyBRef: serializeEntityRef(body),
          anchorA: [0, 0, 0],
          anchorB: [0, 0, 0],
        },
      },
    });
    this.disposeFixedStep = this.fixedStep.register((context) => {
      const report = stepPhysicsWorld({
        world: context.world,
        backend,
        fixedDelta: context.fixedDelta,
        fixedStep: context.fixedStep,
        state: syncState,
      });

      this.physics.setStepReport(report);
    });
  }

  override destroy(): void {
    this.disposeFixedStep?.();
    this.backend?.dispose();
    this.physics.setBackend(null);
    super.destroy();
  }
}

const GeneratedWorkerPhysicsInterpolationProofBase = createSystem();

class GeneratedWorkerPhysicsInterpolationProofSystem extends GeneratedWorkerPhysicsInterpolationProofBase {
  private backend: PhysicsBackend | null = null;
  private disposeFixedStep: (() => void) | null = null;

  override init(): void {
    const backend = createTestPhysicsBackend();
    const syncState = createPhysicsWorldSyncState();

    backend.init({ execution: "simulation-worker" });
    this.backend = backend;
    this.physics.setBackend(backend);
    this.spawn.camera({
      key: "physics.interpolate.camera",
      transform: { translation: [0, 0, 0] },
    });
    this.spawn.mesh({
      key: "physics.interpolate.body",
      name: "Physics Interpolation Body",
      transform: { translation: [0, 0, -5] },
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard(),
      physics: {
        rigidBody: { type: PhysicsRigidBodyType.Dynamic },
        collider: { shape: { kind: "box", halfExtents: [0.5, 0.5, 0.5] } },
        velocity: { linear: [1, 0, 0] },
      },
    });
    this.disposeFixedStep = this.fixedStep.register((context) => {
      const report = stepPhysicsWorld({
        world: context.world,
        backend,
        fixedDelta: context.fixedDelta,
        fixedStep: context.fixedStep,
        state: syncState,
      });

      this.physics.setStepReport(report);
    });
  }

  override destroy(): void {
    this.disposeFixedStep?.();
    this.backend?.dispose();
    this.physics.setBackend(null);
    super.destroy();
  }
}

const GeneratedWorkerRapierPhysicsProofBase = createSystem();

class GeneratedWorkerRapierPhysicsProofSystem extends GeneratedWorkerRapierPhysicsProofBase {
  private backend: PhysicsBackend | null = null;
  private disposeFixedStep: (() => void) | null = null;

  override init(): void {
    const backend = createRapierPhysicsBackend({ gravity: [0, -9.81, 0] });
    const syncState = createPhysicsWorldSyncState();

    this.disposeFixedStep = this.fixedStep.register((context) => {
      if (this.backend === null) {
        return;
      }

      const report = stepPhysicsWorld({
        world: context.world,
        backend: this.backend,
        fixedDelta: context.fixedDelta,
        fixedStep: context.fixedStep,
        state: syncState,
      });

      this.physics.setStepReport(report);
    });
    void Promise.resolve(backend.init({ execution: "simulation-worker" }))
      .then(() => {
        this.backend = backend;
        this.physics.setBackend(backend);
        this.spawn.physics({
          key: "physics.rapier.body",
          name: "Rapier Generated Worker Body",
          transform: { translation: [0, 2, 0] },
          physics: {
            rigidBody: { type: PhysicsRigidBodyType.Dynamic, canSleep: false },
            collider: { shape: { kind: "sphere", radius: 0.25 } },
            velocity: { linear: [0, -1, 0] },
          },
        });
        this.spawn.physics({
          key: "physics.rapier.floor",
          name: "Rapier Generated Worker Floor",
          transform: { translation: [0, 0, 0] },
          physics: {
            rigidBody: { type: PhysicsRigidBodyType.Static },
            collider: { shape: { kind: "box", halfExtents: [2, 0.1, 2] } },
          },
        });
        this.spawn.physics({
          key: "physics.rapier.axisCylinder",
          name: "Rapier Axis Cylinder",
          transform: { translation: [8, 3, 0] },
          physics: {
            rigidBody: { type: PhysicsRigidBodyType.Static },
            collider: {
              shape: {
                kind: "cylinder",
                radius: 0.25,
                halfHeight: 2,
                axis: PhysicsColliderAxis.X,
              },
            },
          },
        });
        this.spawn.physics({
          key: "physics.rapier.axisTarget",
          name: "Rapier Axis Query Target",
          transform: { translation: [9.5, 3, 0] },
          physics: {
            rigidBody: { type: PhysicsRigidBodyType.Static },
            collider: {
              shape: { kind: "box", halfExtents: [0.05, 0.05, 0.05] },
            },
          },
        });
      })
      .catch((error: unknown) => {
        this.diagnostics.error("aperture.physics.rapierInitFailed", {
          message: error instanceof Error ? error.message : String(error),
        });
      });
  }

  override destroy(): void {
    this.disposeFixedStep?.();
    this.backend?.dispose();
    this.physics.setBackend(null);
    super.destroy();
  }
}

class GeneratedWorkerRapierAssetColliderProofSystem extends GeneratedWorkerRapierPhysicsProofBase {
  private backend: PhysicsBackend | null = null;
  private disposeFixedStep: (() => void) | null = null;

  override init(): void {
    const backend = createRapierPhysicsBackend({
      gravity: [0, 0, 0],
      colliderGeometryProvider: createGeneratedWorkerAssetColliderProvider(),
    });
    const syncState = createPhysicsWorldSyncState();

    this.disposeFixedStep = this.fixedStep.register((context) => {
      if (this.backend === null) {
        return;
      }

      const report = stepPhysicsWorld({
        world: context.world,
        backend: this.backend,
        fixedDelta: context.fixedDelta,
        fixedStep: context.fixedStep,
        state: syncState,
      });

      this.physics.setStepReport(report);
    });
    void Promise.resolve(backend.init({ execution: "simulation-worker" }))
      .then(() => {
        this.backend = backend;
        this.physics.setBackend(backend);
        this.spawn.physics({
          key: "physics.rapier.body",
          name: "Rapier Generated Worker Asset Collider Body",
          transform: { translation: [0, 2, 0] },
          physics: {
            rigidBody: { type: PhysicsRigidBodyType.Dynamic, canSleep: false },
            collider: { shape: { kind: "sphere", radius: 0.25 } },
          },
        });
      })
      .catch((error: unknown) => {
        this.diagnostics.error("aperture.physics.rapierInitFailed", {
          message: error instanceof Error ? error.message : String(error),
        });
      });
  }

  override destroy(): void {
    this.disposeFixedStep?.();
    this.backend?.dispose();
    this.physics.setBackend(null);
    super.destroy();
  }
}

function createGeneratedWorkerAssetColliderProvider(): PhysicsColliderGeometryProvider {
  return {
    triangleMesh(meshId) {
      if (meshId !== "mesh:level") {
        return {
          ok: false,
          error: {
            code: "physics.collider.asset.missing",
            feature: "collider.triangleMesh",
            message: `Generated-worker physics test mesh '${meshId}' is not registered.`,
            suggestedFix:
              "Use mesh:level in this generated-worker asset-collider proof.",
            details: { assetId: meshId },
          },
        };
      }

      return {
        ok: true,
        geometry: generatedWorkerLevelGeometry(meshId),
      };
    },
    heightfield(assetId) {
      return {
        ok: false,
        error: {
          code: "physics.collider.asset.missing",
          feature: "collider.heightfield",
          message: `Generated-worker physics test heightfield '${assetId}' is not registered.`,
          suggestedFix:
            "Use triangle-mesh geometry for this generated-worker proof.",
          details: { assetId },
        },
      };
    },
  };
}

function generatedWorkerLevelGeometry(
  key: string,
): PhysicsTriangleMeshGeometry {
  return {
    key,
    positions: new Float32Array([-2, 0, -2, 2, 0, -2, -2, 0, 2, 2, 0, 2]),
    indices: new Uint32Array([0, 2, 1, 2, 3, 1]),
    vertexCount: 4,
    triangleCount: 2,
  };
}

class GeneratedWorkerRapierSleepProofSystem extends GeneratedWorkerRapierPhysicsProofBase {
  private backend: PhysicsBackend | null = null;
  private disposeFixedStep: (() => void) | null = null;

  override init(): void {
    const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });
    const syncState = createPhysicsWorldSyncState();

    this.disposeFixedStep = this.fixedStep.register((context) => {
      if (this.backend === null) {
        return;
      }

      const report = stepPhysicsWorld({
        world: context.world,
        backend: this.backend,
        fixedDelta: context.fixedDelta,
        fixedStep: context.fixedStep,
        state: syncState,
      });

      this.physics.setStepReport(report);
    });
    void Promise.resolve(backend.init({ execution: "simulation-worker" }))
      .then(() => {
        this.backend = backend;
        this.physics.setBackend(backend);
        this.spawn.physics({
          key: "physics.rapier.awake",
          name: "Rapier Awake Body",
          transform: { translation: [0, 0, 0] },
          physics: {
            rigidBody: { type: PhysicsRigidBodyType.Dynamic, canSleep: true },
            collider: { shape: { kind: "sphere", radius: 0.25 } },
            velocity: { linear: [0, 0, 0] },
          },
        });
        this.spawn.physics({
          key: "physics.rapier.sleepControl",
          name: "Rapier Sleep Control Body",
          transform: { translation: [2, 0, 0] },
          physics: {
            rigidBody: { type: PhysicsRigidBodyType.Dynamic, canSleep: true },
            collider: { shape: { kind: "sphere", radius: 0.25 } },
          },
        });
      })
      .catch((error: unknown) => {
        this.diagnostics.error("aperture.physics.rapierInitFailed", {
          message: error instanceof Error ? error.message : String(error),
        });
      });
  }

  override destroy(): void {
    this.disposeFixedStep?.();
    this.backend?.dispose();
    this.physics.setBackend(null);
    super.destroy();
  }
}

const GeneratedWorkerRapierJointFrameProofBase = createSystem();

class GeneratedWorkerRapierJointFrameProofSystem extends GeneratedWorkerRapierJointFrameProofBase {
  private backend: PhysicsBackend | null = null;
  private disposeFixedStep: (() => void) | null = null;

  override init(): void {
    const backend = createRapierPhysicsBackend({ gravity: [0, 0, 0] });
    const syncState = createPhysicsWorldSyncState();

    this.disposeFixedStep = this.fixedStep.register((context) => {
      if (this.backend === null) {
        return;
      }

      const report = stepPhysicsWorld({
        world: context.world,
        backend: this.backend,
        fixedDelta: context.fixedDelta,
        fixedStep: context.fixedStep,
        state: syncState,
      });

      this.physics.setStepReport(report);
    });
    void Promise.resolve(backend.init({ execution: "simulation-worker" }))
      .then(() => {
        this.backend = backend;
        this.physics.setBackend(backend);
        const anchor = this.spawn.physics({
          key: "physics.rapier.frameAnchor",
          name: "Rapier Frame Joint Anchor",
          transform: { translation: [0, -5, 0] },
          physics: {
            rigidBody: { type: PhysicsRigidBodyType.Static },
            collider: { shape: { kind: "sphere", radius: 0.05 } },
          },
        });
        const slider = this.spawn.physics({
          key: "physics.rapier.frameSlider",
          name: "Rapier Frame Joint Slider",
          transform: { translation: [0, 0, 0] },
          physics: {
            rigidBody: { type: PhysicsRigidBodyType.Dynamic, canSleep: false },
            collider: { shape: { kind: "sphere", radius: 0.05 } },
            velocity: { linear: [1, 0, 0] },
          },
        });

        this.spawn.physics({
          key: "physics.rapier.frameJoint",
          name: "Rapier Frame-Oriented Prismatic Joint",
          physics: {
            joint: {
              kind: PhysicsJointKind.Prismatic,
              bodyARef: serializeEntityRef(anchor),
              bodyBRef: serializeEntityRef(slider),
              anchorA: [0, 5, 0],
              anchorB: [0, 0, 0],
              axis: [0, 0, 1],
              frameA: [0, 0, 0, 1],
              minLimit: -0.6,
              maxLimit: 0.6,
            },
          },
        });
      })
      .catch((error: unknown) => {
        this.diagnostics.error("aperture.physics.rapierInitFailed", {
          message: error instanceof Error ? error.message : String(error),
        });
      });
  }

  override destroy(): void {
    this.disposeFixedStep?.();
    this.backend?.dispose();
    this.physics.setBackend(null);
    super.destroy();
  }
}

class TestGeneratedWorkerPort {
  readonly posted: unknown[] = [];
  private readonly listeners = new Set<
    (event: MessageEvent<unknown>) => void
  >();
  private waiters: {
    readonly predicate: (message: unknown) => boolean;
    readonly resolve: (message: unknown) => void;
  }[] = [];

  postMessage(message: unknown): void {
    this.posted.push(message);

    for (const waiter of [...this.waiters]) {
      if (waiter.predicate(message)) {
        this.waiters = this.waiters.filter((entry) => entry !== waiter);
        waiter.resolve(message);
      }
    }
  }

  addEventListener(
    _type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void {
    this.listeners.delete(listener);
  }

  start(): void {}

  dispatch(message: unknown): void {
    for (const listener of this.listeners) {
      listener({ data: message } as MessageEvent<unknown>);
    }
  }

  nextPostedMessage(
    predicate: (message: unknown) => boolean,
  ): Promise<unknown> {
    const existing = this.posted.find(predicate);

    if (existing !== undefined) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.waiters = this.waiters.filter(
          (waiter) => waiter.resolve !== resolve,
        );
        reject(new Error("Timed out waiting for generated worker message."));
      }, 1000);

      this.waiters.push({
        predicate,
        resolve(message) {
          clearTimeout(timeout);
          resolve(message);
        },
      });
    });
  }
}

async function waitForEntitySnapshot(
  port: TestGeneratedWorkerPort,
  options: {
    readonly requestIdPrefix: string;
    readonly label: string;
    readonly query: unknown;
    readonly total: number;
  },
): Promise<DevtoolsEntitySnapshotResponseMessage> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const requestId = `${options.requestIdPrefix}-${attempt}`;
    port.dispatch(
      createApertureDevtoolsRequest({
        requestId,
        tool: "ecs_snapshot",
        payload: { label: options.label, query: options.query },
      }),
    );
    const response = (await port.nextPostedMessage(
      devtoolsResponseWithId(requestId),
    )) as DevtoolsEntitySnapshotResponseMessage;
    const result = response.result as { readonly total?: unknown };

    if (response.ok && result.total === options.total) {
      return response;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(
    `Timed out waiting for generated worker snapshot '${options.label}' with total=${options.total}.`,
  );
}

function isSimulationWorkerSnapshotMessage(value: unknown): value is {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.snapshot;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly type?: unknown }).type ===
      SIMULATION_WORKER_PROTOCOL.snapshot
  );
}

function simulationSnapshotWithFrame(
  frame: number,
): (value: unknown) => value is SimulationWorkerSnapshotMessage {
  return (value: unknown): value is SimulationWorkerSnapshotMessage =>
    isSimulationWorkerSnapshotMessage(value) &&
    (value as { readonly frame?: unknown }).frame === frame;
}

function isSimulationWorkerErrorMessage(value: unknown): value is {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.error;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly type?: unknown }).type ===
      SIMULATION_WORKER_PROTOCOL.error
  );
}

interface DevtoolsStepResponseMessage {
  readonly requestId: string;
  readonly ok: boolean;
  readonly result: {
    readonly fixedStep: {
      readonly enabled?: boolean;
      readonly fixedDelta?: number;
      readonly substeps: number;
      readonly fixedStepStart: number;
      readonly fixedStepEnd: number;
      readonly overstepAlpha?: number;
    };
    readonly physics?: unknown;
  };
}

interface DevtoolsStepAndDiffResponseMessage {
  readonly requestId: string;
  readonly ok: boolean;
  readonly result: {
    readonly step: DevtoolsStepResponseMessage["result"];
    readonly diff: unknown;
  };
}

interface DevtoolsPhysicsSummary {
  readonly eventKinds: Readonly<Record<string, number>>;
  readonly events: readonly PhysicsEvent[];
}

interface DevtoolsPhysicsDebugGeometryResponseMessage {
  readonly requestId: string;
  readonly ok: boolean;
  readonly result: {
    readonly options?: {
      readonly broadphaseAabbs?: boolean;
    };
    readonly geometry: {
      readonly lines: readonly DevtoolsPhysicsDebugLine[];
    };
  };
}

interface DevtoolsPhysicsDebugSummaryResponseMessage {
  readonly requestId: string;
  readonly ok: boolean;
  readonly result: {
    readonly summary: {
      readonly lineCount: number;
      readonly finiteLineCount: number;
      readonly invalidLineCount: number;
      readonly colorCount: number;
      readonly colors: readonly {
        readonly color: readonly number[];
        readonly lineCount: number;
      }[];
      readonly bounds: {
        readonly min: readonly number[];
        readonly max: readonly number[];
      } | null;
    };
  };
}

interface DevtoolsPhysicsDebugLine {
  readonly from: readonly number[];
  readonly to: readonly number[];
  readonly color: readonly number[];
}

interface DevtoolsEntitySnapshotResponseMessage {
  readonly requestId: string;
  readonly ok: boolean;
  readonly result: unknown;
}

interface DevtoolsEntityDiffResponseMessage {
  readonly requestId: string;
  readonly ok: boolean;
  readonly result: unknown;
}

interface DevtoolsEntityMutationResponseMessage {
  readonly requestId: string;
  readonly ok: boolean;
  readonly result: unknown;
}

interface SimulationWorkerSnapshotMessage {
  readonly type: typeof SIMULATION_WORKER_PROTOCOL.snapshot;
  readonly snapshot: {
    readonly meshDraws: readonly {
      readonly entity: { readonly index: number; readonly generation: number };
      readonly worldTransformOffset: number;
    }[];
    readonly transforms: Float32Array;
  };
  readonly frame?: number;
  readonly workerSummary: {
    readonly physics: unknown;
  };
}

function isDevtoolsResponseMessage(
  value: unknown,
): value is DevtoolsStepResponseMessage {
  return devtoolsResponseWithId("step-fixed")(value);
}

function devtoolsResponseWithId(
  requestId: string,
): (value: unknown) => value is DevtoolsStepResponseMessage {
  return (value: unknown): value is DevtoolsStepResponseMessage =>
    typeof value === "object" &&
    value !== null &&
    (value as { readonly type?: unknown }).type ===
      "aperture.devtools.response" &&
    (value as { readonly requestId?: unknown }).requestId === requestId;
}
