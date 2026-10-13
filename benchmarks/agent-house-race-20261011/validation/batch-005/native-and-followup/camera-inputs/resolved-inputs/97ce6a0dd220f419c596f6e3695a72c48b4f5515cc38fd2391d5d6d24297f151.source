import { assetHandleKey, } from "@aperture-engine/simulation";
export const HIGH_METALLIC_FACTOR_THRESHOLD = 0.8;
export const DEFAULT_HIGH_RANGE_LUMINANCE_THRESHOLD = 1;
/**
 * Analyze presentation compatibility without touching a GPU. The function is
 * intentionally side-effect free and only considers visible mesh draws, so
 * culled or hidden materials do not create scene-health warnings.
 */
export function analyzeLightingHealth(input) {
    const visible = visibleStandardMaterials(input.snapshot, input.assets);
    const visibleMaterialKeys = new Set(input.snapshot.meshDraws.map((draw) => assetHandleKey(draw.material)));
    const unresolved = [...visibleMaterialKeys].filter((key) => !visible.some((material) => material.key === key)).length;
    const highMetallic = visible.filter((material) => material.asset.metallicFactor >= HIGH_METALLIC_FACTOR_THRESHOLD);
    const environmentCount = input.snapshot.environments.length;
    const derivedDiffuseActive = input.snapshot.meshDraws.some((draw) => hasPipelineToken(draw.batchKey.pipelineKey, "iblDiffuse"));
    const derivedSpecularActive = input.snapshot.meshDraws.some((draw) => hasPipelineToken(draw.batchKey.pipelineKey, "iblSpecularProof") ||
        hasPipelineToken(draw.batchKey.pipelineKey, "iblSpecularBrdf"));
    const diffuseIblActive = input.ibl?.diffuseActive ?? derivedDiffuseActive;
    const specularIblActive = input.ibl?.specularActive ?? derivedSpecularActive;
    const diffuseIblReady = input.ibl?.diffuseReady ?? diffuseIblActive;
    const specularIblReady = input.ibl?.specularReady ?? specularIblActive;
    const environmentPreparationStatus = input.ibl?.preparationStatus ??
        inferredPreparationStatus({
            environmentCount,
            diffuseIblReady,
            specularIblReady,
        });
    const maximumMetallicFactor = maximumMetallic(highMetallic);
    const warnings = [];
    if (highMetallic.length > 0 && !specularIblActive) {
        const entities = uniqueSortedEntities(highMetallic.flatMap((material) => material.entities));
        warnings.push({
            code: "render.material.metalWithoutSpecularIbl",
            severity: "warning",
            materialCount: highMetallic.length,
            entityCount: entities.length,
            maximumMetallicFactor,
            activeEnvironmentCount: environmentCount,
            materialKeys: highMetallic.map((material) => material.key),
            entities,
            message: "Highly metallic materials are visible without specular environment lighting.",
            suggestions: [
                'Use spawn.lightRig({ preset: "studio-neutral", environmentMap }) or spawn.environment({ source }) with an HDR asset.',
                'For stylized painted assets, use material.preset("painted-stylized") or an explicit metallicFactor patch.',
            ],
        });
    }
    if (environmentCount > 0 &&
        visible.length > 0 &&
        !diffuseIblActive &&
        !specularIblActive) {
        warnings.push({
            code: "render.environment.requestedButInactive",
            severity: "warning",
            activeEnvironmentCount: environmentCount,
            message: "An environment is authored but is not contributing to the submitted StandardMaterial pipeline.",
            suggestions: [
                "Run render_diagnose and inspect environment preparation plus StandardMaterial IBL readiness.",
                "Confirm the HDR asset is ready and the submitted frame uses an iblDiffuse/iblSpecular StandardMaterial pipeline key.",
            ],
        });
    }
    const measurement = input.luminance;
    const clippingRiskThreshold = measurement?.clippingRiskThreshold ??
        DEFAULT_HIGH_RANGE_LUMINANCE_THRESHOLD;
    if (input.output.tonemap === "none" &&
        measurement !== undefined &&
        Number.isFinite(measurement.maximumPreOutputLuminance) &&
        measurement.maximumPreOutputLuminance > clippingRiskThreshold) {
        warnings.push({
            code: "render.output.untoneMappedHighRange",
            severity: "warning",
            maximumPreOutputLuminance: measurement.maximumPreOutputLuminance,
            clippingRiskThreshold,
            message: "Measured pre-output luminance exceeds the clipping-risk threshold while tonemapping is disabled.",
            suggestions: [
                'Set render.tonemap to "aces" and render.exposure to an explicit finite value.',
                "Use frame_capture pixel samples to inspect highlights before reducing authored light intensity.",
            ],
        });
    }
    return {
        output: { ...input.output },
        lighting: {
            ambient: countLights(input.snapshot, "ambient"),
            directional: countLights(input.snapshot, "directional"),
            point: countLights(input.snapshot, "point"),
            spot: countLights(input.snapshot, "spot"),
            area: countLights(input.snapshot, "rect-area"),
            environment: environmentCount,
            diffuseIblReady,
            specularIblReady,
            diffuseIblActive,
            specularIblActive,
            environmentPreparationStatus,
        },
        materials: {
            visible: visible.length,
            highMetallic: highMetallic.length,
            highMetallicWithoutIbl: specularIblActive ? 0 : highMetallic.length,
            maximumMetallicFactor,
            unresolved,
        },
        warnings,
    };
}
export function lightingHealthReportToJsonValue(report) {
    return {
        output: { ...report.output },
        lighting: { ...report.lighting },
        materials: { ...report.materials },
        warnings: report.warnings.map((warning) => ({
            ...warning,
            suggestions: [...warning.suggestions],
            ...(warning.materialKeys === undefined
                ? {}
                : { materialKeys: [...warning.materialKeys] }),
            ...(warning.entities === undefined
                ? {}
                : { entities: warning.entities.map((entity) => ({ ...entity })) }),
        })),
    };
}
export function lightingHealthReportToJson(report) {
    return JSON.stringify(lightingHealthReportToJsonValue(report));
}
/**
 * Allocation-free fingerprint of the snapshot/material facts consumed by the
 * analyzer. Frame/time and transforms are intentionally excluded: a static
 * visible material/lighting set can reuse its previous report across frames.
 */
export function lightingHealthInputFingerprint(snapshot, assets) {
    let hash = 0x811c9dc5;
    hash = hashInteger(hash, snapshot.meshDraws.length);
    for (const draw of snapshot.meshDraws) {
        hash = hashString(hash, draw.material.kind);
        hash = hashString(hash, draw.material.id);
        hash = hashInteger(hash, draw.entity.index);
        hash = hashInteger(hash, draw.entity.generation);
        hash = hashString(hash, draw.batchKey.pipelineKey);
        const entry = assets.get(draw.material);
        hash = hashInteger(hash, entry?.version ?? -1);
        hash = hashString(hash, entry?.status ?? "missing");
        if (entry?.status === "ready" && entry.asset?.kind === "standard") {
            hash = hashScalar(hash, entry.asset.metallicFactor);
            hash = hashScalar(hash, entry.asset.roughnessFactor);
        }
    }
    hash = hashInteger(hash, snapshot.lights.length);
    for (const light of snapshot.lights) {
        hash = hashString(hash, light.kind);
    }
    hash = hashInteger(hash, snapshot.environments.length);
    for (const environment of snapshot.environments) {
        hash = hashInteger(hash, environment.environmentId);
        hash = hashString(hash, environment.handle?.kind ?? "none");
        hash = hashString(hash, environment.handle?.id ?? "none");
    }
    return hash >>> 0;
}
function visibleStandardMaterials(snapshot, assets) {
    const entitiesByMaterial = new Map();
    const handlesByMaterial = new Map();
    for (const draw of snapshot.meshDraws) {
        const key = assetHandleKey(draw.material);
        handlesByMaterial.set(key, draw.material);
        const entities = entitiesByMaterial.get(key);
        if (entities === undefined) {
            entitiesByMaterial.set(key, [draw.entity]);
        }
        else if (!entities.some((entity) => sameEntity(entity, draw.entity))) {
            entities.push(draw.entity);
        }
    }
    return [...handlesByMaterial.entries()]
        .flatMap(([key, handle]) => {
        const entry = assets.get(handle);
        const asset = entry?.status === "ready" ? entry.asset : null;
        if (asset === null || asset?.kind !== "standard") {
            return [];
        }
        return [
            {
                key,
                handle,
                asset,
                entities: uniqueSortedEntities(entitiesByMaterial.get(key) ?? []),
            },
        ];
    })
        .sort((a, b) => a.key.localeCompare(b.key));
}
function maximumMetallic(materials) {
    let maximum = 0;
    for (const material of materials) {
        maximum = Math.max(maximum, material.asset.metallicFactor);
    }
    return maximum;
}
function countLights(snapshot, kind) {
    let count = 0;
    for (const light of snapshot.lights) {
        if (light.kind === kind) {
            count += 1;
        }
    }
    return count;
}
function inferredPreparationStatus(input) {
    if (input.environmentCount === 0) {
        return "not-requested";
    }
    if (input.diffuseIblReady && input.specularIblReady) {
        return "diffuse-specular-ready";
    }
    if (input.diffuseIblReady) {
        return "diffuse-ready";
    }
    return "source-missing";
}
function hasPipelineToken(pipelineKey, token) {
    return `|${pipelineKey}|`.includes(`|${token}|`);
}
function uniqueSortedEntities(entities) {
    const byKey = new Map();
    for (const entity of entities) {
        byKey.set(`${entity.index}:${entity.generation}`, {
            index: entity.index,
            generation: entity.generation,
        });
    }
    return [...byKey.values()].sort((a, b) => a.index - b.index || a.generation - b.generation);
}
function sameEntity(a, b) {
    return a.index === b.index && a.generation === b.generation;
}
function hashString(hash, value) {
    let next = hash;
    for (let index = 0; index < value.length; index += 1) {
        next = Math.imul(next ^ value.charCodeAt(index), 0x01000193);
    }
    return next;
}
function hashInteger(hash, value) {
    return Math.imul(hash ^ (value | 0), 0x01000193);
}
function hashScalar(hash, value) {
    return hashInteger(hash, Number.isFinite(value) ? Math.round(value * 1e6) : 0);
}
//# sourceMappingURL=lighting-health.js.map