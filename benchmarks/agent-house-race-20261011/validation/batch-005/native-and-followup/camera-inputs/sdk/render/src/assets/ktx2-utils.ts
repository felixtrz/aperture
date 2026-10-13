import type {
  Ktx2FeatureSetLike,
  Ktx2TextureCompressionFeature,
} from "./ktx2-types.js";

export function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export function bytesView(source: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (source instanceof ArrayBuffer) {
    return new Uint8Array(source);
  }
  return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

export function featureSetHas(
  features:
    | Ktx2FeatureSetLike
    | Iterable<Ktx2TextureCompressionFeature | string>
    | null
    | undefined,
  feature: Ktx2TextureCompressionFeature,
): boolean {
  if (features === null || features === undefined) {
    return false;
  }

  if (typeof (features as Ktx2FeatureSetLike).has === "function") {
    return (features as Ktx2FeatureSetLike).has?.(feature) === true;
  }

  const iterator = (features as { readonly [Symbol.iterator]?: unknown })[
    Symbol.iterator
  ];

  if (typeof iterator !== "function") {
    return false;
  }

  for (const candidate of features as Iterable<string>) {
    if (candidate === feature) {
      return true;
    }
  }

  return false;
}

export function readUint64(view: DataView, byteOffset: number): number {
  const value = view.getBigUint64(byteOffset, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(
      "KTX2 64-bit offset exceeds JavaScript's safe integer range.",
    );
  }
  return Number(value);
}
