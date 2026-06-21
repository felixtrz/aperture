export function createCurrentTextureColorTarget(options) {
    const texture = options.context.getCurrentTexture?.() ?? null;
    if (texture === null) {
        return {
            valid: false,
            texture: null,
            target: null,
            diagnostics: [
                {
                    code: "currentTextureView.missingCurrentTexture",
                    message: "WebGPU context did not provide a current texture.",
                },
            ],
        };
    }
    const view = texture.createView?.();
    if (view === undefined) {
        return {
            valid: false,
            texture,
            target: null,
            diagnostics: [
                {
                    code: "currentTextureView.missingTextureView",
                    message: "WebGPU current texture did not provide a texture view.",
                },
            ],
        };
    }
    const target = { view };
    return {
        valid: true,
        texture,
        target: createColorTargetInput(target, options),
        diagnostics: [],
    };
}
export function createOffscreenColorTarget(options) {
    const texture = options.texture ?? null;
    if (texture === null) {
        return {
            valid: false,
            texture: null,
            target: null,
            diagnostics: [
                {
                    code: "currentTextureView.missingTexture",
                    message: "Off-screen color target requires a texture.",
                },
            ],
        };
    }
    const view = texture.createView?.();
    if (view === undefined) {
        return {
            valid: false,
            texture,
            target: null,
            diagnostics: [
                {
                    code: "currentTextureView.missingTextureView",
                    message: "Off-screen color target texture did not provide a texture view.",
                },
            ],
        };
    }
    return {
        valid: true,
        texture,
        target: createColorTargetInput({ view }, options),
        diagnostics: [],
    };
}
export function createOffscreenColorTargets(options) {
    const textures = [];
    const targets = [];
    const diagnostics = [];
    for (let i = 0; i < options.textures.length; i += 1) {
        const clearColor = colorOptionAt(options.clearColors, i, options.clearColor);
        const loadOp = attachmentOptionAt(options.loadOps, i, options.loadOp);
        const storeOp = attachmentOptionAt(options.storeOps, i, options.storeOp);
        const targetOptions = {
            texture: options.textures[i],
            ...(clearColor === undefined ? {} : { clearColor }),
            ...(loadOp === undefined ? {} : { loadOp }),
            ...(storeOp === undefined ? {} : { storeOp }),
        };
        const result = createOffscreenColorTarget(targetOptions);
        textures.push(result.texture ?? null);
        if (result.target !== null) {
            targets.push(result.target);
        }
        for (const diagnostic of result.diagnostics) {
            diagnostics.push({ ...diagnostic, targetIndex: i });
        }
    }
    return {
        valid: diagnostics.length === 0 && targets.length === options.textures.length,
        textures,
        targets,
        diagnostics,
    };
}
function createColorTargetInput(target, options) {
    return {
        ...target,
        ...(options.clearColor === undefined
            ? {}
            : { clearColor: options.clearColor }),
        ...(options.loadOp === undefined ? {} : { loadOp: options.loadOp }),
        ...(options.storeOp === undefined ? {} : { storeOp: options.storeOp }),
    };
}
function colorOptionAt(values, index, fallback) {
    return values?.[index] ?? fallback;
}
function attachmentOptionAt(values, index, fallback) {
    return values?.[index] ?? fallback;
}
//# sourceMappingURL=current-texture-view.js.map