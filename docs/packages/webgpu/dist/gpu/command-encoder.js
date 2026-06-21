import { commandEncoderResourceKey } from "../resources/core/resource-keys.js";
export function createCommandEncoderResource(options) {
    if (options.device.createCommandEncoder === undefined) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "commandEncoder.missingCreateCommandEncoder",
                    message: "WebGPU device cannot create command encoders.",
                },
            ],
        };
    }
    return {
        valid: true,
        resource: {
            resourceKey: commandEncoderResourceKey(options.label),
            encoder: options.device.createCommandEncoder(),
        },
        diagnostics: [],
    };
}
//# sourceMappingURL=command-encoder.js.map