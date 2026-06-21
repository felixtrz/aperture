export function createRenderPassAttachmentPlan(options) {
    const diagnostics = [];
    const colorAttachments = options.colorTargets.flatMap((target, index) => createColorAttachment(target, index, diagnostics));
    const depthStencilAttachment = options.depthTarget === undefined || options.depthTarget === null
        ? undefined
        : createDepthAttachment(options.depthTarget, diagnostics);
    if (options.colorTargets.length === 0) {
        diagnostics.push({
            code: "renderPassAttachment.missingColorTarget",
            message: "Render pass attachment planning requires at least one color target.",
        });
    }
    if (diagnostics.length > 0) {
        return { valid: false, plan: null, diagnostics };
    }
    const plan = {
        colorAttachments,
        ...(options.occlusionQuerySet === undefined
            ? {}
            : { occlusionQuerySet: options.occlusionQuerySet }),
    };
    if (depthStencilAttachment !== undefined) {
        return {
            valid: true,
            plan: { ...plan, depthStencilAttachment },
            diagnostics,
        };
    }
    return { valid: true, plan, diagnostics };
}
function createColorAttachment(target, targetIndex, diagnostics) {
    if (target.view === null) {
        diagnostics.push({
            code: "renderPassAttachment.missingColorTarget",
            targetIndex,
            message: `Render pass color target ${targetIndex} is missing a texture view.`,
        });
        return [];
    }
    const clearValue = target.clearColor === undefined
        ? undefined
        : createClearColor(target.clearColor, targetIndex, diagnostics);
    if (target.clearColor !== undefined && clearValue === undefined) {
        return [];
    }
    const attachment = {
        view: target.view,
        loadOp: target.loadOp ?? (clearValue === undefined ? "load" : "clear"),
        storeOp: target.storeOp ??
            (target.resolveTarget === undefined ? "store" : "discard"),
    };
    const resolvedAttachment = target.resolveTarget === undefined || target.resolveTarget === null
        ? attachment
        : { ...attachment, resolveTarget: target.resolveTarget };
    if (clearValue !== undefined) {
        return [{ ...resolvedAttachment, clearValue }];
    }
    return [resolvedAttachment];
}
function createDepthAttachment(target, diagnostics) {
    if (target.view === null) {
        return undefined;
    }
    if (target.depthClearValue !== undefined &&
        !isValidDepthClear(target.depthClearValue)) {
        diagnostics.push({
            code: "renderPassAttachment.invalidDepthClear",
            message: `Depth clear value must be a finite number in [0, 1], not '${String(target.depthClearValue)}'.`,
        });
        return undefined;
    }
    const attachment = {
        view: target.view,
        depthLoadOp: target.depthLoadOp ??
            (target.depthClearValue === undefined ? "load" : "clear"),
        depthStoreOp: target.depthStoreOp ?? "store",
    };
    if (target.depthClearValue !== undefined) {
        return { ...attachment, depthClearValue: target.depthClearValue };
    }
    return attachment;
}
function createClearColor(value, targetIndex, diagnostics) {
    if (!isClearColorTuple(value)) {
        diagnostics.push({
            code: "renderPassAttachment.invalidClearColor",
            targetIndex,
            message: `Render pass color target ${targetIndex} clear color must be a finite [r, g, b, a] tuple.`,
        });
        return undefined;
    }
    return { r: value[0], g: value[1], b: value[2], a: value[3] };
}
function isClearColorTuple(value) {
    return (value.length === 4 && value.every((component) => Number.isFinite(component)));
}
function isValidDepthClear(value) {
    return Number.isFinite(value) && value >= 0 && value <= 1;
}
//# sourceMappingURL=render-pass-attachments.js.map