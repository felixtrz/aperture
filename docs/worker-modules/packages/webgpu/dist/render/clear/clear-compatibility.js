export function createClearCompatibilityReport(report) {
    const diagnostics = [];
    if (!report.texture.valid) {
        diagnostics.push({
            code: "clearCompatibility.missingTextureView",
            message: "Clear pass compatibility requires a current texture view.",
        });
    }
    if (report.encoder?.valid !== true) {
        diagnostics.push({
            code: "clearCompatibility.missingCommandEncoder",
            message: "Clear pass compatibility requires a command encoder.",
        });
    }
    if (report.begin?.valid !== true) {
        diagnostics.push({
            code: "clearCompatibility.missingPassBegin",
            message: "Clear pass compatibility requires render pass begin support.",
        });
    }
    if (report.end?.valid !== true) {
        diagnostics.push({
            code: "clearCompatibility.missingPassEnd",
            message: "Clear pass compatibility requires render pass end support.",
        });
    }
    if (report.finish?.valid !== true) {
        diagnostics.push({
            code: "clearCompatibility.missingCommandBuffer",
            message: "Clear pass compatibility requires command buffer finish support.",
        });
    }
    if (report.submit?.valid !== true) {
        diagnostics.push({
            code: "clearCompatibility.missingQueueSubmit",
            message: "Clear pass compatibility requires queue submit support.",
        });
    }
    return {
        ready: diagnostics.length === 0,
        diagnostics,
    };
}
//# sourceMappingURL=clear-compatibility.js.map