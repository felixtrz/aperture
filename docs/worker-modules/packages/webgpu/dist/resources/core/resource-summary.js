export function createRenderResourceSummaryReport(input) {
    const diagnostics = [];
    for (const result of input.meshResources) {
        diagnostics.push(...result.diagnostics.map((diagnostic) => resourceDiagnostic(diagnostic, "warning")));
    }
    for (const result of input.materialResources) {
        diagnostics.push(...result.diagnostics.map((diagnostic) => resourceDiagnostic(diagnostic, "warning")));
    }
    for (const result of input.textureResources ?? []) {
        diagnostics.push(...result.diagnostics.map((diagnostic) => resourceDiagnostic(diagnostic, "warning")));
    }
    for (const result of input.samplerResources ?? []) {
        diagnostics.push(...result.diagnostics.map((diagnostic) => resourceDiagnostic(diagnostic, "warning")));
    }
    for (const result of input.lightGpuBufferResources ?? []) {
        diagnostics.push(...result.diagnostics.map((diagnostic) => resourceDiagnostic(diagnostic, "warning")));
    }
    for (const result of input.lightBindGroupResources ?? []) {
        diagnostics.push(...result.diagnostics.map((diagnostic) => resourceDiagnostic(diagnostic, "warning")));
    }
    for (const result of input.viewUniformResources) {
        diagnostics.push(...result.diagnostics.map((diagnostic) => resourceDiagnostic(diagnostic, "warning")));
    }
    for (const result of input.shaderResources) {
        diagnostics.push(...result.diagnostics.map((diagnostic) => resourceDiagnostic(diagnostic, !result.valid || diagnostic.severity === "error"
            ? "error"
            : "warning")));
    }
    for (const result of input.pipelines) {
        diagnostics.push(...result.diagnostics.map((diagnostic) => resourceDiagnostic(diagnostic, result.ok ? "warning" : "error")));
    }
    if (input.resourceInspection !== undefined) {
        diagnostics.push(...input.resourceInspection.diagnostics.map((diagnostic) => resourceDiagnostic(diagnostic, diagnostic.code === "renderResourceInspection.missingResource"
            ? "error"
            : "warning")));
    }
    return {
        counts: {
            meshResources: input.meshResources.filter((result) => result.valid)
                .length,
            meshVertexBuffers: input.meshResources.reduce((sum, result) => sum + (result.resource?.vertexBuffers.length ?? 0), 0),
            meshIndexBuffers: input.meshResources.filter((result) => result.resource?.indexBuffer !== undefined).length,
            materialBuffers: input.materialResources.filter((result) => result.valid)
                .length,
            textures: (input.textureResources ?? []).filter((result) => result.valid)
                .length,
            samplers: (input.samplerResources ?? []).filter((result) => result.valid)
                .length,
            lightBuffers: input.lightBuffers?.length ?? 0,
            lightGpuBuffers: (input.lightGpuBufferResources ?? []).filter((result) => result.valid).length,
            lightBindGroups: (input.lightBindGroupResources ?? []).filter((result) => result.valid).length,
            environmentMaps: (input.environmentResources ?? []).reduce((sum, plan) => sum + plan.requirements.length, 0),
            viewUniformBuffers: input.viewUniformResources.filter((result) => result.valid).length,
            shaderModules: input.shaderResources.filter((result) => result.valid)
                .length,
            pipelineHits: input.pipelines.filter((result) => result.ok && result.status === "hit").length,
            pipelineMisses: input.pipelines.filter((result) => result.ok && result.status === "miss").length,
            inspectedResources: input.resourceInspection?.counts.total ?? 0,
            staleResources: input.resourceInspection?.counts.stale ?? 0,
            missingResources: input.resourceInspection?.counts.missing ?? 0,
            pendingDestroyResources: input.resourceInspection?.counts.pendingDestroy ?? 0,
            warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length,
            errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
        },
        diagnostics,
    };
}
export function renderResourceSummaryReportToJsonValue(report) {
    return {
        counts: { ...report.counts },
        diagnostics: report.diagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            message: diagnostic.message,
            severity: diagnostic.severity,
            ...(diagnostic.resourceKey === undefined
                ? {}
                : { resourceKey: diagnostic.resourceKey }),
        })),
    };
}
export function renderResourceSummaryReportToJson(report) {
    return JSON.stringify(renderResourceSummaryReportToJsonValue(report));
}
export function mergeRenderResourceSummaryReports(reports) {
    const diagnostics = reports.flatMap((report) => [...report.diagnostics]);
    return {
        counts: {
            meshResources: sum(reports, (report) => report.counts.meshResources),
            meshVertexBuffers: sum(reports, (report) => report.counts.meshVertexBuffers),
            meshIndexBuffers: sum(reports, (report) => report.counts.meshIndexBuffers),
            materialBuffers: sum(reports, (report) => report.counts.materialBuffers),
            textures: sum(reports, (report) => report.counts.textures),
            samplers: sum(reports, (report) => report.counts.samplers),
            lightBuffers: sum(reports, (report) => report.counts.lightBuffers),
            lightGpuBuffers: sum(reports, (report) => report.counts.lightGpuBuffers),
            lightBindGroups: sum(reports, (report) => report.counts.lightBindGroups),
            environmentMaps: sum(reports, (report) => report.counts.environmentMaps),
            viewUniformBuffers: sum(reports, (report) => report.counts.viewUniformBuffers),
            shaderModules: sum(reports, (report) => report.counts.shaderModules),
            pipelineHits: sum(reports, (report) => report.counts.pipelineHits),
            pipelineMisses: sum(reports, (report) => report.counts.pipelineMisses),
            inspectedResources: sum(reports, (report) => report.counts.inspectedResources),
            staleResources: sum(reports, (report) => report.counts.staleResources),
            missingResources: sum(reports, (report) => report.counts.missingResources),
            pendingDestroyResources: sum(reports, (report) => report.counts.pendingDestroyResources),
            warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length,
            errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
        },
        diagnostics,
    };
}
function sum(reports, read) {
    return reports.reduce((total, report) => total + read(report), 0);
}
function resourceDiagnostic(diagnostic, severity) {
    return {
        code: diagnostic.code,
        message: diagnostic.message,
        severity,
        ...(diagnostic.resourceKey === undefined
            ? {}
            : { resourceKey: diagnostic.resourceKey }),
    };
}
//# sourceMappingURL=resource-summary.js.map