import { createSamplerAsset, } from "/aperture/worker-modules/packages/render/dist/index.js";
import { createOrReuseWebGpuPostPassTexture, } from "../post/post-pass.js";
import { assembleFrameBoundary, } from "../render/frame/frame-boundary.js";
import { createSamplerGpuResource, } from "../resources/textures/texture-resources.js";
import { createWebGpuAppFrameBoundaryTargets, } from "./frame-target.js";
import { commandsWithoutOcclusionQueryCommands } from "./occlusion-culling.js";
import { countDrawCommands, isRenderPassDrawCommand } from "./view-commands.js";
export function createWebGpuAppTransmissionGrabResources(options) {
    if (!options.required) {
        return { valid: true, resources: null, diagnostics: [] };
    }
    const targetPlan = createWebGpuAppFrameBoundaryTargets(options.app, options.assets, options.snapshot);
    const target = targetPlan.targets[0];
    if (target === undefined) {
        return {
            valid: false,
            resources: null,
            diagnostics: targetPlan.diagnostics,
        };
    }
    const texture = createOrReuseWebGpuPostPassTexture({
        device: options.app.initialization.device,
        slot: options.cache.postPasses.transmissionGrab,
        width: target.width,
        height: target.height,
        format: target.format,
        label: "aperture/standard-transmission-grab/scene-color",
    });
    const diagnostics = [
        ...targetPlan.diagnostics,
        ...texture.diagnostics,
    ];
    if (!texture.valid || texture.resource === null) {
        return { valid: false, resources: null, diagnostics };
    }
    const view = texture.resource.texture.createView?.();
    if (view === undefined) {
        diagnostics.push({
            code: "webGpuApp.transmissionGrabTextureViewUnavailable",
            message: "StandardMaterial transmission grab pass requires a scene color texture view.",
        });
        return { valid: false, resources: null, diagnostics };
    }
    const sampler = createOrReuseTransmissionGrabSampler(options);
    diagnostics.push(...sampler.diagnostics);
    if (sampler.resource === null) {
        return { valid: false, resources: null, diagnostics };
    }
    return {
        valid: diagnostics.length === 0,
        resources: {
            texture: {
                resourceKey: transmissionGrabTextureResourceKey(texture.resource),
                texture: texture.resource.texture,
                view,
                width: texture.resource.width,
                height: texture.resource.height,
                format: texture.resource.format,
            },
            sampler: {
                resourceKey: sampler.resource.resourceKey,
                sampler: sampler.resource.sampler,
            },
        },
        diagnostics,
    };
}
// Build the transmission-grab boundary options + static report fields WITHOUT
// executing. The legacy path (assembleWebGpuAppTransmissionGrabPass) runs these
// through assembleFrameBoundary; the M3-T4 FrameGraph path registers them as a
// grab node the main forward node reads, so the grab + main share one encoder.
export function buildWebGpuAppTransmissionGrabBoundaryOptions(options) {
    const commands = commandsWithoutOcclusionQueryCommands(commandsWithoutTransmissionDraws(options.commands));
    const boundaryOptions = {
        context: options.app.initialization.context,
        device: options.app.initialization.device,
        queue: options.app.initialization.device
            .queue,
        commands,
        label: `${options.label}:transmission-grab:${options.target.renderTargetKey ?? "swapchain"}`,
        colorTarget: {
            source: "offscreen-target",
            texture: options.resources.texture.texture,
        },
        clearColor: options.clearColor,
        depthTarget: {
            view: options.depthAttachment.view,
            depthClearValue: options.target.view.clearDepth,
            depthLoadOp: "clear",
            depthStoreOp: "store",
        },
    };
    return {
        boundaryOptions,
        reportBase: {
            enabled: true,
            width: options.resources.texture.width,
            height: options.resources.texture.height,
            format: options.resources.texture.format,
            commands: commands.length,
            drawCalls: countDrawCommands(commands),
            textureResourceKey: options.resources.texture.resourceKey,
            samplerResourceKey: options.resources.sampler.resourceKey,
        },
    };
}
export function assembleWebGpuAppTransmissionGrabPass(options) {
    const { boundaryOptions, reportBase } = buildWebGpuAppTransmissionGrabBoundaryOptions(options);
    const boundary = assembleFrameBoundary(boundaryOptions);
    const diagnostics = [
        ...boundary.texture.diagnostics,
        ...(boundary.attachments?.diagnostics ?? []),
        ...(boundary.encoder?.diagnostics ?? []),
        ...(boundary.begin?.diagnostics ?? []),
        ...(boundary.rectangle?.diagnostics ?? []),
        ...(boundary.execution?.diagnostics ?? []),
        ...(boundary.end?.diagnostics ?? []),
        ...(boundary.finish?.diagnostics ?? []),
        ...(boundary.submit?.diagnostics ?? []),
    ];
    return {
        boundary,
        report: { ...reportBase, ok: boundary.valid },
        diagnostics,
    };
}
function createOrReuseTransmissionGrabSampler(options) {
    const resourceKey = "standard-transmission-grab:sampler";
    const cached = options.cache.samplers.get(resourceKey);
    if (cached !== undefined) {
        return { resource: cached, diagnostics: [] };
    }
    const result = createSamplerGpuResource({
        device: options.app.initialization.device,
        resourceKey,
        sampler: createSamplerAsset({
            label: "Standard transmission scene color sampler",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            addressModeW: "clamp-to-edge",
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "nearest",
            lodMaxClamp: 0,
        }),
    });
    if (result.valid && result.resource !== null) {
        options.cache.samplers.set(resourceKey, result.resource);
    }
    return { resource: result.resource, diagnostics: result.diagnostics };
}
function commandsWithoutTransmissionDraws(commands) {
    const transmissionRenderIds = new Set();
    let activePipelineKey = "";
    for (const command of commands) {
        if (command.kind === "setPipeline") {
            activePipelineKey = command.pipelineKey;
        }
        if (isRenderPassDrawCommand(command) &&
            pipelineKeyUsesTransmission(activePipelineKey)) {
            transmissionRenderIds.add(command.renderId);
        }
    }
    if (transmissionRenderIds.size === 0) {
        return commands;
    }
    return commands.filter((command) => !transmissionRenderIds.has(command.renderId));
}
function pipelineKeyUsesTransmission(pipelineKey) {
    return materialPipelineKeyFromRenderPipelineKey(pipelineKey)
        .split("|")
        .includes("transmission");
}
function materialPipelineKeyFromRenderPipelineKey(pipelineKey) {
    const cacheKey = pipelineKey.startsWith("render-pipeline:")
        ? pipelineKey.slice("render-pipeline:".length)
        : pipelineKey;
    try {
        const parsed = JSON.parse(cacheKey);
        const materialPipelineKey = parsed.material?.pipelineKey;
        if (typeof materialPipelineKey === "string") {
            return materialPipelineKey;
        }
        const batchPipelineKey = parsed.batch?.pipelineKey;
        if (typeof batchPipelineKey === "string") {
            return batchPipelineKey;
        }
    }
    catch {
        // Non-cache pipeline keys are already authored material keys.
    }
    return pipelineKey;
}
function transmissionGrabTextureResourceKey(resource) {
    return [
        "standard-transmission-grab:scene-color",
        resource.width,
        resource.height,
        resource.format,
    ].join(":");
}
//# sourceMappingURL=transmission-grab.js.map