import { WORKER_SETTINGS } from "./contract.mjs";

// SimulationWorker.start sends the real settings in `options`; the generated
// worker supports both that production shape and direct test/start messages.
export function observeStartSettings(message) {
  const nested = message.options;
  const start =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? { ...message, ...nested }
      : message;
  return {
    ...Object.fromEntries(
      Object.keys(WORKER_SETTINGS).map((key) => [key, start[key]]),
    ),
    simulationPaused: start.simulationPaused,
    transport: start.transport?.mode ?? null,
    sharedHeaderIsNative:
      typeof SharedArrayBuffer === "function" &&
      start.transport?.headerBuffer instanceof SharedArrayBuffer,
  };
}
