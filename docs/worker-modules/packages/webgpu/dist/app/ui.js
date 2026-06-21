import { createFontAtlasHandle, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { layoutMsdfText, createSamplerAsset, } from "/aperture/worker-modules/packages/render/dist/index.js";
import { createWebGpuBuffer } from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
import { createSamplerGpuResource, } from "../resources/textures/texture-resources.js";
import { createUiImageRenderPipelineResource, createUiPanelRenderPipelineResource, uiImagePipelineCacheKey, uiPanelPipelineCacheKey, } from "../render/ui/ui-quad-pipeline.js";
import { getOrCreateWebGpuAppMsdfTextPipeline } from "./text.js";
import { prepareAppSamplerResource, prepareAppTextureResource, } from "./app-texture-sampler-resources.js";
import { webGpuAppCanvasDimensions } from "./canvas.js";
import { WEBGPU_APP_DEPTH_FORMAT } from "../resources/textures/depth-texture-resource.js";
import { webGpuAppScenePassColorFormat, webGpuAppUsesHdrScenePass, } from "./render-color-format.js";
// AI-17: resolve the HDR-aware output stage for a UI pipeline — none/linear on the
// rgba16float scene-buffer path (post stage encodes), else the app's configured stage.
function resolveUiOutputStage(app) {
    const isHdr = webGpuAppUsesHdrScenePass(app);
    return {
        tonemap: isHdr ? "none" : (app.tonemap ?? "none"),
        outputColorSpace: isHdr ? "linear" : (app.outputColorSpace ?? "linear"),
    };
}
const UI_VIEWPORT_FLOAT_OFFSET = 20;
const UI_QUAD_FLOAT_STRIDE = 16;
const UI_GLYPH_FLOAT_STRIDE = 24;
export async function prepareUiFrameResourcesForSnapshot(options) {
    const uiNodes = sortedRenderableUiNodes(options.snapshot);
    if (uiNodes.length === 0) {
        return { valid: true, commands: [], diagnostics: [] };
    }
    const diagnostics = [];
    const commands = [];
    const device = options.app.initialization.device;
    if (device.createBindGroup === undefined) {
        return {
            valid: false,
            commands,
            diagnostics: [
                {
                    code: "uiFrame.createBindGroupUnavailable",
                    message: "WebGPU device cannot create UI bind groups.",
                },
            ],
        };
    }
    const viewUniformData = createUiViewUniformData({
        snapshot: options.snapshot,
        viewUniforms: options.viewUniforms,
        source: options.viewUniforms.data.subarray(0, options.viewUniforms.floatCount ?? options.viewUniforms.data.length),
        ...(options.app.canvas === undefined ? {} : { canvas: options.app.canvas }),
    });
    const viewBuffer = createWebGpuBuffer({
        device,
        descriptor: {
            label: "UI/ViewUniforms",
            size: viewUniformData.byteLength,
            usage: WEBGPU_BUFFER_USAGE_FLAGS.UNIFORM | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
            initialData: viewUniformData,
        },
    });
    if (!viewBuffer.ok) {
        return {
            valid: false,
            commands,
            diagnostics: [
                bufferDiagnostic("uiFrame.viewBufferFailed", viewBuffer.message),
            ],
        };
    }
    const panelInput = createUiPanelInput(uiNodes);
    const imageInput = createUiImageInput(uiNodes);
    const textInput = createUiTextInput(options.snapshot, uiNodes, options.assets);
    diagnostics.push(...textInput.diagnostics);
    const panelPipeline = panelInput.instances.length === 0
        ? null
        : await getOrCreateWebGpuAppUiPanelPipeline(options.app, options.cache);
    const imagePipeline = imageInput.instances.length === 0
        ? null
        : await getOrCreateWebGpuAppUiImagePipeline(options.app, options.cache);
    const textPipeline = textInput.batches.length === 0
        ? null
        : await getOrCreateWebGpuAppMsdfTextPipeline(options.app, options.cache);
    for (const pipeline of [panelPipeline, imagePipeline, textPipeline]) {
        if (pipeline !== null && (!pipeline.valid || pipeline.resource === null)) {
            return {
                valid: false,
                commands,
                diagnostics: [...diagnostics, ...pipeline.diagnostics],
            };
        }
    }
    const panelResources = panelPipeline?.resource === undefined || panelPipeline.resource === null
        ? { commands: [], diagnostics: [] }
        : createUiPanelCommands({
            device,
            cache: options.cache,
            snapshot: options.snapshot,
            pipeline: panelPipeline.resource,
            viewBuffer: viewBuffer.buffer,
            input: panelInput,
        });
    const imageResources = imagePipeline?.resource === undefined || imagePipeline.resource === null
        ? { commands: [], diagnostics: [] }
        : createUiImageCommands({
            app: options.app,
            assets: options.assets,
            cache: options.cache,
            reuse: options.reuse,
            device,
            snapshot: options.snapshot,
            pipeline: imagePipeline.resource,
            viewBuffer: viewBuffer.buffer,
            input: imageInput,
        });
    const textResources = textPipeline?.resource === undefined || textPipeline.resource === null
        ? { commands: [], diagnostics: [] }
        : createUiTextCommands({
            app: options.app,
            assets: options.assets,
            cache: options.cache,
            reuse: options.reuse,
            device,
            snapshot: options.snapshot,
            pipeline: textPipeline.resource,
            viewBuffer: viewBuffer.buffer,
            input: textInput,
        });
    diagnostics.push(...panelResources.diagnostics, ...imageResources.diagnostics, ...textResources.diagnostics);
    const commandGroups = new Map();
    for (const instance of panelInput.instances) {
        commandGroups.set(instance.node.uiId, commandsForRenderId(panelResources.commands, instance.node.uiId));
    }
    for (const instance of imageInput.instances) {
        commandGroups.set(instance.node.uiId, commandsForRenderId(imageResources.commands, instance.node.uiId));
    }
    for (const batch of textInput.batches) {
        const existing = commandGroups.get(batch.node.uiId) ?? [];
        commandGroups.set(batch.node.uiId, [
            ...existing,
            ...commandsForRenderId(textResources.commands, batch.renderId),
        ]);
    }
    for (const node of uiNodes) {
        commands.push(...(commandGroups.get(node.uiId) ?? []));
    }
    if (commands.length === 0) {
        diagnostics.push({
            code: "uiFrame.noRenderableCommands",
            message: "UI frame preparation found renderable UI nodes but emitted no draw commands.",
        });
    }
    return {
        valid: diagnostics.length === 0,
        commands,
        diagnostics,
    };
}
export async function getOrCreateWebGpuAppUiPanelPipeline(app, cache) {
    const { tonemap, outputColorSpace } = resolveUiOutputStage(app);
    const colorFormat = webGpuAppScenePassColorFormat(app);
    const key = uiPanelPipelineCacheKey(colorFormat, WEBGPU_APP_DEPTH_FORMAT, app.msaa.sampleCount, tonemap, outputColorSpace);
    const cached = cache.uiPanelPipelines.get(key);
    if (cached !== undefined) {
        return cached;
    }
    const result = await createUiPanelRenderPipelineResource({
        device: app.initialization.device,
        colorFormat,
        depthFormat: WEBGPU_APP_DEPTH_FORMAT,
        sampleCount: app.msaa.sampleCount,
        tonemap,
        outputColorSpace,
    });
    cache.uiPanelPipelines.set(key, result);
    return result;
}
export async function getOrCreateWebGpuAppUiImagePipeline(app, cache) {
    const { tonemap, outputColorSpace } = resolveUiOutputStage(app);
    const colorFormat = webGpuAppScenePassColorFormat(app);
    const key = uiImagePipelineCacheKey(colorFormat, WEBGPU_APP_DEPTH_FORMAT, app.msaa.sampleCount, tonemap, outputColorSpace);
    const cached = cache.uiImagePipelines.get(key);
    if (cached !== undefined) {
        return cached;
    }
    const result = await createUiImageRenderPipelineResource({
        device: app.initialization.device,
        colorFormat,
        depthFormat: WEBGPU_APP_DEPTH_FORMAT,
        sampleCount: app.msaa.sampleCount,
        tonemap,
        outputColorSpace,
    });
    cache.uiImagePipelines.set(key, result);
    return result;
}
function createUiPanelCommands(options) {
    if (options.input.instances.length === 0) {
        return { commands: [], diagnostics: [] };
    }
    const diagnostics = [];
    const commands = [];
    const buffer = createWebGpuBuffer({
        device: options.device,
        descriptor: {
            label: "UI/PanelData",
            size: options.input.data.byteLength,
            usage: WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
            initialData: options.input.data,
        },
    });
    if (!buffer.ok) {
        return {
            commands,
            diagnostics: [
                bufferDiagnostic("uiFrame.panelBufferFailed", buffer.message),
            ],
        };
    }
    const pipeline = options.pipeline.pipeline;
    if (pipeline.getBindGroupLayout === undefined) {
        return {
            commands,
            diagnostics: [
                {
                    code: "uiFrame.panelMissingPipelineLayouts",
                    message: "UI panel pipeline does not expose bind group layouts.",
                },
            ],
        };
    }
    const viewBindGroup = options.device.createBindGroup?.({
        label: "UI/Panel/ViewBindGroup",
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: options.viewBuffer } }],
    });
    const dataBindGroup = options.device.createBindGroup?.({
        label: "UI/Panel/DataBindGroup",
        layout: pipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: { buffer: buffer.buffer } }],
    });
    for (const instance of options.input.instances) {
        commands.push({
            kind: "setPipeline",
            renderId: instance.node.uiId,
            pipelineKey: options.pipeline.cacheKey,
            pipeline: options.pipeline.pipeline,
        }, {
            kind: "setBindGroup",
            renderId: instance.node.uiId,
            index: 0,
            resourceKey: `ui-panel:view:${options.snapshot.frame}`,
            bindGroup: viewBindGroup,
        }, {
            kind: "setBindGroup",
            renderId: instance.node.uiId,
            index: 1,
            resourceKey: `ui-panel:data:${options.snapshot.frame}`,
            bindGroup: dataBindGroup,
        }, {
            kind: "draw",
            renderId: instance.node.uiId,
            vertexCount: 6,
            instanceCount: 1,
            firstVertex: 0,
            firstInstance: instance.instance,
        });
    }
    return { commands, diagnostics };
}
function createUiImageCommands(options) {
    if (options.input.instances.length === 0) {
        return { commands: [], diagnostics: [] };
    }
    const diagnostics = [];
    const commands = [];
    const buffer = createWebGpuBuffer({
        device: options.device,
        descriptor: {
            label: "UI/ImageData",
            size: options.input.data.byteLength,
            usage: WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
            initialData: options.input.data,
        },
    });
    if (!buffer.ok) {
        return {
            commands,
            diagnostics: [
                bufferDiagnostic("uiFrame.imageBufferFailed", buffer.message),
            ],
        };
    }
    const pipeline = options.pipeline.pipeline;
    if (pipeline.getBindGroupLayout === undefined) {
        return {
            commands,
            diagnostics: [
                {
                    code: "uiFrame.imageMissingPipelineLayouts",
                    message: "UI image pipeline does not expose bind group layouts.",
                },
            ],
        };
    }
    const viewBindGroup = options.device.createBindGroup?.({
        label: "UI/Image/ViewBindGroup",
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: options.viewBuffer } }],
    });
    const defaultSampler = getOrCreateUiImageDefaultSampler(options.app, options.cache, options.reuse, diagnostics);
    if (defaultSampler === null) {
        return { commands, diagnostics };
    }
    for (const instance of options.input.instances) {
        const textureHandle = instance.node.texture;
        if (textureHandle === undefined || textureHandle === null) {
            diagnostics.push({
                code: "uiFrame.imageMissingTexture",
                message: `UI image node ${instance.node.uiId} is missing its texture handle.`,
            });
            continue;
        }
        const texture = prepareAppTextureResource({
            assets: options.assets,
            device: options.app.initialization.device,
            cache: options.cache,
            handle: textureHandle,
            reuse: options.reuse,
            diagnostics: diagnostics,
        });
        if (texture === null) {
            continue;
        }
        const sampler = instance.node.sampler === undefined || instance.node.sampler === null
            ? {
                cacheKey: "ui-image:default-sampler",
                resource: defaultSampler,
            }
            : prepareAppSamplerResource({
                assets: options.assets,
                device: options.app.initialization.device,
                cache: options.cache,
                handle: instance.node.sampler,
                reuse: options.reuse,
                diagnostics: diagnostics,
            });
        if (sampler === null) {
            continue;
        }
        const dataBindGroup = options.device.createBindGroup?.({
            label: `UI/Image/DataBindGroup/${instance.node.uiId}`,
            layout: pipeline.getBindGroupLayout(1),
            entries: [
                { binding: 0, resource: { buffer: buffer.buffer } },
                { binding: 1, resource: texture.resource.view },
                { binding: 2, resource: sampler.resource.sampler },
            ],
        });
        commands.push({
            kind: "setPipeline",
            renderId: instance.node.uiId,
            pipelineKey: options.pipeline.cacheKey,
            pipeline: options.pipeline.pipeline,
        }, {
            kind: "setBindGroup",
            renderId: instance.node.uiId,
            index: 0,
            resourceKey: `ui-image:view:${options.snapshot.frame}`,
            bindGroup: viewBindGroup,
        }, {
            kind: "setBindGroup",
            renderId: instance.node.uiId,
            index: 1,
            resourceKey: `ui-image:${options.snapshot.frame}:${texture.cacheKey}:${sampler.cacheKey}`,
            bindGroup: dataBindGroup,
        }, {
            kind: "draw",
            renderId: instance.node.uiId,
            vertexCount: 6,
            instanceCount: 1,
            firstVertex: 0,
            firstInstance: instance.instance,
        });
    }
    return { commands, diagnostics };
}
function createUiTextCommands(options) {
    if (options.input.batches.length === 0) {
        return { commands: [], diagnostics: [] };
    }
    const diagnostics = [];
    const commands = [];
    const transformBuffer = createWebGpuBuffer({
        device: options.device,
        descriptor: {
            label: "UI/TextTransforms",
            size: options.input.transforms.byteLength,
            usage: WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
            initialData: options.input.transforms,
        },
    });
    const glyphBuffer = createWebGpuBuffer({
        device: options.device,
        descriptor: {
            label: "UI/TextGlyphData",
            size: options.input.glyphs.byteLength,
            usage: WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST,
            initialData: options.input.glyphs,
        },
    });
    if (!transformBuffer.ok) {
        diagnostics.push(bufferDiagnostic("uiFrame.textTransformBufferFailed", transformBuffer.message));
    }
    if (!glyphBuffer.ok) {
        diagnostics.push(bufferDiagnostic("uiFrame.textGlyphBufferFailed", glyphBuffer.message));
    }
    if (!transformBuffer.ok || !glyphBuffer.ok) {
        return { commands, diagnostics };
    }
    const pipeline = options.pipeline.pipeline;
    if (pipeline.getBindGroupLayout === undefined) {
        return {
            commands,
            diagnostics: [
                {
                    code: "uiFrame.textMissingPipelineLayouts",
                    message: "MSDF text pipeline does not expose bind group layouts.",
                },
            ],
        };
    }
    const viewBindGroup = options.device.createBindGroup?.({
        label: "UI/Text/ViewBindGroup",
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: options.viewBuffer } }],
    });
    const transformBindGroup = options.device.createBindGroup?.({
        label: "UI/Text/TransformBindGroup",
        layout: pipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: { buffer: transformBuffer.buffer } }],
    });
    const defaultSampler = getOrCreateUiTextDefaultSampler(options.app, options.cache, options.reuse, diagnostics);
    if (defaultSampler === null) {
        return { commands, diagnostics };
    }
    for (const batch of options.input.batches) {
        const texture = prepareAppTextureResource({
            assets: options.assets,
            device: options.app.initialization.device,
            cache: options.cache,
            handle: batch.texture,
            reuse: options.reuse,
            diagnostics: diagnostics,
        });
        if (texture === null) {
            continue;
        }
        const sampler = batch.sampler === undefined || batch.sampler === null
            ? {
                cacheKey: "ui-text:default-sampler",
                resource: defaultSampler,
            }
            : prepareAppSamplerResource({
                assets: options.assets,
                device: options.app.initialization.device,
                cache: options.cache,
                handle: batch.sampler,
                reuse: options.reuse,
                diagnostics: diagnostics,
            });
        if (sampler === null) {
            continue;
        }
        const glyphBindGroup = options.device.createBindGroup?.({
            label: `UI/Text/GlyphBindGroup/${batch.renderId}`,
            layout: pipeline.getBindGroupLayout(2),
            entries: [
                { binding: 0, resource: { buffer: glyphBuffer.buffer } },
                { binding: 1, resource: texture.resource.view },
                { binding: 2, resource: sampler.resource.sampler },
            ],
        });
        commands.push({
            kind: "setPipeline",
            renderId: batch.renderId,
            pipelineKey: options.pipeline.cacheKey,
            pipeline: options.pipeline.pipeline,
        }, {
            kind: "setBindGroup",
            renderId: batch.renderId,
            index: 0,
            resourceKey: `ui-text:view:${options.snapshot.frame}`,
            bindGroup: viewBindGroup,
        }, {
            kind: "setBindGroup",
            renderId: batch.renderId,
            index: 1,
            resourceKey: `ui-text:transforms:${options.snapshot.frame}`,
            bindGroup: transformBindGroup,
        }, {
            kind: "setBindGroup",
            renderId: batch.renderId,
            index: 2,
            resourceKey: `ui-text:glyphs:${options.snapshot.frame}:${batch.renderId}:${texture.cacheKey}:${sampler.cacheKey}`,
            bindGroup: glyphBindGroup,
        }, {
            kind: "draw",
            renderId: batch.renderId,
            vertexCount: 6,
            instanceCount: batch.instanceCount,
            firstVertex: 0,
            firstInstance: batch.firstInstance,
        });
    }
    return { commands, diagnostics };
}
function createUiPanelInput(nodes) {
    const panels = nodes.filter((node) => node.kind === "panel");
    const data = new Float32Array(Math.max(1, panels.length) * UI_QUAD_FLOAT_STRIDE);
    const instances = [];
    panels.forEach((node, instance) => {
        writeUiQuadData(data, instance, node, node.color ?? [1, 1, 1, 1]);
        instances.push({ node, instance });
    });
    return { data, instances };
}
function createUiImageInput(nodes) {
    const images = nodes.filter((node) => node.kind === "image");
    const data = new Float32Array(Math.max(1, images.length) * UI_QUAD_FLOAT_STRIDE);
    const instances = [];
    images.forEach((node, instance) => {
        writeUiQuadData(data, instance, node, node.color ?? [1, 1, 1, 1]);
        instances.push({ node, instance });
    });
    return { data, instances };
}
function createUiTextInput(snapshot, nodes, assets) {
    const textNodes = nodes.filter((node) => node.kind === "text");
    const glyphFloats = [];
    const transforms = new Float32Array(Math.max(1, textNodes.length) * 16);
    const batches = [];
    const diagnostics = [];
    textNodes.forEach((node, transformIndex) => {
        writeUiTextTransform(transforms, transformIndex, node.rect.x, node.rect.y);
        const fontHandle = parseFontAtlasHandle(node.fontAtlasId ?? "");
        if (fontHandle === null) {
            diagnostics.push({
                code: "uiFrame.textInvalidFontAtlas",
                message: `UI text node ${node.uiId} has an invalid font atlas handle.`,
            });
            return;
        }
        const fontEntry = assets.get(fontHandle);
        const font = fontEntry?.asset ?? null;
        if (font === null) {
            diagnostics.push({
                code: "uiFrame.textFontAtlasNotReady",
                message: `UI text node ${node.uiId} references a font atlas that is not ready.`,
            });
            return;
        }
        const layout = layoutMsdfText(font, {
            text: node.text ?? "",
            ...(node.fontSize === undefined ? {} : { fontSize: node.fontSize }),
            ...(node.lineHeight === undefined || node.lineHeight <= 0
                ? {}
                : { lineHeight: node.lineHeight }),
            maxWidth: node.maxWidth !== undefined && node.maxWidth > 0
                ? node.maxWidth
                : Math.max(1, node.rect.width),
            align: node.textAlign ?? "left",
            color: withOpacity(node.color ?? [1, 1, 1, 1], node.opacity),
        });
        diagnostics.push(...layout.diagnostics);
        const glyphsByPage = new Map();
        for (const glyph of layout.glyphs) {
            const pageGlyphs = glyphsByPage.get(glyph.page) ?? [];
            glyphsByPage.set(glyph.page, [...pageGlyphs, glyph]);
        }
        for (const [page, glyphs] of glyphsByPage) {
            const texture = font.pages[page];
            if (texture === undefined) {
                diagnostics.push({
                    code: "uiFrame.textMissingFontPage",
                    message: `UI text node ${node.uiId} references missing font atlas page ${page}.`,
                });
                continue;
            }
            const firstInstance = glyphFloats.length / UI_GLYPH_FLOAT_STRIDE;
            for (const glyph of glyphs) {
                writeUiGlyphData(glyphFloats, {
                    node,
                    glyph,
                    font,
                    transformIndex,
                });
            }
            batches.push({
                node,
                renderId: node.uiId * 16 + page,
                texture,
                ...(font.sampler === undefined ? {} : { sampler: font.sampler }),
                firstInstance,
                instanceCount: glyphs.length,
            });
        }
    });
    return {
        glyphs: new Float32Array(glyphFloats),
        transforms,
        batches,
        diagnostics,
    };
}
function sortedRenderableUiNodes(snapshot) {
    return [...(snapshot.uiNodes ?? [])]
        .filter((node) => node.kind === "panel" ||
        node.kind === "image" ||
        (node.kind === "text" && (node.text ?? "").length > 0))
        .filter((node) => node.rect.width > 0 && node.rect.height > 0)
        .sort((a, b) => a.stackIndex - b.stackIndex || a.uiId - b.uiId);
}
function writeUiQuadData(data, instance, node, color) {
    const offset = instance * UI_QUAD_FLOAT_STRIDE;
    const uv = node.uvRect ?? [0, 0, 1, 1];
    const rgba = withOpacity(color, node.opacity);
    data[offset] = rgba[0];
    data[offset + 1] = rgba[1];
    data[offset + 2] = rgba[2];
    data[offset + 3] = rgba[3];
    data[offset + 4] = node.rect.x;
    data[offset + 5] = node.rect.y;
    data[offset + 6] = node.rect.width;
    data[offset + 7] = node.rect.height;
    data[offset + 8] = uv[0] ?? 0;
    data[offset + 9] = uv[1] ?? 0;
    data[offset + 10] = uv[2] ?? 1;
    data[offset + 11] = uv[3] ?? 1;
    data[offset + 12] = node.clip.x;
    data[offset + 13] = node.clip.y;
    data[offset + 14] = node.clip.width;
    data[offset + 15] = node.clip.height;
}
function writeUiTextTransform(transforms, transformIndex, x, y) {
    const offset = transformIndex * 16;
    transforms[offset] = 1;
    transforms[offset + 5] = 1;
    transforms[offset + 10] = 1;
    transforms[offset + 15] = 1;
    transforms[offset + 12] = x;
    transforms[offset + 13] = y;
}
function writeUiGlyphData(target, input) {
    const glyph = input.glyph;
    const color = withOpacity(glyph.color, input.node.opacity);
    target.push(color[0], color[1], color[2], color[3], glyph.x, glyph.y, glyph.width, glyph.height, glyph.uvRect[0], glyph.uvRect[1], glyph.uvRect[2], glyph.uvRect[3], input.font.distanceRange, input.font.scaleW, input.font.scaleH, 1, input.transformIndex, glyph.glyphId, glyph.charIndex, glyph.lineIndex, input.node.clip.x, input.node.clip.y, input.node.clip.width, input.node.clip.height);
}
function createUiViewUniformData(options) {
    const data = options.source.length === 0
        ? new Float32Array(UI_VIEWPORT_FLOAT_OFFSET + 4)
        : new Float32Array(options.source);
    const dimensions = options.canvas === undefined
        ? { width: 1, height: 1 }
        : webGpuAppCanvasDimensions(options.canvas);
    const records = options.viewUniforms.views.length === 0
        ? [{ viewId: options.snapshot.views[0]?.viewId ?? 0, packedOffset: 0 }]
        : options.viewUniforms.views;
    for (const record of records) {
        const view = options.snapshot.views.find((candidate) => candidate.viewId === record.viewId);
        const viewport = view?.viewport ?? [0, 0, 1, 1];
        const offset = record.packedOffset + UI_VIEWPORT_FLOAT_OFFSET;
        if (offset + 3 >= data.length) {
            continue;
        }
        const width = Math.max(1, dimensions.width * (viewport[2] ?? 1));
        const height = Math.max(1, dimensions.height * (viewport[3] ?? 1));
        data[offset] = width;
        data[offset + 1] = height;
        data[offset + 2] = 1 / width;
        data[offset + 3] = 1 / height;
    }
    return data;
}
function commandsForRenderId(commands, renderId) {
    return commands.filter((command) => command.renderId === renderId);
}
function parseFontAtlasHandle(value) {
    const prefix = "font-atlas:";
    return value.startsWith(prefix) && value.length > prefix.length
        ? createFontAtlasHandle(value.slice(prefix.length))
        : null;
}
function withOpacity(color, opacity) {
    return [
        color[0] ?? 1,
        color[1] ?? 1,
        color[2] ?? 1,
        (color[3] ?? 1) * opacity,
    ];
}
function getOrCreateUiImageDefaultSampler(app, cache, reuse, diagnostics) {
    return getOrCreateUiDefaultSampler(app, cache, reuse, diagnostics, "ui-image:default-sampler", "UiImageDefaultSampler");
}
function getOrCreateUiTextDefaultSampler(app, cache, reuse, diagnostics) {
    return getOrCreateUiDefaultSampler(app, cache, reuse, diagnostics, "ui-text:default-sampler", "UiTextDefaultSampler");
}
function getOrCreateUiDefaultSampler(app, cache, reuse, diagnostics, cacheKey, label) {
    const cached = cache.samplers.get(cacheKey);
    if (cached !== undefined) {
        reuse.samplerResourcesReused += 1;
        return cached;
    }
    const sampler = createSamplerGpuResource({
        device: app.initialization.device,
        resourceKey: cacheKey,
        sampler: createSamplerAsset({
            label,
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            addressModeW: "clamp-to-edge",
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "linear",
            lodMaxClamp: 0,
        }),
    });
    diagnostics.push(...sampler.diagnostics);
    if (!sampler.valid || sampler.resource === null) {
        return null;
    }
    cache.samplers.set(cacheKey, sampler.resource);
    reuse.samplerResourcesCreated += 1;
    return sampler.resource;
}
function bufferDiagnostic(code, message) {
    return { code, message };
}
//# sourceMappingURL=ui.js.map