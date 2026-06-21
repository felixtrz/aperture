const TRANSFORM_FLOATS_PER_ENTITY = 16;
const INSTANCE_TINT_FLOATS_PER_ENTITY = 4;
const VIEW_MATRIX_FLOATS_PER_VIEW = 48;
const QUAD_INSTANCE_FLOATS_PER_INSTANCE = 24;
const QUAD_INSTANCE_WORDS_PER_INSTANCE = 8;
const BUFFER_COUNT = 2;
var HeaderIndex;
(function (HeaderIndex) {
    HeaderIndex[HeaderIndex["Sequence"] = 0] = "Sequence";
    HeaderIndex[HeaderIndex["Frame"] = 1] = "Frame";
    HeaderIndex[HeaderIndex["ActiveBuffer"] = 2] = "ActiveBuffer";
    HeaderIndex[HeaderIndex["TransformFloats"] = 3] = "TransformFloats";
    HeaderIndex[HeaderIndex["ViewMatrixFloats"] = 4] = "ViewMatrixFloats";
    HeaderIndex[HeaderIndex["InstanceTintFloats"] = 5] = "InstanceTintFloats";
    HeaderIndex[HeaderIndex["PacketWords"] = 6] = "PacketWords";
    HeaderIndex[HeaderIndex["QuadInstanceFloats"] = 7] = "QuadInstanceFloats";
    HeaderIndex[HeaderIndex["QuadInstanceWords"] = 8] = "QuadInstanceWords";
    HeaderIndex[HeaderIndex["TimeLo"] = 9] = "TimeLo";
    HeaderIndex[HeaderIndex["TimeHi"] = 10] = "TimeHi";
})(HeaderIndex || (HeaderIndex = {}));
const HEADER_INT32_COUNT = 11;
const FLOAT64_SCRATCH_BYTES = 8;
const FLOAT64_HEADER_SCRATCH_BUFFER = new ArrayBuffer(FLOAT64_SCRATCH_BYTES);
const FLOAT64_HEADER_SCRATCH_FLOATS = new Float64Array(FLOAT64_HEADER_SCRATCH_BUFFER);
const FLOAT64_HEADER_SCRATCH_WORDS = new Int32Array(FLOAT64_HEADER_SCRATCH_BUFFER);
export class SharedSnapshotTransportUnsupportedError extends Error {
    code = "shared-snapshot-transport-unsupported";
    reason;
    constructor(reason, message) {
        super(message);
        this.name = "SharedSnapshotTransportUnsupportedError";
        this.reason = reason;
    }
}
export function createSharedSnapshotTransport(options) {
    validatePositiveInteger(options.maxEntities, "maxEntities");
    validatePositiveInteger(options.maxViews, "maxViews");
    const SharedArrayBufferCtor = options.sharedArrayBufferConstructor === undefined
        ? globalThis.SharedArrayBuffer
        : options.sharedArrayBufferConstructor;
    if (SharedArrayBufferCtor === undefined || SharedArrayBufferCtor === null) {
        throw new SharedSnapshotTransportUnsupportedError("shared-array-buffer-unavailable", "SharedArrayBuffer snapshot transport is unavailable in this environment.");
    }
    const requiresIsolation = options.requireCrossOriginIsolated ??
        typeof globalThis.crossOriginIsolated === "boolean";
    const crossOriginIsolated = options.crossOriginIsolated ?? globalThis.crossOriginIsolated;
    if (requiresIsolation && crossOriginIsolated !== true) {
        throw new SharedSnapshotTransportUnsupportedError("cross-origin-isolation-required", "SharedArrayBuffer snapshot transport requires a cross-origin isolated page.");
    }
    const layout = createLayout({
        maxEntities: options.maxEntities,
        maxViews: options.maxViews,
        maxInstanceTints: options.maxInstanceTints ?? options.maxEntities,
        maxQuadInstances: options.maxQuadInstances ?? 0,
        maxPacketWords: options.maxPacketWords ?? 0,
    });
    const headerBuffer = new SharedArrayBufferCtor(HEADER_INT32_COUNT * Int32Array.BYTES_PER_ELEMENT);
    const transformBuffer = new SharedArrayBufferCtor(layout.transformFloatsPerBuffer *
        BUFFER_COUNT *
        Float32Array.BYTES_PER_ELEMENT);
    const instanceTintBuffer = new SharedArrayBufferCtor(layout.instanceTintFloatsPerBuffer *
        BUFFER_COUNT *
        Float32Array.BYTES_PER_ELEMENT);
    const viewMatrixBuffer = new SharedArrayBufferCtor(layout.viewMatrixFloatsPerBuffer *
        BUFFER_COUNT *
        Float32Array.BYTES_PER_ELEMENT);
    const quadInstanceFloatBuffer = new SharedArrayBufferCtor(layout.quadInstanceFloatsPerBuffer *
        BUFFER_COUNT *
        Float32Array.BYTES_PER_ELEMENT);
    const quadInstanceWordBuffer = new SharedArrayBufferCtor(layout.quadInstanceWordsPerBuffer *
        BUFFER_COUNT *
        Uint32Array.BYTES_PER_ELEMENT);
    const packetBuffer = new SharedArrayBufferCtor(layout.packetWordsPerBuffer * BUFFER_COUNT * Uint32Array.BYTES_PER_ELEMENT);
    const header = new Int32Array(headerBuffer);
    const transforms = new Float32Array(transformBuffer);
    const instanceTints = new Float32Array(instanceTintBuffer);
    const viewMatrices = new Float32Array(viewMatrixBuffer);
    const quadInstanceFloats = new Float32Array(quadInstanceFloatBuffer);
    const quadInstanceWords = new Uint32Array(quadInstanceWordBuffer);
    const packetWords = new Uint32Array(packetBuffer);
    return {
        mode: "shared-array-buffer",
        layout,
        headerBuffer,
        transformBuffer,
        instanceTintBuffer,
        viewMatrixBuffer,
        quadInstanceFloatBuffer,
        quadInstanceWordBuffer,
        packetBuffer,
        writer: createWriter(layout, header, transforms, instanceTints, viewMatrices, quadInstanceFloats, quadInstanceWords, packetWords),
        reader: createReader(layout, header, transforms, instanceTints, viewMatrices, quadInstanceFloats, quadInstanceWords, packetWords),
    };
}
export function createSharedSnapshotTransportViews(input) {
    const header = new Int32Array(input.headerBuffer);
    const transforms = new Float32Array(input.transformBuffer);
    const instanceTints = new Float32Array(input.instanceTintBuffer);
    const viewMatrices = new Float32Array(input.viewMatrixBuffer);
    const quadInstanceFloats = new Float32Array(input.quadInstanceFloatBuffer);
    const quadInstanceWords = new Uint32Array(input.quadInstanceWordBuffer);
    const packetWords = new Uint32Array(input.packetBuffer);
    return {
        mode: "shared-array-buffer",
        layout: input.layout,
        headerBuffer: input.headerBuffer,
        transformBuffer: input.transformBuffer,
        instanceTintBuffer: input.instanceTintBuffer,
        viewMatrixBuffer: input.viewMatrixBuffer,
        quadInstanceFloatBuffer: input.quadInstanceFloatBuffer,
        quadInstanceWordBuffer: input.quadInstanceWordBuffer,
        packetBuffer: input.packetBuffer,
        writer: createWriter(input.layout, header, transforms, instanceTints, viewMatrices, quadInstanceFloats, quadInstanceWords, packetWords),
        reader: createReader(input.layout, header, transforms, instanceTints, viewMatrices, quadInstanceFloats, quadInstanceWords, packetWords),
    };
}
function createLayout(options) {
    validateNonNegativeInteger(options.maxInstanceTints, "maxInstanceTints");
    validateNonNegativeInteger(options.maxQuadInstances, "maxQuadInstances");
    validateNonNegativeInteger(options.maxPacketWords, "maxPacketWords");
    return {
        buffers: BUFFER_COUNT,
        headerInt32Count: HEADER_INT32_COUNT,
        transformFloatsPerEntity: TRANSFORM_FLOATS_PER_ENTITY,
        instanceTintFloatsPerTint: INSTANCE_TINT_FLOATS_PER_ENTITY,
        viewMatrixFloatsPerView: VIEW_MATRIX_FLOATS_PER_VIEW,
        quadInstanceFloatsPerInstance: QUAD_INSTANCE_FLOATS_PER_INSTANCE,
        quadInstanceWordsPerInstance: QUAD_INSTANCE_WORDS_PER_INSTANCE,
        maxEntities: options.maxEntities,
        maxViews: options.maxViews,
        maxInstanceTints: options.maxInstanceTints,
        maxQuadInstances: options.maxQuadInstances,
        transformFloatsPerBuffer: options.maxEntities * TRANSFORM_FLOATS_PER_ENTITY,
        instanceTintFloatsPerBuffer: options.maxInstanceTints * INSTANCE_TINT_FLOATS_PER_ENTITY,
        viewMatrixFloatsPerBuffer: options.maxViews * VIEW_MATRIX_FLOATS_PER_VIEW,
        quadInstanceFloatsPerBuffer: options.maxQuadInstances * QUAD_INSTANCE_FLOATS_PER_INSTANCE,
        quadInstanceWordsPerBuffer: options.maxQuadInstances * QUAD_INSTANCE_WORDS_PER_INSTANCE,
        packetWordsPerBuffer: options.maxPacketWords,
    };
}
function createWriter(layout, header, transforms, instanceTints, viewMatrices, quadInstanceFloats, quadInstanceWords, packetWords) {
    return {
        header,
        transforms,
        instanceTints,
        viewMatrices,
        quadInstanceFloats,
        quadInstanceWords,
        packetWords,
        writeFrame(frame) {
            validateFrameInput(layout, frame);
            const activeBuffer = Atomics.load(header, HeaderIndex.ActiveBuffer);
            const nextBuffer = activeBuffer === 0 ? 1 : 0;
            const sequence = Atomics.load(header, HeaderIndex.Sequence);
            const writeSequence = sequence % 2 === 0 ? sequence + 1 : sequence + 2;
            writeSharedFrameBuffers(layout, transforms, instanceTints, viewMatrices, quadInstanceFloats, quadInstanceWords, packetWords, nextBuffer, frame);
            Atomics.store(header, HeaderIndex.Sequence, writeSequence);
            Atomics.store(header, HeaderIndex.Frame, frame.frame);
            writeHeaderFloat64(header, HeaderIndex.TimeLo, snapshotFrameTime(frame));
            Atomics.store(header, HeaderIndex.ActiveBuffer, nextBuffer);
            Atomics.store(header, HeaderIndex.TransformFloats, frame.transforms.length);
            Atomics.store(header, HeaderIndex.ViewMatrixFloats, frame.viewMatrices.length);
            Atomics.store(header, HeaderIndex.InstanceTintFloats, frame.instanceTints?.length ?? 0);
            Atomics.store(header, HeaderIndex.PacketWords, frame.packetWords?.length ?? 0);
            Atomics.store(header, HeaderIndex.QuadInstanceFloats, frame.quadInstanceFloats?.length ?? 0);
            Atomics.store(header, HeaderIndex.QuadInstanceWords, frame.quadInstanceWords?.length ?? 0);
            const completeSequence = writeSequence + 1;
            Atomics.store(header, HeaderIndex.Sequence, completeSequence);
            Atomics.notify(header, HeaderIndex.Sequence);
            return {
                frame: frame.frame,
                time: snapshotFrameTime(frame),
                sequence: completeSequence,
                bufferIndex: nextBuffer,
                transformFloats: frame.transforms.length,
                instanceTintFloats: frame.instanceTints?.length ?? 0,
                viewMatrixFloats: frame.viewMatrices.length,
                quadInstanceFloats: frame.quadInstanceFloats?.length ?? 0,
                quadInstanceWords: frame.quadInstanceWords?.length ?? 0,
                packetWords: frame.packetWords?.length ?? 0,
            };
        },
    };
}
function createReader(layout, header, transforms, instanceTints, viewMatrices, quadInstanceFloats, quadInstanceWords, packetWords) {
    return {
        header,
        transforms,
        instanceTints,
        viewMatrices,
        quadInstanceFloats,
        quadInstanceWords,
        packetWords,
        readLatestFrame() {
            for (let attempt = 0; attempt < 3; attempt += 1) {
                const sequenceBefore = Atomics.load(header, HeaderIndex.Sequence);
                if (sequenceBefore % 2 !== 0 || sequenceBefore === 0) {
                    return null;
                }
                const bufferIndex = Atomics.load(header, HeaderIndex.ActiveBuffer);
                const frame = Atomics.load(header, HeaderIndex.Frame);
                const time = readHeaderFloat64(header, HeaderIndex.TimeLo);
                const transformFloats = Atomics.load(header, HeaderIndex.TransformFloats);
                const viewMatrixFloats = Atomics.load(header, HeaderIndex.ViewMatrixFloats);
                const instanceTintFloats = Atomics.load(header, HeaderIndex.InstanceTintFloats);
                const packetWordCount = Atomics.load(header, HeaderIndex.PacketWords);
                const quadInstanceFloatCount = Atomics.load(header, HeaderIndex.QuadInstanceFloats);
                const quadInstanceWordCount = Atomics.load(header, HeaderIndex.QuadInstanceWords);
                const transformOffset = bufferIndex * layout.transformFloatsPerBuffer;
                const instanceTintOffset = bufferIndex * layout.instanceTintFloatsPerBuffer;
                const viewMatrixOffset = bufferIndex * layout.viewMatrixFloatsPerBuffer;
                const quadInstanceFloatOffset = bufferIndex * layout.quadInstanceFloatsPerBuffer;
                const quadInstanceWordOffset = bufferIndex * layout.quadInstanceWordsPerBuffer;
                const packetOffset = bufferIndex * layout.packetWordsPerBuffer;
                // Copy the payload out of the shared ring *before* re-validating the
                // sequence. The returned arrays are owned copies (via slice), not live
                // SAB views, so the consumer can safely retain them across an async GPU
                // upload and across frames while the writer recycles the underlying
                // buffers. The post-copy seqlock check guarantees the writer did not
                // overwrite this buffer mid-copy; otherwise we retry with a fresh read.
                // (Returning subarray views here tore under any writer/reader rate
                // mismatch because the seqlock only covered the header read.)
                const outTransforms = transforms.slice(transformOffset, transformOffset + transformFloats);
                const outInstanceTints = instanceTints.slice(instanceTintOffset, instanceTintOffset + instanceTintFloats);
                const outViewMatrices = viewMatrices.slice(viewMatrixOffset, viewMatrixOffset + viewMatrixFloats);
                const outQuadInstanceFloats = quadInstanceFloats.slice(quadInstanceFloatOffset, quadInstanceFloatOffset + quadInstanceFloatCount);
                const outQuadInstanceWords = quadInstanceWords.slice(quadInstanceWordOffset, quadInstanceWordOffset + quadInstanceWordCount);
                const outPacketWords = packetWords.slice(packetOffset, packetOffset + packetWordCount);
                const sequenceAfter = Atomics.load(header, HeaderIndex.Sequence);
                if (sequenceBefore !== sequenceAfter || sequenceAfter % 2 !== 0) {
                    continue;
                }
                return {
                    frame,
                    time,
                    sequence: sequenceAfter,
                    bufferIndex,
                    transforms: outTransforms,
                    instanceTints: outInstanceTints,
                    viewMatrices: outViewMatrices,
                    quadInstanceFloats: outQuadInstanceFloats,
                    quadInstanceWords: outQuadInstanceWords,
                    packetWords: outPacketWords,
                };
            }
            return null;
        },
    };
}
function writeSharedFrameBuffers(layout, transforms, instanceTints, viewMatrices, quadInstanceFloats, quadInstanceWords, packetWords, bufferIndex, frame) {
    const transformOffset = bufferIndex * layout.transformFloatsPerBuffer;
    const instanceTintOffset = bufferIndex * layout.instanceTintFloatsPerBuffer;
    const viewMatrixOffset = bufferIndex * layout.viewMatrixFloatsPerBuffer;
    const quadInstanceFloatOffset = bufferIndex * layout.quadInstanceFloatsPerBuffer;
    const quadInstanceWordOffset = bufferIndex * layout.quadInstanceWordsPerBuffer;
    const packetOffset = bufferIndex * layout.packetWordsPerBuffer;
    for (let index = 0; index < frame.transforms.length; index += 1) {
        transforms[transformOffset + index] = frame.transforms[index] ?? 0;
    }
    const frameInstanceTints = frame.instanceTints;
    if (frameInstanceTints !== undefined) {
        for (let index = 0; index < frameInstanceTints.length; index += 1) {
            instanceTints[instanceTintOffset + index] =
                frameInstanceTints[index] ?? 0;
        }
    }
    for (let index = 0; index < frame.viewMatrices.length; index += 1) {
        viewMatrices[viewMatrixOffset + index] = frame.viewMatrices[index] ?? 0;
    }
    const frameQuadInstanceFloats = frame.quadInstanceFloats;
    if (frameQuadInstanceFloats !== undefined) {
        for (let index = 0; index < frameQuadInstanceFloats.length; index += 1) {
            quadInstanceFloats[quadInstanceFloatOffset + index] =
                frameQuadInstanceFloats[index] ?? 0;
        }
    }
    const frameQuadInstanceWords = frame.quadInstanceWords;
    if (frameQuadInstanceWords !== undefined) {
        for (let index = 0; index < frameQuadInstanceWords.length; index += 1) {
            quadInstanceWords[quadInstanceWordOffset + index] =
                frameQuadInstanceWords[index] ?? 0;
        }
    }
    const framePacketWords = frame.packetWords;
    if (framePacketWords !== undefined) {
        for (let index = 0; index < framePacketWords.length; index += 1) {
            packetWords[packetOffset + index] = framePacketWords[index] ?? 0;
        }
    }
}
function validateFrameInput(layout, frame) {
    validateNonNegativeInteger(frame.frame, "frame");
    if (frame.time !== undefined &&
        (!Number.isFinite(frame.time) || frame.time < 0)) {
        throw new RangeError("Shared snapshot transport time must be finite >= 0.");
    }
    if (frame.transforms.length > layout.transformFloatsPerBuffer) {
        throw new RangeError(`Shared snapshot transform frame has ${frame.transforms.length} floats; capacity is ${layout.transformFloatsPerBuffer}.`);
    }
    if (frame.viewMatrices.length > layout.viewMatrixFloatsPerBuffer) {
        throw new RangeError(`Shared snapshot view-matrix frame has ${frame.viewMatrices.length} floats; capacity is ${layout.viewMatrixFloatsPerBuffer}.`);
    }
    if (frame.instanceTints !== undefined &&
        frame.instanceTints.length > layout.instanceTintFloatsPerBuffer) {
        throw new RangeError(`Shared snapshot instance-tint frame has ${frame.instanceTints.length} floats; capacity is ${layout.instanceTintFloatsPerBuffer}.`);
    }
    if (frame.quadInstanceFloats !== undefined &&
        frame.quadInstanceFloats.length > layout.quadInstanceFloatsPerBuffer) {
        throw new RangeError(`Shared snapshot quad instance float frame has ${frame.quadInstanceFloats.length} floats; capacity is ${layout.quadInstanceFloatsPerBuffer}.`);
    }
    if (frame.quadInstanceWords !== undefined &&
        frame.quadInstanceWords.length > layout.quadInstanceWordsPerBuffer) {
        throw new RangeError(`Shared snapshot quad instance word frame has ${frame.quadInstanceWords.length} words; capacity is ${layout.quadInstanceWordsPerBuffer}.`);
    }
    if (frame.packetWords !== undefined &&
        frame.packetWords.length > layout.packetWordsPerBuffer) {
        throw new RangeError(`Shared snapshot packet frame has ${frame.packetWords.length} words; capacity is ${layout.packetWordsPerBuffer}.`);
    }
}
function validatePositiveInteger(value, label) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new RangeError(`Shared snapshot transport ${label} must be > 0.`);
    }
}
function validateNonNegativeInteger(value, label) {
    if (!Number.isInteger(value) || value < 0) {
        throw new RangeError(`Shared snapshot transport ${label} must be >= 0.`);
    }
}
function snapshotFrameTime(frame) {
    return typeof frame.time === "number" && Number.isFinite(frame.time)
        ? Math.max(0, frame.time)
        : frame.frame / 60;
}
function writeHeaderFloat64(header, offset, value) {
    FLOAT64_HEADER_SCRATCH_FLOATS[0] = value;
    Atomics.store(header, offset, FLOAT64_HEADER_SCRATCH_WORDS[0] ?? 0);
    Atomics.store(header, offset + 1, FLOAT64_HEADER_SCRATCH_WORDS[1] ?? 0);
}
function readHeaderFloat64(header, offset) {
    FLOAT64_HEADER_SCRATCH_WORDS[0] = Atomics.load(header, offset);
    FLOAT64_HEADER_SCRATCH_WORDS[1] = Atomics.load(header, offset + 1);
    return Number.isFinite(FLOAT64_HEADER_SCRATCH_FLOATS[0] ?? NaN)
        ? Math.max(0, FLOAT64_HEADER_SCRATCH_FLOATS[0] ?? 0)
        : 0;
}
//# sourceMappingURL=shared-snapshot-transport.js.map