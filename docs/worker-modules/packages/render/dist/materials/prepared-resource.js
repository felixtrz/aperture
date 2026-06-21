import { assetHandleKey } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { createMaterialDependencyReadinessReport, materialDependencyReadinessReportToJsonValue, } from "./dependency-readiness.js";
import { createMaterialPipelineKeyInput, materialPipelineKeyInputToKey, } from "./pipeline-key.js";
import { collectMaterialDependencyKeys, collectTextureBindingResources, } from "./prepared-resource-dependencies.js";
import { validateMaterialAsset } from "./validation.js";
export function createPreparedMaterialResourceDescriptor(options) {
    const materialKey = assetHandleKey(options.material);
    const entry = options.registry.get(options.material);
    if (entry === undefined) {
        return {
            valid: false,
            descriptor: null,
            diagnostics: [
                {
                    code: "preparedMaterialResource.missingMaterial",
                    materialKey,
                    message: `Material '${materialKey}' is not registered.`,
                },
            ],
        };
    }
    if (entry.status !== "ready" || entry.asset === null) {
        return {
            valid: false,
            descriptor: null,
            diagnostics: [
                {
                    code: "preparedMaterialResource.materialNotReady",
                    materialKey,
                    message: `Material '${materialKey}' is '${entry.status}', not ready.`,
                },
            ],
        };
    }
    const material = entry.asset;
    if (options.expectedMaterialFamily !== undefined &&
        material.kind !== options.expectedMaterialFamily) {
        return {
            valid: false,
            descriptor: null,
            diagnostics: [
                {
                    code: "preparedMaterialResource.unsupportedMaterialKind",
                    materialKey,
                    expectedMaterialFamily: options.expectedMaterialFamily,
                    actualMaterialFamily: material.kind,
                    message: `Prepared material resource descriptor expected '${options.expectedMaterialFamily}', not '${material.kind}'.`,
                },
            ],
        };
    }
    const validation = validateMaterialAsset(material);
    if (!validation.valid) {
        return {
            valid: false,
            descriptor: null,
            diagnostics: validation.diagnostics.map((diagnostic) => ({
                code: "preparedMaterialResource.invalidMaterial",
                materialKey,
                ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
                message: diagnostic.message,
            })),
        };
    }
    const dependencyReadiness = createMaterialDependencyReadinessReport({
        registry: options.registry,
        material: options.material,
    });
    if (!dependencyReadiness.ready) {
        return {
            valid: false,
            descriptor: null,
            diagnostics: dependencyReadiness.diagnostics,
        };
    }
    const pipelineKeyInput = createMaterialPipelineKeyInput(material);
    const pipelineKey = materialPipelineKeyInputToKey(pipelineKeyInput);
    const sourceMaterialKey = materialKey;
    return {
        valid: true,
        descriptor: {
            resourceFamily: "material",
            sourceMaterialKey,
            materialKey,
            label: material.label,
            materialFamily: material.kind,
            materialKind: material.kind,
            pipelineKey,
            pipelineKeyInput,
            materialResourceKey: preparedMaterialResourceKey(sourceMaterialKey, entry.version),
            bindGroupResourceKey: preparedMaterialBindGroupResourceKey({
                sourceMaterialKey,
                pipelineKey,
                version: entry.version,
            }),
            dependencies: collectMaterialDependencyKeys(material),
            textureBindings: collectTextureBindingResources(material),
            dependencyReadiness: materialDependencyReadinessReportToJsonValue(dependencyReadiness),
        },
        diagnostics: [],
    };
}
export function createUnlitPreparedMaterialResourceDescriptor(options) {
    return createPreparedMaterialResourceDescriptor({
        ...options,
        expectedMaterialFamily: "unlit",
    });
}
export function createMatcapPreparedMaterialResourceDescriptor(options) {
    return createPreparedMaterialResourceDescriptor({
        ...options,
        expectedMaterialFamily: "matcap",
    });
}
export function createStandardPreparedMaterialResourceDescriptor(options) {
    return createPreparedMaterialResourceDescriptor({
        ...options,
        expectedMaterialFamily: "standard",
    });
}
export function createDebugNormalPreparedMaterialResourceDescriptor(options) {
    return createPreparedMaterialResourceDescriptor({
        ...options,
        expectedMaterialFamily: "debug-normal",
    });
}
export function preparedMaterialResourceKey(sourceMaterialKey, version) {
    return `prepared-material:${sourceMaterialKey}@v${version}`;
}
export function preparedMaterialBindGroupResourceKey(input) {
    return `prepared-material-bind-group:${input.sourceMaterialKey}@v${input.version}|pipeline:${input.pipelineKey}`;
}
//# sourceMappingURL=prepared-resource.js.map