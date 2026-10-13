export function createClearParityReport(clear, compatibility) {
    const clearReady = clear.ok;
    const boundaryReady = compatibility.ready;
    if (clearReady && boundaryReady) {
        return { ready: true, clearReady, boundaryReady, diagnostics: [] };
    }
    if (!clearReady && !boundaryReady) {
        return {
            ready: false,
            clearReady,
            boundaryReady,
            diagnostics: [
                {
                    code: "clearParity.bothFailed",
                    message: "Both clearWebGpuCanvas and frame-boundary compatibility report failed.",
                },
            ],
        };
    }
    if (!clearReady) {
        return {
            ready: false,
            clearReady,
            boundaryReady,
            diagnostics: [
                {
                    code: "clearParity.clearFailedBoundaryReady",
                    message: "clearWebGpuCanvas failed while frame-boundary compatibility reported ready.",
                },
            ],
        };
    }
    return {
        ready: false,
        clearReady,
        boundaryReady,
        diagnostics: [
            {
                code: "clearParity.clearSucceededBoundaryFailed",
                message: "clearWebGpuCanvas succeeded while frame-boundary compatibility reported missing requirements.",
            },
        ],
    };
}
//# sourceMappingURL=clear-parity.js.map