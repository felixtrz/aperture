export const QUAD_SNAPSHOT_ABI_VERSION = 1;

// Fixed ABI for M6 quad consumers. Per-instance floats are owned by extraction
// until the snapshot crosses the worker boundary, then by the renderer for that
// frame. Future UI/text/particle paths may add meaning to reserved lanes only by
// bumping QUAD_SNAPSHOT_ABI_VERSION.
export const QUAD_INSTANCE_FLOAT_STRIDE = 24;
export const QUAD_INSTANCE_WORD_STRIDE = 8;

export type QuadCoordinateMode = "world" | "screen";
export type QuadBillboardMode =
  | "none"
  | "spherical"
  | "cylindrical"
  | "axis-locked";
export type QuadSizeMode = "world-units" | "screen-pixels";
export type QuadBatchKind = "sprite" | "ui" | "glyph" | "particle";
export type QuadPipelineVariant =
  | "sprite"
  | "ui-panel"
  | "ui-image"
  | "msdf-text"
  | "particle";
export type QuadBlendMode = "opaque" | "alpha" | "additive" | "multiply";

export interface QuadSnapshotBuffers {
  readonly version: typeof QUAD_SNAPSHOT_ABI_VERSION;
  readonly instanceFloatStride: typeof QUAD_INSTANCE_FLOAT_STRIDE;
  readonly instanceWordStride: typeof QUAD_INSTANCE_WORD_STRIDE;
  readonly instanceFloats: Float32Array;
  readonly instanceWords: Uint32Array;
}

export interface QuadInstanceFlagsInput {
  readonly coordinateMode: QuadCoordinateMode;
  readonly billboardMode: QuadBillboardMode;
  readonly sizeMode: QuadSizeMode;
}

export const QUAD_INSTANCE_FLAG_MASKS = Object.freeze({
  coordinateMode: 0b0000_0011,
  billboardMode: 0b0011_1100,
  sizeMode: 0b1100_0000,
});

export function createQuadSnapshotBuffers(
  options: {
    readonly instanceFloats?: Float32Array;
    readonly instanceWords?: Uint32Array;
  } = {},
): QuadSnapshotBuffers {
  return {
    version: QUAD_SNAPSHOT_ABI_VERSION,
    instanceFloatStride: QUAD_INSTANCE_FLOAT_STRIDE,
    instanceWordStride: QUAD_INSTANCE_WORD_STRIDE,
    instanceFloats: options.instanceFloats ?? new Float32Array(0),
    instanceWords: options.instanceWords ?? new Uint32Array(0),
  };
}

export function quadInstanceCount(buffers: QuadSnapshotBuffers): number {
  assertQuadSnapshotBuffers(buffers);

  return buffers.instanceFloats.length / QUAD_INSTANCE_FLOAT_STRIDE;
}

export function assertQuadSnapshotBuffers(
  buffers: QuadSnapshotBuffers,
): asserts buffers is QuadSnapshotBuffers {
  if (buffers.version !== QUAD_SNAPSHOT_ABI_VERSION) {
    throw new RangeError(
      `Unsupported quad snapshot ABI version ${buffers.version}.`,
    );
  }

  if (buffers.instanceFloatStride !== QUAD_INSTANCE_FLOAT_STRIDE) {
    throw new RangeError(
      `Unsupported quad instance float stride ${buffers.instanceFloatStride}.`,
    );
  }

  if (buffers.instanceWordStride !== QUAD_INSTANCE_WORD_STRIDE) {
    throw new RangeError(
      `Unsupported quad instance word stride ${buffers.instanceWordStride}.`,
    );
  }

  if (buffers.instanceFloats.length % QUAD_INSTANCE_FLOAT_STRIDE !== 0) {
    throw new RangeError(
      `Quad instance float buffer length ${buffers.instanceFloats.length} is not aligned to stride ${QUAD_INSTANCE_FLOAT_STRIDE}.`,
    );
  }

  if (buffers.instanceWords.length % QUAD_INSTANCE_WORD_STRIDE !== 0) {
    throw new RangeError(
      `Quad instance word buffer length ${buffers.instanceWords.length} is not aligned to stride ${QUAD_INSTANCE_WORD_STRIDE}.`,
    );
  }

  const floatInstances =
    buffers.instanceFloats.length / QUAD_INSTANCE_FLOAT_STRIDE;
  const wordInstances =
    buffers.instanceWords.length / QUAD_INSTANCE_WORD_STRIDE;

  if (floatInstances !== wordInstances) {
    throw new RangeError(
      `Quad instance buffers disagree: ${floatInstances} float instances vs ${wordInstances} word instances.`,
    );
  }
}

export function encodeQuadInstanceFlags(input: QuadInstanceFlagsInput): number {
  return (
    coordinateModeId(input.coordinateMode) |
    (billboardModeId(input.billboardMode) << 2) |
    (sizeModeId(input.sizeMode) << 6)
  );
}

export function decodeQuadInstanceFlags(flags: number): QuadInstanceFlagsInput {
  return {
    coordinateMode: coordinateModeValue(
      flags & QUAD_INSTANCE_FLAG_MASKS.coordinateMode,
    ),
    billboardMode: billboardModeValue(
      (flags & QUAD_INSTANCE_FLAG_MASKS.billboardMode) >>> 2,
    ),
    sizeMode: sizeModeValue((flags & QUAD_INSTANCE_FLAG_MASKS.sizeMode) >>> 6),
  };
}

function coordinateModeId(mode: QuadCoordinateMode): number {
  switch (mode) {
    case "world":
      return 1;
    case "screen":
      return 2;
  }
}

function coordinateModeValue(id: number): QuadCoordinateMode {
  switch (id) {
    case 1:
      return "world";
    case 2:
      return "screen";
    default:
      throw new RangeError(`Unknown quad coordinate mode id '${id}'.`);
  }
}

function billboardModeId(mode: QuadBillboardMode): number {
  switch (mode) {
    case "none":
      return 0;
    case "spherical":
      return 1;
    case "cylindrical":
      return 2;
    case "axis-locked":
      return 3;
  }
}

function billboardModeValue(id: number): QuadBillboardMode {
  switch (id) {
    case 0:
      return "none";
    case 1:
      return "spherical";
    case 2:
      return "cylindrical";
    case 3:
      return "axis-locked";
    default:
      throw new RangeError(`Unknown quad billboard mode id '${id}'.`);
  }
}

function sizeModeId(mode: QuadSizeMode): number {
  switch (mode) {
    case "world-units":
      return 1;
    case "screen-pixels":
      return 2;
  }
}

function sizeModeValue(id: number): QuadSizeMode {
  switch (id) {
    case 1:
      return "world-units";
    case 2:
      return "screen-pixels";
    default:
      throw new RangeError(`Unknown quad size mode id '${id}'.`);
  }
}
