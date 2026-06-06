import { describe, expect, it } from "vitest";
import {
  LocalTransform,
  Parent,
  WorldTransform,
  createParent,
  createRootTransform,
  createSystem,
} from "@aperture-engine/simulation";
import {
  createSimulationApp,
  type SimulationFixedStepContext,
} from "@aperture-engine/runtime";

describe("runtime fixed-step scheduling", () => {
  it("keeps fixed stepping disabled by default while preserving variable updates", () => {
    const order: string[] = [];
    const VariableSystemBase = createSystem();

    class VariableSystem extends VariableSystemBase {
      override update(delta: number, time: number): void {
        order.push(`variable:${delta}:${time}`);
      }
    }

    const app = createSimulationApp();

    app.registerSystem(VariableSystem);
    app.registerFixedStepTask(() => order.push("fixed"));

    const result = app.step(1 / 60, 1);

    expect(order).toEqual([`variable:${1 / 60}:1`]);
    expect(result.fixedStep).toEqual({
      enabled: false,
      substeps: 0,
      fixedDelta: 0,
      fixedStepStart: 0,
      fixedStepEnd: 0,
      overstepAlpha: 0,
      consumedTime: 0,
      droppedTime: 0,
      clamped: false,
    });
  });

  it("accumulates zero, one, and capped many fixed substeps deterministically", () => {
    const contexts: Pick<
      SimulationFixedStepContext,
      "fixedStep" | "substep" | "substeps" | "frameDelta" | "frameTime"
    >[] = [];
    const app = createSimulationApp({
      fixedStep: {
        fixedDelta: 0.1,
        maxSubsteps: 2,
        update(context) {
          contexts.push({
            fixedStep: context.fixedStep,
            substep: context.substep,
            substeps: context.substeps,
            frameDelta: context.frameDelta,
            frameTime: context.frameTime,
          });
        },
      },
    });

    const zero = app.step(0.05, 1);
    const one = app.step(0.05, 1.05);
    const cappedMany = app.step(0.35, 1.4);

    expect(zero.fixedStep).toMatchObject({
      enabled: true,
      substeps: 0,
      fixedStepStart: 0,
      fixedStepEnd: 0,
      clamped: false,
    });
    expect(zero.fixedStep.overstepAlpha).toBeCloseTo(0.5, 5);

    expect(one.fixedStep).toMatchObject({
      enabled: true,
      substeps: 1,
      fixedStepStart: 0,
      fixedStepEnd: 1,
      consumedTime: 0.1,
      clamped: false,
    });

    expect(cappedMany.fixedStep).toMatchObject({
      enabled: true,
      substeps: 2,
      fixedStepStart: 1,
      fixedStepEnd: 3,
      consumedTime: 0.2,
      clamped: true,
    });
    expect(cappedMany.fixedStep.droppedTime).toBeCloseTo(0.15, 5);

    expect(contexts).toEqual([
      {
        fixedStep: 0,
        substep: 0,
        substeps: 1,
        frameDelta: 0.05,
        frameTime: 1.05,
      },
      {
        fixedStep: 1,
        substep: 0,
        substeps: 2,
        frameDelta: 0.35,
        frameTime: 1.4,
      },
      {
        fixedStep: 2,
        substep: 1,
        substeps: 2,
        frameDelta: 0.35,
        frameTime: 1.4,
      },
    ]);
  });

  it("runs fixed substeps after variable systems and before transform resolution", () => {
    const order: string[] = [];
    const VariableSystemBase = createSystem();

    class VariableSystem extends VariableSystemBase {
      override update(_delta: number, _time: number): void {
        order.push("variable");
      }
    }

    const app = createSimulationApp({
      fixedStep: {
        fixedDelta: 0.1,
        update(context) {
          order.push(`fixed:${context.fixedStep}`);
          actor
            .getVectorView(LocalTransform, "translation")
            .set([context.fixedStep + 1, 2, 3]);
        },
      },
    });
    const actor = app.world.createEntity();
    const root = createRootTransform();

    actor.addComponent(LocalTransform, root.local);
    actor.addComponent(Parent, createParent(null));
    actor.addComponent(WorldTransform, root.world);
    app.registerSystem(VariableSystem);

    const result = app.step(0.2, 2);
    const worldTranslation = Array.from(
      actor.getVectorView(WorldTransform, "col3"),
    );

    expect(result.fixedStep).toMatchObject({
      enabled: true,
      substeps: 2,
      fixedStepStart: 0,
      fixedStepEnd: 2,
    });
    expect(order).toEqual(["variable", "fixed:0", "fixed:1"]);
    expect(worldTranslation).toEqual([2, 2, 3, 1]);
  });

  it("registers, disposes, and resets fixed-step tasks after app creation", () => {
    const order: string[] = [];
    const app = createSimulationApp({
      fixedStep: { fixedDelta: 0.1, maxSubsteps: 4 },
    });
    const disposeA = app.registerFixedStepTask((context) => {
      order.push(`a:${context.fixedStep}:${context.fixedStartTime.toFixed(1)}`);
    });

    app.registerFixedStepTask((context) => {
      order.push(`b:${context.fixedStep}:${context.fixedEndTime.toFixed(1)}`);
    });

    app.step(0.2, 1);
    disposeA();
    app.step(0.1, 1.1);
    app.resetFixedStepClock();
    app.step(0.1, 1.2);

    expect(order).toEqual([
      "a:0:0.0",
      "b:0:0.1",
      "a:1:0.1",
      "b:1:0.2",
      "b:2:0.3",
      "b:0:0.1",
    ]);
  });
});
