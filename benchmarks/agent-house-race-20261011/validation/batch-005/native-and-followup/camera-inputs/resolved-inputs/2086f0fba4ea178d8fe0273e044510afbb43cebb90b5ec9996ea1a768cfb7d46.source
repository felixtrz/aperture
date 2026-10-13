import { summarizeDiagnostics, } from "@aperture-engine/simulation";
export function summarizeFrameBoundaryDiagnostics(report) {
    const diagnostics = summarizeDiagnostics([
        ...report.texture.diagnostics,
        ...(report.attachments?.diagnostics ?? []),
        ...(report.encoder?.diagnostics ?? []),
        ...(report.begin?.diagnostics ?? []),
        ...(report.rectangle?.diagnostics ?? []),
        ...(report.execution?.diagnostics ?? []),
        ...(report.renderBundle?.diagnostics ?? []),
        ...(report.end?.diagnostics ?? []),
        ...(report.finish?.diagnostics ?? []),
        ...(report.submit?.diagnostics ?? []),
    ], { defaultSeverity: "warning" });
    return {
        ready: diagnostics.total === 0,
        diagnostics,
    };
}
//# sourceMappingURL=frame-boundary-diagnostics.js.map