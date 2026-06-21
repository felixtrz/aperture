export function isIdentityTextureTransform(transform) {
    const offset = transform.offset ?? [0, 0];
    const scale = transform.scale ?? [1, 1];
    const rotation = transform.rotation ?? 0;
    return (offset[0] === 0 &&
        offset[1] === 0 &&
        scale[0] === 1 &&
        scale[1] === 1 &&
        rotation === 0);
}
export function isSupportedStandardTextureTransform(input) {
    return ((input.field === "baseColorTexture" ||
        input.field === "metallicRoughnessTexture" ||
        input.field === "clearcoatTexture" ||
        input.field === "normalTexture" ||
        input.field === "occlusionTexture" ||
        input.field === "emissiveTexture") &&
        (input.texCoord === 0 || input.texCoord === 1) &&
        isFiniteTextureTransform(input.transform));
}
export function textureFormatMatchesColorSpace(texture) {
    return (isSrgbTextureFormat(texture.format) === (texture.colorSpace === "srgb"));
}
export function cloneTextureTransform(transform) {
    return {
        ...(transform.offset === undefined
            ? {}
            : { offset: [transform.offset[0], transform.offset[1]] }),
        ...(transform.scale === undefined
            ? {}
            : { scale: [transform.scale[0], transform.scale[1]] }),
        ...(transform.rotation === undefined
            ? {}
            : { rotation: transform.rotation }),
    };
}
function isFiniteTextureTransform(transform) {
    const offset = transform.offset ?? [0, 0];
    const scale = transform.scale ?? [1, 1];
    const rotation = transform.rotation ?? 0;
    return (Number.isFinite(offset[0]) &&
        Number.isFinite(offset[1]) &&
        Number.isFinite(scale[0]) &&
        Number.isFinite(scale[1]) &&
        Number.isFinite(rotation));
}
function isSrgbTextureFormat(format) {
    return format.endsWith("-srgb");
}
//# sourceMappingURL=standard-texture-readiness-utils.js.map