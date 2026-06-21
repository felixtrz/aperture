export function submitCommandBuffers(options) {
    if (options.commandBuffers.length === 0) {
        return {
            valid: false,
            submitted: 0,
            skipped: 0,
            commandBufferKeys: [],
            diagnostics: [
                {
                    code: "queueSubmit.emptyCommandBuffers",
                    message: "Queue submission requires at least one command buffer.",
                },
            ],
        };
    }
    const commandBufferKeys = options.commandBuffers.map((resource) => resource.resourceKey);
    if (options.queue.submit === undefined) {
        return {
            valid: false,
            submitted: 0,
            skipped: options.commandBuffers.length,
            commandBufferKeys,
            diagnostics: [
                {
                    code: "queueSubmit.missingSubmit",
                    message: "WebGPU queue cannot submit command buffers.",
                },
            ],
        };
    }
    options.queue.submit(options.commandBuffers.map((resource) => resource.commandBuffer));
    return {
        valid: true,
        submitted: options.commandBuffers.length,
        skipped: 0,
        commandBufferKeys,
        diagnostics: [],
    };
}
//# sourceMappingURL=queue-submit.js.map