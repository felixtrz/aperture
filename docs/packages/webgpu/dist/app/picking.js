import { WEBGPU_APP_DEPTH_FORMAT } from "../resources/textures/depth-texture-resource.js";
import { createWebGpuIdBufferPickPipelineResource, webGpuIdBufferPickPipelineCacheKey, } from "../picking/id-buffer-pick.js";
import { resolveDrawCommandPipelineKey } from "../render/draw/draw-command.js";
export function webGpuAppPickPixel(dimensions, x, y) {
    const pixel = { x: Math.floor(x), y: Math.floor(y) };
    if (!Number.isFinite(x) ||
        !Number.isFinite(y) ||
        pixel.x < 0 ||
        pixel.y < 0 ||
        pixel.x >= dimensions.width ||
        pixel.y >= dimensions.height) {
        return null;
    }
    return pixel;
}
export function pushWebGpuPickErrorScope(device) {
    const scoped = device;
    try {
        scoped.pushErrorScope?.("validation");
    }
    catch {
        // Error scopes are diagnostic-only; picking still returns readback results.
    }
}
export async function popWebGpuPickErrorScope(device) {
    const scoped = device;
    if (scoped.popErrorScope === undefined) {
        return null;
    }
    try {
        const error = await scoped.popErrorScope();
        return error?.message ?? null;
    }
    catch {
        return null;
    }
}
export function createWebGpuAppPickSharedBindGroups(options) {
    const device = options.device;
    if (device.createBindGroup === undefined) {
        return {
            valid: false,
            viewBindGroup: missingPickBindGroup(0),
            worldTransformBindGroup: missingPickBindGroup(1),
            diagnostics: [
                {
                    code: "webGpuApp.pickCreateBindGroupUnavailable",
                    message: "WebGPU app picking requires createBindGroup for view and transform resources.",
                },
            ],
        };
    }
    return {
        valid: true,
        viewBindGroup: {
            group: 0,
            resourceKey: "id-buffer-pick/view",
            bindGroup: device.createBindGroup({
                label: "aperture/id-buffer-pick/view",
                layout: options.pipeline.layouts.view,
                entries: [
                    {
                        binding: 0,
                        resource: { buffer: options.viewUniformBuffer },
                    },
                ],
            }),
        },
        worldTransformBindGroup: {
            group: 1,
            resourceKey: "id-buffer-pick/world-transforms",
            bindGroup: device.createBindGroup({
                label: "aperture/id-buffer-pick/world-transforms",
                layout: options.pipeline.layouts.worldTransforms,
                entries: [
                    {
                        binding: 0,
                        resource: { buffer: options.worldTransformBuffer },
                    },
                ],
            }),
        },
        diagnostics: [],
    };
}
function missingPickBindGroup(group) {
    return { group, resourceKey: "missing", bindGroup: null };
}
export async function getOrCreateWebGpuIdBufferPickPipelines(options) {
    const pipelines = new Map();
    const diagnostics = [];
    for (const draw of options.snapshot.meshDraws) {
        const commandPipelineKey = resolveDrawCommandPipelineKey(draw.renderId, draw.batchKey.pipelineKey, options.pipelineKeysByRenderId);
        if (pipelines.has(commandPipelineKey)) {
            continue;
        }
        const cacheKey = webGpuIdBufferPickPipelineCacheKey(draw.batchKey);
        const cached = options.cache.idPickPipelines.get(cacheKey);
        if (cached !== undefined) {
            pipelines.set(commandPipelineKey, cached);
            continue;
        }
        const created = await createWebGpuIdBufferPickPipelineResource({
            device: options.app.initialization.device,
            batchKey: draw.batchKey,
            depthFormat: WEBGPU_APP_DEPTH_FORMAT,
        });
        diagnostics.push(...created.diagnostics);
        if (created.valid && created.resource !== null) {
            options.cache.idPickPipelines.set(cacheKey, created.resource);
            pipelines.set(commandPipelineKey, created.resource);
        }
    }
    return {
        valid: diagnostics.length === 0,
        pipelines,
        diagnostics,
    };
}
//# sourceMappingURL=picking.js.map