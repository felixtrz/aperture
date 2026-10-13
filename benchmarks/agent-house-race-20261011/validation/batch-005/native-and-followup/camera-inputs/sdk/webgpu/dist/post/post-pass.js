import { WEBGPU_TEXTURE_USAGE_FLAGS } from "../resources/textures/texture-resources.js";
export function createWebGpuPostPassTextureCacheSlot() {
    return { current: null };
}
export function createOrReuseWebGpuPostPassTexture(options) {
    const current = options.slot.current;
    if (current !== null &&
        current.width === options.width &&
        current.height === options.height &&
        current.format === options.format) {
        return {
            valid: true,
            resource: current,
            status: "reused",
            diagnostics: [],
        };
    }
    if (options.device.createTexture === undefined) {
        return {
            valid: false,
            resource: null,
            status: "failed",
            diagnostics: [
                {
                    code: "webGpuPostPass.createTextureUnavailable",
                    message: "WebGPU post pass cannot create intermediate textures.",
                },
            ],
        };
    }
    try {
        const texture = options.device.createTexture({
            label: options.label,
            size: { width: options.width, height: options.height },
            format: options.format,
            usage: WEBGPU_TEXTURE_USAGE_FLAGS.RENDER_ATTACHMENT |
                WEBGPU_TEXTURE_USAGE_FLAGS.TEXTURE_BINDING |
                WEBGPU_TEXTURE_USAGE_FLAGS.COPY_SRC,
        });
        const resource = {
            texture,
            width: options.width,
            height: options.height,
            format: options.format,
            label: options.label,
        };
        options.slot.current = resource;
        return {
            valid: true,
            resource,
            status: "created",
            diagnostics: [],
        };
    }
    catch (cause) {
        return {
            valid: false,
            resource: null,
            status: "failed",
            diagnostics: [
                {
                    code: "webGpuPostPass.textureCreationFailed",
                    message: `WebGPU post pass texture creation failed: ${messageFromCause(cause)}`,
                },
            ],
        };
    }
}
export function createWebGpuCopyPostEffect(options = {}) {
    const id = options.id ?? "copy";
    const label = options.label ?? "Copy Post Effect";
    const enabled = options.enabled;
    let cachedPipeline = null;
    let sampler = null;
    return {
        id,
        label,
        ...(enabled === undefined ? {} : { enabled }),
        prepare(prepareOptions) {
            const diagnostics = [];
            const pipelineKey = `webgpu-post-copy|${prepareOptions.outputFormat}`;
            const pipelineResult = cachedPipeline?.key === pipelineKey
                ? cachedPipeline
                : createCopyPostPipeline({
                    device: prepareOptions.device,
                    outputFormat: prepareOptions.outputFormat,
                    label: `${prepareOptions.label}:${id}:pipeline`,
                    effectId: id,
                    diagnostics,
                });
            if (pipelineResult === null) {
                return preparedCopyPass(id, label, [], diagnostics);
            }
            cachedPipeline = pipelineResult;
            if (sampler === null) {
                sampler = createCopyPostSampler({
                    device: prepareOptions.device,
                    effectId: id,
                    diagnostics,
                });
            }
            if (sampler === null) {
                return preparedCopyPass(id, label, [], diagnostics);
            }
            const inputView = prepareOptions.input.texture.createView?.();
            if (inputView === undefined) {
                diagnostics.push({
                    code: "webGpuPostPass.inputTextureViewUnavailable",
                    effectId: id,
                    message: `Post effect '${id}' cannot sample input texture '${prepareOptions.input.label}'.`,
                });
                return preparedCopyPass(id, label, [], diagnostics);
            }
            const layout = pipelineResult.pipeline.getBindGroupLayout?.(0);
            if (layout === undefined) {
                diagnostics.push({
                    code: "webGpuPostPass.pipelineLayoutUnavailable",
                    effectId: id,
                    message: `Post effect '${id}' pipeline does not expose group 0 bind-group layout.`,
                });
                return preparedCopyPass(id, label, [], diagnostics);
            }
            if (prepareOptions.device.createBindGroup === undefined) {
                diagnostics.push({
                    code: "webGpuPostPass.createBindGroupUnavailable",
                    effectId: id,
                    message: `Post effect '${id}' cannot create a texture sampling bind group.`,
                });
                return preparedCopyPass(id, label, [], diagnostics);
            }
            const bindGroup = prepareOptions.device.createBindGroup({
                label: `${prepareOptions.label}:${id}:bind-group`,
                layout,
                entries: [
                    { binding: 0, resource: sampler },
                    { binding: 1, resource: inputView },
                ],
            });
            return preparedCopyPass(id, label, [
                {
                    kind: "setPipeline",
                    renderId: 0,
                    pipelineKey,
                    pipeline: pipelineResult.pipeline,
                },
                {
                    kind: "setBindGroup",
                    renderId: 0,
                    index: 0,
                    resourceKey: `${id}:input:${prepareOptions.input.label}`,
                    bindGroup,
                },
                {
                    kind: "draw",
                    renderId: 0,
                    vertexCount: 3,
                    instanceCount: 1,
                    firstVertex: 0,
                    firstInstance: 0,
                },
            ], diagnostics);
        },
    };
}
function createCopyPostPipeline(options) {
    if (options.device.createShaderModule === undefined) {
        options.diagnostics.push({
            code: "webGpuPostPass.createShaderModuleUnavailable",
            effectId: options.effectId,
            message: `Post effect '${options.effectId}' cannot create a shader module.`,
        });
        return null;
    }
    if (options.device.createRenderPipeline === undefined) {
        options.diagnostics.push({
            code: "webGpuPostPass.createRenderPipelineUnavailable",
            effectId: options.effectId,
            message: `Post effect '${options.effectId}' cannot create a render pipeline.`,
        });
        return null;
    }
    const module = options.device.createShaderModule({
        label: `${options.label}:shader`,
        code: copyPostEffectWgsl,
    });
    const pipeline = options.device.createRenderPipeline({
        label: options.label,
        layout: "auto",
        vertex: { module, entryPoint: "vs" },
        fragment: {
            module,
            entryPoint: "fs",
            targets: [{ format: options.outputFormat }],
        },
        primitive: { topology: "triangle-list" },
    });
    return {
        key: `webgpu-post-copy|${options.outputFormat}`,
        pipeline,
    };
}
function createCopyPostSampler(options) {
    if (options.device.createSampler === undefined) {
        options.diagnostics.push({
            code: "webGpuPostPass.createSamplerUnavailable",
            effectId: options.effectId,
            message: `Post effect '${options.effectId}' cannot create an input sampler.`,
        });
        return null;
    }
    return options.device.createSampler({
        label: `aperture/post/${options.effectId}/sampler`,
        magFilter: "nearest",
        minFilter: "nearest",
        mipmapFilter: "nearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
    });
}
function preparedCopyPass(effectId, label, commands, diagnostics) {
    return {
        effectId,
        label,
        commands,
        diagnostics,
    };
}
function messageFromCause(cause) {
    return cause instanceof Error ? cause.message : String(cause);
}
const copyPostEffectWgsl = `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, 3.0),
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
  );
  var uvs = array<vec2f, 3>(
    vec2f(0.0, 2.0),
    vec2f(0.0, 0.0),
    vec2f(2.0, 0.0),
  );
  var output: VertexOutput;
  output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex];
  return output;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  return textureSample(inputTexture, inputSampler, input.uv);
}
`;
//# sourceMappingURL=post-pass.js.map