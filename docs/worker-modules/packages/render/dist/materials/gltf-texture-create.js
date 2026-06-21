import { createTextureMappingReportFromDecoded } from "./gltf-texture-result.js";
import { resolveDecodedImage, resolveDecodedImageAsync, } from "./gltf-texture-resolution.js";
import { prepareGltfTextureMapping } from "./gltf-texture-prepare.js";
export function createTextureAssetFromGltfTexture(options) {
    const prepared = prepareGltfTextureMapping(options);
    if (prepared.kind === "report") {
        return prepared.report;
    }
    const decoded = resolveDecodedImage({
        options,
        image: prepared.image,
        imageIndex: prepared.imageIndex,
        source: prepared.source,
        diagnostics: prepared.diagnostics,
    });
    return createTextureMappingReportFromDecoded({
        ...prepared,
        decoded,
    });
}
export async function createTextureAssetFromGltfTextureAsync(options) {
    const prepared = prepareGltfTextureMapping(options);
    if (prepared.kind === "report") {
        return prepared.report;
    }
    const decoded = await resolveDecodedImageAsync({
        options,
        image: prepared.image,
        imageIndex: prepared.imageIndex,
        source: prepared.source,
        diagnostics: prepared.diagnostics,
    });
    return createTextureMappingReportFromDecoded({
        ...prepared,
        decoded,
    });
}
//# sourceMappingURL=gltf-texture-create.js.map