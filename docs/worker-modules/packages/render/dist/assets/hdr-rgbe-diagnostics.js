export function parseFailure(code, message) {
    return {
        ok: false,
        image: null,
        diagnostics: [{ code, severity: "error", message }],
    };
}
//# sourceMappingURL=hdr-rgbe-diagnostics.js.map