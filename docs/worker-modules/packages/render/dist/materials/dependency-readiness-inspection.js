import { assetHandleKey, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
export function inspectMaterialDependencySlot(input) {
    if (input.handle === null) {
        input.slots.push({
            field: input.field,
            dependency: input.dependencyKind,
            dependencyKind: input.dependencyKind,
            handleKey: null,
            status: "missing",
            ready: false,
        });
        input.diagnostics.push({
            code: missingHandleDiagnosticCode(input.dependencyKind),
            materialKey: input.materialKey,
            field: input.field,
            dependencyKind: input.dependencyKind,
            ...(input.textureKey === undefined
                ? {}
                : { textureKey: input.textureKey }),
            ...(input.samplerKey === undefined
                ? {}
                : { samplerKey: input.samplerKey }),
            status: "missing",
            message: `${input.field} is missing a ${input.dependencyKind} handle.`,
        });
        return;
    }
    const dependencyKey = assetHandleKey(input.handle);
    const entry = input.registry.get(input.handle);
    const status = entry?.status ?? "missing";
    input.slots.push({
        field: input.field,
        dependency: input.dependencyKind,
        dependencyKind: input.dependencyKind,
        handleKey: dependencyKey,
        status,
        ready: status === "ready",
    });
    if (status === "ready") {
        return;
    }
    input.diagnostics.push({
        code: materialDependencyDiagnosticCode(input.dependencyKind, status),
        materialKey: input.materialKey,
        field: input.field,
        dependencyKind: input.dependencyKind,
        dependencyKey,
        ...(input.textureKey === undefined ? {} : { textureKey: input.textureKey }),
        ...(input.samplerKey === undefined ? {} : { samplerKey: input.samplerKey }),
        status,
        message: `${input.field} ${input.dependencyKind} dependency '${dependencyKey}' is '${status}'.`,
    });
}
function missingHandleDiagnosticCode(dependencyKind) {
    switch (dependencyKind) {
        case "texture":
            return "materialDependency.missingTextureHandle";
        case "sampler":
            return "materialDependency.missingSamplerHandle";
        case "shader":
            return "materialDependency.missingShaderHandle";
    }
}
function materialDependencyDiagnosticCode(dependencyKind, status) {
    switch (status) {
        case "missing":
            return "materialDependency.dependencyMissing";
        case "registered":
            return "materialDependency.dependencyRegistered";
        case "loading":
            return "materialDependency.dependencyLoading";
        case "failed":
            return "materialDependency.dependencyFailed";
        case "ready":
            throw new Error(`Ready ${dependencyKind} dependencies do not produce diagnostics.`);
    }
}
//# sourceMappingURL=dependency-readiness-inspection.js.map