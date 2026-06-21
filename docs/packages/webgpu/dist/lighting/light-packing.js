import { createWebGpuBuffer, } from "../gpu/buffer.js";
import { WEBGPU_BUFFER_USAGE_FLAGS } from "../resources/meshes/mesh-buffer-descriptors.js";
// Slots 0-23: color/intensity/range-or-cascadeCount/cascade-far-bounds-or-cones/
// matrixBaseIndex-or-shape/cookie/position/direction/area extents.
// Slot 24: authored shadow strength (M4-T4); shadow-casting lights only.
// Slot 25: authored shadow receiver depthBias (M4-T5).
// Slot 26: authored shadow normal-offset bias (M4-T5).
// Slot 27: authored shadow filter radius in texels (M4-T7).
// Slot 28: authored shadow filtering type (0=hard, 1=PCF, 2=PCSS) (M4-T7).
export const PACKED_LIGHT_FLOAT_STRIDE = 29;
export const PACKED_LIGHT_METADATA_STRIDE = 6;
export const PackedLightKindId = {
    Ambient: 0,
    Directional: 1,
    Point: 2,
    Spot: 3,
    Environment: 4,
    RectArea: 5,
};
export const PackedAreaLightShapeId = {
    Rect: 1,
    Disk: 2,
    Sphere: 3,
};
export const DEFAULT_LIGHT_BUFFER_RESOURCE_KEY = "light-buffer:main";
export const DEFAULT_LIGHT_BUFFER_USAGE = WEBGPU_BUFFER_USAGE_FLAGS.STORAGE | WEBGPU_BUFFER_USAGE_FLAGS.COPY_DST;
export function packLightPackets(input) {
    return writePackedLightPackets(input, createLightPacketPackingScratch());
}
export function createLightPacketPackingScratch(lightCapacity = 0) {
    const floats = new Float32Array(lightCapacity * PACKED_LIGHT_FLOAT_STRIDE);
    const metadata = new Int32Array(lightCapacity * PACKED_LIGHT_METADATA_STRIDE);
    const packed = {
        count: 0,
        floatStride: PACKED_LIGHT_FLOAT_STRIDE,
        metadataStride: PACKED_LIGHT_METADATA_STRIDE,
        floats,
        metadata,
    };
    return {
        floats,
        metadata,
        floatView: floats,
        metadataView: metadata,
        packed,
        previousFloats: new Float32Array(0),
        previousMetadata: new Int32Array(0),
        lastFloatCount: -1,
        lastMetadataCount: -1,
    };
}
export function writePackedLightPackets(input, scratch) {
    const lights = isLightPacketArray(input) ? input : input.lights;
    const transforms = isLightPacketArray(input) ? null : input.transforms;
    const directionalShadows = isLightPacketArray(input)
        ? null
        : directionalShadowMetadata(input.shadowRequests ?? []);
    const shadowParams = isLightPacketArray(input)
        ? null
        : shadowParamsByLight(input.shadowRequests ?? []);
    ensureLightPacketCapacity(scratch, lights.length);
    for (let index = 0; index < lights.length; index += 1) {
        const light = lights[index];
        if (light === undefined) {
            continue;
        }
        const floatOffset = index * PACKED_LIGHT_FLOAT_STRIDE;
        const metadataOffset = index * PACKED_LIGHT_METADATA_STRIDE;
        const directionalShadow = light.kind === "directional"
            ? (directionalShadows?.get(light.lightId) ?? null)
            : null;
        const directionalFarBounds = directionalShadow === null
            ? null
            : directionalCascadeFarBounds(directionalShadow.cascadeCount, light.range);
        const transformData = packedLightTransformData(light, transforms);
        scratch.floats.set([
            light.color[0] ?? 0,
            light.color[1] ?? 0,
            light.color[2] ?? 0,
            light.color[3] ?? 1,
            light.intensity,
            directionalShadow?.cascadeCount ?? light.range,
            directionalFarBounds?.[0] ?? light.innerConeAngle,
            directionalFarBounds?.[1] ?? light.outerConeAngle,
            directionalFarBounds?.[2] ?? light.width ?? 0,
            directionalFarBounds?.[3] ?? light.height ?? 0,
            directionalShadow?.matrixBaseIndex ??
                packedAreaLightShapeId(light.shape),
            light.cookieTexture === undefined || light.cookieTexture === null
                ? 0
                : Math.max(light.cookieIntensity ?? 1, 0),
            transformData.position[0],
            transformData.position[1],
            transformData.position[2],
            transformData.direction[0],
            transformData.direction[1],
            transformData.direction[2],
            transformData.areaHalfWidth[0],
            transformData.areaHalfWidth[1],
            transformData.areaHalfWidth[2],
            transformData.areaHalfHeight[0],
            transformData.areaHalfHeight[1],
            transformData.areaHalfHeight[2],
            shadowParams?.get(light.lightId)?.strength ?? 1,
            shadowParams?.get(light.lightId)?.depthBias ?? 0,
            shadowParams?.get(light.lightId)?.normalBias ?? 0,
            shadowParams?.get(light.lightId)?.filterRadius ?? 1,
            shadowParams?.get(light.lightId)?.shadowType ?? 1,
        ], floatOffset);
        scratch.metadata.set([
            packedLightKindId(light.kind),
            light.worldTransformOffset,
            light.layerMask,
            light.lightId,
            light.entity.index,
            light.entity.generation,
        ], metadataOffset);
    }
    scratch.packed.count = lights.length;
    scratch.packed.floats = lightFloatView(scratch, lights.length);
    scratch.packed.metadata = lightMetadataView(scratch, lights.length);
    return scratch.packed;
}
function packedLightTransformData(light, transforms) {
    if (transforms === null ||
        !Number.isInteger(light.worldTransformOffset) ||
        light.worldTransformOffset < 0 ||
        light.worldTransformOffset + 15 >= transforms.length) {
        return fallbackLightTransformData(light);
    }
    const offset = light.worldTransformOffset;
    const width = light.width ?? 1;
    const height = light.height ?? 1;
    const position = [
        transforms[offset + 12] ?? 0,
        transforms[offset + 13] ?? 0,
        transforms[offset + 14] ?? 0,
    ];
    const direction = normalizeVec3([
        -(transforms[offset + 8] ?? 0),
        -(transforms[offset + 9] ?? 0),
        -(transforms[offset + 10] ?? 1),
    ], [0, 0, -1]);
    const areaHalfWidth = scaleVec3(normalizeVec3([
        transforms[offset] ?? 1,
        transforms[offset + 1] ?? 0,
        transforms[offset + 2] ?? 0,
    ], [1, 0, 0]), width * 0.5);
    const areaHalfHeight = scaleVec3(normalizeVec3([
        transforms[offset + 4] ?? 0,
        transforms[offset + 5] ?? 1,
        transforms[offset + 6] ?? 0,
    ], [0, 1, 0]), height * 0.5);
    return { position, direction, areaHalfWidth, areaHalfHeight };
}
function fallbackLightTransformData(light) {
    const halfWidth = (light.width ?? 1) * 0.5;
    const halfHeight = (light.height ?? 1) * 0.5;
    return {
        position: [0, 0, 0],
        direction: [0, 0, -1],
        areaHalfWidth: [halfWidth, 0, 0],
        areaHalfHeight: [0, halfHeight, 0],
    };
}
function normalizeVec3(value, fallback) {
    const length = Math.hypot(value[0], value[1], value[2]);
    if (length <= 0.0001) {
        return fallback;
    }
    return [
        cleanSignedZero(value[0] / length),
        cleanSignedZero(value[1] / length),
        cleanSignedZero(value[2] / length),
    ];
}
function scaleVec3(value, scale) {
    return [
        cleanSignedZero(value[0] * scale),
        cleanSignedZero(value[1] * scale),
        cleanSignedZero(value[2] * scale),
    ];
}
function cleanSignedZero(value) {
    return Object.is(value, -0) ? 0 : value;
}
export function createLightBufferDescriptor(input, options = {}) {
    return writeLightBufferDescriptor(input, createLightBufferDescriptorScratch(), options);
}
export function createLightBufferDescriptorScratch(lightCapacity = 0) {
    const packing = createLightPacketPackingScratch(lightCapacity);
    const descriptor = {
        resourceKey: DEFAULT_LIGHT_BUFFER_RESOURCE_KEY,
        usageIntent: "read-only-storage",
        count: 0,
        byteLength: 0,
        floatByteLength: 0,
        metadataByteLength: 0,
        packed: packing.packed,
    };
    return { packing, descriptor };
}
export function writeLightBufferDescriptor(input, scratch, options = {}) {
    const throughScratch = !isPackedLightPackets(input);
    const packed = isPackedLightPackets(input)
        ? input
        : writePackedLightPackets(input, scratch.packing);
    const floatByteLength = packed.floats.byteLength;
    const metadataByteLength = packed.metadata.byteLength;
    scratch.descriptor.resourceKey =
        options.resourceKey ?? DEFAULT_LIGHT_BUFFER_RESOURCE_KEY;
    scratch.descriptor.count = packed.count;
    scratch.descriptor.byteLength = floatByteLength + metadataByteLength;
    scratch.descriptor.floatByteLength = floatByteLength;
    scratch.descriptor.metadataByteLength = metadataByteLength;
    scratch.descriptor.packed = packed;
    if (throughScratch) {
        const packing = scratch.packing;
        scratch.descriptor.floatsDirty = diffPackedElements(packing.previousFloats, packed.floats, packing.lastFloatCount);
        scratch.descriptor.metadataDirty = diffPackedElements(packing.previousMetadata, packed.metadata, packing.lastMetadataCount);
        if (packing.previousFloats.length < packed.floats.length) {
            packing.previousFloats = new Float32Array(packed.floats.length);
        }
        if (packing.previousMetadata.length < packed.metadata.length) {
            packing.previousMetadata = new Int32Array(packed.metadata.length);
        }
        packing.previousFloats.set(packed.floats);
        packing.previousMetadata.set(packed.metadata);
        packing.lastFloatCount = packed.floats.length;
        packing.lastMetadataCount = packed.metadata.length;
    }
    else {
        // Pre-packed inputs carry no scratch history — consumers full-write.
        scratch.descriptor.floatsDirty = undefined;
        scratch.descriptor.metadataDirty = undefined;
    }
    return scratch.descriptor;
}
/**
 * AI-65: contiguous changed window of a packed light array vs its previous
 * frame copy. Null = byte-identical; full when the element count changed or
 * no history exists yet.
 */
function diffPackedElements(previous, next, lastCount) {
    const count = next.length;
    if (lastCount !== count || previous.length < count) {
        return count === 0
            ? null
            : { floatOffset: 0, floatCount: count, full: true };
    }
    let first = -1;
    for (let index = 0; index < count; index += 1) {
        if (previous[index] !== next[index]) {
            first = index;
            break;
        }
    }
    if (first === -1) {
        return null;
    }
    let last = first;
    for (let index = count - 1; index > first; index -= 1) {
        if (previous[index] !== next[index]) {
            last = index;
            break;
        }
    }
    return { floatOffset: first, floatCount: last - first + 1, full: false };
}
export function createLightBufferDescriptorPlan(descriptor, options = {}) {
    return writeLightBufferDescriptorPlan(descriptor, createLightBufferDescriptorPlanScratch(), options);
}
export function createLightBufferDescriptorPlanScratch() {
    const floatDescriptor = {
        size: 0,
        usage: DEFAULT_LIGHT_BUFFER_USAGE,
    };
    const metadataDescriptor = {
        size: 0,
        usage: DEFAULT_LIGHT_BUFFER_USAGE,
    };
    const plan = {
        resourceKey: DEFAULT_LIGHT_BUFFER_RESOURCE_KEY,
        source: createLightPacketPackingScratch().packed,
        floatDescriptor,
        metadataDescriptor,
    };
    const diagnostics = [];
    return {
        floatDescriptor,
        metadataDescriptor,
        plan,
        diagnostics,
        result: { valid: false, plan: null, diagnostics },
    };
}
export function writeLightBufferDescriptorPlan(descriptor, scratch, options = {}) {
    const diagnostics = scratch.diagnostics;
    diagnostics.length = 0;
    const usage = options.usage ?? DEFAULT_LIGHT_BUFFER_USAGE;
    if (!Number.isInteger(usage) || usage <= 0) {
        diagnostics.push({
            code: "lightBufferDescriptor.invalidUsageFlags",
            field: "usage",
            message: "Light buffer usage flags must be a positive integer.",
        });
    }
    if (descriptor.count === 0 || descriptor.byteLength === 0) {
        scratch.result.valid = diagnostics.length === 0;
        scratch.result.plan = null;
        return scratch.result;
    }
    if (diagnostics.length > 0) {
        scratch.result.valid = false;
        scratch.result.plan = null;
        return scratch.result;
    }
    const label = options.label ?? descriptor.resourceKey;
    scratch.floatDescriptor.label = `${label}/floats`;
    scratch.floatDescriptor.size = descriptor.floatByteLength;
    scratch.floatDescriptor.usage = usage;
    scratch.floatDescriptor.initialData = descriptor.packed.floats;
    scratch.metadataDescriptor.label = `${label}/metadata`;
    scratch.metadataDescriptor.size = descriptor.metadataByteLength;
    scratch.metadataDescriptor.usage = usage;
    scratch.metadataDescriptor.initialData = descriptor.packed.metadata;
    scratch.plan.resourceKey = descriptor.resourceKey;
    scratch.plan.source = descriptor.packed;
    scratch.result.valid = true;
    scratch.result.plan = scratch.plan;
    return scratch.result;
}
export function createLightGpuBuffers(options) {
    if (options.plan === null) {
        return {
            valid: false,
            resource: null,
            diagnostics: [
                {
                    code: "lightGpuBuffer.nullDescriptorPlan",
                    message: "Cannot create light GPU buffers from a null descriptor plan.",
                },
            ],
        };
    }
    const floatResourceKey = `${options.plan.resourceKey}/floats`;
    const metadataResourceKey = `${options.plan.resourceKey}/metadata`;
    const floatResult = createWebGpuBuffer({
        device: options.device,
        descriptor: options.plan.floatDescriptor,
    });
    const metadataResult = createWebGpuBuffer({
        device: options.device,
        descriptor: options.plan.metadataDescriptor,
    });
    const diagnostics = [];
    if (!floatResult.ok) {
        diagnostics.push({
            code: "lightGpuBuffer.creationFailed",
            reason: floatResult.reason,
            resourceKey: floatResourceKey,
            message: `Failed to create light float buffer '${floatResourceKey}': ${floatResult.message}`,
        });
    }
    if (!metadataResult.ok) {
        diagnostics.push({
            code: "lightGpuBuffer.creationFailed",
            reason: metadataResult.reason,
            resourceKey: metadataResourceKey,
            message: `Failed to create light metadata buffer '${metadataResourceKey}': ${metadataResult.message}`,
        });
    }
    if (!floatResult.ok || !metadataResult.ok) {
        return { valid: false, resource: null, diagnostics };
    }
    return {
        valid: true,
        resource: {
            resourceKey: options.plan.resourceKey,
            floatResourceKey,
            metadataResourceKey,
            floatBuffer: floatResult.buffer,
            metadataBuffer: metadataResult.buffer,
            count: options.plan.source.count,
        },
        diagnostics,
    };
}
export function createLightGpuBuffersResultToJsonValue(result) {
    return {
        valid: result.valid,
        resource: result.resource === null
            ? null
            : {
                resourceKey: result.resource.resourceKey,
                floatResourceKey: result.resource.floatResourceKey,
                metadataResourceKey: result.resource.metadataResourceKey,
                count: result.resource.count,
            },
        counts: {
            lights: result.resource?.count ?? 0,
            gpuBuffers: result.resource === null ? 0 : 2,
            diagnostics: result.diagnostics.length,
        },
        diagnostics: result.diagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            message: diagnostic.message,
            ...(diagnostic.reason === undefined ? {} : { reason: diagnostic.reason }),
            ...(diagnostic.resourceKey === undefined
                ? {}
                : { resourceKey: diagnostic.resourceKey }),
        })),
    };
}
export function createLightGpuBuffersResultToJson(result) {
    return JSON.stringify(createLightGpuBuffersResultToJsonValue(result));
}
function isLightPacketArray(input) {
    return Array.isArray(input);
}
function isPackedLightPackets(input) {
    return (typeof input === "object" &&
        input !== null &&
        "floats" in input &&
        "metadata" in input &&
        "floatStride" in input &&
        "metadataStride" in input);
}
/**
 * Per-light shadow params keyed by lightId, for ALL shadow-casting kinds
 * (directional/point/spot) — not just directional. Sourced from the authored
 * ShadowRequestPacket (M4-T3) so the shader can read per-light strength
 * (M4-T4) without a new binding.
 */
function shadowParamsByLight(shadowRequests) {
    const params = new Map();
    for (const request of shadowRequests) {
        params.set(request.lightId, {
            strength: clampUnit(request.strength ?? 1),
            depthBias: Math.max(0, request.depthBias ?? 0),
            normalBias: Math.max(0, request.normalBias ?? 0),
            filterRadius: Math.max(0, request.filterRadius ?? 1),
            shadowType: Math.min(2, Math.max(0, Math.round(request.shadowType ?? 1))),
        });
    }
    return params;
}
function clampUnit(value) {
    if (!Number.isFinite(value)) {
        return 1;
    }
    return Math.min(1, Math.max(0, value));
}
function directionalShadowMetadata(shadowRequests) {
    const metadata = new Map();
    let matrixBaseIndex = 0;
    for (const request of shadowRequests) {
        if (request.lightKind !== undefined &&
            request.lightKind !== "directional") {
            continue;
        }
        const cascadeCount = clampDirectionalCascadeCount(request.cascadeCount ?? 1);
        metadata.set(request.lightId, {
            cascadeCount,
            matrixBaseIndex,
        });
        matrixBaseIndex += cascadeCount;
    }
    return metadata;
}
function directionalCascadeFarBounds(cascadeCount, shadowDistance) {
    const count = clampDirectionalCascadeCount(cascadeCount);
    const maximumDistance = Math.max(1, shadowDistance);
    const minimumDistance = Math.min(0.1, maximumDistance * 0.5);
    const bounds = [
        maximumDistance,
        maximumDistance,
        maximumDistance,
        maximumDistance,
    ];
    for (let index = 0; index < count; index += 1) {
        const fraction = (index + 1) / count;
        const linear = minimumDistance + (maximumDistance - minimumDistance) * fraction;
        const logarithmic = minimumDistance * Math.pow(maximumDistance / minimumDistance, fraction);
        bounds[index] =
            index + 1 === count ? maximumDistance : (linear + logarithmic) * 0.5;
    }
    return bounds;
}
function clampDirectionalCascadeCount(value) {
    if (!Number.isInteger(value)) {
        return 1;
    }
    return Math.min(4, Math.max(1, value));
}
function ensureLightPacketCapacity(scratch, lightCount) {
    const floatCount = lightCount * PACKED_LIGHT_FLOAT_STRIDE;
    const metadataCount = lightCount * PACKED_LIGHT_METADATA_STRIDE;
    if (scratch.floats.length < floatCount) {
        let capacity = Math.max(PACKED_LIGHT_FLOAT_STRIDE, scratch.floats.length);
        while (capacity < floatCount) {
            capacity *= 2;
        }
        scratch.floats = new Float32Array(capacity);
    }
    if (scratch.metadata.length < metadataCount) {
        let capacity = Math.max(PACKED_LIGHT_METADATA_STRIDE, scratch.metadata.length);
        while (capacity < metadataCount) {
            capacity *= 2;
        }
        scratch.metadata = new Int32Array(capacity);
    }
}
function lightFloatView(scratch, lightCount) {
    const floatCount = lightCount * PACKED_LIGHT_FLOAT_STRIDE;
    if (floatCount === scratch.floats.length) {
        scratch.floatView = scratch.floats;
        return scratch.floats;
    }
    if (scratch.floatView.buffer !== scratch.floats.buffer ||
        scratch.floatView.byteOffset !== scratch.floats.byteOffset ||
        scratch.floatView.length !== floatCount) {
        scratch.floatView = scratch.floats.subarray(0, floatCount);
    }
    return scratch.floatView;
}
function lightMetadataView(scratch, lightCount) {
    const metadataCount = lightCount * PACKED_LIGHT_METADATA_STRIDE;
    if (metadataCount === scratch.metadata.length) {
        scratch.metadataView = scratch.metadata;
        return scratch.metadata;
    }
    if (scratch.metadataView.buffer !== scratch.metadata.buffer ||
        scratch.metadataView.byteOffset !== scratch.metadata.byteOffset ||
        scratch.metadataView.length !== metadataCount) {
        scratch.metadataView = scratch.metadata.subarray(0, metadataCount);
    }
    return scratch.metadataView;
}
export function packedLightKindId(kind) {
    switch (kind) {
        case "ambient":
            return PackedLightKindId.Ambient;
        case "directional":
            return PackedLightKindId.Directional;
        case "point":
            return PackedLightKindId.Point;
        case "spot":
            return PackedLightKindId.Spot;
        case "environment":
            return PackedLightKindId.Environment;
        case "rect-area":
            return PackedLightKindId.RectArea;
    }
}
export function packedAreaLightShapeId(shape) {
    switch (shape) {
        case "disk":
            return PackedAreaLightShapeId.Disk;
        case "sphere":
            return PackedAreaLightShapeId.Sphere;
        case "rect":
        case undefined:
            return PackedAreaLightShapeId.Rect;
    }
}
//# sourceMappingURL=light-packing.js.map