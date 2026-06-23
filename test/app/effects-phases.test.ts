import { describe, expect, it } from "vitest";

import { createApertureApp } from "@aperture-engine/app";
import { defineApertureConfig, signal } from "@aperture-engine/app/config";
import { createSystem } from "@aperture-engine/app/systems";

describe("app effect phases", () => {
  it("flushes update-phase effects during headless app steps", async () => {
    const events: string[] = [];

    class UpdateEffectSystem extends createSystem({ priority: 0 }) {
      override init(): void {
        this.effects.watch(
          this.signals.mode!,
          (mode) => {
            events.push(`effect:${mode}`);
          },
          { phase: "update" },
        );
      }

      override update(): void {
        if (this.signals.mode!.value !== "idle") {
          return;
        }

        events.push("update");
        this.signals.mode!.value = "running";
      }
    }

    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        signals: { mode: signal.string("idle") },
      }),
      systems: [{ default: UpdateEffectSystem }],
    });

    const report = app.step(1 / 60, 0);

    expect(events).toEqual(["update", "effect:running"]);
    expect(report.timing.updateEffectsMilliseconds).toBeGreaterThanOrEqual(0);
  });
});
