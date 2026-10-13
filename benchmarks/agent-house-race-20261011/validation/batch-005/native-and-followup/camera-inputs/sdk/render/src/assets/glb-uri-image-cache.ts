import type { GltfImageSourceRef } from "../materials/gltf-texture-types.js";
import type {
  Ktx2BasisTranscoder,
  Ktx2TextureCompressionSupport,
} from "./ktx2-decoder.js";

export function imageDecodeCacheKey(input: {
  readonly source: GltfImageSourceRef;
  readonly sourceUrl: URL;
  readonly bytes: ArrayBuffer | ArrayBufferView | undefined;
  readonly byteObjectId: (bytes: ArrayBuffer | ArrayBufferView) => number;
  readonly decodeOptionsKey?: string;
}): string {
  const mimeType = input.source.mimeType ?? "";
  const decodeOptionsKey =
    input.decodeOptionsKey === undefined
      ? ""
      : `:decode:${input.decodeOptionsKey}`;

  if (input.source.kind === "uri") {
    const uri = input.source.uri.startsWith("data:")
      ? input.source.uri
      : new URL(input.source.uri, input.sourceUrl).href;

    return `uri:${uri}:mime:${mimeType}${decodeOptionsKey}`;
  }

  const bytesKey =
    input.bytes === undefined
      ? "inline"
      : `bytes:${input.byteObjectId(input.bytes)}`;

  return `bufferView:${input.sourceUrl.href}:${input.source.bufferView}:mime:${mimeType}:${bytesKey}${decodeOptionsKey}`;
}

export function imageDecodeOptionsKeyField(input: {
  readonly source: GltfImageSourceRef;
  readonly textureCompression?: Ktx2TextureCompressionSupport;
}): { readonly decodeOptionsKey?: string } {
  const decodeOptionsKey = imageDecodeOptionsKey(input);
  return decodeOptionsKey === undefined ? {} : { decodeOptionsKey };
}

export async function resolveBasisKtx2Transcoder(input: {
  readonly source: GltfImageSourceRef;
  readonly provided: Ktx2BasisTranscoder | undefined;
  readonly create: (() => PromiseLike<Ktx2BasisTranscoder>) | undefined;
  readonly getCreated: () => Promise<Ktx2BasisTranscoder> | null;
  readonly setCreated: (promise: Promise<Ktx2BasisTranscoder>) => void;
}): Promise<Ktx2BasisTranscoder | undefined> {
  if (input.source.mimeType !== "image/ktx2") {
    return undefined;
  }
  if (input.provided !== undefined) {
    return input.provided;
  }
  if (input.create === undefined) {
    return undefined;
  }

  const existing = input.getCreated();
  if (existing !== null) {
    return existing;
  }

  const created = Promise.resolve(input.create());
  input.setCreated(created);
  return created;
}

function imageDecodeOptionsKey(input: {
  readonly source: GltfImageSourceRef;
  readonly textureCompression?: Ktx2TextureCompressionSupport;
}): string | undefined {
  if (input.source.mimeType !== "image/ktx2") {
    return undefined;
  }

  const compression = input.textureCompression;

  return (
    [
      compression?.astc === true ? "astc" : null,
      compression?.bc === true ? "bc" : null,
      compression?.etc2 === true ? "etc2" : null,
    ]
      .filter((feature): feature is string => feature !== null)
      .join(",") || "rgba"
  );
}
