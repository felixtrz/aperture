import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { configureApertureExampleControl } from "./example-control.js";

const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
let latestStatus = null;
let targetRef = null;
let decoyRef = null;

class AutoPickingSetupSystem extends createSystem({ priority: 0 }) {
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
      key: "auto-pick.target",
      name: "auto-pick target",
      mesh: mesh.plane({ size: [2, 2] }),
      material: material.standard({
        baseColor: [1, 0.48, 0.18, 1],
        roughness: 0.45,
      }),
    });
    const decoy = this.spawn.mesh({
      key: "auto-pick.decoy",
      name: "auto-pick decoy",
      mesh: mesh.plane({ size: [2, 2] }),
      material: material.standard({
        baseColor: [0.2, 0.5, 1, 1],
        roughness: 0.55,
      }),
      transform: {
        translation: [3, 0, 0],
      },
    });

    targetRef = entityRef(target);
    decoyRef = entityRef(decoy);
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
    systems: [{ default: AutoPickingSetupSystem }],
  });

  app.step(1 / 60, 0);

  const ray = app.context.cameras.main.rayFromPointer([0.5, 0.5]);
  const hit = app.context.spatial.raycastFirst(ray, {
    source: "visual-mesh",
    includeBackfaces: true,
    includeNormal: true,
    includeUv: true,
  });
  const ok =
    hit?.source === "mesh-bvh" &&
    targetRef !== null &&
    hit.entity.ref.index === targetRef.index &&
    hit.entity.ref.generation === targetRef.generation;

  publishStatus({
    example: "auto-picking",
    ok,
    phase: ok ? "ready" : "failed",
    manualSpatialSetup: false,
    scene: {
      target: targetRef,
      decoy: decoyRef,
    },
    picking: {
      pointer: [0.5, 0.5],
      ray: {
        origin: tuple3(ray.origin),
        direction: tuple3(ray.direction),
      },
      hit:
        hit === null
          ? null
          : {
              entity: hit.entity.ref,
              source: hit.source,
              distance: hit.distance,
              point: hit.point,
              normal: hit.normal ?? null,
              uv: hit.uv ?? null,
              faceIndex: hit.faceIndex ?? null,
              submeshIndex: hit.submeshIndex ?? null,
              materialSlot: hit.materialSlot ?? null,
            },
    },
  });
} catch (error) {
  publishStatus({
    example: "auto-picking",
    ok: false,
    phase: "failed",
    reason: "auto-picking-failed",
    message:
      error instanceof Error ? error.message : "Auto picking route failed.",
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
