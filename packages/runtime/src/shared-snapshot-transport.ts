const TRANSFORM_FLOATS_PER_ENTITY = 16;
const INSTANCE_TINT_FLOATS_PER_ENTITY = 4;
const VIEW_MATRIX_FLOATS_PER_VIEW = 48;
const QUAD_INSTANCE_FLOATS_PER_INSTANCE = 24;
const QUAD_INSTANCE_WORDS_PER_INSTANCE = 8;
const BUFFER_COUNT = 2;

const enum HeaderIndex {
  Sequence = 0,
  Frame = 1,
  ActiveBuffer = 2,
  TransformFloats = 3,
  ViewMatrixFloats = 4,
  InstanceTintFloats = 5,
  PacketWords = 6,
  QuadInstanceFloats = 7,
  QuadInstanceWords = 8,
}

const HEADER_INT32_COUNT = 9;

export interface CreateSharedSnapshotTransportOptions {
  readonly maxEntities: number;
  readonly maxViews: number;
  readonly maxInstanceTints?: number;
  readonly maxQuadInstances?: number;
  readonly maxPacketWords?: number;
  readonly requireCrossOriginIsolated?: boolean;
  readonly crossOriginIsolated?: boolean;
  readonly sharedArrayBufferConstructor?: SharedArrayBufferConstructor | null;
}

export interface SharedSnapshotTransportLayout {
  readonly buffers: number;
  readonly headerInt32Count: number;
  readonly transformFloatsPerEntity: number;
  readonly instanceTintFloatsPerTint: number;
  readonly viewMatrixFloatsPerView: number;
  readonly quadInstanceFloatsPerInstance: number;
  readonly quadInstanceWordsPerInstance: number;
  readonly maxEntities: number;
  readonly maxViews: number;
  readonly maxInstanceTints: number;
  readonly maxQuadInstances: number;
  readonly transformFloatsPerBuffer: number;
  readonly instanceTintFloatsPerBuffer: number;
  readonly viewMatrixFloatsPerBuffer: number;
  readonly quadInstanceFloatsPerBuffer: number;
  readonly quadInstanceWordsPerBuffer: number;
  readonly packetWordsPerBuffer: number;
}

export interface SharedSnapshotFrameInput {
  readonly frame: number;
  readonly transforms: ArrayLike<number>;
  readonly instanceTints?: ArrayLike<number>;
  readonly viewMatrices: ArrayLike<number>;
  readonly quadInstanceFloats?: ArrayLike<number>;
  readonly quadInstanceWords?: ArrayLike<number>;
  readonly packetWords?: ArrayLike<number>;
}

export interface SharedSnapshotWriteReport {
  readonly frame: number;
  readonly sequence: number;
  readonly bufferIndex: number;
  readonly transformFloats: number;
  readonly instanceTintFloats: number;
  readonly viewMatrixFloats: number;
  readonly quadInstanceFloats: number;
  readonly quadInstanceWords: number;
  readonly packetWords: number;
}

export interface SharedSnapshotReadFrame {
  readonly frame: number;
  readonly sequence: number;
  readonly bufferIndex: number;
  readonly transforms: Float32Array;
  readonly instanceTints: Float32Array;
  readonly viewMatrices: Float32Array;
  readonly quadInstanceFloats: Float32Array;
  readonly quadInstanceWords: Uint32Array;
  readonly packetWords: Uint32Array;
}

export interface SharedSnapshotTransportWriter {
  readonly header: Int32Array;
  readonly transforms: Float32Array;
  readonly instanceTints: Float32Array;
  readonly viewMatrices: Float32Array;
  readonly quadInstanceFloats: Float32Array;
  readonly quadInstanceWords: Uint32Array;
  readonly packetWords: Uint32Array;
  writeFrame(frame: SharedSnapshotFrameInput): SharedSnapshotWriteReport;
}

export interface SharedSnapshotTransportReader {
  readonly header: Int32Array;
  readonly transforms: Float32Array;
  readonly instanceTints: Float32Array;
  readonly viewMatrices: Float32Array;
  readonly quadInstanceFloats: Float32Array;
  readonly quadInstanceWords: Uint32Array;
  readonly packetWords: Uint32Array;
  readLatestFrame(): SharedSnapshotReadFrame | null;
}

export interface SharedSnapshotTransport {
  readonly mode: "shared-array-buffer";
  readonly layout: SharedSnapshotTransportLayout;
  readonly headerBuffer: SharedArrayBuffer;
  readonly transformBuffer: SharedArrayBuffer;
  readonly instanceTintBuffer: SharedArrayBuffer;
  readonly viewMatrixBuffer: SharedArrayBuffer;
  readonly quadInstanceFloatBuffer: SharedArrayBuffer;
  readonly quadInstanceWordBuffer: SharedArrayBuffer;
  readonly packetBuffer: SharedArrayBuffer;
  readonly writer: SharedSnapshotTransportWriter;
  readonly reader: SharedSnapshotTransportReader;
}

export interface SharedSnapshotTransportBuffers {
  readonly layout: SharedSnapshotTransportLayout;
  readonly headerBuffer: SharedArrayBuffer;
  readonly transformBuffer: SharedArrayBuffer;
  readonly instanceTintBuffer: SharedArrayBuffer;
  readonly viewMatrixBuffer: SharedArrayBuffer;
  readonly quadInstanceFloatBuffer: SharedArrayBuffer;
  readonly quadInstanceWordBuffer: SharedArrayBuffer;
  readonly packetBuffer: SharedArrayBuffer;
}

export type SharedSnapshotTransportUnsupportedReason =
  | "shared-array-buffer-unavailable"
  | "cross-origin-isolation-required";

export class SharedSnapshotTransportUnsupportedError extends Error {
  readonly code = "shared-snapshot-transport-unsupported";
  readonly reason: SharedSnapshotTransportUnsupportedReason;

  constructor(
    reason: SharedSnapshotTransportUnsupportedReason,
    message: string,
  ) {
    super(message);
    this.name = "SharedSnapshotTransportUnsupportedError";
    this.reason = reason;
  }
}

export function createSharedSnapshotTransport(
  options: CreateSharedSnapshotTransportOptions,
): SharedSnapshotTransport {
  validatePositiveInteger(options.maxEntities, "maxEntities");
  validatePositiveInteger(options.maxViews, "maxViews");

  const SharedArrayBufferCtor =
    options.sharedArrayBufferConstructor === undefined
      ? globalThis.SharedArrayBuffer
      : options.sharedArrayBufferConstructor;

  if (SharedArrayBufferCtor === undefined || SharedArrayBufferCtor === null) {
    throw new SharedSnapshotTransportUnsupportedError(
      "shared-array-buffer-unavailable",
      "SharedArrayBuffer snapshot transport is unavailable in this environment.",
    );
  }

  const requiresIsolation =
    options.requireCrossOriginIsolated ??
    typeof globalThis.crossOriginIsolated === "boolean";
  const crossOriginIsolated =
    options.crossOriginIsolated ?? globalThis.crossOriginIsolated;

  if (requiresIsolation && crossOriginIsolated !== true) {
    throw new SharedSnapshotTransportUnsupportedError(
      "cross-origin-isolation-required",
      "SharedArrayBuffer snapshot transport requires a cross-origin isolated page.",
    );
  }

  const layout = createLayout({
    maxEntities: options.maxEntities,
    maxViews: options.maxViews,
    maxInstanceTints: options.maxInstanceTints ?? options.maxEntities,
    maxQuadInstances: options.maxQuadInstances ?? 0,
    maxPacketWords: options.maxPacketWords ?? 0,
  });
  const headerBuffer = new SharedArrayBufferCtor(
    HEADER_INT32_COUNT * Int32Array.BYTES_PER_ELEMENT,
  );
  const transformBuffer = new SharedArrayBufferCtor(
    layout.transformFloatsPerBuffer *
      BUFFER_COUNT *
      Float32Array.BYTES_PER_ELEMENT,
  );
  const instanceTintBuffer = new SharedArrayBufferCtor(
    layout.instanceTintFloatsPerBuffer *
      BUFFER_COUNT *
      Float32Array.BYTES_PER_ELEMENT,
  );
  const viewMatrixBuffer = new SharedArrayBufferCtor(
    layout.viewMatrixFloatsPerBuffer *
      BUFFER_COUNT *
      Float32Array.BYTES_PER_ELEMENT,
  );
  const quadInstanceFloatBuffer = new SharedArrayBufferCtor(
    layout.quadInstanceFloatsPerBuffer *
      BUFFER_COUNT *
      Float32Array.BYTES_PER_ELEMENT,
  );
  const quadInstanceWordBuffer = new SharedArrayBufferCtor(
    layout.quadInstanceWordsPerBuffer *
      BUFFER_COUNT *
      Uint32Array.BYTES_PER_ELEMENT,
  );
  const packetBuffer = new SharedArrayBufferCtor(
    layout.packetWordsPerBuffer * BUFFER_COUNT * Uint32Array.BYTES_PER_ELEMENT,
  );
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
    writer: createWriter(
      layout,
      header,
      transforms,
      instanceTints,
      viewMatrices,
      quadInstanceFloats,
      quadInstanceWords,
      packetWords,
    ),
    reader: createReader(
      layout,
      header,
      transforms,
      instanceTints,
      viewMatrices,
      quadInstanceFloats,
      quadInstanceWords,
      packetWords,
    ),
  };
}

export function createSharedSnapshotTransportViews(
  input: SharedSnapshotTransportBuffers,
): SharedSnapshotTransport {
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
    writer: createWriter(
      input.layout,
      header,
      transforms,
      instanceTints,
      viewMatrices,
      quadInstanceFloats,
      quadInstanceWords,
      packetWords,
    ),
    reader: createReader(
      input.layout,
      header,
      transforms,
      instanceTints,
      viewMatrices,
      quadInstanceFloats,
      quadInstanceWords,
      packetWords,
    ),
  };
}

function createLayout(options: {
  readonly maxEntities: number;
  readonly maxViews: number;
  readonly maxInstanceTints: number;
  readonly maxQuadInstances: number;
  readonly maxPacketWords: number;
}): SharedSnapshotTransportLayout {
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
    instanceTintFloatsPerBuffer:
      options.maxInstanceTints * INSTANCE_TINT_FLOATS_PER_ENTITY,
    viewMatrixFloatsPerBuffer: options.maxViews * VIEW_MATRIX_FLOATS_PER_VIEW,
    quadInstanceFloatsPerBuffer:
      options.maxQuadInstances * QUAD_INSTANCE_FLOATS_PER_INSTANCE,
    quadInstanceWordsPerBuffer:
      options.maxQuadInstances * QUAD_INSTANCE_WORDS_PER_INSTANCE,
    packetWordsPerBuffer: options.maxPacketWords,
  };
}

function createWriter(
  layout: SharedSnapshotTransportLayout,
  header: Int32Array,
  transforms: Float32Array,
  instanceTints: Float32Array,
  viewMatrices: Float32Array,
  quadInstanceFloats: Float32Array,
  quadInstanceWords: Uint32Array,
  packetWords: Uint32Array,
): SharedSnapshotTransportWriter {
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

      Atomics.store(header, HeaderIndex.Sequence, writeSequence);
      writeSharedFrameBuffers(
        layout,
        transforms,
        instanceTints,
        viewMatrices,
        quadInstanceFloats,
        quadInstanceWords,
        packetWords,
        nextBuffer,
        frame,
      );
      Atomics.store(header, HeaderIndex.Frame, frame.frame);
      Atomics.store(header, HeaderIndex.ActiveBuffer, nextBuffer);
      Atomics.store(
        header,
        HeaderIndex.TransformFloats,
        frame.transforms.length,
      );
      Atomics.store(
        header,
        HeaderIndex.ViewMatrixFloats,
        frame.viewMatrices.length,
      );
      Atomics.store(
        header,
        HeaderIndex.InstanceTintFloats,
        frame.instanceTints?.length ?? 0,
      );
      Atomics.store(
        header,
        HeaderIndex.PacketWords,
        frame.packetWords?.length ?? 0,
      );
      Atomics.store(
        header,
        HeaderIndex.QuadInstanceFloats,
        frame.quadInstanceFloats?.length ?? 0,
      );
      Atomics.store(
        header,
        HeaderIndex.QuadInstanceWords,
        frame.quadInstanceWords?.length ?? 0,
      );

      const completeSequence = writeSequence + 1;

      Atomics.store(header, HeaderIndex.Sequence, completeSequence);
      Atomics.notify(header, HeaderIndex.Sequence);

      return {
        frame: frame.frame,
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

function createReader(
  layout: SharedSnapshotTransportLayout,
  header: Int32Array,
  transforms: Float32Array,
  instanceTints: Float32Array,
  viewMatrices: Float32Array,
  quadInstanceFloats: Float32Array,
  quadInstanceWords: Uint32Array,
  packetWords: Uint32Array,
): SharedSnapshotTransportReader {
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
        const transformFloats = Atomics.load(
          header,
          HeaderIndex.TransformFloats,
        );
        const viewMatrixFloats = Atomics.load(
          header,
          HeaderIndex.ViewMatrixFloats,
        );
        const instanceTintFloats = Atomics.load(
          header,
          HeaderIndex.InstanceTintFloats,
        );
        const packetWordCount = Atomics.load(header, HeaderIndex.PacketWords);
        const quadInstanceFloatCount = Atomics.load(
          header,
          HeaderIndex.QuadInstanceFloats,
        );
        const quadInstanceWordCount = Atomics.load(
          header,
          HeaderIndex.QuadInstanceWords,
        );
        const transformOffset = bufferIndex * layout.transformFloatsPerBuffer;
        const instanceTintOffset =
          bufferIndex * layout.instanceTintFloatsPerBuffer;
        const viewMatrixOffset = bufferIndex * layout.viewMatrixFloatsPerBuffer;
        const quadInstanceFloatOffset =
          bufferIndex * layout.quadInstanceFloatsPerBuffer;
        const quadInstanceWordOffset =
          bufferIndex * layout.quadInstanceWordsPerBuffer;
        const packetOffset = bufferIndex * layout.packetWordsPerBuffer;
        const sequenceAfter = Atomics.load(header, HeaderIndex.Sequence);

        if (sequenceBefore !== sequenceAfter || sequenceAfter % 2 !== 0) {
          continue;
        }

        return {
          frame,
          sequence: sequenceAfter,
          bufferIndex,
          transforms: transforms.subarray(
            transformOffset,
            transformOffset + transformFloats,
          ),
          instanceTints: instanceTints.subarray(
            instanceTintOffset,
            instanceTintOffset + instanceTintFloats,
          ),
          viewMatrices: viewMatrices.subarray(
            viewMatrixOffset,
            viewMatrixOffset + viewMatrixFloats,
          ),
          quadInstanceFloats: quadInstanceFloats.subarray(
            quadInstanceFloatOffset,
            quadInstanceFloatOffset + quadInstanceFloatCount,
          ),
          quadInstanceWords: quadInstanceWords.subarray(
            quadInstanceWordOffset,
            quadInstanceWordOffset + quadInstanceWordCount,
          ),
          packetWords: packetWords.subarray(
            packetOffset,
            packetOffset + packetWordCount,
          ),
        };
      }

      return null;
    },
  };
}

function writeSharedFrameBuffers(
  layout: SharedSnapshotTransportLayout,
  transforms: Float32Array,
  instanceTints: Float32Array,
  viewMatrices: Float32Array,
  quadInstanceFloats: Float32Array,
  quadInstanceWords: Uint32Array,
  packetWords: Uint32Array,
  bufferIndex: number,
  frame: SharedSnapshotFrameInput,
): void {
  const transformOffset = bufferIndex * layout.transformFloatsPerBuffer;
  const instanceTintOffset = bufferIndex * layout.instanceTintFloatsPerBuffer;
  const viewMatrixOffset = bufferIndex * layout.viewMatrixFloatsPerBuffer;
  const quadInstanceFloatOffset =
    bufferIndex * layout.quadInstanceFloatsPerBuffer;
  const quadInstanceWordOffset =
    bufferIndex * layout.quadInstanceWordsPerBuffer;
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

function validateFrameInput(
  layout: SharedSnapshotTransportLayout,
  frame: SharedSnapshotFrameInput,
): void {
  validateNonNegativeInteger(frame.frame, "frame");

  if (frame.transforms.length > layout.transformFloatsPerBuffer) {
    throw new RangeError(
      `Shared snapshot transform frame has ${frame.transforms.length} floats; capacity is ${layout.transformFloatsPerBuffer}.`,
    );
  }

  if (frame.viewMatrices.length > layout.viewMatrixFloatsPerBuffer) {
    throw new RangeError(
      `Shared snapshot view-matrix frame has ${frame.viewMatrices.length} floats; capacity is ${layout.viewMatrixFloatsPerBuffer}.`,
    );
  }

  if (
    frame.instanceTints !== undefined &&
    frame.instanceTints.length > layout.instanceTintFloatsPerBuffer
  ) {
    throw new RangeError(
      `Shared snapshot instance-tint frame has ${frame.instanceTints.length} floats; capacity is ${layout.instanceTintFloatsPerBuffer}.`,
    );
  }

  if (
    frame.quadInstanceFloats !== undefined &&
    frame.quadInstanceFloats.length > layout.quadInstanceFloatsPerBuffer
  ) {
    throw new RangeError(
      `Shared snapshot quad instance float frame has ${frame.quadInstanceFloats.length} floats; capacity is ${layout.quadInstanceFloatsPerBuffer}.`,
    );
  }

  if (
    frame.quadInstanceWords !== undefined &&
    frame.quadInstanceWords.length > layout.quadInstanceWordsPerBuffer
  ) {
    throw new RangeError(
      `Shared snapshot quad instance word frame has ${frame.quadInstanceWords.length} words; capacity is ${layout.quadInstanceWordsPerBuffer}.`,
    );
  }

  if (
    frame.packetWords !== undefined &&
    frame.packetWords.length > layout.packetWordsPerBuffer
  ) {
    throw new RangeError(
      `Shared snapshot packet frame has ${frame.packetWords.length} words; capacity is ${layout.packetWordsPerBuffer}.`,
    );
  }
}

function validatePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`Shared snapshot transport ${label} must be > 0.`);
  }
}

function validateNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`Shared snapshot transport ${label} must be >= 0.`);
  }
}
