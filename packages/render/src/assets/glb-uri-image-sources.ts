import type { GltfImageSourceRef } from "../materials/gltf-texture-types.js";
import type { LoadGlbFromUriExternalImageSourceKind } from "./glb-uri-loader.js";

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

export function externalImageSourceKind(
  source: GltfImageSourceRef,
): LoadGlbFromUriExternalImageSourceKind {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mimeTypeFromImage(
  image: Record<string, unknown>,
  uri: string,
): string | null {
  const mimeType =
    typeof image.mimeType === "string" ? image.mimeType : mimeTypeFromUri(uri);

  return mimeType !== null && isSupportedImageMimeType(mimeType)
    ? mimeType
    : null;
}

function mimeTypeFromUri(uri: string): string | null {
  const dataPrefix = uri.match(/^data:([^;,]+)[;,]/u);
  if (dataPrefix?.[1] !== undefined) {
    return dataPrefix[1];
  }

  let pathname: string;

  try {
    pathname = new URL(uri, "https://example.invalid/").pathname;
  } catch {
    pathname = uri;
  }

  const lower = pathname.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".ktx2")) {
    return "image/ktx2";
  }
  return null;
}

function isSupportedImageMimeType(mimeType: string): boolean {
  return (
    mimeType === "image/png" ||
    mimeType === "image/jpeg" ||
    mimeType === "image/ktx2"
  );
}
