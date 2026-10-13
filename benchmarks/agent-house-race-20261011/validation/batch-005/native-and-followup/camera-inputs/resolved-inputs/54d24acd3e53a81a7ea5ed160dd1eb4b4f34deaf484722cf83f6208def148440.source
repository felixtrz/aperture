export function webGpuResourceKey(kind, id) {
    const normalized = id.trim();
    if (normalized.length === 0) {
        throw new RangeError(`Cannot create '${kind}' resource key with empty id.`);
    }
    return `${kind}:${normalized}`;
}
export function meshBufferResourceKey(meshLabel) {
    return webGpuResourceKey("mesh-buffer", meshLabel);
}
export function meshVertexBufferResourceKey(meshLabel, streamId) {
    return webGpuResourceKey("mesh-vertex-buffer", `${meshLabel}/vertex:${streamId}`);
}
export function meshIndexBufferResourceKey(meshLabel) {
    return webGpuResourceKey("mesh-index-buffer", `${meshLabel}/index`);
}
export function materialUniformBufferResourceKey(label) {
    return webGpuResourceKey("material-buffer", label);
}
export function viewUniformBufferResourceKey(label) {
    return webGpuResourceKey("view-uniform-buffer", label);
}
export function worldTransformBufferResourceKey(label) {
    return webGpuResourceKey("world-transform-buffer", label);
}
export function skinningJointBufferResourceKey(label) {
    return webGpuResourceKey("skinning-joint-buffer", label);
}
export function morphTargetWeightBufferResourceKey(label) {
    return webGpuResourceKey("morph-target-weight-buffer", label);
}
export function morphTargetDeltaBufferResourceKey(label) {
    return webGpuResourceKey("morph-target-delta-buffer", label);
}
export function morphInstanceDescriptorBufferResourceKey(label) {
    return webGpuResourceKey("morph-instance-descriptor-buffer", label);
}
export function instanceTintBufferResourceKey(label) {
    return webGpuResourceKey("instance-tint-buffer", label);
}
export function instanceAttributeBufferResourceKey(label) {
    return webGpuResourceKey("instance-attribute-buffer", label);
}
export function shaderModuleResourceKey(label) {
    return webGpuResourceKey("shader-module", label);
}
export function renderPipelineResourceKey(cacheKey) {
    return webGpuResourceKey("render-pipeline", cacheKey);
}
export function bindGroupResourceKey(label) {
    return webGpuResourceKey("bind-group", label);
}
export function commandBufferResourceKey(label) {
    return webGpuResourceKey("command-buffer", label);
}
export function commandEncoderResourceKey(label) {
    return webGpuResourceKey("command-encoder", label);
}
//# sourceMappingURL=resource-keys.js.map