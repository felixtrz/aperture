import { describe, expect, it } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import type { Entity } from "@aperture-engine/simulation";
import {
  LocalTransform,
  RenderInterpolation,
  createSystem,
  material,
  mesh,
  type SimulationFixedStepContext,
} from "@aperture-engine/app/systems";

describe("app fixed-step scheduling", () => {
  it("passes fixed-step options through createApertureApp and preserves variable system order", async () => {
    const order: string[] = [];
    const VariableSystem = class extends createSystem({ priority: 0 }) {
      override update(): void {
        order.push("variable");
      }
    };
    const app = await createApertureApp({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: VariableSystem }],
      fixedStep: {
        fixedDelta: 0.1,
        update(context) {
          order.push(`fixed:${context.fixedStep}`);
        },
      },
    });

    const result = app.step(0.2, 1);

    expect(order).toEqual(["variable", "fixed:0", "fixed:1"]);
    expect(result.fixedStep).toMatchObject({
      enabled: true,
      substeps: 2,
      fixedStepStart: 0,
      fixedStepEnd: 2,
    });
  });

  it("auto-registers system fixedUpdate hooks with system priority ordering", async () => {
    const order: string[] = [];
    const EarlyFixedSystem = class extends createSystem({ priority: -10 }) {
      override fixedUpdate(context: SimulationFixedStepContext): void {
        order.push(`early:${context.fixedStep}`);
      }
    };
    const LateFixedSystem = class extends createSystem({ priority: 20 }) {
      override fixedUpdate(context: SimulationFixedStepContext): void {
        order.push(`late:${context.fixedStep}`);
      }
    };

    const app = await createApertureApp({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: LateFixedSystem }, { default: EarlyFixedSystem }],
      fixedStep: {
        fixedDelta: 0.1,
        update(context) {
          order.push(`runtime:${context.fixedStep}`);
        },
      },
    });

    app.step(0.1, 1);

    expect(order).toEqual(["early:0", "runtime:0", "late:0"]);
  });

  it("interpolates opted-in mesh and camera render snapshots between fixed steps", async () => {
    class MovingRenderSystem extends createSystem({ priority: 10 }) {
      #mesh: Entity | null = null;
      #camera: Entity | null = null;

      override init(): void {
        this.#mesh = this.spawn.mesh({
          key: "moving",
          mesh: mesh.box({ size: 1 }),
          material: material.standard(),
        });
        this.#mesh.addComponent(RenderInterpolation);

        this.#camera = this.spawn.camera({
          key: "camera.main",
          transform: { translation: [0, 0, 5] },
        });
        this.#camera.addComponent(RenderInterpolation);
      }

      override fixedUpdate(): void {
        if (this.#mesh === null || this.#camera === null) {
          return;
        }

        this.#mesh.getVectorView(LocalTransform, "translation").set([10, 0, 0]);
        this.#camera
          .getVectorView(LocalTransform, "translation")
          .set([10, 0, 5]);
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: MovingRenderSystem }],
      fixedStep: { fixedDelta: 1 },
    });

    app.step(1.25, 1.25);
    const snapshot = app.extract(1);
    const draw = snapshot.meshDraws[0];
    const view = snapshot.views[0];

    expect(draw).toBeDefined();
    expect(view).toBeDefined();
    expect(snapshot.transforms[draw!.worldTransformOffset + 12]).toBeCloseTo(
      2.5,
      5,
    );
    expect(snapshot.viewMatrices[view!.viewMatrixOffset + 12]).toBeCloseTo(
      -2.5,
      5,
    );
  });
});
