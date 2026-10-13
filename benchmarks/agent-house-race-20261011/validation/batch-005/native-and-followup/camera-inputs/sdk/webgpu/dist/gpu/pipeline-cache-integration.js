export function getOrCreateRenderPipelineFromPlan(options) {
    if (options.plan === null) {
        return {
            ok: false,
            reason: "null-descriptor-plan",
            diagnostics: [
                {
                    code: "pipelineCacheIntegration.nullDescriptorPlan",
                    message: "Cannot create or retrieve a render pipeline from a null descriptor plan.",
                },
            ],
        };
    }
    const result = options.cache.getOrCreate({
        device: options.device,
        key: options.plan.keyInput,
        descriptor: options.plan.descriptor,
    });
    if (!result.ok) {
        return {
            ok: false,
            reason: result.reason,
            key: result.key,
            diagnostics: [
                {
                    code: "pipelineCacheIntegration.pipelineCreationFailed",
                    reason: result.reason,
                    message: result.message,
                },
            ],
        };
    }
    return {
        ok: true,
        status: result.status,
        key: result.key,
        pipeline: result.pipeline,
        diagnostics: [],
    };
}
//# sourceMappingURL=pipeline-cache-integration.js.map