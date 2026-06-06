import type { SimulationFixedStepCallback } from "@aperture-engine/runtime";
import { ApertureSystemError } from "./errors.js";

export interface FixedStepAccess {
  register(task: SimulationFixedStepCallback): () => void;
}

export type FixedStepTaskRegistrar = (
  task: SimulationFixedStepCallback,
) => () => void;

export function createFixedStepAccess(
  registerTask?: FixedStepTaskRegistrar,
): FixedStepAccess {
  return {
    register(task) {
      if (registerTask === undefined) {
        throw new ApertureSystemError(
          "aperture.fixedStep.unavailable",
          "Fixed-step task registration is unavailable for this system context.",
          "Create systems through createApertureApp() so the app can connect fixed-step tasks to the runtime scheduler.",
        );
      }

      return registerTask(task);
    },
  };
}
