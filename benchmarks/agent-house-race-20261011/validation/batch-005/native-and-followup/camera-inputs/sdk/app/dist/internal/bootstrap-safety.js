const cleanupFailures = [];
/** A failed disposer cannot prove that old timers/callbacks have stopped. */
export function recordApertureCleanupFailures(errors) {
    cleanupFailures.push(...errors);
}
export function getApertureCleanupFailures() {
    return cleanupFailures.slice();
}
export function assertApertureBootstrapAllowed() {
    if (cleanupFailures.length === 0)
        return;
    const error = new Error("A previous Aperture cleanup failed; starting another ECS world in this process is unsafe. Restart the process before starting or resetting a session.", {
        cause: new AggregateError(cleanupFailures, "Previous cleanup failures."),
    });
    Object.assign(error, { code: "aperture.app.cleanupBlocked" });
    throw error;
}
//# sourceMappingURL=bootstrap-safety.js.map