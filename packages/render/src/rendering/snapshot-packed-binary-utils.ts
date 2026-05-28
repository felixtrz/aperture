const OPTIONAL_UINT32_ABSENT = 0xffff_ffff;

const FLOAT64_SCRATCH = new Float64Array(1);
const FLOAT64_WORDS = new Uint32Array(FLOAT64_SCRATCH.buffer);

export function writeEntity(
  words: Uint32Array,
  offset: number,
  entity: { readonly index: number; readonly generation: number },
): void {
  words[offset] = entity.index >>> 0;
  words[offset + 1] = entity.generation >>> 0;
}

export function readEntity(
  words: Uint32Array,
  offset: number,
): { readonly index: number; readonly generation: number } {
  return {
    index: words[offset] ?? 0,
    generation: words[offset + 1] ?? 0,
  };
}

export function writeVec3(
  words: Uint32Array,
  offset: number,
  value: ArrayLike<number>,
): void {
  writeFloat64(words, offset, value[0] ?? 0);
  writeFloat64(words, offset + 2, value[1] ?? 0);
  writeFloat64(words, offset + 4, value[2] ?? 0);
}

export function readVec3(
  words: Uint32Array,
  offset: number,
): readonly [number, number, number] {
  return [
    readFloat64(words, offset),
    readFloat64(words, offset + 2),
    readFloat64(words, offset + 4),
  ];
}

export function writeVec4(
  words: Uint32Array,
  offset: number,
  value: ArrayLike<number>,
): void {
  writeFloat64(words, offset, value[0] ?? 0);
  writeFloat64(words, offset + 2, value[1] ?? 0);
  writeFloat64(words, offset + 4, value[2] ?? 0);
  writeFloat64(words, offset + 6, value[3] ?? 0);
}

export function readVec4(
  words: Uint32Array,
  offset: number,
): readonly [number, number, number, number] {
  return [
    readFloat64(words, offset),
    readFloat64(words, offset + 2),
    readFloat64(words, offset + 4),
    readFloat64(words, offset + 6),
  ];
}

export function writeFloat64(
  words: Uint32Array,
  offset: number,
  value: number,
): void {
  FLOAT64_SCRATCH[0] = value;
  words[offset] = FLOAT64_WORDS[0] ?? 0;
  words[offset + 1] = FLOAT64_WORDS[1] ?? 0;
}

export function readFloat64(words: Uint32Array, offset: number): number {
  FLOAT64_WORDS[0] = words[offset] ?? 0;
  FLOAT64_WORDS[1] = words[offset + 1] ?? 0;

  return FLOAT64_SCRATCH[0] ?? 0;
}

export function writeSigned32(
  words: Uint32Array,
  offset: number,
  value: number,
): void {
  words[offset] = value >>> 0;
}

export function readSigned32(words: Uint32Array, offset: number): number {
  return (words[offset] ?? 0) | 0;
}

export function writeOptionalUint32(
  words: Uint32Array,
  offset: number,
  value: number | undefined,
): void {
  words[offset] = value === undefined ? OPTIONAL_UINT32_ABSENT : value >>> 0;
}

export function readOptionalUint32(
  words: Uint32Array,
  offset: number,
): number | undefined {
  const value = words[offset] ?? OPTIONAL_UINT32_ABSENT;

  return value === OPTIONAL_UINT32_ABSENT ? undefined : value;
}

export function boolState(value: boolean | undefined): number {
  return value === undefined ? 0 : value ? 2 : 1;
}

export function readBoolState(value: number): boolean | undefined {
  switch (value) {
    case 0:
      return undefined;
    case 1:
      return false;
    case 2:
      return true;
    default:
      throw new RangeError(`Unknown snapshot packet boolean state '${value}'.`);
  }
}
