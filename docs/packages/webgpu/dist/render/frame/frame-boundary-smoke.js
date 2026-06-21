export function createFrameBoundarySmokeReport(report) {
    const sections = {
        texture: evaluatePresentSection({
            section: "texture",
            present: true,
            valid: report.texture.valid,
            missingCode: "frameBoundary.textureFailed",
            failedCode: "frameBoundary.textureFailed",
            missingMessage: "Current texture view report is missing.",
            failedMessage: "Current texture view acquisition failed.",
        }),
        attachments: evaluatePresentSection({
            section: "attachments",
            present: report.attachments !== null,
            valid: report.attachments?.valid ?? false,
            missingCode: "frameBoundary.missingAttachments",
            failedCode: "frameBoundary.attachmentsFailed",
            missingMessage: "Frame boundary assembly is missing attachment planning output.",
            failedMessage: "Render pass attachment planning failed.",
        }),
        encoder: evaluatePresentSection({
            section: "encoder",
            present: report.encoder !== null,
            valid: report.encoder?.valid ?? false,
            missingCode: "frameBoundary.missingEncoder",
            failedCode: "frameBoundary.encoderFailed",
            missingMessage: "Frame boundary assembly is missing command encoder output.",
            failedMessage: "Command encoder creation failed.",
        }),
        begin: evaluatePresentSection({
            section: "begin",
            present: report.begin !== null,
            valid: report.begin?.valid ?? false,
            missingCode: "frameBoundary.missingBegin",
            failedCode: "frameBoundary.beginFailed",
            missingMessage: "Frame boundary assembly is missing render pass begin output.",
            failedMessage: "Render pass begin failed.",
        }),
        execution: evaluatePresentSection({
            section: "execution",
            present: report.execution !== null,
            valid: report.execution?.valid ?? false,
            missingCode: "frameBoundary.missingExecution",
            failedCode: "frameBoundary.executionFailed",
            missingMessage: "Frame boundary assembly is missing command execution output.",
            failedMessage: "Render pass command execution failed.",
        }),
        end: evaluatePresentSection({
            section: "end",
            present: report.end !== null,
            valid: report.end?.valid ?? false,
            missingCode: "frameBoundary.missingEnd",
            failedCode: "frameBoundary.endFailed",
            missingMessage: "Frame boundary assembly is missing render pass end output.",
            failedMessage: "Render pass end failed.",
        }),
        finish: evaluatePresentSection({
            section: "finish",
            present: report.finish !== null,
            valid: report.finish?.valid ?? false,
            missingCode: "frameBoundary.missingFinish",
            failedCode: "frameBoundary.finishFailed",
            missingMessage: "Frame boundary assembly is missing command buffer finish output.",
            failedMessage: "Command buffer finish failed.",
        }),
        submit: evaluatePresentSection({
            section: "submit",
            present: report.submit !== null,
            valid: report.submit?.valid ?? false,
            missingCode: "frameBoundary.missingSubmit",
            failedCode: "frameBoundary.submitFailed",
            missingMessage: "Frame boundary assembly is missing queue submission output.",
            failedMessage: "Queue submission failed.",
        }),
    };
    return {
        ready: Object.values(sections).every((section) => section.ready),
        sections,
        diagnostics: [
            ...Object.values(sections).flatMap((section) => section.diagnosticCodes.map((code) => ({
                code,
                message: `${section.section} section is not ready.`,
            }))),
            ...report.texture.diagnostics,
            ...(report.attachments?.diagnostics ?? []),
            ...(report.encoder?.diagnostics ?? []),
            ...(report.begin?.diagnostics ?? []),
            ...(report.execution?.diagnostics ?? []),
            ...(report.end?.diagnostics ?? []),
            ...(report.finish?.diagnostics ?? []),
            ...(report.submit?.diagnostics ?? []),
        ],
    };
}
function evaluatePresentSection(input) {
    if (!input.present) {
        return {
            section: input.section,
            present: false,
            ready: false,
            diagnosticCodes: [input.missingCode],
        };
    }
    if (!input.valid) {
        return {
            section: input.section,
            present: true,
            ready: false,
            diagnosticCodes: [input.failedCode],
        };
    }
    return {
        section: input.section,
        present: true,
        ready: true,
        diagnosticCodes: [],
    };
}
//# sourceMappingURL=frame-boundary-smoke.js.map