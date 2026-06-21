export function shadowSamplerResourceReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        createdSamplerCount: report.createdSamplerCount,
        reusedSamplerCount: report.reusedSamplerCount,
        sections: { ...report.sections },
        resource: report.resource === null
            ? null
            : {
                resourceKey: report.resource.resourceKey,
                descriptor: { ...report.resource.descriptor },
            },
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function shadowSamplerResourceReportToJson(report) {
    return JSON.stringify(shadowSamplerResourceReportToJsonValue(report));
}
export function standardMaterialShadowBindGroupDescriptorReadinessReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        standardMaterialCount: report.standardMaterialCount,
        group: report.group,
        entryCount: report.entryCount,
        sections: { ...report.sections },
        plan: report.plan === null
            ? null
            : {
                valid: report.plan.valid,
                group: report.plan.group,
                resourceKey: report.plan.resourceKey,
                entries: report.plan.entries.map((entry) => ({ ...entry })),
                diagnostics: report.plan.diagnostics.map((diagnostic) => ({
                    ...diagnostic,
                })),
            },
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function standardMaterialShadowBindGroupDescriptorReadinessReportToJson(report) {
    return JSON.stringify(standardMaterialShadowBindGroupDescriptorReadinessReportToJsonValue(report));
}
export function standardMaterialShadowBindGroupResourceReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        standardMaterialCount: report.standardMaterialCount,
        group: report.group,
        createdBindGroupCount: report.createdBindGroupCount,
        reusedBindGroupCount: report.reusedBindGroupCount,
        sections: { ...report.sections },
        resource: report.resource === null
            ? null
            : {
                group: report.resource.group,
                resourceKey: report.resource.resourceKey,
                layoutKey: report.resource.layoutKey,
                entryResourceKeys: [...report.resource.entryResourceKeys],
            },
        diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function standardMaterialShadowBindGroupResourceReportToJson(report) {
    return JSON.stringify(standardMaterialShadowBindGroupResourceReportToJsonValue(report));
}
//# sourceMappingURL=standard-material-shadow-bind-group-report.js.map