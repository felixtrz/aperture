import type {
  HarnessStatus,
  RenderBundleMetadata,
  RenderBundleDigestMetadata,
  RenderBundleWebGpuMetadata,
} from "./types.js";

/** Preserve JSON-safe renderer feedback on successful CLI renders. */
export function renderBundleFeedbackMetadata(
  status: Pick<HarnessStatus, "diagnostics" | "shadow" | "shader">,
): Pick<RenderBundleMetadata, "diagnostics" | "shadow" | "shader"> {
  return {
    diagnostics: status.diagnostics ?? [],
    ...(status.shadow === undefined ? {} : { shadow: status.shadow }),
    ...(status.shader === undefined ? {} : { shader: status.shader }),
  };
}

export function readRenderBundleDigestMetadata(
  bundle: unknown,
): RenderBundleDigestMetadata | null {
  if (!isRecord(bundle) || !isRecord(bundle["digest"])) {
    return null;
  }

  const digest = bundle["digest"];
  const algorithm = digest["algorithm"];
  const hash = digest["hash"];
  const byteLength = digest["byteLength"];

  if (
    typeof algorithm !== "string" ||
    typeof hash !== "string" ||
    typeof byteLength !== "number" ||
    !Number.isInteger(byteLength) ||
    byteLength < 0
  ) {
    return null;
  }

  return { algorithm, hash, byteLength };
}

export function normalizeRenderBundleWebGpuMetadata(
  value: unknown,
): RenderBundleWebGpuMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    format: stringOrNull(value["format"]),
    displayColorSpace: stringOrNull(value["displayColorSpace"]),
    adapterInfo: primitiveRecord(value["adapterInfo"]),
    adapterFeatures: sortedStringArray(value["adapterFeatures"]),
    deviceFeatures: sortedStringArray(value["deviceFeatures"]),
  };
}

function sortedStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .sort();
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function primitiveRecord(
  value: unknown,
): Readonly<Record<string, string | number | boolean>> {
  if (!isRecord(value)) {
    return {};
  }

  const output: Record<string, string | number | boolean> = {};

  for (const [key, item] of Object.entries(value)) {
    if (
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean"
    ) {
      output[key] = item;
    }
  }

  return output;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
