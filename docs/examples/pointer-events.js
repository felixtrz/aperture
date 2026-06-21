import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { Pickable, createPickable } from "@aperture-engine/render";
import { configureApertureExampleControl } from "./example-control.js";

// M7-T8 render-control route: a Pickable mesh + the public interaction layer.
// The pointer is driven programmatically each frame (no DOM listeners — the
// behaviour is headless/worker-safe) so the route deterministically exercises
// enter/leave, click (down+up over the same entity, sub-threshold movement) and
// drag (down + move past threshold → dragStart/drag/dragEnd) and publishes the
// resulting JSON-safe event counts + the click entity ref / world hit point.

const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
let latestStatus = null;
let targetRef = null;

const counts = {
  enter: 0,
  leave: 0,
  down: 0,
  up: 0,
  click: 0,
  dragStart: 0,
  drag: 0,
  dragEnd: 0,
};
let clickEntity = null;
let clickPoint = null;

class PointerEventsSetupSystem extends createSystem({ priority: 0 }) {
  init() {
    this.spawn.camera({
      key: "camera.main",
      name: "main-camera",
      transform: {
        translation: [0, 0, 5],
        lookAt: [0, 0, 0],
      },
      fovYDegrees: 60,
      camera: {
        aspect: 16 / 9,
      },
    });

    const target = this.spawn.mesh({
      key: "pointer-events.target",
      name: "pointer-events target",
      mesh: mesh.box({ size: [2, 2, 2] }),
      material: material.standard({
        baseColor: [1, 0.48, 0.18, 1],
        roughness: 0.45,
      }),
    });
    target.addComponent(Pickable, createPickable({ enabled: true }));
    targetRef = entityRef(target);

    this.interaction.onEnter(() => {
      counts.enter += 1;
    });
    this.interaction.onLeave(() => {
      counts.leave += 1;
    });
    this.interaction.onDown(() => {
      counts.down += 1;
    });
    this.interaction.onUp(() => {
      counts.up += 1;
    });
    this.interaction.onClick((event) => {
      counts.click += 1;
      clickEntity = event.entity;
      clickPoint = event.point ?? null;
    });
    this.interaction.onDrag((event) => {
      if (event.type === "dragStart") counts.dragStart += 1;
      else if (event.type === "drag") counts.drag += 1;
      else if (event.type === "dragEnd") counts.dragEnd += 1;
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
      render: {
        defaultCamera: false,
        defaultLight: false,
      },
    }),
    systems: [{ default: PointerEventsSetupSystem }],
  });

  const pointer = app.context.input.pointer.primary;
  let time = 0;
  const frame = (position, pressed) => {
    if (position !== null) {
      pointer.position.value = position;
    }
    if (pressed !== null) {
      pointer.pressed.value = pressed;
    }
    time += 1 / 60;
    app.step(1 / 60, time);
  };

  // Hover on -> off -> back on: enter, leave, enter.
  frame([0.5, 0.5], false);
  frame([0.5, 0.97], null);
  frame([0.5, 0.5], null);

  // Press + release over the same entity, no movement -> one click.
  frame(null, true);
  frame(null, false);

  // Press + move past the drag threshold + release -> dragStart/drag/dragEnd.
  frame(null, true);
  frame([0.62, 0.5], null);
  frame(null, false);

  const hoveredEntity = app.context.interaction.hoveredEntity();

  const ok =
    targetRef !== null &&
    counts.enter === 2 &&
    counts.leave === 1 &&
    counts.click === 1 &&
    counts.dragStart === 1 &&
    counts.dragEnd === 1 &&
    counts.drag >= 1 &&
    clickEntity !== null &&
    clickEntity.index === targetRef.index &&
    clickEntity.generation === targetRef.generation &&
    clickPoint !== null;

  publishStatus({
    example: "pointer-events",
    ok,
    phase: ok ? "ready" : "failed",
    domListeners: false,
    scene: {
      target: targetRef,
    },
    interaction: {
      counts: { ...counts },
      hoveredEntity,
      click: {
        entity: clickEntity,
        point: clickPoint === null ? null : tuple3(clickPoint),
      },
    },
  });
} catch (error) {
  publishStatus({
    example: "pointer-events",
    ok: false,
    phase: "failed",
    reason: "pointer-events-failed",
    message:
      error instanceof Error ? error.message : "Pointer events route failed.",
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
  return [read(value, 0), read(value, 1), read(value, 2)];
}

function read(value, index) {
  const next = value[index];

  if (next === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return next;
}
