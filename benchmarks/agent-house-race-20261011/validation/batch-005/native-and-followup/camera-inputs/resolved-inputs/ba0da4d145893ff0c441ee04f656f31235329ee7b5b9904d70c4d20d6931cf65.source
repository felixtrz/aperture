export function createFrameBoundaryValidationReport(input) {
    const diagnostics = [];
    const warnings = input.summary.diagnostics.bySeverity.warning;
    const errors = input.summary.diagnostics.bySeverity.error;
    if (!input.smoke.ready) {
        diagnostics.push({
            code: "frameBoundaryValidation.smokeNotReady",
            message: "Frame boundary smoke report is not ready.",
        });
    }
    if (!input.compatibility.ready) {
        diagnostics.push({
            code: "frameBoundaryValidation.compatibilityNotReady",
            message: "Clear compatibility report is not ready.",
        });
    }
    if (warnings > 0) {
        diagnostics.push({
            code: "frameBoundaryValidation.diagnosticWarnings",
            message: `Frame boundary source diagnostics include ${warnings} warning(s).`,
        });
    }
    if (errors > 0) {
        diagnostics.push({
            code: "frameBoundaryValidation.diagnosticErrors",
            message: `Frame boundary source diagnostics include ${errors} error(s).`,
        });
    }
    return {
        ready: diagnostics.length === 0,
        counts: {
            smokeDiagnostics: input.smoke.diagnostics.length,
            compatibilityDiagnostics: input.compatibility.diagnostics.length,
            sourceDiagnostics: input.summary.diagnostics.total,
            warnings,
            errors,
        },
        diagnostics,
    };
}
//# sourceMappingURL=frame-boundary-validation.js.map