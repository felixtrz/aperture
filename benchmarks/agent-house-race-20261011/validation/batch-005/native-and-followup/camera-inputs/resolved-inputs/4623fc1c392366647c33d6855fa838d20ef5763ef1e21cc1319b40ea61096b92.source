export function createWebGpuTaaPostEffect(options = {}) {
    const id = options.id ?? "taa";
    const label = options.label ?? "TAA Post Effect";
    const enabled = options.enabled;
    const historyWeight = clampHistoryWeight(options.historyWeight ?? 0.95);
    let cachedPipeline = null;
    let sampler = null;
    let previousOutput = null;
    return {
        id,
        label,
        ...(enabled === undefined ? {} : { enabled }),
        requiresMotionVectors: true,
        requiresColorHistory: true,
        prepare(prepareOptions) {
            const diagnostics = [];
            if (prepareOptions.output === undefined) {
                previousOutput = null;
                diagnostics.push({
                    code: "webGpuPostPass.outputTextureUnavailable",
                    effectId: id,
                    message: `TAA post effect '${id}' requires a persistent off-screen output texture before presentation.`,
                });
                return preparedTaaPass(id, label, [], diagnostics);
            }
            if (prepareOptions.motionVector === undefined) {
                previousOutput = null;
                diagnostics.push({
                    code: "webGpuPostPass.motionVectorTextureUnavailable",
                    effectId: id,
                    message: `TAA post effect '${id}' requires a renderer-owned motion-vector texture.`,
                });
                return preparedTaaPass(id, label, [], diagnostics);
            }
            const pipelineKey = `webgpu-post-taa|${prepareOptions.outputFormat}|history:${historyWeight.toFixed(3)}`;
            const pipelineResult = cachedPipeline?.key === pipelineKey
                ? cachedPipeline
                : createTaaPostPipeline({
                    device: prepareOptions.device,
                    outputFormat: prepareOptions.outputFormat,
                    historyWeight,
                    label: `${prepareOptions.label}:${id}:pipeline`,
                    effectId: id,
                    diagnostics,
                });
            if (pipelineResult === null) {
                return preparedTaaPass(id, label, [], diagnostics);
            }
            cachedPipeline = pipelineResult;
            if (sampler === null) {
                sampler = createTaaPostSampler({
                    device: prepareOptions.device,
                    effectId: id,
                    diagnostics,
                });
            }
            if (sampler === null) {
                return preparedTaaPass(id, label, [], diagnostics);
            }
            const inputView = prepareOptions.input.texture.createView?.();
            if (inputView === undefined) {
                diagnostics.push({
                    code: "webGpuPostPass.inputTextureViewUnavailable",
                    effectId: id,
                    message: `TAA post effect '${id}' cannot sample input texture '${prepareOptions.input.label}'.`,
                });
                return preparedTaaPass(id, label, [], diagnostics);
            }
            // M3-T6: when the route owns a double-buffered history pool it supplies
            // last frame's buffer explicitly (the graph path's declareHistory
            // 'previous' view); otherwise self-thread the previous output across
            // frames (the legacy ping/pong path). Either way the first frame has no
            // history and falls back to sampling the input.
            const routeSuppliesHistory = prepareOptions.history !== undefined;
            const history = historyTextureForFrame(prepareOptions.history ?? previousOutput, prepareOptions.input);
            const historyView = history.texture.createView?.();
            if (historyView === undefined) {
                diagnostics.push({
                    code: "webGpuPostPass.inputTextureViewUnavailable",
                    effectId: id,
                    message: `TAA post effect '${id}' cannot sample history texture '${history.label}'.`,
                });
                return preparedTaaPass(id, label, [], diagnostics);
            }
            const motionVectorView = prepareOptions.motionVector.texture.createView?.();
            if (motionVectorView === undefined) {
                diagnostics.push({
                    code: "webGpuPostPass.inputTextureViewUnavailable",
                    effectId: id,
                    message: `TAA post effect '${id}' cannot sample motion-vector texture '${prepareOptions.motionVector.label}'.`,
                });
                return preparedTaaPass(id, label, [], diagnostics);
            }
            const layout = pipelineResult.pipeline.getBindGroupLayout?.(0);
            if (layout === undefined) {
                diagnostics.push({
                    code: "webGpuPostPass.pipelineLayoutUnavailable",
                    effectId: id,
                    message: `TAA post effect '${id}' pipeline does not expose group 0 bind-group layout.`,
                });
                return preparedTaaPass(id, label, [], diagnostics);
            }
            if (prepareOptions.device.createBindGroup === undefined) {
                diagnostics.push({
                    code: "webGpuPostPass.createBindGroupUnavailable",
                    effectId: id,
                    message: `TAA post effect '${id}' cannot create a texture sampling bind group.`,
                });
                return preparedTaaPass(id, label, [], diagnostics);
            }
            const bindGroup = prepareOptions.device.createBindGroup({
                label: `${prepareOptions.label}:${id}:bind-group`,
                layout,
                entries: [
                    { binding: 0, resource: sampler },
                    { binding: 1, resource: inputView },
                    { binding: 2, resource: historyView },
                    { binding: 3, resource: motionVectorView },
                ],
            });
            // Only self-thread history when the route is not supplying it (legacy
            // path). When the graph owns the history pool the closure stays dormant
            // so the two mechanisms never fight over which buffer is "previous".
            if (!routeSuppliesHistory) {
                previousOutput = prepareOptions.output;
            }
            return preparedTaaPass(id, label, [
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
                    resourceKey: `${id}:input:${prepareOptions.input.label}:history:${history.label}:motion:${prepareOptions.motionVector.label}:weight:${historyWeight.toFixed(3)}`,
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
function historyTextureForFrame(previousOutput, input) {
    if (previousOutput !== null &&
        previousOutput.width === input.width &&
        previousOutput.height === input.height &&
        previousOutput.format === input.format) {
        return previousOutput;
    }
    return input;
}
function clampHistoryWeight(value) {
    if (!Number.isFinite(value)) {
        return 0.95;
    }
    return Math.min(Math.max(value, 0), 0.99);
}
function createTaaPostPipeline(options) {
    if (options.device.createShaderModule === undefined) {
        options.diagnostics.push({
            code: "webGpuPostPass.createShaderModuleUnavailable",
            effectId: options.effectId,
            message: `TAA post effect '${options.effectId}' cannot create a shader module.`,
        });
        return null;
    }
    if (options.device.createRenderPipeline === undefined) {
        options.diagnostics.push({
            code: "webGpuPostPass.createRenderPipelineUnavailable",
            effectId: options.effectId,
            message: `TAA post effect '${options.effectId}' cannot create a render pipeline.`,
        });
        return null;
    }
    const module = options.device.createShaderModule({
        label: `${options.label}:shader`,
        code: taaPostEffectWgsl(options.historyWeight),
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
        key: `webgpu-post-taa|${options.outputFormat}|history:${options.historyWeight.toFixed(3)}`,
        pipeline,
    };
}
function createTaaPostSampler(options) {
    if (options.device.createSampler === undefined) {
        options.diagnostics.push({
            code: "webGpuPostPass.createSamplerUnavailable",
            effectId: options.effectId,
            message: `TAA post effect '${options.effectId}' cannot create an input sampler.`,
        });
        return null;
    }
    return options.device.createSampler({
        label: `aperture/post/${options.effectId}/sampler`,
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "nearest",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
    });
}
function preparedTaaPass(effectId, label, commands, diagnostics) {
    return {
        effectId,
        label,
        commands,
        diagnostics,
    };
}
function taaPostEffectWgsl(historyWeight) {
    return /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -3.0),
    vec2f(3.0, 1.0),
    vec2f(-1.0, 1.0),
  );
  let position = positions[vertexIndex];
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.uv = position * vec2f(0.5, -0.5) + vec2f(0.5);
  return output;
}

@group(0) @binding(0) var postSampler: sampler;
@group(0) @binding(1) var sourceTexture: texture_2d<f32>;
@group(0) @binding(2) var historyTexture: texture_2d<f32>;
@group(0) @binding(3) var motionVectorTexture: texture_2d<f32>;

fn clampHistoryColor(uv: vec2f, historyRgb: vec3f) -> vec3f {
  let dimensions = textureDimensions(sourceTexture);
  let texel = vec2f(1.0) / vec2f(f32(dimensions.x), f32(dimensions.y));
  var minColor = vec3f(9999.0);
  var maxColor = vec3f(-9999.0);

  for (var y = -1; y <= 1; y = y + 1) {
    for (var x = -1; x <= 1; x = x + 1) {
      let sampleUv = clamp(uv + vec2f(f32(x), f32(y)) * texel, vec2f(0.0), vec2f(1.0));
      let sampleColor = textureSample(sourceTexture, postSampler, sampleUv).rgb;
      minColor = min(minColor, sampleColor);
      maxColor = max(maxColor, sampleColor);
    }
  }

  return clamp(historyRgb, minColor, maxColor);
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let source = textureSample(sourceTexture, postSampler, input.uv);
  let encodedMotion = textureSample(motionVectorTexture, postSampler, input.uv).rg;
  let motion = encodedMotion * 2.0 - vec2f(1.0);
  let historyUv = input.uv - motion;
  let historyInside = all(historyUv >= vec2f(0.0)) && all(historyUv <= vec2f(1.0));
  let history = textureSample(historyTexture, postSampler, clamp(historyUv, vec2f(0.0), vec2f(1.0)));
  let clampedHistory = clampHistoryColor(input.uv, history.rgb);
  let weight = select(0.0, ${historyWeight.toFixed(8)}, historyInside);
  let mixed = mix(source.rgb, clampedHistory, weight);
  return vec4f(mixed, source.a);
}
`;
}
//# sourceMappingURL=post-taa.js.map