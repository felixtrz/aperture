import type {
  SimulationFixedStepCallback,
  SimulationFixedStepTaskOptions,
} from "@aperture-engine/runtime";
import { ApertureSystemError } from "./errors.js";

export interface FixedStepAccess {
  readonly available: boolean;
  register(
    task: SimulationFixedStepCallback,
    options?: SimulationFixedStepTaskOptions,
  ): () => void;
}

export type FixedStepTaskRegistrar = (
  task: SimulationFixedStepCallback,
  options?: SimulationFixedStepTaskOptions,
) => () => void;

export function createFixedStepAccess(
  registerTask?: FixedStepTaskRegistrar,
): FixedStepAccess {
  return {
    available: registerTask !== undefined,
    register(task, options) {
      if (registerTask === undefined) {
        throw new ApertureSystemError(
          "aperture.fixedStep.unavailable",
          "Fixed-step task registration is unavailable for this system context.",
          "Create systems through createApertureApp() so the app can connect fixed-step tasks to the runtime scheduler.",
        );
      }

      return registerTask(task, options);
    },
  };
}
