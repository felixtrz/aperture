import type { RenderSnapshot } from "./snapshot-core-types.js";
import {
  createQuadSnapshotBuffers,
  type QuadSnapshotBuffers,
} from "./quad-snapshot.js";

// A RenderSnapshot is structured-clone-friendly but NOT JSON-friendly: it holds
// typed arrays at the top level (`transforms`, `viewMatrices`, `bones`, the
// `morph*` buffers, instance buffers) and nested ones (`quads.instanceFloats`,
// `BoundsPacket` AABB/sphere vectors). Plain `JSON.stringify` turns those into
// index-keyed objects and silently maps `NaN`/`Infinity` to `null`, so a
// round-trip would corrupt geometry. This module encodes every typed array as a
// tagged `{ $typedArray, base64, length }` node — exact bytes, environment
// independent — so a snapshot can be written to disk by the Node headless loop
// and rehydrated in the browser render path.

const TYPED_ARRAY_TAG = "$typedArray";

type TypedArray =
  | Float32Array
  | Float64Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array;

interface TypedArrayConstructor {
  new (length: number): TypedArray;
  new (buffer: ArrayBufferLike, byteOffset: number, length: number): TypedArray;
  readonly BYTES_PER_ELEMENT: number;
}

const TYPED_ARRAY_CONSTRUCTORS: Readonly<Record<string, TypedArrayConstructor>> =
  {
    Float32Array,
    Float64Array,
    Int8Array,
    Int16Array,
    Int32Array,
    Uint8Array,
    Uint8ClampedArray,
    Uint16Array,
    Uint32Array,
  };

interface TypedArrayJson {
  readonly [TYPED_ARRAY_TAG]: string;
  readonly base64: string;
  readonly length: number;
}

/**
 * Recursively encode a structured-clone value into a JSON-safe value, replacing
 * every typed array (at any depth) with a tagged base64 node. Plain objects,
 * arrays, and primitives pass through unchanged; asset handles such as
 * `{ kind, id }` are ordinary objects and are preserved verbatim.
 */
export function encodeTypedArrayTree(value: unknown): unknown {
  const typedArray = asTypedArray(value);

  if (typedArray !== null) {
    return encodeTypedArray(typedArray);
  }

  if (Array.isArray(value)) {
    return value.map((item) => encodeTypedArrayTree(item));
  }

  if (isPlainRecord(value)) {
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      result[key] = encodeTypedArrayTree(item);
    }

    return result;
  }

  return value;
}

/**
 * Inverse of {@link encodeTypedArrayTree}: rebuild every tagged base64 node into
 * its exact typed-array constructor and otherwise clone the tree.
 */
export function decodeTypedArrayTree(value: unknown): unknown {
  if (isTypedArrayJson(value)) {
    return decodeTypedArray(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => decodeTypedArrayTree(item));
  }

  if (isPlainRecord(value)) {
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      result[key] = decodeTypedArrayTree(item);
    }

    return result;
  }

  return value;
}

/**
 * Encode a {@link RenderSnapshot} to a JSON-safe value (typed arrays tagged).
 */
export function renderSnapshotToJsonValue(snapshot: RenderSnapshot): unknown {
  return encodeTypedArrayTree(snapshot);
}

/**
 * Rebuild a {@link RenderSnapshot} from a value produced by
 * {@link renderSnapshotToJsonValue}. The `quads` buffers are reconstructed
 * through {@link createQuadSnapshotBuffers} so their ABI version/stride literals
 * are canonical and pass `assertQuadSnapshotBuffers`.
 */
export function renderSnapshotFromJsonValue(value: unknown): RenderSnapshot {
  const decoded = decodeTypedArrayTree(value);

  if (!isPlainRecord(decoded)) {
    throw new TypeError(
      "Cannot rebuild a RenderSnapshot: the decoded value is not an object.",
    );
  }

  const quads = decoded["quads"];

  if (isPlainRecord(quads)) {
    decoded["quads"] = canonicalizeQuadBuffers(quads);
  }

  return decoded as unknown as RenderSnapshot;
}

function canonicalizeQuadBuffers(
  quads: Record<string, unknown>,
): QuadSnapshotBuffers {
  const instanceFloats = quads["instanceFloats"];
  const instanceWords = quads["instanceWords"];

  return createQuadSnapshotBuffers({
    ...(instanceFloats instanceof Float32Array ? { instanceFloats } : {}),
    ...(instanceWords instanceof Uint32Array ? { instanceWords } : {}),
  });
}

function encodeTypedArray(typedArray: TypedArray): TypedArrayJson {
  const bytes = new Uint8Array(
    typedArray.buffer,
    typedArray.byteOffset,
    typedArray.byteLength,
  );

  return {
    [TYPED_ARRAY_TAG]: typedArray.constructor.name,
    base64: bytesToBase64(bytes),
    length: typedArray.length,
  };
}

function decodeTypedArray(value: TypedArrayJson): TypedArray {
  const Constructor = TYPED_ARRAY_CONSTRUCTORS[value[TYPED_ARRAY_TAG]];

  if (Constructor === undefined) {
    throw new RangeError(
      `Unsupported typed array '${value[TYPED_ARRAY_TAG]}' in snapshot JSON.`,
    );
  }

  const bytes = base64ToBytes(value.base64);

  return new Constructor(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / Constructor.BYTES_PER_ELEMENT,
  );
}

function asTypedArray(value: unknown): TypedArray | null {
  if (!ArrayBuffer.isView(value) || value instanceof DataView) {
    return null;
  }

  return value as TypedArray;
}

function isTypedArrayJson(value: unknown): value is TypedArrayJson {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    typeof value[TYPED_ARRAY_TAG] === "string" &&
    typeof value["base64"] === "string"
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !ArrayBuffer.isView(value)
  );
}

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const BASE64_LOOKUP: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(
    BASE64_ALPHABET.split("").map((char, index) => [char, index]),
  ),
);

// Dependency-free, environment-independent base64 over raw bytes. The snapshot
// codec runs in pure Node (headless write path) and in the browser (render
// path), so it cannot rely on `Buffer` or `atob`/`btoa` being present.
function bytesToBase64(bytes: Uint8Array): string {
  const chars: string[] = [];

  for (let index = 0; index < bytes.length; index += 3) {
    const byte0 = bytes[index] ?? 0;
    const hasByte1 = index + 1 < bytes.length;
    const hasByte2 = index + 2 < bytes.length;
    const byte1 = hasByte1 ? (bytes[index + 1] ?? 0) : 0;
    const byte2 = hasByte2 ? (bytes[index + 2] ?? 0) : 0;

    chars.push(
      BASE64_ALPHABET[byte0 >> 2] ?? "A",
      BASE64_ALPHABET[((byte0 & 0b11) << 4) | (byte1 >> 4)] ?? "A",
      hasByte1 ? (BASE64_ALPHABET[((byte1 & 0b1111) << 2) | (byte2 >> 6)] ?? "A") : "=",
      hasByte2 ? (BASE64_ALPHABET[byte2 & 0b111111] ?? "A") : "=",
    );
  }

  return chars.join("");
}

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/u, "");
  const byteLength = Math.floor((clean.length * 6) / 8);
  const bytes = new Uint8Array(byteLength);
  let bitBuffer = 0;
  let bitCount = 0;
  let writeIndex = 0;

  for (const char of clean) {
    const sextet = BASE64_LOOKUP[char];

    if (sextet === undefined) {
      throw new RangeError(`Invalid base64 character '${char}' in snapshot JSON.`);
    }

    bitBuffer = (bitBuffer << 6) | sextet;
    bitCount += 6;

    if (bitCount >= 8) {
      bitCount -= 8;
      bytes[writeIndex] = (bitBuffer >> bitCount) & 0xff;
      writeIndex += 1;
    }
  }

  return bytes;
}
