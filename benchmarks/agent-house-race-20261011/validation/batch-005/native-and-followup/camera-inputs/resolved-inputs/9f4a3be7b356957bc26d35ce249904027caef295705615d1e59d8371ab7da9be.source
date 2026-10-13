import { commandBufferResourceKey } from "../resources/core/resource-keys.js";
export function finishCommandEncoder(options) {
    if (options.encoder.finish === undefined) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "commandBuffer.missingFinish",
                    message: "Command encoder cannot finish command buffers.",
                },
            ],
        };
    }
    return {
        valid: true,
        resource: {
            resourceKey: commandBufferResourceKey(options.label),
            commandBuffer: options.encoder.finish(),
        },
        diagnostics: [],
    };
}
//# sourceMappingURL=command-buffer.js.map