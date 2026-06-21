import { APERTURE_GENERATED_COMMAND_EVENT, createGeneratedCommandMessage, parseGeneratedCommand, } from "../commands.js";
import { createApertureGeneratedDiagnosticsStatus } from "../diagnostics.js";
import { jsonSafeValue } from "../internal/json-safe.js";
export function installGeneratedCommandForwarding(worker, status, options = {}) {
    window.addEventListener(APERTURE_GENERATED_COMMAND_EVENT, (event) => {
        const command = parseGeneratedCommand(event.detail);
        if (command === null) {
            status.lastCommandEvent = invalidGeneratedCommandDiagnostic(event.detail);
            status.lastFailure = createApertureGeneratedDiagnosticsStatus({
                status: "failed",
                diagnostics: [status.lastCommandEvent],
            });
            status.lastError = status.lastFailure;
            return;
        }
        forwardCommand(worker, status, command);
        options.afterForward?.();
    });
}
function forwardCommand(worker, status, command) {
    worker.postMessage(createGeneratedCommandMessage(command));
    status.forwardedCommandEvents += 1;
    status.lastCommandEvent = command;
}
function invalidGeneratedCommandDiagnostic(detail) {
    return {
        code: "aperture.command.invalid",
        severity: "error",
        message: "Generated Aperture command events require a non-empty channel.",
        data: {
            event: APERTURE_GENERATED_COMMAND_EVENT,
            detail: jsonSafeValue(detail),
        },
        suggestedFix: "Dispatch aperture:command with detail { channel: 'your.channel', payload: { ... } }.",
    };
}
//# sourceMappingURL=commands.js.map