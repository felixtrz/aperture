import { createPreparedCustomWgslMaterial } from "./custom-wgsl-material-prepared.js";
import { validateCustomWgslMaterialSource, } from "./custom-wgsl-material-validation.js";
export function createCustomWgslMaterialRenderAssetAdapter(familyKey) {
    return {
        kind: "material",
        family: familyKey,
        prepare(input) {
            if (!input.dependencyState.ready) {
                return {
                    status: "retry",
                    diagnostics: input.dependencyState.diagnostics.map((diagnostic) => ({
                        code: `renderAsset.${diagnostic.code}`,
                        message: diagnostic.message,
                        severity: "warning",
                        assetKey: input.assetKey,
                        dependencyKey: diagnostic.dependencyKey,
                    })),
                };
            }
            const diagnostics = validateCustomMaterialSource(input.source, {
                assetKey: input.assetKey,
                expectedFamily: familyKey,
            });
            const errorDiagnostics = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
            if (errorDiagnostics.length > 0) {
                return {
                    status: "failed",
                    diagnostics,
                };
            }
            const shader = resolveCustomWgslShaderSource(input);
            if (shader.status !== "ready") {
                return {
                    status: shader.status,
                    diagnostics: [...diagnostics, ...shader.diagnostics],
                };
            }
            return {
                status: "prepared",
                prepared: createPreparedCustomWgslMaterial({
                    source: input.source,
                    assetKey: input.assetKey,
                    shaderCode: shader.code,
                    shaderSourceKey: shader.sourceKey,
                }),
                diagnostics,
            };
        },
        unload(input) {
            return {
                diagnostics: [
                    {
                        code: "renderAsset.customWgslMaterial.unloaded",
                        message: `Custom WGSL material '${input.assetKey}' was unloaded.`,
                        severity: "info",
                        assetKey: input.assetKey,
                    },
                ],
            };
        },
    };
}
export function validateCustomMaterialSource(source, options = {}) {
    return validateCustomWgslMaterialSource(source, options.assetKey ?? "material:custom-material", options.expectedFamily ?? source.familyKey);
}
function resolveCustomWgslShaderSource(input) {
    if (input.source.shader.kind === "inline-wgsl") {
        return {
            status: "ready",
            code: input.source.shader.code,
            sourceKey: `inline:${input.assetKey}:${input.source.shader.virtualPath ?? "source"}`,
            diagnostics: [],
        };
    }
    const shaderHandle = input.source.shader.handle;
    const shaderKey = `${shaderHandle.kind}:${shaderHandle.id}`;
    const entry = input.registry.get(shaderHandle);
    if (entry === undefined) {
        return {
            status: "retry",
            diagnostics: [
                {
                    code: "renderAsset.customWgslMaterial.shaderMissing",
                    message: `Custom WGSL material '${input.assetKey}' references missing shader asset '${shaderKey}'.`,
                    severity: "warning",
                    assetKey: input.assetKey,
                    dependencyKey: shaderKey,
                },
            ],
        };
    }
    if (entry.status === "loading" || entry.status === "registered") {
        return {
            status: "retry",
            diagnostics: [
                {
                    code: "renderAsset.customWgslMaterial.shaderNotReady",
                    message: `Custom WGSL material '${input.assetKey}' shader asset '${shaderKey}' is '${entry.status}'.`,
                    severity: "warning",
                    assetKey: input.assetKey,
                    dependencyKey: shaderKey,
                },
            ],
        };
    }
    if (entry.status === "failed" || entry.asset === null) {
        return {
            status: "failed",
            diagnostics: [
                {
                    code: "renderAsset.customWgslMaterial.shaderFailed",
                    message: `Custom WGSL material '${input.assetKey}' shader asset '${shaderKey}' failed to load.`,
                    severity: "error",
                    assetKey: input.assetKey,
                    dependencyKey: shaderKey,
                },
            ],
        };
    }
    if (entry.asset.kind !== "shader" || entry.asset.language !== "wgsl") {
        return {
            status: "failed",
            diagnostics: [
                {
                    code: "renderAsset.customWgslMaterial.invalidShaderAsset",
                    message: `Custom WGSL material '${input.assetKey}' shader asset '${shaderKey}' is not a WGSL shader asset.`,
                    severity: "error",
                    assetKey: input.assetKey,
                    dependencyKey: shaderKey,
                },
            ],
        };
    }
    return {
        status: "ready",
        code: entry.asset.source,
        sourceKey: `${shaderKey}:v${entry.version}`,
        diagnostics: [],
    };
}
//# sourceMappingURL=custom-wgsl-material-preparation.js.map