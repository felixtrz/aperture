import { assetHandleKey } from "@aperture-engine/simulation";
import { inspectStandardMaterialTextures } from "./standard-texture-readiness-inspection.js";
import { standardMaterialTextureReadinessReportToJson, standardMaterialTextureReadinessReportToJsonValue, } from "./standard-texture-readiness-report.js";
export { standardMaterialTextureReadinessReportToJson, standardMaterialTextureReadinessReportToJsonValue, };
export function createStandardMaterialTextureReadinessReport(options) {
    const materialKey = assetHandleKey(options.material);
    const entry = options.registry.get(options.material);
    if (entry === undefined) {
        return {
            ready: false,
            materialKey,
            materialStatus: "missing",
            slots: [],
            diagnostics: [
                {
                    code: "standardMaterialTexture.missingMaterial",
                    severity: "error",
                    materialKey,
                    status: "missing",
                    message: `StandardMaterial texture readiness requires registered material '${materialKey}'.`,
                },
            ],
        };
    }
    if (entry.status !== "ready" || entry.asset === null) {
        return {
            ready: false,
            materialKey,
            materialStatus: entry.status,
            slots: [],
            diagnostics: [
                {
                    code: "standardMaterialTexture.materialNotReady",
                    severity: entry.status === "failed" ? "error" : "warning",
                    materialKey,
                    status: entry.status,
                    message: `StandardMaterial texture readiness requires material '${materialKey}' to be ready, not '${entry.status}'.`,
                },
            ],
        };
    }
    if (entry.asset.kind !== "standard") {
        return {
            ready: false,
            materialKey,
            materialStatus: entry.status,
            materialKind: entry.asset.kind,
            slots: [],
            diagnostics: [
                {
                    code: "standardMaterialTexture.unsupportedMaterialKind",
                    severity: "error",
                    materialKey,
                    message: `StandardMaterial texture readiness requires a StandardMaterial, not '${entry.asset.kind}'.`,
                },
            ],
        };
    }
    return inspectStandardMaterialTextures(options.registry, materialKey, entry.asset);
}
//# sourceMappingURL=standard-texture-readiness.js.map