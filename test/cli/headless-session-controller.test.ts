import { describe, expect, it } from "vitest";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem } from "@aperture-engine/app/systems";
import { createHeadlessSessionController } from "../../packages/cli/src/headless/session-controller.js";

describe("HeadlessSessionController", () => {
  it("advances multi-frame step time by one delta per frame", async () => {
    const times: number[] = [];
    const controller = await createHeadlessSessionController({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [
        {
          default: class TimingSystem extends createSystem() {
            override update(): void {
              times.push(this.time.elapsed);
            }
          },
        },
      ],
      seed: 0,
      assetMode: "placeholder",
      root: process.cwd(),
      publicDir: "public",
      allowHttpAssets: false,
      determinism: "off",
    });

    try {
      controller.step({ frames: 3, delta: 0.5 });
      expect(times).toEqual([0, 0.5, 1]);

      times.length = 0;
      controller.step({ frames: 3, delta: 0.5, time: 10 });
      expect(times).toEqual([10, 10.5, 11]);
    } finally {
      controller.dispose();
    }
  });

  it("exposes headless system metadata through ecs_list_systems", async () => {
    const controller = await createHeadlessSessionController({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [
        {
          default: class ListedSystem extends createSystem({ priority: 7 }) {},
        },
      ],
      seed: 0,
      assetMode: "placeholder",
      root: process.cwd(),
      publicDir: "public",
      allowHttpAssets: false,
      determinism: "off",
    });

    try {
      expect(
        controller.callTool({ name: "ecs_list_systems", arguments: {} }),
      ).toMatchObject({
        ok: true,
        result: {
          systems: [
            {
              className: "ListedSystem",
              schedule: { priority: 7 },
            },
          ],
        },
      });
    } finally {
      controller.dispose();
    }
  });
});
