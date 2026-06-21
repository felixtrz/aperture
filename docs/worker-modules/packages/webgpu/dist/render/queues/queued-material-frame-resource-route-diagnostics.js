export function createWebGpuAppFrameResourceRouteDiagnostic(route) {
    return {
        code: "webGpuApp.frameResourceRoute",
        message: `WebGPU app frame resource preparation failed for '${route.family}' material route.`,
        route,
    };
}
//# sourceMappingURL=queued-material-frame-resource-route-diagnostics.js.map