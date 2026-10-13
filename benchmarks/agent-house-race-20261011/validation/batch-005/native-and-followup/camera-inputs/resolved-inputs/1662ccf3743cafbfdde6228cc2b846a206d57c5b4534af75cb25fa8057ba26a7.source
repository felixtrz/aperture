import { cloneTextureTransform } from "./standard-texture-readiness-utils.js";
export function standardMaterialTextureReadinessReportToJsonValue(report) {
    return {
        ...report,
        slots: report.slots.map((slot) => ({
            ...slot,
            expectedColorSpaces: [...slot.expectedColorSpaces],
        })),
        diagnostics: report.diagnostics.map((diagnostic) => ({
            ...diagnostic,
            ...(diagnostic.expectedColorSpaces === undefined
                ? {}
                : { expectedColorSpaces: [...diagnostic.expectedColorSpaces] }),
            ...(diagnostic.supportedTexCoords === undefined
                ? {}
                : { supportedTexCoords: [...diagnostic.supportedTexCoords] }),
            ...(diagnostic.textureTransform === undefined
                ? {}
                : {
                    textureTransform: cloneTextureTransform(diagnostic.textureTransform),
                }),
        })),
    };
}
export function standardMaterialTextureReadinessReportToJson(report) {
    return JSON.stringify(standardMaterialTextureReadinessReportToJsonValue(report));
}
//# sourceMappingURL=standard-texture-readiness-report.js.map