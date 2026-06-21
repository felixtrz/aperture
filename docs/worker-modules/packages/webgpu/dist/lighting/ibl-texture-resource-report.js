export function diffuseIblTextureResourceReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        textureSlotCount: report.textureSlotCount,
        diffuseSlotCount: report.diffuseSlotCount,
        createdTextureCount: report.createdTextureCount,
        reusedTextureCount: report.reusedTextureCount,
        ...(report.convolved === undefined ? {} : { convolved: report.convolved }),
        ...(report.irradianceFaceSize === undefined
            ? {}
            : { irradianceFaceSize: report.irradianceFaceSize }),
        sections: { ...report.sections },
        resources: report.resources.map((resource) => ({
            valid: resource.valid,
            resourceKey: resource.resource?.resourceKey ??
                resource.diagnostics[0]?.resourceKey ??
                "",
            descriptor: resource.resource === null
                ? null
                : {
                    ...resource.resource.descriptor,
                    size: [...resource.resource.descriptor.size],
                },
        })),
        diagnostics: report.diagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            severity: "severity" in diagnostic ? diagnostic.severity : "warning",
            message: diagnostic.message,
            ...("resourceKey" in diagnostic && diagnostic.resourceKey !== undefined
                ? { resourceKey: diagnostic.resourceKey }
                : {}),
        })),
    };
}
export function diffuseIblTextureResourceReportToJson(report) {
    return JSON.stringify(diffuseIblTextureResourceReportToJsonValue(report));
}
export function specularIblTextureResourceReportToJsonValue(report) {
    return {
        ready: report.ready,
        status: report.status,
        textureSlotCount: report.textureSlotCount,
        specularSlotCount: report.specularSlotCount,
        createdTextureCount: report.createdTextureCount,
        reusedTextureCount: report.reusedTextureCount,
        sections: { ...report.sections },
        resources: report.resources.map((resource) => ({
            valid: resource.valid,
            resourceKey: resource.resource?.resourceKey ??
                resource.diagnostics[0]?.resourceKey ??
                "",
            descriptor: resource.resource === null
                ? null
                : {
                    ...resource.resource.descriptor,
                    size: [...resource.resource.descriptor.size],
                },
        })),
        diagnostics: report.diagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            severity: "severity" in diagnostic ? diagnostic.severity : "warning",
            message: diagnostic.message,
            ...("resourceKey" in diagnostic && diagnostic.resourceKey !== undefined
                ? { resourceKey: diagnostic.resourceKey }
                : {}),
        })),
    };
}
export function specularIblTextureResourceReportToJson(report) {
    return JSON.stringify(specularIblTextureResourceReportToJsonValue(report));
}
//# sourceMappingURL=ibl-texture-resource-report.js.map