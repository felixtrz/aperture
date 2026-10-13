const STANDARD_TEXTURE_SAMPLER_ALIGNMENT_FIELDS = [
    "baseColorTexture",
    "metallicRoughnessTexture",
    "normalTexture",
    "occlusionTexture",
    "emissiveTexture",
];
export function createStandardMaterialTextureSamplerAlignmentSummary(input) {
    const textureSlots = new Map(input.textureReadiness.slots.map((slot) => [slot.field, slot]));
    const samplerSlots = new Map(input.samplerFidelity.slots.map((slot) => [slot.field, slot]));
    return {
        materialKey: input.textureReadiness.materialKey,
        textureReady: input.textureReadiness.ready,
        samplerFidelityReady: input.samplerFidelity.ready,
        blockingTextureDiagnosticCount: input.textureReadiness.ready
            ? 0
            : input.textureReadiness.diagnostics.length,
        samplerWarningCount: input.samplerFidelity.diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length,
        byField: STANDARD_TEXTURE_SAMPLER_ALIGNMENT_FIELDS.map((field) => fieldSummary(field, textureSlots.get(field), samplerSlots.get(field))),
    };
}
export function standardMaterialTextureSamplerAlignmentSummaryToJsonValue(summary) {
    return {
        materialKey: summary.materialKey,
        textureReady: summary.textureReady,
        samplerFidelityReady: summary.samplerFidelityReady,
        blockingTextureDiagnosticCount: summary.blockingTextureDiagnosticCount,
        samplerWarningCount: summary.samplerWarningCount,
        byField: summary.byField.map((field) => ({ ...field })),
    };
}
function fieldSummary(field, textureSlot, samplerSlot) {
    return {
        field,
        textureSlotReady: textureSlot?.ready ?? null,
        samplerWarningCount: samplerSlot?.warningCount ?? 0,
    };
}
//# sourceMappingURL=standard-texture-sampler-alignment.js.map