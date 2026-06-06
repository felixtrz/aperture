import { describe, expect, it } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { createSystem } from "@aperture-engine/app/systems";

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
});
