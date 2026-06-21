import { WEBGPU_APP_DEPTH_FORMAT } from "../resources/textures/depth-texture-resource.js";
import { createDebugNormalRenderPipelineResource, } from "../materials/debug-normal/debug-normal-pipeline.js";
import { createMatcapRenderPipelineResource, } from "../materials/matcap/matcap-pipeline.js";
import { createStandardRenderPipelineResource, } from "../materials/standard/standard-pipeline.js";
import { createUnlitRenderPipelineResource, } from "../materials/unlit/unlit-pipeline.js";
import { createTonemapPipelineKey } from "../output/output-stage-tonemap.js";
import { createOutputColorSpacePipelineKey } from "../output/output-stage-color-space.js";
export function getOrCreateWebGpuAppPipeline(options) {
    // HDR scene-buffer path (M5-T4): the lit pass renders into rgba16float and the
    // material does NOT tonemap (tonemap+exposure+sRGB run in the final post
    // stage). Default path: sceneRenderFormat === the swapchain format -> unchanged.
    const isHdr = options.app.sceneRenderFormat !== options.app.initialization.format;
    const standardTonemap = isHdr ? "none" : options.app.tonemap;
    const standardOutputColorSpace = isHdr
        ? "linear"
        : options.app.outputColorSpace;
    // AI-17 / AI-91: mesh pipelines are created once per app and reused by every
    // pass, including render-to-texture previews and the transmission scene-color
    // copy, whose contents must stay LINEAR (they are sampled as scene content
    // and encoded once at the final output; three.js likewise only tonemaps when
    // no render target is bound). Until pipeline selection is per-render-target
    // (AI-91), the non-standard mesh families therefore resolve the no-op pair by
    // default; the wrap capability itself stays wired, keyed, and Dawn-verified.
    const meshTonemap = options.kind === "standard" ? standardTonemap : "none";
    const meshOutputColorSpace = options.kind === "standard" ? standardOutputColorSpace : "linear";
    const key = [
        options.kind,
        options.app.sceneRenderFormat,
        `motion:${options.motionVectorColorFormat ?? "none"}`,
        `indirect:${options.indirectColorFormat ?? "none"}`,
        WEBGPU_APP_DEPTH_FORMAT,
        `samples:${options.app.msaa.sampleCount}`,
        options.pipelineKey,
        // The created resource bakes its vertex buffer layout from batchKey, so
        // the cache must be at least as fine as the mesh layout: two meshes with
        // colliding material variants but different stream layouts (e.g. an
        // interleaved primitive floor vs a multi-stream glTF mesh) otherwise
        // share one pipeline and the second draw fails Dawn validation with
        // "Vertex buffer slot N required ... was not set".
        `layout:${options.batchKey.meshLayoutKey}`,
        // The resolved pair keys the cache for every kind so a future per-target
        // resolution (AI-91) cannot collide cached variants.
        createTonemapPipelineKey(meshTonemap),
        createOutputColorSpacePipelineKey(meshOutputColorSpace),
    ].join("|");
    const cached = options.cache.pipelines.get(key);
    if (cached !== undefined) {
        options.reuse.pipelineHits += 1;
        return cached;
    }
    options.reuse.pipelineMisses += 1;
    const pipeline = options.kind === "standard"
        ? createStandardRenderPipelineResource({
            device: options.app.initialization.device,
            colorFormat: options.app.sceneRenderFormat,
            ...(options.motionVectorColorFormat === undefined
                ? {}
                : { motionVectorColorFormat: options.motionVectorColorFormat }),
            ...(options.indirectColorFormat === undefined ||
                options.indirectColorFormat === null
                ? {}
                : { indirectColorFormat: options.indirectColorFormat }),
            depthFormat: WEBGPU_APP_DEPTH_FORMAT,
            sampleCount: options.app.msaa.sampleCount,
            batchKey: options.batchKey,
            tonemap: meshTonemap,
            outputColorSpace: meshOutputColorSpace,
        })
        : options.kind === "debug-normal"
            ? createDebugNormalRenderPipelineResource({
                device: options.app.initialization.device,
                colorFormat: options.app.sceneRenderFormat,
                ...(options.motionVectorColorFormat === undefined
                    ? {}
                    : { motionVectorColorFormat: options.motionVectorColorFormat }),
                depthFormat: WEBGPU_APP_DEPTH_FORMAT,
                sampleCount: options.app.msaa.sampleCount,
                batchKey: options.batchKey,
                tonemap: meshTonemap,
                outputColorSpace: meshOutputColorSpace,
            })
            : options.kind === "matcap"
                ? createMatcapRenderPipelineResource({
                    device: options.app.initialization.device,
                    colorFormat: options.app.sceneRenderFormat,
                    ...(options.motionVectorColorFormat === undefined
                        ? {}
                        : { motionVectorColorFormat: options.motionVectorColorFormat }),
                    depthFormat: WEBGPU_APP_DEPTH_FORMAT,
                    sampleCount: options.app.msaa.sampleCount,
                    batchKey: options.batchKey,
                    tonemap: meshTonemap,
                    outputColorSpace: meshOutputColorSpace,
                })
                : createUnlitRenderPipelineResource({
                    device: options.app.initialization.device,
                    colorFormat: options.app.sceneRenderFormat,
                    ...(options.motionVectorColorFormat === undefined
                        ? {}
                        : { motionVectorColorFormat: options.motionVectorColorFormat }),
                    depthFormat: WEBGPU_APP_DEPTH_FORMAT,
                    sampleCount: options.app.msaa.sampleCount,
                    batchKey: options.batchKey,
                    tonemap: meshTonemap,
                    outputColorSpace: meshOutputColorSpace,
                });
    return cacheWebGpuAppPipelineWhenReady(options.cache, key, pipeline);
}
function cacheWebGpuAppPipelineWhenReady(cache, key, pipeline) {
    if (isPromiseLike(pipeline)) {
        return pipeline.then((resolved) => cacheWebGpuAppPipelineResult(cache, key, resolved));
    }
    return cacheWebGpuAppPipelineResult(cache, key, pipeline);
}
function cacheWebGpuAppPipelineResult(cache, key, pipeline) {
    if (pipeline.valid && pipeline.resource !== null) {
        cache.pipelines.set(key, pipeline);
    }
    return pipeline;
}
function isPromiseLike(value) {
    return (typeof value === "object" &&
        value !== null &&
        "then" in value &&
        typeof value.then === "function");
}
//# sourceMappingURL=pipeline-resources.js.map