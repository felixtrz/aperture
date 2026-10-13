function createGlbContainerDiagnostic(input) {
    const diagnostic = {
        code: input.code,
        message: input.message,
        severity: input.severity,
    };
    if (input.byteOffset !== undefined) {
        diagnostic.byteOffset = input.byteOffset;
    }
    if (input.byteLength !== undefined) {
        diagnostic.byteLength = input.byteLength;
    }
    if (input.chunkType !== undefined) {
        diagnostic.chunkType = input.chunkType;
    }
    return diagnostic;
}
export function createErrorDiagnostic(input) {
    return createGlbContainerDiagnostic({ ...input, severity: "error" });
}
export function createWarningDiagnostic(input) {
    return createGlbContainerDiagnostic({ ...input, severity: "warning" });
}
export function hasErrorDiagnostics(diagnostics) {
    return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
//# sourceMappingURL=glb-container-diagnostics.js.map