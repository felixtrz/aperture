import type { QueuedMaterialFrameResourceRouteShell } from "./queued-material-frame-resource-route.js";

export interface QueuedMaterialFrameResourceRouteAppDiagnostic {
  readonly code: "webGpuApp.frameResourceRoute";
  readonly message: string;
  readonly route: QueuedMaterialFrameResourceRouteShell;
}

export function createWebGpuAppFrameResourceRouteDiagnostic(
  route: QueuedMaterialFrameResourceRouteShell,
): QueuedMaterialFrameResourceRouteAppDiagnostic {
  return {
    code: "webGpuApp.frameResourceRoute",
    message: `WebGPU app frame resource preparation failed for '${route.family}' material route.`,
    route,
  };
}
