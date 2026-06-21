export function beginPlannedRenderPass(options) {
    if (options.plan === null) {
        return {
            valid: false,
            pass: null,
            diagnostics: [
                {
                    code: "renderPassLifecycle.nullAttachmentPlan",
                    message: "Cannot begin a render pass from a null attachment plan.",
                },
            ],
        };
    }
    if (options.encoder.beginRenderPass === undefined) {
        return {
            valid: false,
            pass: null,
            diagnostics: [
                {
                    code: "renderPassLifecycle.missingBeginRenderPass",
                    message: "Command encoder cannot begin render passes.",
                },
            ],
        };
    }
    return {
        valid: true,
        pass: options.encoder.beginRenderPass(options.plan),
        diagnostics: [],
    };
}
export function endPlannedRenderPass(pass) {
    if (pass.end === undefined) {
        return {
            valid: false,
            ended: false,
            diagnostics: [
                {
                    code: "renderPassLifecycle.missingEnd",
                    message: "Render pass encoder cannot end render passes.",
                },
            ],
        };
    }
    pass.end();
    return { valid: true, ended: true, diagnostics: [] };
}
//# sourceMappingURL=render-pass-lifecycle.js.map