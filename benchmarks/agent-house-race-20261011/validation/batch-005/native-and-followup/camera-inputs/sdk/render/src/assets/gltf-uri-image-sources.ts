import type { GltfImageSourceRef } from "../materials/gltf-texture-types.js";
import type {
  LoadGltfFromUriDiagnostic,
  LoadGltfFromUriExternalImageSourceKind,
} from "./gltf-uri-loader.js";
import {
  bytesView,
  isRecord,
  isSupportedImageMimeType,
  mimeTypeFromImage,
} from "./gltf-uri-shared.js";

export type ImageSourceRefResult =
  | { readonly ok: true; readonly source: GltfImageSourceRef }
  | { readonly ok: false; readonly message: string };

export function imageSourceRefFromImage(
  image: Record<string, unknown>,
): ImageSourceRefResult {
  const bufferView =
    typeof image.bufferView === "number" && Number.isInteger(image.bufferView)
      ? image.bufferView
      : null;

  if (bufferView !== null) {
    if (typeof image.mimeType !== "string") {
      return {
        ok: false,
        message: "BufferView images must declare a MIME type.",
      };
    }

    if (!isSupportedImageMimeType(image.mimeType)) {
      return {
        ok: false,
        message: `Image MIME type '${image.mimeType}' is not supported.`,
      };
    }

    return {
      ok: true,
      source: {
        kind: "bufferView",
        bufferView,
        mimeType: image.mimeType,
      },
    };
  }

  if (typeof image.uri === "string") {
    const mimeType = mimeTypeFromImage(image, image.uri);

    if (mimeType === null) {
      return {
        ok: false,
        message: `Image URI '${image.uri}' has an unsupported or unknown image format.`,
      };
    }

    return {
      ok: true,
      source: {
        kind: "uri",
        uri: image.uri,
        mimeType,
      },
    };
  }

  return {
    ok: false,
    message: "Image must provide a URI or bufferView source.",
  };
}

export type BytesForImageSourceResult =
  | { readonly ok: true; readonly bytes?: ArrayBuffer | ArrayBufferView }
  | { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic };

export function bytesForImageSource(input: {
  readonly root: Record<string, unknown>;
  readonly source: GltfImageSourceRef;
  readonly imageIndex: number;
  readonly externalBufferBytes: ReadonlyMap<
    number,
    ArrayBuffer | ArrayBufferView
  >;
  readonly externalImageBytes: ReadonlyMap<
    number,
    ArrayBuffer | ArrayBufferView
  >;
}): BytesForImageSourceResult {
  if (input.source.kind === "uri") {
    if (input.source.uri.startsWith("data:")) {
      return { ok: true };
    }

    const bytes = input.externalImageBytes.get(input.imageIndex);
    if (bytes === undefined) {
      return {
        ok: false,
        diagnostic: {
          code: "loadGltfFromUri.imageReadFailed",
          severity: "error",
          imageIndex: input.imageIndex,
          uri: input.source.uri,
          message: `glTF image ${input.imageIndex} URI '${input.source.uri}' bytes were not available.`,
        },
      };
    }

    return { ok: true, bytes };
  }

  const bytes = bufferViewBytesForImageSource({
    root: input.root,
    bufferViewIndex: input.source.bufferView,
    externalBufferBytes: input.externalBufferBytes,
  });

  if (!bytes.ok) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.imageReadFailed",
        severity: "error",
        imageIndex: input.imageIndex,
        uri: `bufferView:${input.source.bufferView}`,
        message: bytes.message,
      },
    };
  }

  return { ok: true, bytes: bytes.bytes };
}

export function externalImageSourceKind(
  source: GltfImageSourceRef,
): LoadGltfFromUriExternalImageSourceKind {
  if (source.kind === "bufferView") {
    return "buffer-view";
  }
  return source.uri.startsWith("data:") ? "data-uri" : "uri";
}

export function imageStatusUri(source: GltfImageSourceRef): string {
  return source.kind === "bufferView"
    ? `bufferView:${source.bufferView}`
    : source.uri;
}

export function byteLengthOf(bytes: ArrayBuffer | ArrayBufferView): number {
  return bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.byteLength;
}

export { isRecord };

type BufferViewBytesForImageResult =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly message: string };

function bufferViewBytesForImageSource(input: {
  readonly root: Record<string, unknown>;
  readonly bufferViewIndex: number;
  readonly externalBufferBytes: ReadonlyMap<
    number,
    ArrayBuffer | ArrayBufferView
  >;
}): BufferViewBytesForImageResult {
  const bufferViews = Array.isArray(input.root.bufferViews)
    ? input.root.bufferViews
    : [];
  const bufferView = bufferViews[input.bufferViewIndex];

  if (!isRecord(bufferView)) {
    return {
      ok: false,
      message: `glTF image bufferView ${input.bufferViewIndex} is missing or malformed.`,
    };
  }

  const bufferIndex =
    typeof bufferView.buffer === "number" && Number.isInteger(bufferView.buffer)
      ? bufferView.buffer
      : null;
  const byteOffset =
    typeof bufferView.byteOffset === "number" &&
    Number.isInteger(bufferView.byteOffset)
      ? bufferView.byteOffset
      : 0;
  const byteLength =
    typeof bufferView.byteLength === "number" &&
    Number.isInteger(bufferView.byteLength)
      ? bufferView.byteLength
      : null;

  if (bufferIndex === null || byteOffset < 0 || byteLength === null) {
    return {
      ok: false,
      message: `glTF image bufferView ${input.bufferViewIndex} has invalid byte layout.`,
    };
  }

  const bufferBytes = input.externalBufferBytes.get(bufferIndex);
  if (bufferBytes === undefined) {
    return {
      ok: false,
      message: `glTF image bufferView ${input.bufferViewIndex} references unavailable buffer ${bufferIndex}.`,
    };
  }

  const view = bytesView(bufferBytes);
  const byteEnd = byteOffset + byteLength;

  if (byteEnd > view.byteLength) {
    return {
      ok: false,
      message: `glTF image bufferView ${input.bufferViewIndex} byte range exceeds buffer ${bufferIndex}.`,
    };
  }

  return { ok: true, bytes: view.subarray(byteOffset, byteEnd) };
}
