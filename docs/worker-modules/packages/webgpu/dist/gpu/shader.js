export async function createWebGpuShaderModule(options) {
    const entryPointDiagnostics = validateEntryPoints(options.descriptor);
    if (entryPointDiagnostics.length > 0) {
        return failure("missing-entry-point", "WGSL source is missing one or more expected entry points.", entryPointDiagnostics);
    }
    if (options.device.createShaderModule === undefined) {
        return failure("create-shader-module-unavailable", "WebGPU device cannot create shader modules.", []);
    }
    const module = options.device.createShaderModule(createDescriptor(options.descriptor));
    const diagnostics = await readCompilationDiagnostics(module);
    if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        return failure("compilation-error", "WGSL shader compilation reported errors.", diagnostics);
    }
    return { ok: true, module, diagnostics };
}
function validateEntryPoints(descriptor) {
    const diagnostics = [];
    for (const entryPoint of descriptor.entryPoints ?? []) {
        const pattern = new RegExp(`\\bfn\\s+${escapeRegExp(entryPoint)}\\s*\\(`);
        if (!pattern.test(descriptor.code)) {
            diagnostics.push({
                severity: "error",
                message: `WGSL source is missing expected entry point '${entryPoint}'.`,
            });
        }
    }
    return diagnostics;
}
async function readCompilationDiagnostics(module) {
    const info = await module.compilationInfo?.();
    return (info?.messages ?? []).map((message) => {
        const diagnostic = {
            severity: mapSeverity(message.type),
            message: message.message,
        };
        if (message.lineNum !== undefined) {
            return {
                ...diagnostic,
                line: message.lineNum,
                ...(message.linePos === undefined ? {} : { column: message.linePos }),
            };
        }
        if (message.linePos !== undefined) {
            return { ...diagnostic, column: message.linePos };
        }
        return diagnostic;
    });
}
function createDescriptor(descriptor) {
    const result = { code: descriptor.code };
    if (descriptor.label !== undefined) {
        return { ...result, label: descriptor.label };
    }
    return result;
}
function mapSeverity(type) {
    switch (type) {
        case "error":
            return "error";
        case "warning":
            return "warning";
        default:
            return "info";
    }
}
function failure(reason, message, diagnostics) {
    return { ok: false, reason, message, diagnostics };
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
//# sourceMappingURL=shader.js.map