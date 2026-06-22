import { describe, expect, it } from "vitest";
import { createParent } from "@aperture-engine/simulation";
import {
  Pickable,
  UiHitTarget,
  UiNode,
  UiPanel,
  UiScreen,
  createPickable,
  createUiHitTarget,
  createUiNode,
  createUiPanel,
  createUiScreen,
} from "@aperture-engine/render";
import { defineApertureConfig } from "@aperture-engine/app/config";
import {
  createSystem,
  material,
  mesh,
  Parent,
} from "@aperture-engine/app/systems";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";
import type { EcsEntityRef } from "@aperture-engine/app/config";

interface UiInteractionCounts {
  readonly refs: {
    ui: EcsEntityRef | null;
    mesh: EcsEntityRef | null;
  };
  uiEnter: number;
  uiDown: number;
  uiUp: number;
  uiClick: number;
  meshClick: number;
  hovered: EcsEntityRef | null;
}

describe("UI interaction bridge (M6-T6)", () => {
  it("hits topmost UI regions and blocks the 3D pick behind the UI", async () => {
    const counts = createCounts();
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        systems: [],
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [routeSystem(counts)],
    });

    runner.app.context.input.pointer.primary.position.value = [0.5, 0.5];
    runner.app.context.input.pointer.primary.pressed.value = false;
    runner.step(1 / 60, 0);

    expect(counts.uiEnter).toBe(1);
    expect(counts.hovered).toEqual(counts.refs.ui);

    runner.app.context.input.pointer.primary.pressed.value = true;
    runner.step(1 / 60, 0.1);
    runner.app.context.input.pointer.primary.pressed.value = false;
    runner.step(1 / 60, 0.2);

    expect(counts.uiDown).toBe(1);
    expect(counts.uiUp).toBe(1);
    expect(counts.uiClick).toBe(1);
    expect(counts.meshClick).toBe(0);
  });
});

function createCounts(): UiInteractionCounts {
  return {
    refs: { ui: null, mesh: null },
    uiEnter: 0,
    uiDown: 0,
    uiUp: 0,
    uiClick: 0,
    meshClick: 0,
    hovered: null,
  };
}

function routeSystem(counts: UiInteractionCounts): ApertureSystemModule {
  return {
    default: class UiInteractionRouteSystem extends createSystem({
      priority: 0,
    }) {
      override init(): void {
        this.spawn.camera({
          key: "camera.main",
          transform: { translation: [0, 0, 5], lookAt: [0, 0, 0] },
          fovYDegrees: 60,
        });
        const meshEntity = this.spawn.mesh({
          key: "blocked-mesh",
          mesh: mesh.box({ size: [2, 2, 2] }),
          material: material.standard(),
          transform: { translation: [0, 0, 0] },
        });
        meshEntity.addComponent(Pickable, createPickable({ enabled: true }));

        const screen = this.createEntity();
        screen.addComponent(
          UiScreen,
          createUiScreen({ width: 400, height: 300 }),
        );

        const button = this.createEntity();
        button.addComponent(Parent, createParent(screen));
        button.addComponent(
          UiNode,
          createUiNode({
            x: 120,
            y: 95,
            width: 160,
            height: 110,
            zIndex: 4,
          }),
        );
        button.addComponent(UiPanel, createUiPanel({ color: [1, 0, 0, 1] }));
        button.addComponent(
          UiHitTarget,
          createUiHitTarget({
            blocksInput: true,
            cursor: "pointer",
            priority: 10,
          }),
        );

        counts.refs.ui = {
          index: button.index,
          generation: button.generation,
        };
        counts.refs.mesh = {
          index: meshEntity.index,
          generation: meshEntity.generation,
        };

        this.interaction.onEnter(counts.refs.ui, () => {
          counts.uiEnter += 1;
          counts.hovered = this.interaction.hoveredEntity();
        });
        this.interaction.onDown(counts.refs.ui, () => {
          counts.uiDown += 1;
        });
        this.interaction.onUp(counts.refs.ui, () => {
          counts.uiUp += 1;
        });
        this.interaction.onClick(counts.refs.ui, () => {
          counts.uiClick += 1;
        });
        this.interaction.onClick(counts.refs.mesh, () => {
          counts.meshClick += 1;
        });
      }
    },
  };
}
