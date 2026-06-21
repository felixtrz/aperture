import { summarizeRenderBundleKey } from "../draw/render-bundle.js";
import { summarizeFrameBoundaryDiagnostics } from "./frame-boundary-diagnostics.js";
export function frameBoundaryReportToJsonValue(report) {
    return {
        valid: report.valid,
        sections: {
            texture: report.texture.valid,
            attachments: report.attachments?.valid ?? null,
            encoder: report.encoder?.valid ?? null,
            begin: report.begin?.valid ?? null,
            execution: report.execution?.valid ?? null,
            renderBundle: report.renderBundle?.valid ?? null,
            end: report.end?.valid ?? null,
            finish: report.finish?.valid ?? null,
            submit: report.submit?.valid ?? null,
        },
        counts: {
            colorTargets: report.attachments?.plan?.colorAttachments.length ?? 0,
            commands: report.execution?.commandCount ?? 0,
            executedCommands: report.execution?.executedCommands ?? 0,
            skippedCommands: report.execution?.skippedCommands ?? 0,
            drawCalls: report.execution?.drawCalls ?? 0,
            renderBundleEncodedCommands: report.renderBundle?.encodedCommands ?? 0,
            executedRenderBundles: report.renderBundle?.executedBundles ?? 0,
            submittedCommandBuffers: report.submit?.submitted ?? 0,
        },
        renderBundle: renderBundleReportToJsonValue(report.renderBundle),
        diagnostics: summarizeFrameBoundaryDiagnostics(report).diagnostics,
    };
}
function renderBundleReportToJsonValue(report) {
    if (report === undefined || report === null) {
        return null;
    }
    const key = summarizeRenderBundleKey(report.key);
    return {
        valid: report.valid,
        status: report.status,
        key: key.key,
        keyHash: key.keyHash,
        keyLength: key.keyLength,
        commandCount: report.commandCount,
        encodedCommands: report.encodedCommands,
        executedBundles: report.executedBundles,
        drawCalls: report.drawCalls,
        indexedDrawCalls: report.indexedDrawCalls,
        nonIndexedDrawCalls: report.nonIndexedDrawCalls,
        cacheSize: report.cacheSize,
        diagnostics: report.diagnostics,
    };
}
export function frameBoundaryReportToJson(report) {
    return JSON.stringify(frameBoundaryReportToJsonValue(report));
}
//# sourceMappingURL=frame-boundary-json.js.map