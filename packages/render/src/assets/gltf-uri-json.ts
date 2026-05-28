import type { LoadGltfFromUriDiagnostic } from "./gltf-uri-loader.js";
import { errorMessage, isRecord } from "./gltf-uri-shared.js";

export type ParseGltfJsonResult =
  | { readonly ok: true; readonly root: Record<string, unknown> }
  | { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic };

export function parseGltfJson(
  url: string,
  bytes: ArrayBuffer,
): ParseGltfJsonResult {
  let text: string;

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    return invalidJson(url, error);
  }

  try {
    const parsed: unknown = JSON.parse(text);

    if (!isRecord(parsed)) {
      return invalidJson(url, null);
    }

    return { ok: true, root: parsed };
  } catch (error) {
    return invalidJson(url, error);
  }
}

function invalidJson(
  url: string,
  error: unknown,
): { readonly ok: false; readonly diagnostic: LoadGltfFromUriDiagnostic } {
  return {
    ok: false,
    diagnostic: {
      code: "loadGltfFromUri.invalidJson",
      severity: "error",
      uri: url,
      message: errorMessage(error, `glTF URI '${url}' did not contain JSON.`),
    },
  };
}
