import type { GeneratedBrowserAppStatus } from "./status.js";

export function syncGeneratedDiagnostics(
  getDiagnostics: () => unknown,
  status: GeneratedBrowserAppStatus,
): void {
  const sync = () => {
    status.diagnostics = getDiagnostics();
    requestAnimationFrame(sync);
  };

  requestAnimationFrame(sync);
}
