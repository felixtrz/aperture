import type {
  RuntimeUniformPacket,
  RuntimeUniformValuePacket,
} from "./snapshot.js";
import type { SnapshotPacketEncodingRegistry } from "./snapshot-packed-registry.js";
import { RUNTIME_UNIFORM_PACKET_WORDS } from "./snapshot-packed-encoding-constants.js";
import {
  readEntity,
  readFloat64,
  writeEntity,
  writeFloat64,
} from "./snapshot-packed-codec-utils.js";

const VALUE_NULL = 0;
const VALUE_BOOLEAN = 1;
const VALUE_NUMBER = 2;
const VALUE_STRING = 3;
const VALUE_NUMBER_ARRAY = 4;
const HEADER_WORDS = 6;
const VALUE_HEADER_WORDS = 3;

/**
 * Runtime uniforms are extensible records, so their packed representation uses
 * a generous fixed packet with tagged variable-width entries. Numeric values
 * stay inline (important for per-frame clocks); only stable field/string names
 * enter the append-only registry.
 */
export function writeRuntimeUniformPacket(
  words: Uint32Array,
  offset: number,
  packet: RuntimeUniformPacket,
  registry: SnapshotPacketEncodingRegistry,
): void {
  const end = offset + RUNTIME_UNIFORM_PACKET_WORDS;
  words.fill(0, offset, end);
  words[offset] = packet.uniformId >>> 0;
  writeEntity(words, offset + 1, packet.entity);
  words[offset + 3] = registry.stringId(packet.key);
  words[offset + 4] = packet.version >>> 0;

  const entries = Object.entries(packet.values);
  words[offset + 5] = entries.length >>> 0;
  let cursor = offset + HEADER_WORDS;

  for (const [key, value] of entries) {
    cursor = writeRuntimeUniformValue(words, cursor, end, key, value, registry);
  }
}

export function readRuntimeUniformPacket(
  words: Uint32Array,
  offset: number,
  registry: SnapshotPacketEncodingRegistry,
): RuntimeUniformPacket {
  const end = offset + RUNTIME_UNIFORM_PACKET_WORDS;
  const entryCount = words[offset + 5] ?? 0;
  const values: Record<string, RuntimeUniformValuePacket> = {};
  let cursor = offset + HEADER_WORDS;

  for (let index = 0; index < entryCount; index += 1) {
    requireWords(cursor, VALUE_HEADER_WORDS, end);
    const key = registry.stringValue(words[cursor] ?? 0);
    const kind = words[cursor + 1] ?? 0;
    const length = words[cursor + 2] ?? 0;
    cursor += VALUE_HEADER_WORDS;

    if (kind === VALUE_NULL) {
      values[key] = null;
      continue;
    }
    if (kind === VALUE_BOOLEAN) {
      requireWords(cursor, 1, end);
      values[key] = (words[cursor] ?? 0) !== 0;
      cursor += 1;
      continue;
    }
    if (kind === VALUE_NUMBER) {
      requireWords(cursor, 2, end);
      values[key] = readFloat64(words, cursor);
      cursor += 2;
      continue;
    }
    if (kind === VALUE_STRING) {
      requireWords(cursor, 1, end);
      values[key] = registry.stringValue(words[cursor] ?? 0);
      cursor += 1;
      continue;
    }
    if (kind === VALUE_NUMBER_ARRAY) {
      requireWords(cursor, length * 2, end);
      const value: number[] = [];
      for (let valueIndex = 0; valueIndex < length; valueIndex += 1) {
        value.push(readFloat64(words, cursor));
        cursor += 2;
      }
      values[key] = value;
      continue;
    }

    throw new RangeError(
      `Unsupported packed runtime uniform value kind '${kind}'.`,
    );
  }

  return {
    uniformId: words[offset] ?? 0,
    entity: readEntity(words, offset + 1),
    key: registry.stringValue(words[offset + 3] ?? 0),
    version: words[offset + 4] ?? 0,
    values,
  };
}

function writeRuntimeUniformValue(
  words: Uint32Array,
  cursor: number,
  end: number,
  key: string,
  value: RuntimeUniformValuePacket,
  registry: SnapshotPacketEncodingRegistry,
): number {
  requireWords(cursor, VALUE_HEADER_WORDS, end);
  words[cursor] = registry.stringId(key);

  if (value === null) {
    words[cursor + 1] = VALUE_NULL;
    words[cursor + 2] = 0;
    return cursor + VALUE_HEADER_WORDS;
  }
  if (typeof value === "boolean") {
    requireWords(cursor, VALUE_HEADER_WORDS + 1, end);
    words[cursor + 1] = VALUE_BOOLEAN;
    words[cursor + 2] = 1;
    words[cursor + 3] = value ? 1 : 0;
    return cursor + VALUE_HEADER_WORDS + 1;
  }
  if (typeof value === "number") {
    requireWords(cursor, VALUE_HEADER_WORDS + 2, end);
    words[cursor + 1] = VALUE_NUMBER;
    words[cursor + 2] = 1;
    writeFloat64(words, cursor + 3, value);
    return cursor + VALUE_HEADER_WORDS + 2;
  }
  if (typeof value === "string") {
    requireWords(cursor, VALUE_HEADER_WORDS + 1, end);
    words[cursor + 1] = VALUE_STRING;
    words[cursor + 2] = 1;
    words[cursor + 3] = registry.stringId(value);
    return cursor + VALUE_HEADER_WORDS + 1;
  }

  const required = VALUE_HEADER_WORDS + value.length * 2;
  requireWords(cursor, required, end);
  words[cursor + 1] = VALUE_NUMBER_ARRAY;
  words[cursor + 2] = value.length >>> 0;
  let valueCursor = cursor + VALUE_HEADER_WORDS;
  for (const item of value) {
    writeFloat64(words, valueCursor, item);
    valueCursor += 2;
  }
  return cursor + required;
}

function requireWords(cursor: number, count: number, end: number): void {
  if (cursor + count > end) {
    throw new RangeError(
      `Runtime uniform packet exceeds its ${RUNTIME_UNIFORM_PACKET_WORDS}-word packed capacity.`,
    );
  }
}
