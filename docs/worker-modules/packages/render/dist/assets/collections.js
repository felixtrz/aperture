import { AssetRegistry, TypedAssetCollection, assetHandleKey, createFontAtlasHandle, createMaterialHandle, createMeshHandle, createParticleEffectHandle, createShaderHandle, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { materialTextureBindings } from "../materials/bindings.js";
import { isCustomWgslMaterialAsset } from "../materials/family-key.js";
import { msdfFontAtlasDependencies, } from "../text/index.js";
import { particleEffectDependencies, } from "./particles.js";
export class MaterialAssetCollections {
    #all;
    unlit;
    matcap;
    standard;
    debugNormal;
    customWgsl;
    constructor(registry) {
        this.#all = new TypedAssetCollection({
            registry,
            kind: "material",
            createHandle: createMaterialHandle,
            idPrefix: "material",
            label: (asset) => asset.label,
            dependencies: materialAssetDependencies,
        });
        this.unlit = new TypedAssetCollection({
            registry,
            kind: "material",
            createHandle: createMaterialHandle,
            idPrefix: "unlit-material",
            label: (asset) => asset.label,
            dependencies: materialAssetDependencies,
        });
        this.matcap = new TypedAssetCollection({
            registry,
            kind: "material",
            createHandle: createMaterialHandle,
            idPrefix: "matcap-material",
            label: (asset) => asset.label,
            dependencies: materialAssetDependencies,
        });
        this.standard = new TypedAssetCollection({
            registry,
            kind: "material",
            createHandle: createMaterialHandle,
            idPrefix: "standard-material",
            label: (asset) => asset.label,
            dependencies: materialAssetDependencies,
        });
        this.debugNormal = new TypedAssetCollection({
            registry,
            kind: "material",
            createHandle: createMaterialHandle,
            idPrefix: "debug-normal-material",
            label: (asset) => asset.label,
            dependencies: materialAssetDependencies,
        });
        this.customWgsl = new TypedAssetCollection({
            registry,
            kind: "material",
            createHandle: createMaterialHandle,
            idPrefix: "custom-wgsl-material",
            label: (asset) => asset.label,
            dependencies: materialAssetDependencies,
        });
    }
    get registry() {
        return this.#all.registry;
    }
    add(asset, options = {}) {
        return this.#all.add(asset, options);
    }
    register(options = {}) {
        return this.#all.register(options);
    }
    has(handle) {
        return this.#all.has(handle);
    }
    get(handle) {
        return this.#all.get(handle);
    }
    getAsset(handle) {
        return this.#all.getAsset(handle);
    }
    markLoading(handle) {
        return this.#all.markLoading(handle);
    }
    markReady(handle, asset, diagnostics) {
        return diagnostics === undefined
            ? this.#all.markReady(handle, asset)
            : this.#all.markReady(handle, asset, diagnostics);
    }
    markFailed(handle, diagnostics) {
        return this.#all.markFailed(handle, diagnostics);
    }
    list(filter = {}) {
        return this.#all.list(filter);
    }
}
export function createRenderAssetCollections(options = {}) {
    const registry = options.registry ?? new AssetRegistry();
    return {
        registry,
        meshes: new TypedAssetCollection({
            registry,
            kind: "mesh",
            createHandle: createMeshHandle,
            idPrefix: "mesh",
            label: (asset) => asset.label,
        }),
        materials: new MaterialAssetCollections(registry),
        shaders: new TypedAssetCollection({
            registry,
            kind: "shader",
            createHandle: createShaderHandle,
            idPrefix: "shader",
            label: (asset) => asset.label,
        }),
        fontAtlases: new TypedAssetCollection({
            registry,
            kind: "font-atlas",
            createHandle: createFontAtlasHandle,
            idPrefix: "font-atlas",
            label: (asset) => asset.label,
            dependencies: msdfFontAtlasDependencies,
        }),
        particleEffects: new TypedAssetCollection({
            registry,
            kind: "particle-effect",
            createHandle: createParticleEffectHandle,
            idPrefix: "particle-effect",
            label: (asset) => asset.label,
            dependencies: particleEffectDependencies,
        }),
    };
}
export function materialAssetDependencies(material) {
    const dependencies = [];
    const seen = new Set();
    if (isCustomWgslMaterialAsset(material)) {
        for (const dependency of material.dependencies) {
            appendDependency(dependency.handle, dependencies, seen);
        }
        for (const binding of material.bindings) {
            if (binding.kind === "texture") {
                appendDependency(binding.texture, dependencies, seen);
            }
            if (binding.kind === "sampler") {
                appendDependency(binding.sampler, dependencies, seen);
            }
        }
        return dependencies;
    }
    for (const [, binding] of materialTextureBindings(material)) {
        appendDependency(binding.texture, dependencies, seen);
        appendDependency(binding.sampler, dependencies, seen);
    }
    return dependencies;
}
function appendDependency(handle, dependencies, seen) {
    if (handle === null) {
        return;
    }
    const key = assetHandleKey(handle);
    if (!seen.has(key)) {
        seen.add(key);
        dependencies.push(handle);
    }
}
//# sourceMappingURL=collections.js.map