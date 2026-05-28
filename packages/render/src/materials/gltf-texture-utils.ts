import type {
  GltfDecodedImageData,
  GltfImageDataResolverReport,
  GltfTextureDiagnosticValue,
} from "./gltf-texture.js";

export function bytesView(bytes: ArrayBuffer | ArrayBufferView): Uint8Array {
  return bytes instanceof ArrayBuffer
    ? new Uint8Array(bytes)
    : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function mimeTypeFromUri(uri: string): string | undefined {
  const dataPrefix = uri.match(/^data:([^;,]+)[;,]/u);
  if (dataPrefix?.[1] !== undefined) {
    return dataPrefix[1];
  }
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".ktx2")) {
    return "image/ktx2";
  }
  return undefined;
}

export function recordField(
  source: Record<string, unknown>,
  field: string,
): Record<string, unknown> | undefined {
  const value = source[field];
  return isRecord(value) ? value : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}

export function isDecodedImageData(
  value: unknown,
): value is GltfDecodedImageData {
  return (
    isRecord(value) &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    isRecord(value.sourceData)
  );
}

export function isImageDataResolverReport(
  value: unknown,
): value is GltfImageDataResolverReport {
  return (
    isRecord(value) &&
    !isDecodedImageData(value) &&
    ("image" in value || "diagnostics" in value)
  );
}

export function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return isRecord(value) && typeof value.then === "function";
}

export function validDecodedImage(image: GltfDecodedImageData): boolean {
  return (
    Number.isInteger(image.width) &&
    image.width > 0 &&
    Number.isInteger(image.height) &&
    image.height > 0 &&
    image.sourceData.bytes instanceof Uint8Array &&
    Number.isInteger(image.sourceData.bytesPerRow) &&
    image.sourceData.bytesPerRow > 0
  );
}

export function toDiagnosticValue(value: unknown): GltfTextureDiagnosticValue {
  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "undefined":
      return "undefined";
    case "bigint":
    case "symbol":
    case "function":
    case "object":
      return Object.prototype.toString.call(value);
  }

  return String(value);
}
