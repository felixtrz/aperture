import { decodeGltfFloatAccessor, } from "./gltf-accessor-float-reader.js";
import { nodeKey } from "./gltf-scene-traversal-utils.js";
/**
 * Parse `gltf.animations` into engine {@link AnimationClip} assets bound to
 * scene-node entity keys. Extracted from the glb-viewer worker
 * `parseGltfAnimationClips` (examples/glb-viewer.worker.js:5141) but:
 *
 * - decodes sampler input/output through the shared engine accessor reader
 *   ({@link decodeGltfFloatAccessor}) instead of the worker's bespoke reader;
 * - supports all three interpolations including CUBICSPLINE (the worker rejects
 *   it), preserving the 3×-stride [inTangent, value, outTangent] output layout
 *   the M2-T1 sampler expects;
 * - supports `weights` (morph) channels with a dynamic component count; and
 * - resolves `target.node` to a `keyPrefix:node:N` entity key (no live entities
 *   at import time — the mixer/driver binds keys to entities later).
 */
const DEFAULT_KEY_PREFIX = "gltf";
const TRS_COMPONENT_COUNTS = {
    translation: 3,
    rotation: 4,
    scale: 3,
};
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function integerOrNull(value) {
    return Number.isInteger(value) && typeof value === "number" && value >= 0
        ? value
        : null;
}
function asChannelPath(value) {
    return value === "translation" ||
        value === "rotation" ||
        value === "scale" ||
        value === "weights"
        ? value
        : null;
}
function asInterpolation(value) {
    if (value === undefined || value === "LINEAR") {
        return "LINEAR";
    }
    return value === "STEP" || value === "CUBICSPLINE" ? value : null;
}
export function importGltfAnimations(input) {
    const diagnostics = [];
    const clips = [];
    const keyPrefix = input.keyPrefix ?? DEFAULT_KEY_PREFIX;
    const root = input.root;
    let channelCount = 0;
    if (!isRecord(root) || root.animations === undefined) {
        return {
            clips,
            report: {
                valid: true,
                animationCount: 0,
                clipCount: 0,
                channelCount: 0,
                diagnostics,
            },
        };
    }
    if (!Array.isArray(root.animations)) {
        diagnostics.push({
            code: "gltfAnimation.malformedAnimations",
            severity: "error",
            message: "glTF animations must be an array when present.",
        });
        return {
            clips,
            report: {
                valid: false,
                animationCount: 0,
                clipCount: 0,
                channelCount: 0,
                diagnostics,
            },
        };
    }
    const animationCount = root.animations.length;
    root.animations.forEach((rawAnimation, animationIndex) => {
        if (!isRecord(rawAnimation)) {
            diagnostics.push({
                code: "gltfAnimation.malformedAnimation",
                severity: "error",
                animationIndex,
                message: `glTF animation ${animationIndex} must be an object.`,
            });
            return;
        }
        const samplers = Array.isArray(rawAnimation.samplers)
            ? rawAnimation.samplers
            : [];
        const channels = Array.isArray(rawAnimation.channels)
            ? rawAnimation.channels
            : [];
        const parsedChannels = [];
        channels.forEach((rawChannel, channelIndex) => {
            if (!isRecord(rawChannel) || !isRecord(rawChannel.target)) {
                diagnostics.push({
                    code: "gltfAnimation.malformedChannel",
                    severity: "warning",
                    animationIndex,
                    channelIndex,
                    message: `glTF animation ${animationIndex} channel ${channelIndex} is malformed.`,
                });
                return;
            }
            const parsed = parseChannel({
                root,
                resolveBufferBytes: input.resolveBufferBytes,
                keyPrefix,
                samplers,
                rawChannel,
                animationIndex,
                channelIndex,
                diagnostics,
            });
            if (parsed !== null) {
                parsedChannels.push(parsed);
                channelCount += 1;
            }
        });
        if (parsedChannels.length === 0) {
            diagnostics.push({
                code: "gltfAnimation.emptyClip",
                severity: "warning",
                animationIndex,
                message: `glTF animation ${animationIndex} produced no playable channels.`,
            });
            return;
        }
        const name = typeof rawAnimation.name === "string" && rawAnimation.name.length > 0
            ? rawAnimation.name
            : `Animation${animationIndex}`;
        const duration = parsedChannels.reduce((max, channel) => {
            const end = channel.times[channel.times.length - 1] ?? 0;
            return Math.max(max, end);
        }, 0);
        clips.push({
            animationIndex,
            clip: { name, duration, channels: parsedChannels },
        });
    });
    return {
        clips,
        report: {
            valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
            animationCount,
            clipCount: clips.length,
            channelCount,
            diagnostics,
        },
    };
}
function parseChannel(input) {
    const target = input.rawChannel.target;
    const path = asChannelPath(target.path);
    const nodeIndex = integerOrNull(target.node);
    const samplerIndex = integerOrNull(input.rawChannel.sampler);
    if (path === null) {
        input.diagnostics.push({
            code: "gltfAnimation.unsupportedTargetPath",
            severity: "warning",
            animationIndex: input.animationIndex,
            channelIndex: input.channelIndex,
            ...(typeof target.path === "string" ? { path: target.path } : {}),
            message: `glTF animation ${input.animationIndex} channel ${input.channelIndex} targets an unsupported path.`,
        });
        return null;
    }
    if (nodeIndex === null) {
        input.diagnostics.push({
            code: "gltfAnimation.missingTargetNode",
            severity: "warning",
            animationIndex: input.animationIndex,
            channelIndex: input.channelIndex,
            path,
            message: `glTF animation ${input.animationIndex} channel ${input.channelIndex} has no target node.`,
        });
        return null;
    }
    const sampler = samplerIndex === null ? undefined : input.samplers[samplerIndex];
    if (samplerIndex === null || !isRecord(sampler)) {
        input.diagnostics.push({
            code: "gltfAnimation.missingSampler",
            severity: "warning",
            animationIndex: input.animationIndex,
            channelIndex: input.channelIndex,
            path,
            message: `glTF animation ${input.animationIndex} channel ${input.channelIndex} references an invalid sampler.`,
        });
        return null;
    }
    const interpolation = asInterpolation(sampler.interpolation);
    if (interpolation === null) {
        input.diagnostics.push({
            code: "gltfAnimation.unsupportedInterpolation",
            severity: "warning",
            animationIndex: input.animationIndex,
            channelIndex: input.channelIndex,
            path,
            ...(typeof sampler.interpolation === "string"
                ? { interpolation: sampler.interpolation }
                : {}),
            message: `glTF animation ${input.animationIndex} channel ${input.channelIndex} uses an unsupported interpolation.`,
        });
        return null;
    }
    const inputAccessor = integerOrNull(sampler.input);
    const outputAccessor = integerOrNull(sampler.output);
    if (inputAccessor === null || outputAccessor === null) {
        input.diagnostics.push({
            code: "gltfAnimation.missingSampler",
            severity: "warning",
            animationIndex: input.animationIndex,
            channelIndex: input.channelIndex,
            path,
            message: `glTF animation ${input.animationIndex} channel ${input.channelIndex} sampler lacks input/output accessors.`,
        });
        return null;
    }
    const decodedTimes = decodeGltfFloatAccessor({
        root: input.root,
        accessorIndex: inputAccessor,
        resolveBufferBytes: input.resolveBufferBytes,
    });
    if (decodedTimes === null || decodedTimes.componentCount !== 1) {
        input.diagnostics.push({
            code: "gltfAnimation.inputDecodeFailed",
            severity: "error",
            animationIndex: input.animationIndex,
            channelIndex: input.channelIndex,
            path,
            message: `glTF animation ${input.animationIndex} channel ${input.channelIndex} input accessor ${inputAccessor} could not be decoded as a SCALAR time track.`,
        });
        return null;
    }
    const decodedOutput = decodeGltfFloatAccessor({
        root: input.root,
        accessorIndex: outputAccessor,
        resolveBufferBytes: input.resolveBufferBytes,
    });
    if (decodedOutput === null) {
        input.diagnostics.push({
            code: "gltfAnimation.outputDecodeFailed",
            severity: "error",
            animationIndex: input.animationIndex,
            channelIndex: input.channelIndex,
            path,
            message: `glTF animation ${input.animationIndex} channel ${input.channelIndex} output accessor ${outputAccessor} could not be decoded.`,
        });
        return null;
    }
    const keyframeCount = decodedTimes.count;
    const stride = interpolation === "CUBICSPLINE" ? 3 : 1;
    // Component count per value tuple: fixed for TRS, dynamic (morph count) for
    // weights. The total output length must be keyframeCount * componentCount *
    // stride for the M2-T1 sampler's value layout.
    let componentCount;
    if (path === "weights") {
        // weights output is a SCALAR accessor; widen by morph-target count.
        const denom = keyframeCount * stride;
        if (denom <= 0 || decodedOutput.values.length % denom !== 0) {
            input.diagnostics.push({
                code: "gltfAnimation.channelLengthMismatch",
                severity: "error",
                animationIndex: input.animationIndex,
                channelIndex: input.channelIndex,
                path,
                message: `glTF animation ${input.animationIndex} channel ${input.channelIndex} weights output length is not a multiple of keyframeCount*${stride}.`,
            });
            return null;
        }
        componentCount = decodedOutput.values.length / denom;
    }
    else {
        componentCount = TRS_COMPONENT_COUNTS[path];
        if (decodedOutput.componentCount !== componentCount) {
            input.diagnostics.push({
                code: "gltfAnimation.channelLengthMismatch",
                severity: "error",
                animationIndex: input.animationIndex,
                channelIndex: input.channelIndex,
                path,
                message: `glTF animation ${input.animationIndex} channel ${input.channelIndex} output has ${decodedOutput.componentCount} components, expected ${componentCount} for '${path}'.`,
            });
            return null;
        }
    }
    const expectedOutputLength = keyframeCount * componentCount * stride;
    if (keyframeCount < 1 ||
        decodedOutput.values.length !== expectedOutputLength) {
        input.diagnostics.push({
            code: "gltfAnimation.channelLengthMismatch",
            severity: "error",
            animationIndex: input.animationIndex,
            channelIndex: input.channelIndex,
            path,
            message: `glTF animation ${input.animationIndex} channel ${input.channelIndex} has ${keyframeCount} keyframes but ${decodedOutput.values.length} output values (expected ${expectedOutputLength}).`,
        });
        return null;
    }
    return {
        targetId: nodeKey(input.keyPrefix, nodeIndex),
        path,
        interpolation,
        times: decodedTimes.values,
        values: decodedOutput.values,
        componentCount,
    };
}
//# sourceMappingURL=gltf-animation-import.js.map