import { mimeTypeFromImage } from "./gltf-uri-shared.js";
import type {
  ResolveBufferUrlResult,
  ResolveImageUrlResult,
} from "./gltf-uri-external-fetch-types.js";

export function resolveSameOriginBufferUrl(input: {
  readonly sourceUrl: URL;
  readonly uri: string;
  readonly bufferIndex: number;
}): ResolveBufferUrlResult {
  if (input.uri.startsWith("data:")) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedBufferUri",
        severity: "error",
        bufferIndex: input.bufferIndex,
        uri: input.uri,
        message: `glTF buffer ${input.bufferIndex} uses a data URI; this loader currently expects same-origin external buffer files.`,
      },
    };
  }

  let url: URL;

  try {
    url = new URL(input.uri, input.sourceUrl);
  } catch {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedBufferUri",
        severity: "error",
        bufferIndex: input.bufferIndex,
        uri: input.uri,
        message: `glTF buffer ${input.bufferIndex} URI '${input.uri}' could not be resolved.`,
      },
    };
  }

  if (url.origin !== input.sourceUrl.origin) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedBufferUri",
        severity: "error",
        bufferIndex: input.bufferIndex,
        uri: input.uri,
        message: `glTF buffer ${input.bufferIndex} URI '${input.uri}' is not same-origin with the glTF source.`,
      },
    };
  }

  return { ok: true, url: url.href };
}

export function resolveSameOriginImageUrl(input: {
  readonly sourceUrl: URL;
  readonly image: Record<string, unknown>;
  readonly imageIndex: number;
}): ResolveImageUrlResult {
  const uri = input.image.uri;

  if (typeof uri !== "string") {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedImageUri",
        severity: "error",
        imageIndex: input.imageIndex,
        message: `glTF image ${input.imageIndex} does not provide a URI.`,
      },
    };
  }

  const mimeType = mimeTypeFromImage(input.image, uri);

  if (mimeType === null) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedImageUri",
        severity: "error",
        imageIndex: input.imageIndex,
        uri,
        message: `glTF image ${input.imageIndex} URI '${uri}' has an unsupported or unknown image format.`,
      },
    };
  }

  let url: URL;

  try {
    url = new URL(uri, input.sourceUrl);
  } catch {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedImageUri",
        severity: "error",
        imageIndex: input.imageIndex,
        uri,
        message: `glTF image ${input.imageIndex} URI '${uri}' could not be resolved.`,
      },
    };
  }

  if (url.origin !== input.sourceUrl.origin) {
    return {
      ok: false,
      diagnostic: {
        code: "loadGltfFromUri.unsupportedImageUri",
        severity: "error",
        imageIndex: input.imageIndex,
        uri,
        message: `glTF image ${input.imageIndex} URI '${uri}' is not same-origin with the glTF source.`,
      },
    };
  }

  return { ok: true, url: url.href };
}
