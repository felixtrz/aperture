import { describe, expect, it } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import type { Entity } from "@aperture-engine/simulation";
import {
  APERTURE_HTML_BRIDGE_COMMAND_CHANNEL,
  AppEntityKey,
  LocalTransform,
  ScreenSpaceFraming,
  WorldTransform,
  createScreenSpaceFraming,
  createSystem,
  type HtmlBridgeCommand,
  type HtmlBridgeRect,
  type HtmlSlotSnapshot,
} from "@aperture-engine/app/systems";

describe("HTML bridge and screen-space framing", () => {
  it("makes browser slot snapshots available to app systems", async () => {
    let observed: HtmlSlotSnapshot | null = null;
    const SlotReaderSystem = class extends createSystem({ priority: 0 }) {
      override update(): void {
        observed = this.html.slot("story-card");
      }
    };
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [{ default: SlotReaderSystem }],
    });

    queueSlot(app, {
      kind: "slot",
      slot: " story-card ",
      rect: rect(160, 80, 320, 240),
      viewport: viewport(800, 600),
      visible: true,
      sequence: 7,
      time: 12,
    });
    app.step(1 / 60, 1 / 60);

    expect(observed).toMatchObject({
      slot: "story-card",
      rect: { left: 160, top: 80, width: 320, height: 240 },
      visible: true,
      sequence: 7,
    });
  });

  it("frames a subject into a changed HTML slot with smoothed camera motion", async () => {
    let camera: Entity | null = null;
    const FramingSetupSystem = class extends createSystem({ priority: 0 }) {
      override init(): void {
        const subject = this.createEntity();
        subject.addComponent(AppEntityKey, { value: "subject.product" });
        subject.addComponent(LocalTransform);
        subject.addComponent(WorldTransform);

        camera = this.spawn.camera({
          key: "camera.main",
          transform: { translation: [0, 0, 8], lookAt: [0, 0, 0] },
          fovYDegrees: 60,
        });
        camera.addComponent(
          ScreenSpaceFraming,
          createScreenSpaceFraming({
            subject,
            slot: "product-frame",
            boundsMin: [-1, -1, -1],
            boundsMax: [1, 1, 1],
            yawRadians: 0,
            pitchRadians: 0,
            smoothingRate: 4,
          }),
        );
      }
    };
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [{ default: FramingSetupSystem }],
    });

    queueSlot(app, slotCommand("product-frame", rect(200, 150, 400, 300), 1));
    app.step(1 / 60, 1 / 60);
    expect(camera).not.toBeNull();
    const first = readTranslation(camera!);

    queueSlot(app, slotCommand("product-frame", rect(400, 150, 400, 300), 2));
    app.step(1 / 60, 2 / 60);
    const smoothed = readTranslation(camera!);

    camera!.setValue(ScreenSpaceFraming, "initialized", false);
    camera!.setValue(ScreenSpaceFraming, "smoothingRate", 0);
    const targetSlot = rect(400, 150, 400, 300);
    queueSlot(app, slotCommand("product-frame", targetSlot, 3));
    app.step(1 / 60, 3 / 60);
    const immediate = readTranslation(camera!);

    expect(smoothed[0]).not.toBeCloseTo(first[0], 5);
    expect(Math.abs(smoothed[0] - first[0])).toBeLessThan(
      Math.abs(immediate[0] - first[0]),
    );
    expect(Math.abs(immediate[0] - first[0])).toBeGreaterThan(0.5);
    const projected = projectTestBounds(immediate);
    expect(projected.top).toBeCloseTo(targetSlot.top, 1);
    expect(projected.bottom).toBeCloseTo(targetSlot.bottom, 1);
    expect(projected.left).toBeGreaterThanOrEqual(targetSlot.left);
    expect(projected.right).toBeLessThanOrEqual(targetSlot.right);
    expect((projected.left + projected.right) / 2).toBeCloseTo(
      targetSlot.left + targetSlot.width / 2,
      1,
    );

    camera!.setValue(ScreenSpaceFraming, "enabled", false);
    const disabledStart = readTranslation(camera!);
    queueSlot(app, slotCommand("product-frame", rect(0, 150, 400, 300), 4));
    app.step(1 / 60, 4 / 60);
    expect(readTranslation(camera!)).toEqual(disabledStart);
  });

  it("frames inset bounds while allowing the full subject to overflow the slot", async () => {
    let camera: Entity | null = null;
    const InsetSetupSystem = class extends createSystem({ priority: 0 }) {
      override init(): void {
        const subject = this.createEntity();
        subject.addComponent(AppEntityKey, { value: "subject.inset-product" });
        subject.addComponent(LocalTransform);
        subject.addComponent(WorldTransform);

        camera = this.spawn.camera({
          key: "camera.inset",
          transform: { translation: [0, 0, 8], lookAt: [0, 0, 0] },
          fovYDegrees: 60,
        });
        camera.addComponent(
          ScreenSpaceFraming,
          createScreenSpaceFraming({
            subject,
            slot: "product-frame",
            boundsMin: [-1, -1, -1],
            boundsMax: [1, 1, 1],
            boundsInsetMax: [0, 1, 0],
            yawRadians: 0,
            pitchRadians: 0,
            smoothingRate: 0,
          }),
        );
      }
    };
    const app = await createApertureApp({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [{ default: InsetSetupSystem }],
    });
    const targetSlot = rect(200, 150, 400, 300);

    queueSlot(app, slotCommand("product-frame", targetSlot, 1));
    app.step(1 / 60, 1 / 60);
    expect(camera).not.toBeNull();
    const translation = readTranslation(camera!);
    const insetProjection = projectTestBounds(translation, {
      min: [-1, -1, -1],
      max: [1, 0, 1],
    });
    const fullProjection = projectTestBounds(translation);

    expect(insetProjection.left).toBeGreaterThanOrEqual(targetSlot.left);
    expect(insetProjection.right).toBeLessThanOrEqual(targetSlot.right);
    expect(insetProjection.top).toBeGreaterThanOrEqual(targetSlot.top);
    expect(insetProjection.bottom).toBeLessThanOrEqual(targetSlot.bottom);
    expect((insetProjection.top + insetProjection.bottom) / 2).toBeCloseTo(
      targetSlot.top + targetSlot.height / 2,
      1,
    );
    expect(fullProjection.top).toBeLessThan(targetSlot.top);
  });
});

function queueSlot(
  app: Awaited<ReturnType<typeof createApertureApp>>,
  command: HtmlBridgeCommand,
): void {
  app.context.commands.queue(APERTURE_HTML_BRIDGE_COMMAND_CHANNEL, command);
}

function slotCommand(
  slot: string,
  slotRect: HtmlBridgeRect,
  sequence: number,
): HtmlBridgeCommand {
  return {
    kind: "slot",
    slot,
    rect: slotRect,
    viewport: viewport(800, 600),
    visible: true,
    sequence,
    time: sequence,
  };
}

function rect(
  left: number,
  top: number,
  width: number,
  height: number,
): HtmlBridgeRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

function viewport(width: number, height: number) {
  return {
    width,
    height,
    devicePixelRatio: 1,
    scrollX: 0,
    scrollY: 0,
  };
}

function readTranslation(entity: Entity): readonly [number, number, number] {
  const translation = entity.getVectorView(LocalTransform, "translation");
  return [translation[0] ?? 0, translation[1] ?? 0, translation[2] ?? 0];
}

function projectTestBounds(
  cameraPosition: readonly [number, number, number],
  bounds: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  } = {
    min: [-1, -1, -1],
    max: [1, 1, 1],
  },
) {
  const viewport = { width: 800, height: 600 };
  const aspect = viewport.width / viewport.height;
  const tanY = Math.tan(Math.PI / 6);
  const { min, max } = bounds;
  const corners = [
    [min[0], min[1], min[2]],
    [min[0], min[1], max[2]],
    [min[0], max[1], min[2]],
    [min[0], max[1], max[2]],
    [max[0], min[1], min[2]],
    [max[0], min[1], max[2]],
    [max[0], max[1], min[2]],
    [max[0], max[1], max[2]],
  ] as const;
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const corner of corners) {
    const cameraX = corner[0] - cameraPosition[0];
    const cameraY = corner[1] - cameraPosition[1];
    const depth = cameraPosition[2] - corner[2];
    const ndcX = cameraX / (depth * tanY * aspect);
    const ndcY = cameraY / (depth * tanY);
    const screenX = (0.5 + ndcX * 0.5) * viewport.width;
    const screenY = (0.5 - ndcY * 0.5) * viewport.height;

    left = Math.min(left, screenX);
    right = Math.max(right, screenX);
    top = Math.min(top, screenY);
    bottom = Math.max(bottom, screenY);
  }

  return { left, right, top, bottom };
}
