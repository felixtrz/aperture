import { ApertureSystemError } from "./errors.js";
export function createFixedStepAccess(registerTask) {
    return {
        available: registerTask !== undefined,
        register(task, options) {
            if (registerTask === undefined) {
                throw new ApertureSystemError("aperture.fixedStep.unavailable", "Fixed-step task registration is unavailable for this system context.", "Create systems through createApertureApp() so the app can connect fixed-step tasks to the runtime scheduler.");
            }
            return registerTask(task, options);
        },
    };
}
//# sourceMappingURL=fixed-step.js.map