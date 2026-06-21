export function createFrameSubmissionSmokeReport(input) {
    const attachments = evaluateSection({
        section: "attachments",
        report: input.attachments,
        missingCode: "frameSubmission.missingAttachmentPlan",
        notReadyCode: "frameSubmission.attachmentsNotReady",
        missingMessage: "Frame submission smoke report is missing attachment planning output.",
        notReadyMessage: "Render pass attachment planning is not ready.",
    });
    const begin = evaluateSection({
        section: "begin",
        report: input.begin,
        missingCode: "frameSubmission.missingBeginReport",
        notReadyCode: "frameSubmission.beginFailed",
        missingMessage: "Frame submission smoke report is missing pass begin output.",
        notReadyMessage: "Render pass begin failed.",
    });
    const execution = evaluateSection({
        section: "execution",
        report: input.execution,
        missingCode: "frameSubmission.missingExecutionReport",
        notReadyCode: "frameSubmission.executionFailed",
        missingMessage: "Frame submission smoke report is missing command execution output.",
        notReadyMessage: "Render pass command execution failed.",
    });
    const end = evaluateSection({
        section: "end",
        report: input.end,
        missingCode: "frameSubmission.missingEndReport",
        notReadyCode: "frameSubmission.endFailed",
        missingMessage: "Frame submission smoke report is missing pass end output.",
        notReadyMessage: "Render pass end failed.",
    });
    const finish = evaluateSection({
        section: "finish",
        report: input.finish,
        missingCode: "frameSubmission.missingFinishReport",
        notReadyCode: "frameSubmission.finishFailed",
        missingMessage: "Frame submission smoke report is missing command encoder finish output.",
        notReadyMessage: "Command encoder finish failed.",
    });
    const submit = evaluateSection({
        section: "submit",
        report: input.submit,
        missingCode: "frameSubmission.missingSubmitReport",
        notReadyCode: "frameSubmission.submitFailed",
        missingMessage: "Frame submission smoke report is missing queue submit output.",
        notReadyMessage: "Queue submission failed.",
    });
    const sections = {
        attachments: attachments.status,
        begin: begin.status,
        execution: execution.status,
        end: end.status,
        finish: finish.status,
        submit: submit.status,
    };
    return {
        ready: Object.values(sections).every((section) => section.ready),
        sections,
        diagnostics: [
            ...attachments.diagnostics,
            ...(input.attachments?.diagnostics ?? []),
            ...begin.diagnostics,
            ...(input.begin?.diagnostics ?? []),
            ...execution.diagnostics,
            ...(input.execution?.diagnostics ?? []),
            ...end.diagnostics,
            ...(input.end?.diagnostics ?? []),
            ...finish.diagnostics,
            ...(input.finish?.diagnostics ?? []),
            ...submit.diagnostics,
            ...(input.submit?.diagnostics ?? []),
        ],
        summary: {
            attachments: input.attachments === null
                ? null
                : {
                    valid: input.attachments.valid,
                    colorTargets: input.attachments.plan?.colorAttachments.length ?? 0,
                },
            begin: input.begin === null
                ? null
                : { valid: input.begin.valid, hasPass: input.begin.pass !== null },
            execution: input.execution === null
                ? null
                : {
                    valid: input.execution.valid,
                    executedCommands: input.execution.executedCommands,
                    skippedCommands: input.execution.skippedCommands,
                    drawCalls: input.execution.drawCalls,
                },
            end: input.end === null
                ? null
                : { valid: input.end.valid, ended: input.end.ended },
            finish: input.finish === null
                ? null
                : {
                    valid: input.finish.valid,
                    commandBufferKey: input.finish.resource?.resourceKey ?? null,
                },
            submit: input.submit === null
                ? null
                : {
                    valid: input.submit.valid,
                    submitted: input.submit.submitted,
                    skipped: input.submit.skipped,
                },
        },
    };
}
function evaluateSection(input) {
    if (input.report === null) {
        return sectionResult(input.section, false, [
            {
                code: input.missingCode,
                message: input.missingMessage,
                section: input.section,
                severity: "error",
            },
        ]);
    }
    if (!input.report.valid) {
        return sectionResult(input.section, true, [
            {
                code: input.notReadyCode,
                message: input.notReadyMessage,
                section: input.section,
                severity: "warning",
            },
        ]);
    }
    return sectionResult(input.section, true, []);
}
function sectionResult(section, present, diagnostics) {
    return {
        status: {
            section,
            present,
            ready: present && diagnostics.length === 0,
            diagnosticCodes: diagnostics.map((diagnostic) => diagnostic.code),
        },
        diagnostics,
    };
}
//# sourceMappingURL=frame-submission-smoke.js.map