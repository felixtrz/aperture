import type { SimulationWorker } from "@aperture-engine/runtime";
import {
  APERTURE_GENERATED_COMMAND_EVENT,
  createGeneratedCommandMessage,
  parseGeneratedCommand,
  type ApertureGeneratedCommand,
} from "../commands.js";
import { createApertureGeneratedDiagnosticsStatus } from "../diagnostics.js";
import { jsonSafeValue } from "../internal/json-safe.js";
import type { GeneratedBrowserAppStatus } from "./status.js";

export function installGeneratedCommandForwarding(
  worker: SimulationWorker,
  status: GeneratedBrowserAppStatus,
): void {
  window.addEventListener(APERTURE_GENERATED_COMMAND_EVENT, (event) => {
    const command = parseGeneratedCommand((event as CustomEvent).detail);

    if (command === null) {
      status.lastCommandEvent = invalidGeneratedCommandDiagnostic(
        (event as CustomEvent).detail,
      );
      status.lastFailure = createApertureGeneratedDiagnosticsStatus({
        status: "failed",
        diagnostics: [status.lastCommandEvent],
      });
      status.lastError = status.lastFailure;
      return;
    }

    forwardCommand(worker, status, command);
  });
}

function forwardCommand(
  worker: SimulationWorker,
  status: GeneratedBrowserAppStatus,
  command: ApertureGeneratedCommand,
): void {
  worker.postMessage(createGeneratedCommandMessage(command));
  status.forwardedCommandEvents += 1;
  status.lastCommandEvent = command;
}

function invalidGeneratedCommandDiagnostic(detail: unknown): {
  readonly code: string;
  readonly severity: "error";
  readonly message: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly suggestedFix: string;
} {
  return {
    code: "aperture.command.invalid",
    severity: "error",
    message: "Generated Aperture command events require a non-empty channel.",
    data: {
      event: APERTURE_GENERATED_COMMAND_EVENT,
      detail: jsonSafeValue(detail),
    },
    suggestedFix:
      "Dispatch aperture:command with detail { channel: 'your.channel', payload: { ... } }.",
  };
}
