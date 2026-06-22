import { createParent } from "@aperture-engine/simulation";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import {
  createSystem,
  material,
  mesh,
  Parent,
} from "@aperture-engine/app/systems";
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
import { configureApertureExampleControl } from "./example-control.js";

const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
let latestStatus = null;

const counts = {
  uiEnter: 0,
  uiDown: 0,
  uiUp: 0,
  uiClick: 0,
  meshClick: 0,
};
let uiRef = null;
let meshRef = null;
let clickPoint = null;

class UiInteractionSetupSystem extends createSystem({ priority: 0 }) {
  init() {
    this.spawn.camera({
      key: "camera.main",
      transform: { translation: [0, 0, 5], lookAt: [0, 0, 0] },
      fovYDegrees: 60,
      camera: { aspect: 16 / 9 },
    });

    const meshEntity = this.spawn.mesh({
      key: "ui-interaction.blocked-mesh",
      name: "blocked mesh",
      mesh: mesh.box({ size: [2, 2, 2] }),
      material: material.standard({ baseColor: [0.2, 0.6, 1, 1] }),
    });
    meshEntity.addComponent(Pickable, createPickable({ enabled: true }));

    const screen = this.createEntity();
    screen.addComponent(UiScreen, createUiScreen({ width: 400, height: 300 }));

    const button = this.createEntity();
    button.addComponent(Parent, createParent(screen));
    button.addComponent(
      UiNode,
      createUiNode({
        x: 120,
        y: 95,
        width: 160,
        height: 110,
        zIndex: 5,
      }),
    );
    button.addComponent(UiPanel, createUiPanel({ color: [1, 0.08, 0.2, 1] }));
    button.addComponent(
      UiHitTarget,
      createUiHitTarget({
        blocksInput: true,
        cursor: "pointer",
        priority: 10,
      }),
    );

    uiRef = entityRef(button);
    meshRef = entityRef(meshEntity);

    this.interaction.onEnter(uiRef, () => {
      counts.uiEnter += 1;
    });
    this.interaction.onDown(uiRef, () => {
      counts.uiDown += 1;
    });
    this.interaction.onUp(uiRef, () => {
      counts.uiUp += 1;
    });
    this.interaction.onClick(uiRef, (event) => {
      counts.uiClick += 1;
      clickPoint = event.point ?? null;
    });
    this.interaction.onClick(meshRef, () => {
      counts.meshClick += 1;
    });
  }
}

configureApertureExampleControl({
  getStatus: () => latestStatus,
});

try {
  const app = await createApertureApp({
    config: defineApertureConfig({
      mode: "headless",
      systems: [],
      render: { defaultCamera: false, defaultLight: false },
    }),
    systems: [{ default: UiInteractionSetupSystem }],
  });
  const pointer = app.context.input.pointer.primary;
  let time = 0;
  const frame = (position, pressed) => {
    if (position !== null) pointer.position.value = position;
    if (pressed !== null) pointer.pressed.value = pressed;
    time += 1 / 60;
    app.step(1 / 60, time);
  };

  frame([0.5, 0.5], false);
  frame(null, true);
  frame(null, false);

  const hoveredEntity = app.context.interaction.hoveredEntity();
  const ok =
    uiRef !== null &&
    meshRef !== null &&
    counts.uiEnter === 1 &&
    counts.uiDown === 1 &&
    counts.uiUp === 1 &&
    counts.uiClick === 1 &&
    counts.meshClick === 0 &&
    hoveredEntity?.index === uiRef.index &&
    hoveredEntity?.generation === uiRef.generation &&
    clickPoint !== null;

  publishStatus({
    example: "ui-interaction",
    ok,
    phase: ok ? "ready" : "failed",
    domListeners: false,
    scene: {
      ui: uiRef,
      blockedMesh: meshRef,
    },
    interaction: {
      counts: { ...counts },
      hoveredEntity,
      clickPoint: clickPoint === null ? null : tuple3(clickPoint),
      blocks3dPick: counts.uiClick === 1 && counts.meshClick === 0,
    },
  });
} catch (error) {
  publishStatus({
    example: "ui-interaction",
    ok: false,
    phase: "failed",
    reason: "ui-interaction-failed",
    message:
      error instanceof Error ? error.message : "UI interaction route failed.",
  });
}

function publishStatus(status) {
  latestStatus = status;
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function entityRef(entity) {
  return {
    index: entity.index,
    generation: entity.generation,
  };
}

function tuple3(value) {
  return [value[0], value[1], value[2]];
}
