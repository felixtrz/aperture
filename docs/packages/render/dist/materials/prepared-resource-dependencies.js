import { assetHandleKey } from "@aperture-engine/simulation";
import { materialTextureBindings } from "./bindings.js";
export function collectMaterialDependencyKeys(material) {
    const dependencyKeys = [];
    const seen = new Set();
    for (const [, binding] of materialTextureBindings(material)) {
        appendDependencyKey(binding.texture, dependencyKeys, seen);
        appendDependencyKey(binding.sampler, dependencyKeys, seen);
    }
    return dependencyKeys;
}
export function collectTextureBindingResources(material) {
    const resources = [];
    for (const [field, binding] of materialTextureBindings(material)) {
        if (binding.texture === null || binding.sampler === null) {
            continue;
        }
        resources.push({
            field,
            textureKey: assetHandleKey(binding.texture),
            samplerKey: assetHandleKey(binding.sampler),
            ...(binding.texCoord === undefined ? {} : { texCoord: binding.texCoord }),
        });
    }
    return resources;
}
function appendDependencyKey(handle, dependencyKeys, seen) {
    if (handle === null) {
        return;
    }
    const key = assetHandleKey(handle);
    if (!seen.has(key)) {
        seen.add(key);
        dependencyKeys.push(key);
    }
}
//# sourceMappingURL=prepared-resource-dependencies.js.map