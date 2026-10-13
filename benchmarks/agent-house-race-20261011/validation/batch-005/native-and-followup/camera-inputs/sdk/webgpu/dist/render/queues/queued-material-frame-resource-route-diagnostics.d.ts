import type { QueuedMaterialFrameResourceRouteShell } from "./queued-material-frame-resource-route.js";
export interface QueuedMaterialFrameResourceRouteAppDiagnostic {
    readonly code: "webGpuApp.frameResourceRoute";
    readonly message: string;
    readonly route: QueuedMaterialFrameResourceRouteShell;
}
export declare function createWebGpuAppFrameResourceRouteDiagnostic(route: QueuedMaterialFrameResourceRouteShell): QueuedMaterialFrameResourceRouteAppDiagnostic;
//# sourceMappingURL=queued-material-frame-resource-route-diagnostics.d.ts.map