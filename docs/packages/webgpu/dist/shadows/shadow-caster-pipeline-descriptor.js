function biasForCull(_cullMode, base) {
    // three.js parity: no global rasterizer bias. Caster-side bias is emitted only
    // when explicitly authored, analogous to material polygonOffset.
    return base;
}
const SHADOW_CASTER_DEPTH_ONLY_PIPELINE_KEY = "shadow-caster/depth-only/depth24plus/triangle-list/none";
export function createShadowCasterPipelineDescriptorReport(options) {
    if (options.commandEncoding.status === "not-required") {
        return report({
            status: "not-required",
            commandRecordCount: 0,
            descriptor: null,
            descriptors: [],
            diagnostics: [],
        });
    }
    const diagnostics = [];
    const topology = options.topology ?? "triangle-list";
    const depthFormat = options.depthFormat ?? "depth24plus";
    if (options.commandEncoding.records.length === 0) {
        diagnostics.push({
            code: "shadowCasterPipelineDescriptor.missingCommandEncoding",
            severity: "warning",
            message: "Shadow caster pipeline descriptor metadata requires shadow pass command records.",
        });
    }
    if (depthFormat.length === 0) {
        diagnostics.push({
            code: "shadowCasterPipelineDescriptor.missingDepthFormat",
            severity: "warning",
            field: "depthFormat",
            message: "Shadow caster pipeline descriptor metadata requires a depth format.",
        });
    }
    if (topology !== "triangle-list") {
        diagnostics.push({
            code: "shadowCasterPipelineDescriptor.unsupportedTopology",
            severity: "warning",
            field: "topology",
            message: `Shadow caster pipeline descriptor metadata supports triangle-list topology, not '${String(topology)}'.`,
        });
    }
    if (options.commandEncoding.status === "deferred") {
        diagnostics.push({
            code: "shadowCasterPipelineDescriptor.commandEncodingDeferred",
            severity: "warning",
            message: "Shadow caster pipeline descriptor metadata is planned, but shadow pass command encoding is still deferred upstream.",
        });
    }
    if (options.commandEncoding.records.length > 0) {
        diagnostics.push({
            code: "shadowCasterPipelineDescriptor.passSubmissionDeferred",
            severity: "warning",
            message: "Shadow caster pipeline descriptor metadata is planned, but shadow pass submission is deferred.",
        });
    }
    const hasBlockingDiagnostics = diagnostics.some((diagnostic) => diagnostic.code ===
        "shadowCasterPipelineDescriptor.missingCommandEncoding" ||
        diagnostic.code === "shadowCasterPipelineDescriptor.missingDepthFormat" ||
        diagnostic.code === "shadowCasterPipelineDescriptor.unsupportedTopology");
    const bias = {
        // WebGPU depthBias is an integer in depth-buffer units. Use round (not
        // trunc) so an authored sub-integer survives (0.6 -> 1) instead of zeroing.
        // Default stays 0: back-face caster rendering + receiver normal-offset are
        // the primary self-shadow defenses, so rasterizer bias is opt-in (avoids
        // peter-panning the shared cascaded path).
        depthBias: Math.max(0, Math.round(options.depthBias ?? 0)),
        depthBiasSlopeScale: Math.max(0, options.slopeBias ?? 0),
    };
    const cullModes = options.casterCullModes && options.casterCullModes.length > 0
        ? [...new Set(options.casterCullModes)]
        : ["none"];
    const descriptors = hasBlockingDiagnostics || depthFormat !== "depth24plus"
        ? []
        : [
            ...collectMeshLayoutKeys(options).flatMap((meshLayoutKey) => cullModes.map((cullMode) => createDescriptor(options.indexFormat ?? "uint32", meshLayoutKey, biasForCull(cullMode, bias), cullMode))),
            ...dedupeAlphaTestCasters(options.alphaTestCasters ?? []).map((alphaTest) => createDescriptor(options.indexFormat ?? "uint32", alphaTest.meshLayoutKey, 
            // Alpha-test casters force "none" (cutout geometry is treated
            // as double-sided), independent of material cull resolution.
            biasForCull("none", bias), "none", alphaTest)),
        ];
    const status = determineStatus(options.commandEncoding.status, hasBlockingDiagnostics);
    return report({
        status,
        commandRecordCount: options.commandEncoding.records.length,
        descriptor: descriptors[0] ?? null,
        descriptors,
        diagnostics,
    });
}
export function shadowCasterPipelineDescriptorReportToJsonValue(value) {
    return {
        ready: value.ready,
        status: value.status,
        commandRecordCount: value.commandRecordCount,
        descriptorCount: value.descriptorCount,
        sections: { ...value.sections },
        descriptor: descriptorToJsonValue(value.descriptor),
        descriptors: value.descriptors.map(descriptorMetadataToJsonValue),
        diagnostics: value.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
}
export function shadowCasterPipelineDescriptorReportToJson(value) {
    return JSON.stringify(shadowCasterPipelineDescriptorReportToJsonValue(value));
}
function createDescriptor(indexFormat, meshLayoutKey, bias, cullMode, alphaTest) {
    // Alpha-test casters always render both faces; opaque casters use the
    // material-resolved cull (three.js shadowSide).
    const effectiveCullMode = alphaTest !== undefined ? "none" : cullMode;
    const base = {
        index: {
            required: true,
            format: indexFormat,
        },
        primitive: {
            topology: "triangle-list",
            cullMode: effectiveCullMode,
            frontFace: "ccw",
        },
        depthStencil: {
            format: "depth24plus",
            depthWriteEnabled: true,
            depthCompare: "less-equal",
            depthBias: bias.depthBias,
            depthBiasSlopeScale: bias.depthBiasSlopeScale,
        },
        colorTargets: [],
    };
    if (alphaTest !== undefined) {
        return {
            ...base,
            pipelineKey: shadowCasterAlphaTestPipelineKey(meshLayoutKey, alphaTest),
            label: shadowCasterAlphaTestPipelineLabel(meshLayoutKey),
            shader: {
                family: "shadow-caster",
                label: "shadow-caster-alpha-test",
                entryPoints: { vertex: "vs_main", fragment: "fs_main" },
            },
            vertex: {
                buffers: ["POSITION", "TEXCOORD_0"],
                meshLayoutKey,
                matrixBufferLayoutKey: "shadow-caster/group-0:directional-shadow-matrices@0",
            },
            alphaTest: {
                alphaCutoff: alphaTest.alphaCutoff,
                baseColorTextureKey: alphaTest.baseColorTextureKey,
                baseColorSamplerKey: alphaTest.baseColorSamplerKey,
            },
        };
    }
    return {
        ...base,
        pipelineKey: shadowCasterPipelineKeyForMeshLayoutKey(meshLayoutKey, effectiveCullMode),
        label: shadowCasterPipelineLabelForMeshLayoutKey(meshLayoutKey, effectiveCullMode),
        shader: {
            family: "shadow-caster",
            label: "shadow-caster-depth-only",
            entryPoints: { vertex: "vs_main", fragment: "fs_main" },
        },
        vertex: {
            buffers: ["POSITION"],
            meshLayoutKey,
            matrixBufferLayoutKey: "shadow-caster/group-0:directional-shadow-matrices@0",
        },
    };
}
function dedupeAlphaTestCasters(casters) {
    const byKey = new Map();
    for (const caster of casters) {
        byKey.set(shadowCasterAlphaTestPipelineKey(caster.meshLayoutKey, caster), {
            ...caster,
        });
    }
    return [...byKey.values()];
}
function shadowCasterAlphaTestPipelineKey(meshLayoutKey, alphaTest) {
    const base = shadowCasterPipelineKeyForMeshLayoutKey(meshLayoutKey);
    const cutoff = Number.isFinite(alphaTest.alphaCutoff)
        ? alphaTest.alphaCutoff.toFixed(3)
        : "0.000";
    return `${base}/alpha-test:cutoff:${cutoff}:tex:${encodeURIComponent(alphaTest.baseColorTextureKey)}`;
}
function shadowCasterAlphaTestPipelineLabel(meshLayoutKey) {
    const base = shadowCasterPipelineLabelForMeshLayoutKey(meshLayoutKey).replace("shadow-caster-depth-only", "shadow-caster-alpha-test");
    return base;
}
export function shadowCasterPipelineKeyForMeshLayoutKey(meshLayoutKey, cullMode = "none") {
    const normalized = normalizeMeshLayoutKey(meshLayoutKey);
    const base = normalized === null
        ? SHADOW_CASTER_DEPTH_ONLY_PIPELINE_KEY
        : `${SHADOW_CASTER_DEPTH_ONLY_PIPELINE_KEY}/mesh-layout:${encodeURIComponent(normalized)}`;
    // Suffix only for non-default cull so the legacy "none" key (and every
    // existing snapshot/golden keyed on it) is byte-identical.
    return cullMode === "none" ? base : `${base}/cull:${cullMode}`;
}
function shadowCasterPipelineLabelForMeshLayoutKey(meshLayoutKey, cullMode = "none") {
    const normalized = normalizeMeshLayoutKey(meshLayoutKey);
    const base = normalized === null
        ? "shadow-caster-depth-only:depth24plus:triangle-list"
        : `shadow-caster-depth-only:depth24plus:triangle-list:${normalized}`;
    return cullMode === "none" ? base : `${base}:cull:${cullMode}`;
}
function collectMeshLayoutKeys(options) {
    const sourceKeys = options.meshLayoutKeys ??
        options.casterDrawList?.lists.flatMap((list) => list.draws.map((draw) => draw.meshLayoutKey)) ??
        [];
    const normalizedKeys = unique(sourceKeys.flatMap((key) => {
        const normalized = normalizeMeshLayoutKey(key);
        return normalized === null ? [] : [normalized];
    }));
    return normalizedKeys.length > 0 ? normalizedKeys : [null];
}
function normalizeMeshLayoutKey(meshLayoutKey) {
    if (meshLayoutKey === undefined || meshLayoutKey === null) {
        return null;
    }
    const trimmed = meshLayoutKey.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function descriptorToJsonValue(descriptor) {
    return descriptor === null ? null : descriptorMetadataToJsonValue(descriptor);
}
function descriptorMetadataToJsonValue(descriptor) {
    return {
        pipelineKey: descriptor.pipelineKey,
        label: descriptor.label,
        shader: {
            family: descriptor.shader.family,
            label: descriptor.shader.label,
            entryPoints: { ...descriptor.shader.entryPoints },
        },
        vertex: {
            buffers: [...descriptor.vertex.buffers],
            meshLayoutKey: descriptor.vertex.meshLayoutKey,
            matrixBufferLayoutKey: descriptor.vertex.matrixBufferLayoutKey,
        },
        index: { ...descriptor.index },
        primitive: { ...descriptor.primitive },
        depthStencil: { ...descriptor.depthStencil },
        colorTargets: [],
    };
}
function unique(values) {
    return [...new Set(values)];
}
function determineStatus(commandEncodingStatus, hasBlockingDiagnostics) {
    if (hasBlockingDiagnostics || commandEncodingStatus === "missing") {
        return "missing";
    }
    if (commandEncodingStatus === "deferred") {
        return "deferred";
    }
    return "ready";
}
function report(input) {
    const descriptorAvailable = input.descriptors.length > 0;
    return {
        ready: input.status === "ready" || input.status === "not-required",
        status: input.status,
        commandRecordCount: input.commandRecordCount,
        descriptorCount: input.descriptors.length,
        sections: {
            commandEncoding: input.commandRecordCount > 0,
            vertexBufferLayout: descriptorAvailable,
            indexBuffer: descriptorAvailable,
            matrixBufferLayout: descriptorAvailable,
            depthStencil: descriptorAvailable,
            colorTargets: true,
            pipelineCreation: false,
            passSubmission: false,
            shaderSampling: false,
        },
        descriptor: input.descriptor,
        descriptors: input.descriptors,
        diagnostics: input.diagnostics,
    };
}
//# sourceMappingURL=shadow-caster-pipeline-descriptor.js.map