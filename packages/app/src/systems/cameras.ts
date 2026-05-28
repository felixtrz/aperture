import { Camera } from "@aperture-engine/render";
import type { EcsWorld, Entity } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
import type { RayInput } from "../spatial-queries.js";
import { AppEntityKey } from "./components.js";
import { ApertureSystemError } from "./errors.js";

export interface CameraHandle {
  readonly entity: Entity;
  readonly ref: EcsEntityRef;
  rayFromPointer(position: readonly [number, number]): RayInput;
}

export interface CameraAccess {
  readonly main: CameraHandle;
  readonly active: readonly CameraHandle[];
  byKey(key: string): CameraHandle | null;
}

export function createCameraAccess(
  world: EcsWorld,
  options: {
    readonly contextKey?: string;
  } = {},
): CameraAccess {
  function handles(): CameraHandle[] {
    if (options.contextKey !== undefined) {
      const systemsContext = world.globals[options.contextKey];
      void systemsContext;
    }

    const entities = collectCameraEntities(world);
    return entities.map(cameraHandle);
  }

  const access: CameraAccess = {
    get main() {
      return access.byKey("camera.main") ?? handles()[0] ?? fallbackCamera();
    },
    get active() {
      return handles();
    },
    byKey(key) {
      for (const entity of collectCameraEntities(world)) {
        if (
          entity.hasComponent(AppEntityKey) &&
          entity.getValue(AppEntityKey, "value") === key
        ) {
          return cameraHandle(entity);
        }
      }

      return null;
    },
  };

  return access;
}

function collectCameraEntities(world: EcsWorld): Entity[] {
  return world
    .getSystems()
    .flatMap(() => [] as Entity[])
    .concat(collectEntitiesByComponents(world));
}

function collectEntitiesByComponents(world: EcsWorld): Entity[] {
  const query = world.queryManager.registerQuery({ required: [Camera] });
  return [...query.entities];
}

function cameraHandle(entity: Entity): CameraHandle {
  return {
    entity,
    ref: entityRef(entity),
    rayFromPointer(position) {
      return {
        origin: [position[0], position[1], 1],
        direction: [0, 0, -1],
      };
    },
  };
}

function fallbackCamera(): CameraHandle {
  throw new ApertureSystemError(
    "aperture.camera.missing",
    "No camera entity is available.",
    "Spawn a camera in a setup system or enable render.defaultCamera in aperture.config.ts.",
  );
}

function entityRef(entity: Entity): EcsEntityRef {
  return { index: entity.index, generation: entity.generation };
}
