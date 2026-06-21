import { finishCommandEncoder, } from "../../gpu/command-buffer.js";
import { createCommandEncoderResource, } from "../../gpu/command-encoder.js";
import { createCurrentTextureColorTarget, createOffscreenColorTarget, } from "../../app/presentation/current-texture-view.js";
import { submitCommandBuffers, } from "../queues/queue-submit.js";
import { createRenderPassAttachmentPlan, } from "../passes/render-pass-attachments.js";
import { executeRenderPassCommands, } from "../passes/render-pass-command-executor.js";
import { executeRenderPassCommandsWithRenderBundle, } from "../draw/render-bundle.js";
import { resolveGpuTimestampQueries, writeGpuTimestampQuery, } from "../../gpu/gpu-timing.js";
import { resolveGpuOcclusionQueries, } from "../../gpu/occlusion-query.js";
import { beginPlannedRenderPass, endPlannedRenderPass, } from "../passes/render-pass-lifecycle.js";
const readbackBytesPerRow = 256;
/**
 * Encode ONE render boundary (timing-start → begin → rectangles → draw commands
 * → end → timing-end → occlusion resolve → timing resolve → readback copy) into a
 * CALLER-PROVIDED encoder. It never creates, finishes, or submits the encoder —
 * that is the caller's job. This is the single-encoder primitive the FrameGraph
 * executor (M3) uses to fold every pass into one GPUCommandEncoder;
 * `assembleFrameBoundary` is the legacy one-pass wrapper around it.
 */
export function encodeFrameBoundaryInto(options) {
    const encoderHandle = options.encoder;
    const attachments = options.attachments;
    const gpuTimingStart = writeFrameBoundaryGpuTimingStart(encoderHandle, options.gpuTiming);
    const begin = attachments?.plan === undefined || encoderHandle === undefined
        ? null
        : beginPlannedRenderPass({
            encoder: encoderHandle,
            plan: attachments.plan,
        });
    const pass = begin?.pass ?? null;
    const rectangle = pass === null
        ? null
        : applyFrameBoundaryPassRectangles({
            pass: pass,
            viewport: options.viewport ?? null,
            scissor: options.scissor ?? null,
        });
    const commandExecution = pass === null || rectangle?.valid === false
        ? null
        : executeFrameBoundaryCommands({
            pass,
            device: options.device,
            commands: options.commands,
            label: options.label,
            ...(options.renderBundle === undefined
                ? {}
                : { renderBundle: options.renderBundle }),
        });
    const execution = commandExecution?.execution ?? null;
    const renderBundle = commandExecution?.renderBundle ?? null;
    const end = pass === null
        ? null
        : endPlannedRenderPass(pass);
    const gpuTimingEnd = writeFrameBoundaryGpuTimingEnd(encoderHandle, options.gpuTiming);
    const occlusionQueries = resolveFrameBoundaryOcclusionQueries(encoderHandle, options.occlusionQueries);
    const gpuTimingResolve = resolveFrameBoundaryGpuTiming(encoderHandle, options.gpuTiming);
    const readback = options.readback === undefined
        ? null
        : createFrameBoundaryReadbackCopyPlan({
            device: options.device,
            encoder: encoderHandle,
            source: options.colorTargetSource,
            texture: options.readbackTexture,
            readback: options.readback,
        });
    return {
        valid: begin?.valid === true &&
            (rectangle === null || rectangle.valid) &&
            execution?.valid === true &&
            end?.valid === true &&
            (occlusionQueries === null || occlusionQueries.valid),
        begin,
        rectangle,
        execution,
        renderBundle,
        end,
        readback,
        gpuTiming: options.gpuTiming === undefined
            ? null
            : createFrameBoundaryGpuTimingCommandReport(options.gpuTiming, gpuTimingStart, gpuTimingEnd, gpuTimingResolve),
        occlusionQueries,
    };
}
/**
 * Resolve a frame boundary's color target (swapchain or off-screen) and build
 * its render-pass attachment plan (color + optional MSAA resolve + extra color
 * targets + depth + occlusion query set). Extracted so the single-encoder graph
 * executor's route ports build attachments through the EXACT same path as the
 * legacy assembleFrameBoundary wrapper — keeping per-pass encoding identical.
 */
export function buildFrameBoundaryTargetPlan(options) {
    const colorTarget = options.colorTarget ?? { source: "current-texture" };
    const texture = colorTarget.source === "offscreen-target"
        ? createOffscreenColorTarget({
            texture: colorTarget.texture,
            loadOp: options.colorLoadOp ?? "clear",
            ...(options.clearColor === undefined
                ? {}
                : { clearColor: options.clearColor }),
        })
        : createCurrentTextureColorTarget({
            context: options.context,
            loadOp: options.colorLoadOp ?? "clear",
            ...(options.clearColor === undefined
                ? {}
                : { clearColor: options.clearColor }),
        });
    const attachments = texture.target === null
        ? null
        : createRenderPassAttachmentPlan({
            colorTargets: [
                options.msaaColorTarget === undefined ||
                    options.msaaColorTarget === null ||
                    options.msaaColorTarget.sampleCount <= 1
                    ? texture.target
                    : {
                        ...texture.target,
                        view: options.msaaColorTarget.view,
                        resolveTarget: texture.target.view,
                        storeOp: options.msaaColorStoreOp ?? "discard",
                    },
                ...(options.additionalColorTargets ?? []),
            ],
            ...(options.depthTarget === undefined
                ? {}
                : { depthTarget: options.depthTarget }),
            ...(options.occlusionQuerySet === undefined
                ? {}
                : { occlusionQuerySet: options.occlusionQuerySet }),
        });
    return { texture, attachments };
}
export function assembleFrameBoundary(options) {
    const colorTarget = options.colorTarget ?? { source: "current-texture" };
    const { texture, attachments } = buildFrameBoundaryTargetPlan({
        context: options.context,
        ...(options.colorTarget === undefined
            ? {}
            : { colorTarget: options.colorTarget }),
        ...(options.colorLoadOp === undefined
            ? {}
            : { colorLoadOp: options.colorLoadOp }),
        ...(options.clearColor === undefined
            ? {}
            : { clearColor: options.clearColor }),
        ...(options.msaaColorTarget === undefined
            ? {}
            : { msaaColorTarget: options.msaaColorTarget }),
        ...(options.msaaColorStoreOp === undefined
            ? {}
            : { msaaColorStoreOp: options.msaaColorStoreOp }),
        ...(options.additionalColorTargets === undefined
            ? {}
            : { additionalColorTargets: options.additionalColorTargets }),
        ...(options.depthTarget === undefined
            ? {}
            : { depthTarget: options.depthTarget }),
        ...(options.occlusionQueries === undefined
            ? {}
            : { occlusionQuerySet: options.occlusionQueries.resources.querySet }),
    });
    const encoder = attachments?.valid === true
        ? createCommandEncoderResource({
            device: options.device,
            label: options.label,
        })
        : null;
    const encoderHandle = encoder?.resource?.encoder;
    const encoded = encodeFrameBoundaryInto({
        encoder: encoderHandle,
        device: options.device,
        attachments,
        commands: options.commands,
        label: options.label,
        colorTargetSource: colorTarget.source,
        readbackTexture: texture.texture,
        viewport: options.viewport ?? null,
        scissor: options.scissor ?? null,
        ...(options.readback === undefined ? {} : { readback: options.readback }),
        ...(options.gpuTiming === undefined
            ? {}
            : { gpuTiming: options.gpuTiming }),
        ...(options.occlusionQueries === undefined
            ? {}
            : { occlusionQueries: options.occlusionQueries }),
        ...(options.renderBundle === undefined
            ? {}
            : { renderBundle: options.renderBundle }),
    });
    const finish = encoderHandle === undefined || encoded.end?.valid !== true
        ? null
        : finishCommandEncoder({
            encoder: encoderHandle,
            label: options.label,
        });
    const submit = finish?.resource === undefined || finish.resource === null
        ? null
        : submitCommandBuffers({
            queue: options.queue,
            commandBuffers: [finish.resource],
        });
    return {
        valid: texture.valid &&
            attachments?.valid === true &&
            encoder?.valid === true &&
            encoded.valid &&
            finish?.valid === true &&
            submit?.valid === true,
        texture,
        attachments,
        encoder,
        begin: encoded.begin,
        rectangle: encoded.rectangle,
        execution: encoded.execution,
        renderBundle: encoded.renderBundle,
        end: encoded.end,
        finish,
        submit,
        readback: encoded.readback,
        gpuTiming: encoded.gpuTiming,
        occlusionQueries: encoded.occlusionQueries,
    };
}
function resolveFrameBoundaryOcclusionQueries(encoder, options) {
    if (options === undefined) {
        return null;
    }
    if (encoder === undefined) {
        return {
            valid: false,
            diagnostics: [
                {
                    code: "gpuOcclusion.commandEncodingUnsupported",
                    severity: "error",
                    message: "GPU occlusion query resolve requires a command encoder resource.",
                },
            ],
        };
    }
    return resolveGpuOcclusionQueries(encoder, options.resources, options.queryCount);
}
function executeFrameBoundaryCommands(options) {
    if (options.renderBundle === undefined) {
        return {
            execution: executeRenderPassCommands({
                pass: options.pass,
                commands: options.commands,
            }),
            renderBundle: null,
        };
    }
    return executeRenderPassCommandsWithRenderBundle({
        pass: options.pass,
        device: options.device,
        commands: options.commands,
        ...(options.renderBundle.bundledCommandCount === undefined
            ? {}
            : { bundledCommandCount: options.renderBundle.bundledCommandCount }),
        cache: options.renderBundle.cache,
        key: options.renderBundle.key,
        descriptor: options.renderBundle.descriptor,
        label: options.label,
        ...(options.renderBundle.enabled === undefined
            ? {}
            : { enabled: options.renderBundle.enabled }),
    });
}
function applyFrameBoundaryPassRectangles(options) {
    if (options.viewport === null && options.scissor === null) {
        return null;
    }
    const diagnostics = [];
    if (options.viewport !== null) {
        if (!validFrameBoundaryViewRectangle(options.viewport)) {
            diagnostics.push({
                code: "frameBoundaryPassRectangle.invalidRectangle",
                message: `Render pass viewport must have finite positive dimensions; received ${viewRectangleLabel(options.viewport)}.`,
            });
        }
        else if (options.pass.setViewport === undefined) {
            diagnostics.push({
                code: "frameBoundaryPassRectangle.missingSetViewport",
                message: "Render pass encoder cannot apply a viewport rectangle for this view.",
            });
        }
        else {
            options.pass.setViewport(options.viewport.x, options.viewport.y, options.viewport.width, options.viewport.height, 0, 1);
        }
    }
    if (options.scissor !== null) {
        if (!validFrameBoundaryViewRectangle(options.scissor)) {
            diagnostics.push({
                code: "frameBoundaryPassRectangle.invalidRectangle",
                message: `Render pass scissor must have finite positive dimensions; received ${viewRectangleLabel(options.scissor)}.`,
            });
        }
        else if (options.pass.setScissorRect === undefined) {
            diagnostics.push({
                code: "frameBoundaryPassRectangle.missingSetScissorRect",
                message: "Render pass encoder cannot apply a scissor rectangle for this view.",
            });
        }
        else {
            options.pass.setScissorRect(Math.round(options.scissor.x), Math.round(options.scissor.y), Math.round(options.scissor.width), Math.round(options.scissor.height));
        }
    }
    return {
        valid: diagnostics.length === 0,
        viewport: options.viewport,
        scissor: options.scissor,
        diagnostics,
    };
}
function validFrameBoundaryViewRectangle(rect) {
    return (Number.isFinite(rect.x) &&
        Number.isFinite(rect.y) &&
        Number.isFinite(rect.width) &&
        Number.isFinite(rect.height) &&
        rect.width > 0 &&
        rect.height > 0);
}
function viewRectangleLabel(rect) {
    return `${rect.x},${rect.y},${rect.width},${rect.height}`;
}
function writeFrameBoundaryGpuTimingStart(encoder, options) {
    if (options === undefined || encoder === undefined) {
        return null;
    }
    return writeGpuTimestampQuery(encoder, options.resources, options.startQuery ?? 0);
}
function writeFrameBoundaryGpuTimingEnd(encoder, options) {
    if (options === undefined || encoder === undefined) {
        return null;
    }
    return writeGpuTimestampQuery(encoder, options.resources, options.endQuery ?? (options.startQuery ?? 0) + 1);
}
function resolveFrameBoundaryGpuTiming(encoder, options) {
    if (options === undefined || encoder === undefined) {
        return null;
    }
    return resolveGpuTimestampQueries(encoder, options.resources, options.resolveQueryCount ?? options.resources.queryCount);
}
function createFrameBoundaryGpuTimingCommandReport(options, writeStart, writeEnd, resolve) {
    return {
        pass: options.passName,
        startQuery: options.startQuery ?? 0,
        endQuery: options.endQuery ?? (options.startQuery ?? 0) + 1,
        writeStart,
        writeEnd,
        resolve,
        diagnostics: [
            ...(writeStart?.diagnostics ?? []),
            ...(writeEnd?.diagnostics ?? []),
            ...(resolve?.diagnostics ?? []),
        ],
    };
}
export async function mapFrameBoundaryReadbackSamples(plan, frameOk) {
    if (plan === null || plan === undefined) {
        return undefined;
    }
    if (!plan.ok) {
        return { ...plan, clearOk: frameOk };
    }
    const samples = [];
    for (const sample of plan.samples) {
        const buffer = sample.buffer;
        if (buffer.mapAsync === undefined) {
            return readbackFailure("map-read-unavailable", `WebGPU readback buffer for '${sample.id}' cannot be mapped for reading.`, frameOk);
        }
        if (buffer.getMappedRange === undefined) {
            return readbackFailure("mapped-range-unavailable", `WebGPU readback buffer for '${sample.id}' cannot expose a mapped range.`, frameOk);
        }
        try {
            await buffer.mapAsync(plan.mapModeRead);
        }
        catch (cause) {
            return readbackFailure("readback-map-failed", `WebGPU readback buffer mapping failed for '${sample.id}': ${messageFromCause(cause)}`, frameOk);
        }
        try {
            samples.push({
                id: sample.id,
                origin: sample.origin,
                pixel: decodeTexturePixel(plan.byteOrder, mappedRangeBytes(buffer.getMappedRange())),
            });
        }
        catch (cause) {
            return readbackFailure("mapped-range-unavailable", `WebGPU readback mapped range could not be read for '${sample.id}': ${messageFromCause(cause)}`, frameOk);
        }
        finally {
            try {
                buffer.unmap?.();
            }
            catch {
                // Best effort cleanup; readback diagnostics are more useful than unmap failures.
            }
        }
    }
    return {
        ok: true,
        source: plan.source,
        format: plan.format,
        bytesPerRow: plan.bytesPerRow,
        samples,
    };
}
function createFrameBoundaryReadbackCopyPlan(options) {
    const byteOrder = textureByteOrder(options.readback.format);
    if (byteOrder === null) {
        return readbackFailure("unsupported-texture-format", `WebGPU readback does not know how to decode '${options.readback.format}' texture bytes.`, false);
    }
    const usage = resolveBufferUsage();
    if (!usage.ok) {
        return usage;
    }
    const mapMode = resolveMapModeRead();
    if (!mapMode.ok) {
        return mapMode;
    }
    if (options.device.createBuffer === undefined) {
        return readbackFailure("create-buffer-unavailable", "WebGPU device cannot create readback buffers.", false);
    }
    if (options.encoder?.copyTextureToBuffer === undefined) {
        return readbackFailure("copy-texture-to-buffer-unavailable", `WebGPU command encoder cannot copy the ${readbackSourceLabel(options.source)} into readback buffers.`, false);
    }
    const samples = [];
    for (const sample of options.readback.samples) {
        const origin = sampleOrigin(sample, options.readback.width, options.readback.height);
        if (origin === null) {
            return readbackFailure("texture-size-invalid", `WebGPU readback sample '${sample.id}' is outside the ${options.readback.width}x${options.readback.height} texture.`, false);
        }
        let buffer;
        try {
            buffer = options.device.createBuffer({
                label: `aperture-${sample.id}-readback`,
                size: readbackBytesPerRow,
                usage: usage.value,
            });
        }
        catch (cause) {
            return readbackFailure("create-buffer-unavailable", `WebGPU readback buffer creation failed: ${messageFromCause(cause)}`, false);
        }
        try {
            options.encoder.copyTextureToBuffer({
                texture: options.texture,
                origin: { x: origin.x, y: origin.y, z: 0 },
            }, {
                buffer,
                bytesPerRow: readbackBytesPerRow,
                rowsPerImage: 1,
            }, { width: 1, height: 1, depthOrArrayLayers: 1 });
        }
        catch (cause) {
            return readbackFailure("copy-texture-to-buffer-unavailable", `WebGPU ${readbackSourceLabel(options.source)} copy failed: ${messageFromCause(cause)}`, false);
        }
        samples.push({ id: sample.id, origin, buffer });
    }
    return {
        ok: true,
        source: options.source,
        format: options.readback.format,
        byteOrder,
        bytesPerRow: readbackBytesPerRow,
        mapModeRead: mapMode.value,
        samples,
    };
}
function resolveBufferUsage() {
    const environment = globalThis;
    const mapRead = environment.GPUBufferUsage?.MAP_READ;
    const copyDst = environment.GPUBufferUsage?.COPY_DST;
    if (typeof mapRead !== "number" || typeof copyDst !== "number") {
        return readbackFailure("buffer-usage-unavailable", "WebGPU buffer usage flags are unavailable; readback requires MAP_READ and COPY_DST.", false);
    }
    return { ok: true, value: mapRead | copyDst };
}
function resolveMapModeRead() {
    const environment = globalThis;
    const read = environment.GPUMapMode?.READ;
    if (typeof read !== "number") {
        return readbackFailure("map-mode-unavailable", "WebGPU map mode flags are unavailable; readback requires GPUMapMode.READ.", false);
    }
    return { ok: true, value: read };
}
function textureByteOrder(format) {
    switch (format) {
        case "rgba8unorm":
        case "rgba8unorm-srgb":
            return "rgba";
        case "bgra8unorm":
        case "bgra8unorm-srgb":
            return "bgra";
        default:
            return null;
    }
}
function readbackSourceLabel(source) {
    return source === "offscreen-target"
        ? "off-screen target"
        : "current texture";
}
function sampleOrigin(sample, width, height) {
    const x = Math.floor(width * sample.x);
    const y = Math.floor(height * sample.y);
    if (!Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width <= 0 ||
        height <= 0 ||
        x < 0 ||
        y < 0 ||
        x >= width ||
        y >= height) {
        return null;
    }
    return { x, y };
}
function decodeTexturePixel(byteOrder, bytes) {
    if (byteOrder === "bgra") {
        return {
            r: bytes[2] ?? 0,
            g: bytes[1] ?? 0,
            b: bytes[0] ?? 0,
            a: bytes[3] ?? 0,
        };
    }
    return {
        r: bytes[0] ?? 0,
        g: bytes[1] ?? 0,
        b: bytes[2] ?? 0,
        a: bytes[3] ?? 0,
    };
}
function mappedRangeBytes(range) {
    if (ArrayBuffer.isView(range)) {
        return new Uint8Array(range.buffer, range.byteOffset, range.byteLength);
    }
    return new Uint8Array(range);
}
function readbackFailure(reason, message, clearOk) {
    return { ok: false, reason, message, clearOk };
}
function messageFromCause(cause) {
    return cause instanceof Error ? cause.message : String(cause);
}
//# sourceMappingURL=frame-boundary.js.map