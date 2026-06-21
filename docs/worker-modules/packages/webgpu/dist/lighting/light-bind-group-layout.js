import { LOCAL_LIGHT_CLUSTER_CELLS_BINDING, LOCAL_LIGHT_CLUSTER_COOKIE_MATRIX_BINDING, LOCAL_LIGHT_CLUSTER_COOKIE_SAMPLER_BINDING, LOCAL_LIGHT_CLUSTER_COOKIE_TEXTURE_BINDING, LOCAL_LIGHT_CLUSTER_INDICES_BINDING, LOCAL_LIGHT_CLUSTER_METADATA_BINDING, LOCAL_LIGHT_CLUSTER_PARAMS_BINDING, } from "./local-light-clusters.js";
export const DEFAULT_LIGHT_BIND_GROUP = 3;
export const DEFAULT_LIGHT_BIND_GROUP_LAYOUT_VISIBILITY = 0x2;
export function lightBindGroupLayoutResourceKey(group = DEFAULT_LIGHT_BIND_GROUP) {
    return `bind-group-layout:lights/group-${group}`;
}
export function createLightBindGroupLayoutDescriptor(options = {}) {
    const group = options.group ?? DEFAULT_LIGHT_BIND_GROUP;
    const visibility = options.visibility ?? DEFAULT_LIGHT_BIND_GROUP_LAYOUT_VISIBILITY;
    const entries = [
        {
            binding: 0,
            visibility,
            buffer: { type: "read-only-storage" },
        },
        {
            binding: 1,
            visibility,
            buffer: { type: "read-only-storage" },
        },
        ...(options.transmissionSceneColor === true
            ? [
                {
                    binding: 14,
                    visibility,
                    texture: { sampleType: "float" },
                },
                {
                    binding: 15,
                    visibility,
                    sampler: { type: "filtering" },
                },
            ]
            : []),
    ];
    appendClusteredLocalLightLayoutEntries(entries, visibility, options.clusteredLocalLights === true, options.clusteredLocalLightCookies === true, options.clusteredLocalLightCookieTextureViewDimension, true);
    return {
        label: options.label ?? `lights/group-${group}`,
        entries,
    };
}
export function appendClusteredLocalLightLayoutEntries(entries, visibility, enabled, cookiesEnabled = false, cookieTextureViewDimension = "2d", cookieMatrixBufferEnabled = true) {
    if (!enabled) {
        return;
    }
    entries.push({
        binding: LOCAL_LIGHT_CLUSTER_PARAMS_BINDING,
        visibility,
        buffer: { type: "read-only-storage" },
    }, {
        binding: LOCAL_LIGHT_CLUSTER_CELLS_BINDING,
        visibility,
        buffer: { type: "read-only-storage" },
    }, {
        binding: LOCAL_LIGHT_CLUSTER_INDICES_BINDING,
        visibility,
        buffer: { type: "read-only-storage" },
    }, {
        binding: LOCAL_LIGHT_CLUSTER_METADATA_BINDING,
        visibility,
        buffer: { type: "read-only-storage" },
    });
    if (cookiesEnabled) {
        entries.push({
            binding: LOCAL_LIGHT_CLUSTER_COOKIE_TEXTURE_BINDING,
            visibility,
            texture: {
                sampleType: "float",
                viewDimension: cookieTextureViewDimension,
            },
        }, {
            binding: LOCAL_LIGHT_CLUSTER_COOKIE_SAMPLER_BINDING,
            visibility,
            sampler: { type: "filtering" },
        }, ...(cookieMatrixBufferEnabled
            ? [
                {
                    binding: LOCAL_LIGHT_CLUSTER_COOKIE_MATRIX_BINDING,
                    visibility,
                    buffer: { type: "read-only-storage" },
                },
            ]
            : []));
    }
}
export function createLightBindGroupLayoutResource(options) {
    const group = options.group ?? DEFAULT_LIGHT_BIND_GROUP;
    const layoutKey = options.layoutKey ?? lightBindGroupLayoutResourceKey(group);
    const descriptor = createLightBindGroupLayoutDescriptor(options);
    if (options.device.createBindGroupLayout === undefined) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "lightBindGroupLayout.missingDeviceSupport",
                    layoutKey,
                    message: "WebGPU device cannot create light bind group layouts.",
                },
            ],
        };
    }
    try {
        return {
            valid: true,
            resource: {
                group,
                layoutKey,
                layout: options.device.createBindGroupLayout(descriptor),
                descriptor,
            },
            diagnostics: [],
        };
    }
    catch (cause) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "lightBindGroupLayout.creationFailed",
                    layoutKey,
                    message: `Failed to create light bind group layout '${layoutKey}': ${messageFromCause(cause)}`,
                },
            ],
        };
    }
}
function messageFromCause(cause) {
    return cause instanceof Error ? cause.message : String(cause);
}
//# sourceMappingURL=light-bind-group-layout.js.map