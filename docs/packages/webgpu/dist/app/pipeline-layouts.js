import { createLightBindGroupLayoutDescriptor } from "../lighting/light-bind-group-layout.js";
import { createDebugNormalMaterialBindGroupLayoutPlan } from "../materials/debug-normal/debug-normal-bind-group-layout.js";
import { createMatcapMaterialBindGroupLayoutPlan } from "../materials/matcap/matcap-bind-group-layout.js";
import { createStandardMaterialBindGroupLayoutPlan } from "../materials/standard/standard-bind-group-layout.js";
import { STANDARD_LIGHT_CASCADED_SHADOW_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_CASCADED_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_IBL_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_POINT_SHADOW_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY, STANDARD_LIGHT_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY, createStandardLightCascadedShadowBindGroupLayoutDescriptor, createStandardLightIblBindGroupLayoutDescriptor, createStandardLightMultiShadowBindGroupLayoutDescriptor, createStandardLightPointShadowBindGroupLayoutDescriptor, createStandardLightShadowBindGroupLayoutDescriptor, } from "../materials/standard/standard-light-shadow-bind-group.js";
import { createUnlitBindGroupLayoutMetadata, } from "../materials/unlit/unlit-bind-group.js";
import { createUnlitBindGroupLayoutPlan } from "../materials/unlit/unlit-bind-group-layout.js";
export function getWebGpuAppPipelineLayouts(options) {
    const pipelineResourceKey = options.pipeline.resource?.cacheKey ?? "missing";
    const key = `${options.kind}|${pipelineResourceKey}`;
    const cached = options.cache.layouts.get(key);
    if (cached !== undefined) {
        return cached;
    }
    const layouts = options.kind === "standard"
        ? createStandardAppPipelineLayouts(pipelineResourceKey, options.getBindGroupLayout)
        : options.kind === "debug-normal"
            ? createDebugNormalAppPipelineLayouts(pipelineResourceKey, options.getBindGroupLayout)
            : options.kind === "matcap"
                ? createMatcapAppPipelineLayouts(pipelineResourceKey, options.getBindGroupLayout)
                : createUnlitAppPipelineLayouts(pipelineResourceKey, options.getBindGroupLayout);
    options.cache.layouts.set(key, layouts);
    return layouts;
}
function createUnlitAppPipelineLayouts(pipelineResourceKey, getBindGroupLayout) {
    const autoLayoutKeySuffix = `/pipeline:${pipelineResourceKey}`;
    const unlitLayoutPlan = createUnlitBindGroupLayoutPlan();
    return {
        kind: "unlit",
        pipelineResourceKey,
        sharedLayouts: unlitLayoutPlan.layouts.map((descriptor) => ({
            group: descriptor.group,
            layoutKey: `webgpu-app/${descriptor.label}${autoLayoutKeySuffix}`,
            layout: getBindGroupLayout(descriptor.group),
            metadata: {
                ...descriptor.metadata,
                layoutKey: `webgpu-app/${descriptor.label}${autoLayoutKeySuffix}`,
            },
        })),
        materialLayout: null,
        lightLayout: null,
    };
}
function createStandardAppPipelineLayouts(pipelineResourceKey, getBindGroupLayout) {
    const usesLightShadowIblGroup = pipelineResourceKey.includes(STANDARD_LIGHT_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY);
    const usesLightCascadedShadowIblGroup = pipelineResourceKey.includes(STANDARD_LIGHT_CASCADED_SHADOW_IBL_BIND_GROUP_LAYOUT_KEY);
    const usesLightIblGroup = pipelineResourceKey.includes(STANDARD_LIGHT_IBL_BIND_GROUP_LAYOUT_KEY);
    const usesSpecularIblProof = pipelineResourceKey.includes("specular-ibl-proof@7");
    const usesLightShadowGroup = pipelineResourceKey.includes(STANDARD_LIGHT_SHADOW_BIND_GROUP_LAYOUT_KEY);
    const usesLightCascadedShadowGroup = pipelineResourceKey.includes(STANDARD_LIGHT_CASCADED_SHADOW_BIND_GROUP_LAYOUT_KEY);
    const usesLightPointShadowGroup = pipelineResourceKey.includes(STANDARD_LIGHT_POINT_SHADOW_BIND_GROUP_LAYOUT_KEY);
    const usesLightMultiShadowGroup = pipelineResourceKey.includes(STANDARD_LIGHT_MULTI_SHADOW_BIND_GROUP_LAYOUT_KEY);
    const usesClusteredLocalLights = pipelineResourceKey.includes("cluster-params@16");
    const usesClusteredLocalLightCookies = pipelineResourceKey.includes("cluster-cookie");
    const usesClusteredLocalLightShadowCookies = pipelineResourceKey.includes("clusteredLocalLightShadowCookies") ||
        pipelineResourceKey.includes("cluster-cookie-shadow-matrix@2");
    const usesClusteredLocalLightCubeCookies = pipelineResourceKey.includes("cluster-cookie-cube-texture@20");
    const usesClusteredLocalLightArrayCookies = pipelineResourceKey.includes("cluster-cookie-array-texture@20");
    const usesClusteredLocalLightArrayShadows = pipelineResourceKey.includes("clusteredLocalLightArrayShadows") ||
        pipelineResourceKey.includes("directional-depth-array@3");
    const usesClusteredLocalLightPointArrayShadows = pipelineResourceKey.includes("clusteredLocalLightPointArrayShadows") ||
        pipelineResourceKey.includes("point-depth-array@9") ||
        (usesLightPointShadowGroup &&
            pipelineResourceKey.includes("depth-array@3"));
    const autoLayoutKeySuffix = `/pipeline:${pipelineResourceKey}`;
    const baseLightLayoutKey = usesLightShadowIblGroup
        ? "webgpu-app/standard/lights-shadow-ibl/group-3"
        : usesLightCascadedShadowIblGroup
            ? "webgpu-app/standard/lights-cascaded-shadow-ibl/group-3"
            : usesLightIblGroup
                ? "webgpu-app/standard/lights-ibl/group-3"
                : usesLightMultiShadowGroup
                    ? "webgpu-app/standard/lights-multi-shadow/group-3"
                    : usesLightCascadedShadowGroup
                        ? "webgpu-app/standard/lights-cascaded-shadow/group-3"
                        : usesLightPointShadowGroup
                            ? "webgpu-app/standard/lights-point-shadow/group-3"
                            : usesLightShadowGroup
                                ? "webgpu-app/standard/lights-shadow/group-3"
                                : "webgpu-app/standard/group-3";
    const lightLayoutKey = usesClusteredLocalLights
        ? `${baseLightLayoutKey}/${usesClusteredLocalLightCubeCookies
            ? "clustered-local-light-cube-cookies"
            : usesClusteredLocalLightArrayCookies
                ? "clustered-local-light-array-cookies"
                : usesClusteredLocalLightCookies
                    ? "clustered-local-light-cookies"
                    : "clustered-local-lights"}`
        : baseLightLayoutKey;
    return {
        kind: "standard",
        pipelineResourceKey,
        sharedLayouts: [0, 1].map((group) => ({
            group,
            layoutKey: `webgpu-app/standard/group-${group}${autoLayoutKeySuffix}`,
            layout: getBindGroupLayout(group),
            metadata: createUnlitBindGroupLayoutMetadata(group, `webgpu-app/standard/group-${group}${autoLayoutKeySuffix}`),
        })),
        materialLayout: {
            group: 2,
            layoutKey: `webgpu-app/standard/group-2${autoLayoutKeySuffix}`,
            layout: getBindGroupLayout(2),
            descriptor: createStandardMaterialBindGroupLayoutPlan(`webgpu-app/standard/group-2${autoLayoutKeySuffix}`).layout,
        },
        lightLayout: {
            group: 3,
            layoutKey: `${lightLayoutKey}${autoLayoutKeySuffix}`,
            layout: getBindGroupLayout(3),
            descriptor: usesLightShadowIblGroup ||
                usesLightCascadedShadowIblGroup ||
                usesLightIblGroup
                ? createStandardLightIblBindGroupLayoutDescriptor({
                    shadowMap: usesLightShadowIblGroup || usesLightCascadedShadowIblGroup,
                    cascadedShadowMap: usesLightCascadedShadowIblGroup,
                    specularProof: usesSpecularIblProof,
                    clusteredLocalLights: usesClusteredLocalLights,
                    clusteredLocalLightCookies: usesClusteredLocalLightCookies,
                    clusteredLocalLightShadowCookies: usesClusteredLocalLightShadowCookies,
                    clusteredLocalLightCookieTextureViewDimension: usesClusteredLocalLightCubeCookies
                        ? "cube"
                        : usesClusteredLocalLightArrayCookies
                            ? "2d-array"
                            : "2d",
                })
                : usesLightMultiShadowGroup
                    ? createStandardLightMultiShadowBindGroupLayoutDescriptor({
                        clusteredLocalLights: usesClusteredLocalLights,
                        clusteredLocalLightArrayShadows: usesClusteredLocalLightArrayShadows,
                        clusteredLocalLightPointArrayShadows: usesClusteredLocalLightPointArrayShadows,
                        clusteredLocalLightCookies: usesClusteredLocalLightCookies,
                        clusteredLocalLightShadowCookies: usesClusteredLocalLightShadowCookies,
                        clusteredLocalLightCookieTextureViewDimension: usesClusteredLocalLightCubeCookies
                            ? "cube"
                            : usesClusteredLocalLightArrayCookies
                                ? "2d-array"
                                : "2d",
                    })
                    : usesLightCascadedShadowGroup
                        ? createStandardLightCascadedShadowBindGroupLayoutDescriptor({
                            clusteredLocalLights: usesClusteredLocalLights,
                            clusteredLocalLightCookies: usesClusteredLocalLightCookies,
                            clusteredLocalLightShadowCookies: usesClusteredLocalLightShadowCookies,
                            clusteredLocalLightCookieTextureViewDimension: usesClusteredLocalLightCubeCookies
                                ? "cube"
                                : usesClusteredLocalLightArrayCookies
                                    ? "2d-array"
                                    : "2d",
                        })
                        : usesLightShadowGroup
                            ? createStandardLightShadowBindGroupLayoutDescriptor({
                                clusteredLocalLights: usesClusteredLocalLights,
                                clusteredLocalLightCookies: usesClusteredLocalLightCookies,
                                clusteredLocalLightShadowCookies: usesClusteredLocalLightShadowCookies,
                                clusteredLocalLightCookieTextureViewDimension: usesClusteredLocalLightCubeCookies
                                    ? "cube"
                                    : usesClusteredLocalLightArrayCookies
                                        ? "2d-array"
                                        : "2d",
                            })
                            : usesLightPointShadowGroup
                                ? createStandardLightPointShadowBindGroupLayoutDescriptor({
                                    clusteredLocalLights: usesClusteredLocalLights,
                                    clusteredLocalLightPointArrayShadows: usesClusteredLocalLightPointArrayShadows,
                                    clusteredLocalLightCookies: usesClusteredLocalLightCookies,
                                    clusteredLocalLightShadowCookies: usesClusteredLocalLightShadowCookies,
                                    clusteredLocalLightCookieTextureViewDimension: usesClusteredLocalLightCubeCookies
                                        ? "cube"
                                        : usesClusteredLocalLightArrayCookies
                                            ? "2d-array"
                                            : "2d",
                                })
                                : createLightBindGroupLayoutDescriptor({
                                    group: 3,
                                    label: "webgpu-app/standard/group-3",
                                    clusteredLocalLights: usesClusteredLocalLights,
                                    clusteredLocalLightCookies: usesClusteredLocalLightCookies,
                                    clusteredLocalLightCookieTextureViewDimension: usesClusteredLocalLightCubeCookies
                                        ? "cube"
                                        : usesClusteredLocalLightArrayCookies
                                            ? "2d-array"
                                            : "2d",
                                }),
        },
    };
}
function createMatcapAppPipelineLayouts(pipelineResourceKey, getBindGroupLayout) {
    const autoLayoutKeySuffix = `/pipeline:${pipelineResourceKey}`;
    return {
        kind: "matcap",
        pipelineResourceKey,
        sharedLayouts: [0, 1].map((group) => ({
            group,
            layoutKey: `webgpu-app/matcap/group-${group}${autoLayoutKeySuffix}`,
            layout: getBindGroupLayout(group),
            metadata: createUnlitBindGroupLayoutMetadata(group, `webgpu-app/matcap/group-${group}${autoLayoutKeySuffix}`),
        })),
        materialLayout: {
            group: 2,
            layoutKey: `webgpu-app/matcap/group-2${autoLayoutKeySuffix}`,
            layout: getBindGroupLayout(2),
            descriptor: createMatcapMaterialBindGroupLayoutPlan(`webgpu-app/matcap/group-2${autoLayoutKeySuffix}`).layout,
        },
        lightLayout: null,
    };
}
function createDebugNormalAppPipelineLayouts(pipelineResourceKey, getBindGroupLayout) {
    const autoLayoutKeySuffix = `/pipeline:${pipelineResourceKey}`;
    return {
        kind: "debug-normal",
        pipelineResourceKey,
        sharedLayouts: [0, 1].map((group) => ({
            group,
            layoutKey: `webgpu-app/debug-normal/group-${group}${autoLayoutKeySuffix}`,
            layout: getBindGroupLayout(group),
            metadata: createUnlitBindGroupLayoutMetadata(group, `webgpu-app/debug-normal/group-${group}${autoLayoutKeySuffix}`),
        })),
        materialLayout: {
            group: 2,
            layoutKey: `webgpu-app/debug-normal/group-2${autoLayoutKeySuffix}`,
            layout: getBindGroupLayout(2),
            descriptor: createDebugNormalMaterialBindGroupLayoutPlan(`webgpu-app/debug-normal/group-2${autoLayoutKeySuffix}`).layout,
        },
        lightLayout: null,
    };
}
//# sourceMappingURL=pipeline-layouts.js.map