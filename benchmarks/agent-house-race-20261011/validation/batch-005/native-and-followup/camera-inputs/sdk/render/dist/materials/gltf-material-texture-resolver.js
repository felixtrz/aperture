import { isMaterialTextureBinding, isTextureBindingResolverReport, } from "./gltf-material-utils.js";
export function resolveTextureBindingResult(input) {
    if (isMaterialTextureBinding(input.resolved)) {
        return input.resolved;
    }
    if (isTextureBindingResolverReport(input.resolved)) {
        const resolverDiagnostics = input.resolved.diagnostics ?? [];
        for (const diagnostic of resolverDiagnostics) {
            pushResolverDiagnostic({
                materialKey: input.materialKey,
                field: input.field,
                slot: input.slot,
                textureIndex: input.textureIndex,
                diagnostic,
                diagnostics: input.diagnostics,
            });
        }
        if (input.resolved.binding !== null &&
            input.resolved.binding !== undefined) {
            return input.resolved.binding;
        }
        if (resolverDiagnostics.length === 0) {
            pushUnresolvedTextureBindingDiagnostic(input);
        }
        return null;
    }
    pushUnresolvedTextureBindingDiagnostic(input);
    return null;
}
function pushResolverDiagnostic(input) {
    input.diagnostics.push({
        code: input.diagnostic.code ?? "gltfMaterial.unresolvedTextureBinding",
        severity: input.diagnostic.severity ?? "error",
        materialKey: input.materialKey,
        field: input.diagnostic.field ?? input.field,
        slot: input.slot,
        textureIndex: input.diagnostic.textureIndex ?? input.textureIndex,
        message: input.diagnostic.message,
        ...(input.diagnostic.dependencyKind === undefined
            ? {}
            : { dependencyKind: input.diagnostic.dependencyKind }),
        ...(input.diagnostic.samplerIndex === undefined
            ? {}
            : { samplerIndex: input.diagnostic.samplerIndex }),
        ...(input.diagnostic.value === undefined
            ? {}
            : { value: input.diagnostic.value }),
    });
}
function pushUnresolvedTextureBindingDiagnostic(input) {
    input.diagnostics.push({
        code: "gltfMaterial.unresolvedTextureBinding",
        severity: "error",
        materialKey: input.materialKey,
        field: input.field,
        slot: input.slot,
        textureIndex: input.textureIndex,
        message: `${input.field} could not be resolved to texture and sampler handles.`,
    });
}
//# sourceMappingURL=gltf-material-texture-resolver.js.map