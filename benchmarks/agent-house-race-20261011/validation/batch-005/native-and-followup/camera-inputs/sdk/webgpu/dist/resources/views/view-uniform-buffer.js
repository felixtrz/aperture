import { DEFAULT_UNLIT_MATERIAL_BUFFER_USAGE } from "../../materials/unlit/unlit-material-buffer.js";
export function createViewUniformBufferDescriptorScratch() {
    const descriptor = {
        size: 0,
        usage: DEFAULT_UNLIT_MATERIAL_BUFFER_USAGE,
    };
    const plan = {
        descriptor,
        source: new Float32Array(0),
        views: [],
    };
    const diagnostics = [];
    return {
        source: new Float32Array(0),
        descriptor,
        plan,
        diagnostics,
        result: { valid: false, plan: null, diagnostics },
    };
}
export function writeViewUniformBufferDescriptor(packed, scratch, options = {}) {
    const diagnostics = scratch.diagnostics;
    diagnostics.length = 0;
    for (const diagnostic of packed.diagnostics) {
        diagnostics.push({
            code: "viewUniformBuffer.packDiagnostic",
            sourceCode: diagnostic.code,
            message: diagnostic.message,
        });
    }
    const usage = options.usage ?? DEFAULT_UNLIT_MATERIAL_BUFFER_USAGE;
    if (!Number.isInteger(usage) || usage <= 0) {
        diagnostics.push({
            code: "viewUniformBuffer.invalidUsageFlags",
            field: "usage",
            message: "View uniform buffer usage flags must be a positive integer.",
        });
    }
    const floatCount = packed.floatCount ?? packed.data.length;
    const source = sourceViewFor(scratch, packed.data, floatCount);
    if (source.byteLength === 0 || packed.views.length === 0) {
        diagnostics.push({
            code: "viewUniformBuffer.emptyData",
            field: "data",
            message: "Packed view uniform data must contain at least one view matrix.",
        });
    }
    if (diagnostics.length > 0) {
        scratch.result.valid = false;
        scratch.result.plan = null;
        return scratch.result;
    }
    scratch.descriptor.label = options.label ?? "ViewUniforms/uniform";
    scratch.descriptor.size = source.byteLength;
    scratch.descriptor.usage = usage;
    scratch.descriptor.initialData = source;
    scratch.plan.source = source;
    scratch.plan.views = packed.views;
    scratch.result.valid = true;
    scratch.result.plan = scratch.plan;
    return scratch.result;
}
export function createViewUniformBufferDescriptor(packed, options = {}) {
    return writeViewUniformBufferDescriptor(packed, createViewUniformBufferDescriptorScratch(), options);
}
function sourceViewFor(scratch, data, floatCount) {
    if (floatCount === data.length) {
        scratch.source = data;
        return data;
    }
    if (scratch.source.buffer !== data.buffer ||
        scratch.source.byteOffset !== data.byteOffset ||
        scratch.source.length !== floatCount) {
        scratch.source = data.subarray(0, floatCount);
    }
    return scratch.source;
}
//# sourceMappingURL=view-uniform-buffer.js.map