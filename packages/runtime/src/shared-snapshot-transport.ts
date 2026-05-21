const TRANSFORM_FLOATS_PER_ENTITY = 16;
const VIEW_MATRIX_FLOATS_PER_VIEW = 48;
const BUFFER_COUNT = 2;

const enum HeaderIndex {
  Sequence = 0,
  Frame = 1,
  ActiveBuffer = 2,
  TransformFloats = 3,
  ViewMatrixFloats = 4,
}

const HEADER_INT32_COUNT = 8;

export interface CreateSharedSnapshotTransportOptions {
  readonly maxEntities: number;
  readonly maxViews: number;
  readonly requireCrossOriginIsolated?: boolean;
  readonly crossOriginIsolated?: boolean;
  readonly sharedArrayBufferConstructor?: SharedArrayBufferConstructor | null;
}

export interface SharedSnapshotTransportLayout {
  readonly buffers: number;
  readonly headerInt32Count: number;
  readonly transformFloatsPerEntity: number;
  readonly viewMatrixFloatsPerView: number;
  readonly maxEntities: number;
  readonly maxViews: number;
  readonly transformFloatsPerBuffer: number;
  readonly viewMatrixFloatsPerBuffer: number;
}

export interface SharedSnapshotFrameInput {
  readonly frame: number;
  readonly transforms: ArrayLike<number>;
  readonly viewMatrices: ArrayLike<number>;
}

export interface SharedSnapshotWriteReport {
  readonly frame: number;
  readonly sequence: number;
  readonly bufferIndex: number;
  readonly transformFloats: number;
  readonly viewMatrixFloats: number;
}

export interface SharedSnapshotReadFrame {
  readonly frame: number;
  readonly sequence: number;
  readonly bufferIndex: number;
  readonly transforms: Float32Array;
  readonly viewMatrices: Float32Array;
}

export interface SharedSnapshotTransportWriter {
  readonly header: Int32Array;
  readonly transforms: Float32Array;
  readonly viewMatrices: Float32Array;
  writeFrame(frame: SharedSnapshotFrameInput): SharedSnapshotWriteReport;
}

export interface SharedSnapshotTransportReader {
  readonly header: Int32Array;
  readonly transforms: Float32Array;
  readonly viewMatrices: Float32Array;
  readLatestFrame(): SharedSnapshotReadFrame | null;
}

export interface SharedSnapshotTransport {
  readonly mode: "shared-array-buffer";
  readonly layout: SharedSnapshotTransportLayout;
  readonly headerBuffer: SharedArrayBuffer;
  readonly transformBuffer: SharedArrayBuffer;
  readonly viewMatrixBuffer: SharedArrayBuffer;
  readonly writer: SharedSnapshotTransportWriter;
  readonly reader: SharedSnapshotTransportReader;
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

  const layout = createLayout(options.maxEntities, options.maxViews);
  const headerBuffer = new SharedArrayBufferCtor(
    HEADER_INT32_COUNT * Int32Array.BYTES_PER_ELEMENT,
  );
  const transformBuffer = new SharedArrayBufferCtor(
    layout.transformFloatsPerBuffer *
      BUFFER_COUNT *
      Float32Array.BYTES_PER_ELEMENT,
  );
  const viewMatrixBuffer = new SharedArrayBufferCtor(
    layout.viewMatrixFloatsPerBuffer *
      BUFFER_COUNT *
      Float32Array.BYTES_PER_ELEMENT,
  );
  const header = new Int32Array(headerBuffer);
  const transforms = new Float32Array(transformBuffer);
  const viewMatrices = new Float32Array(viewMatrixBuffer);

  return {
    mode: "shared-array-buffer",
    layout,
    headerBuffer,
    transformBuffer,
    viewMatrixBuffer,
    writer: createWriter(layout, header, transforms, viewMatrices),
    reader: createReader(layout, header, transforms, viewMatrices),
  };
}

function createLayout(
  maxEntities: number,
  maxViews: number,
): SharedSnapshotTransportLayout {
  return {
    buffers: BUFFER_COUNT,
    headerInt32Count: HEADER_INT32_COUNT,
    transformFloatsPerEntity: TRANSFORM_FLOATS_PER_ENTITY,
    viewMatrixFloatsPerView: VIEW_MATRIX_FLOATS_PER_VIEW,
    maxEntities,
    maxViews,
    transformFloatsPerBuffer: maxEntities * TRANSFORM_FLOATS_PER_ENTITY,
    viewMatrixFloatsPerBuffer: maxViews * VIEW_MATRIX_FLOATS_PER_VIEW,
  };
}

function createWriter(
  layout: SharedSnapshotTransportLayout,
  header: Int32Array,
  transforms: Float32Array,
  viewMatrices: Float32Array,
): SharedSnapshotTransportWriter {
  return {
    header,
    transforms,
    viewMatrices,
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
        viewMatrices,
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

      const completeSequence = writeSequence + 1;

      Atomics.store(header, HeaderIndex.Sequence, completeSequence);
      Atomics.notify(header, HeaderIndex.Sequence);

      return {
        frame: frame.frame,
        sequence: completeSequence,
        bufferIndex: nextBuffer,
        transformFloats: frame.transforms.length,
        viewMatrixFloats: frame.viewMatrices.length,
      };
    },
  };
}

function createReader(
  layout: SharedSnapshotTransportLayout,
  header: Int32Array,
  transforms: Float32Array,
  viewMatrices: Float32Array,
): SharedSnapshotTransportReader {
  return {
    header,
    transforms,
    viewMatrices,
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
        const transformOffset = bufferIndex * layout.transformFloatsPerBuffer;
        const viewMatrixOffset = bufferIndex * layout.viewMatrixFloatsPerBuffer;
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
          viewMatrices: viewMatrices.subarray(
            viewMatrixOffset,
            viewMatrixOffset + viewMatrixFloats,
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
  viewMatrices: Float32Array,
  bufferIndex: number,
  frame: SharedSnapshotFrameInput,
): void {
  const transformOffset = bufferIndex * layout.transformFloatsPerBuffer;
  const viewMatrixOffset = bufferIndex * layout.viewMatrixFloatsPerBuffer;

  for (let index = 0; index < frame.transforms.length; index += 1) {
    transforms[transformOffset + index] = frame.transforms[index] ?? 0;
  }

  for (let index = 0; index < frame.viewMatrices.length; index += 1) {
    viewMatrices[viewMatrixOffset + index] = frame.viewMatrices[index] ?? 0;
  }
}

function validateFrameInput(
  layout: SharedSnapshotTransportLayout,
  frame: SharedSnapshotFrameInput,
): void {
  validatePositiveInteger(frame.frame, "frame");

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
}

function validatePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`Shared snapshot transport ${label} must be > 0.`);
  }
}
