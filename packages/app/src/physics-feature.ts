import type { ApertureWorkerFeature } from "./features.js";
import {
  installApertureAppPhysics,
  type AperturePhysicsConfig,
  type AperturePhysicsFacade,
} from "./physics-facade.js";
import type { PhysicsAccess } from "./systems/physics.js";

export interface AperturePhysicsFeature extends ApertureWorkerFeature {
  readonly id: "physics";
  getFacade(): AperturePhysicsFacade | null;
}

export interface CreateAperturePhysicsFeatureOptions {
  readonly config: AperturePhysicsConfig;
  readonly physics: PhysicsAccess;
}

export function createAperturePhysicsFeature(
  options: CreateAperturePhysicsFeatureOptions,
): AperturePhysicsFeature {
  let facade: AperturePhysicsFacade | null = null;

  return {
    id: "physics",
    async installRuntime(context) {
      facade = await installApertureAppPhysics({
        world: context.world,
        assets: context.assets,
        physics: options.physics,
        config: options.config,
        registerFixedStepTask: context.registerFixedStepTask,
      });

      return () => {
        facade?.dispose();
        facade = null;
      };
    },
    getFacade() {
      return facade;
    },
  };
}
