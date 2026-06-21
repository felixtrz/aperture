import { assetHandleKey, } from "@aperture-engine/simulation";
const STANDARD_TEXTURE_DEPENDENCY_FIELDS = [
    "baseColorTexture",
    "metallicRoughnessTexture",
    "clearcoatTexture",
    "clearcoatRoughnessTexture",
    "transmissionTexture",
    "sheenColorTexture",
    "sheenRoughnessTexture",
    "iridescenceTexture",
    "iridescenceThicknessTexture",
    "normalTexture",
    "occlusionTexture",
    "emissiveTexture",
];
export function createPreparedStandardTextureDependencyKeys(options) {
    const diagnostics = [];
    const bindings = [];
    for (const field of STANDARD_TEXTURE_DEPENDENCY_FIELDS) {
        const binding = standardTextureBinding(options.material, field);
        if (binding === null) {
            continue;
        }
        const result = createPreparedStandardTextureBindingDependencyKeys({
            registry: options.registry,
            field,
            binding,
        });
        diagnostics.push(...result.diagnostics);
        if (result.dependencies !== null) {
            bindings.push(result.dependencies);
        }
    }
    if (diagnostics.length > 0) {
        return { valid: false, dependencies: null, diagnostics };
    }
    if (bindings.length === 0) {
        return { valid: true, dependencies: null, diagnostics: [] };
    }
    return {
        valid: true,
        dependencies: {
            bindings,
            cacheKeySegments: bindings.flatMap((binding) => binding.cacheKeySegments),
        },
        diagnostics: [],
    };
}
export function createPreparedStandardBaseColorTextureDependencyKeys(options) {
    const binding = options.material.baseColorTexture;
    if (binding === null) {
        return { valid: true, dependencies: null, diagnostics: [] };
    }
    return createPreparedStandardTextureBindingDependencyKeys({
        registry: options.registry,
        field: "baseColorTexture",
        binding,
    });
}
export function createPreparedStandardMetallicRoughnessTextureDependencyKeys(options) {
    const binding = options.material.metallicRoughnessTexture;
    if (binding === null) {
        return { valid: true, dependencies: null, diagnostics: [] };
    }
    return createPreparedStandardTextureBindingDependencyKeys({
        registry: options.registry,
        field: "metallicRoughnessTexture",
        binding,
    });
}
export function createPreparedStandardNormalTextureDependencyKeys(options) {
    const binding = options.material.normalTexture;
    if (binding === null) {
        return { valid: true, dependencies: null, diagnostics: [] };
    }
    return createPreparedStandardTextureBindingDependencyKeys({
        registry: options.registry,
        field: "normalTexture",
        binding,
    });
}
export function createPreparedStandardClearcoatTextureDependencyKeys(options) {
    const binding = options.material.clearcoatTexture;
    if (binding === null) {
        return { valid: true, dependencies: null, diagnostics: [] };
    }
    return createPreparedStandardTextureBindingDependencyKeys({
        registry: options.registry,
        field: "clearcoatTexture",
        binding,
    });
}
export function createPreparedStandardClearcoatRoughnessTextureDependencyKeys(options) {
    const binding = options.material.clearcoatRoughnessTexture;
    if (binding === null) {
        return { valid: true, dependencies: null, diagnostics: [] };
    }
    return createPreparedStandardTextureBindingDependencyKeys({
        registry: options.registry,
        field: "clearcoatRoughnessTexture",
        binding,
    });
}
export function createPreparedStandardTransmissionTextureDependencyKeys(options) {
    const binding = options.material.transmissionTexture;
    if (binding === null) {
        return { valid: true, dependencies: null, diagnostics: [] };
    }
    return createPreparedStandardTextureBindingDependencyKeys({
        registry: options.registry,
        field: "transmissionTexture",
        binding,
    });
}
export function createPreparedStandardSheenColorTextureDependencyKeys(options) {
    const binding = options.material.sheenColorTexture;
    if (binding === null) {
        return { valid: true, dependencies: null, diagnostics: [] };
    }
    return createPreparedStandardTextureBindingDependencyKeys({
        registry: options.registry,
        field: "sheenColorTexture",
        binding,
    });
}
export function createPreparedStandardSheenRoughnessTextureDependencyKeys(options) {
    const binding = options.material.sheenRoughnessTexture;
    if (binding === null) {
        return { valid: true, dependencies: null, diagnostics: [] };
    }
    return createPreparedStandardTextureBindingDependencyKeys({
        registry: options.registry,
        field: "sheenRoughnessTexture",
        binding,
    });
}
export function createPreparedStandardIridescenceTextureDependencyKeys(options) {
    const binding = options.material.iridescenceTexture;
    if (binding === null) {
        return { valid: true, dependencies: null, diagnostics: [] };
    }
    return createPreparedStandardTextureBindingDependencyKeys({
        registry: options.registry,
        field: "iridescenceTexture",
        binding,
    });
}
export function createPreparedStandardIridescenceThicknessTextureDependencyKeys(options) {
    const binding = options.material.iridescenceThicknessTexture;
    if (binding === null) {
        return { valid: true, dependencies: null, diagnostics: [] };
    }
    return createPreparedStandardTextureBindingDependencyKeys({
        registry: options.registry,
        field: "iridescenceThicknessTexture",
        binding,
    });
}
export function createPreparedStandardTextureBindingDependencyKeys(options) {
    const diagnostics = [];
    if (options.binding.texture === null) {
        diagnostics.push({
            code: "preparedStandardTextureDependency.missingTextureHandle",
            field: `${options.field}.texture`,
            message: "Prepared StandardMaterial texture resources require a texture handle.",
        });
    }
    if (options.binding.sampler === null) {
        diagnostics.push({
            code: "preparedStandardTextureDependency.missingSamplerHandle",
            field: `${options.field}.sampler`,
            message: "Prepared StandardMaterial texture resources require a sampler handle.",
        });
    }
    const texture = options.binding.texture === null
        ? null
        : preparedStandardTextureDependencyVersionKey({
            registry: options.registry,
            handle: options.binding.texture,
            field: options.field,
            diagnostics,
        });
    const sampler = options.binding.sampler === null
        ? null
        : preparedStandardSamplerDependencyVersionKey({
            registry: options.registry,
            handle: options.binding.sampler,
            field: options.field,
            diagnostics,
        });
    if (diagnostics.length > 0 || texture === null || sampler === null) {
        return { valid: false, dependencies: null, diagnostics };
    }
    return {
        valid: true,
        dependencies: {
            field: options.field,
            texture,
            sampler,
            cacheKeySegments: [
                `${options.field}:texture:${texture.versionKey}`,
                `${options.field}:sampler:${sampler.versionKey}`,
            ],
        },
        diagnostics: [],
    };
}
export function standardTextureBinding(material, field) {
    switch (field) {
        case "baseColorTexture":
            return material.baseColorTexture;
        case "metallicRoughnessTexture":
            return material.metallicRoughnessTexture;
        case "clearcoatTexture":
            return material.clearcoatTexture;
        case "clearcoatRoughnessTexture":
            return material.clearcoatRoughnessTexture;
        case "transmissionTexture":
            return material.transmissionTexture;
        case "sheenColorTexture":
            return material.sheenColorTexture;
        case "sheenRoughnessTexture":
            return material.sheenRoughnessTexture;
        case "iridescenceTexture":
            return material.iridescenceTexture;
        case "iridescenceThicknessTexture":
            return material.iridescenceThicknessTexture;
        case "normalTexture":
            return material.normalTexture;
        case "occlusionTexture":
            return material.occlusionTexture;
        case "emissiveTexture":
            return material.emissiveTexture;
    }
}
function preparedStandardTextureDependencyVersionKey(options) {
    const handleKey = assetHandleKey(options.handle);
    const entry = options.registry.get(options.handle);
    if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
        options.diagnostics.push({
            code: "preparedStandardTextureDependency.textureSourceNotReady",
            field: options.field,
            resourceKey: handleKey,
            status: entry?.status ?? "missing",
            message: `Texture source asset '${handleKey}' is not ready for prepared StandardMaterial resources.`,
        });
        return null;
    }
    return {
        field: options.field,
        kind: "texture",
        handleKey,
        version: entry.version,
        versionKey: `${handleKey}@${entry.version}`,
    };
}
function preparedStandardSamplerDependencyVersionKey(options) {
    const handleKey = assetHandleKey(options.handle);
    const entry = options.registry.get(options.handle);
    if (entry === undefined || entry.status !== "ready" || entry.asset === null) {
        options.diagnostics.push({
            code: "preparedStandardTextureDependency.samplerSourceNotReady",
            field: options.field,
            resourceKey: handleKey,
            status: entry?.status ?? "missing",
            message: `Sampler source asset '${handleKey}' is not ready for prepared StandardMaterial resources.`,
        });
        return null;
    }
    return {
        field: options.field,
        kind: "sampler",
        handleKey,
        version: entry.version,
        versionKey: `${handleKey}@${entry.version}`,
    };
}
//# sourceMappingURL=prepared-standard-material-dependencies.js.map