export function createMvpFrameReadinessReport(input) {
    const diagnostics = [];
    if (!input.renderer.ready) {
        diagnostics.push({
            code: "mvpFrameReadiness.rendererAssemblyNotReady",
            message: "Renderer assembly smoke report is not ready.",
        });
    }
    if (!input.renderPass.ready) {
        diagnostics.push({
            code: "mvpFrameReadiness.renderPassAssemblyNotReady",
            message: "Render pass assembly smoke report is not ready.",
        });
    }
    if (!input.submission.ready) {
        diagnostics.push({
            code: "mvpFrameReadiness.frameSubmissionNotReady",
            message: "Frame submission smoke report is not ready.",
        });
    }
    if (!input.boundary.ready) {
        diagnostics.push({
            code: "mvpFrameReadiness.frameBoundaryNotReady",
            message: "Frame boundary validation report is not ready.",
        });
    }
    return {
        ready: diagnostics.length === 0,
        sections: {
            rendererAssembly: input.renderer.ready,
            renderPassAssembly: input.renderPass.ready,
            frameSubmission: input.submission.ready,
            frameBoundary: input.boundary.ready,
        },
        counts: {
            rendererDiagnostics: input.renderer.diagnostics.length,
            renderPassDiagnostics: input.renderPass.diagnostics.length,
            submissionDiagnostics: input.submission.diagnostics.length,
            boundaryDiagnostics: input.boundary.diagnostics.length,
        },
        diagnostics,
    };
}
export function mvpFrameReadinessReportToJsonValue(report) {
    return {
        ready: report.ready,
        sections: {
            rendererAssembly: report.sections.rendererAssembly,
            renderPassAssembly: report.sections.renderPassAssembly,
            frameSubmission: report.sections.frameSubmission,
            frameBoundary: report.sections.frameBoundary,
        },
        counts: {
            rendererDiagnostics: report.counts.rendererDiagnostics,
            renderPassDiagnostics: report.counts.renderPassDiagnostics,
            submissionDiagnostics: report.counts.submissionDiagnostics,
            boundaryDiagnostics: report.counts.boundaryDiagnostics,
        },
        diagnostics: report.diagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            message: diagnostic.message,
        })),
    };
}
export function mvpFrameReadinessReportToJson(report) {
    return JSON.stringify(mvpFrameReadinessReportToJsonValue(report));
}
//# sourceMappingURL=mvp-frame-readiness.js.map