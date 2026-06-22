type PreparedAppMaterialResourceStatus = "created" | "reused";

type PreparedAppMaterialCacheSummaryFamily =
  | "unlit"
  | "matcap"
  | "standard"
  | "debug-normal";

export interface PreparedAppMaterialResourceUse<TResource> {
  readonly status: PreparedAppMaterialResourceStatus;
  readonly resource: TResource;
}

export interface PreparedAppMaterialResourceReuseCounters {
  materialBuffersCreated: number;
  materialBuffersReused: number;
  preparedMaterialBuffersCreated: number;
  preparedMaterialBuffersReused: number;
  preparedMaterialBindGroupsCreated: number;
  preparedMaterialBindGroupsReused: number;
  bindGroupsCreated: number;
  bindGroupsReused: number;
}

interface PreparedAppMaterialCacheLike {
  readonly resources: ReadonlyMap<string, unknown>;
}

interface PreparedAppMaterialCacheSummaryFamilyReport {
  entries: number;
}

export interface PreparedAppMaterialCacheSummary {
  totalEntries: number;
  families: Record<
    PreparedAppMaterialCacheSummaryFamily,
    PreparedAppMaterialCacheSummaryFamilyReport
  >;
}

export interface PreparedAppMaterialCacheSummaryInput {
  readonly unlit: PreparedAppMaterialCacheLike;
  readonly matcap: PreparedAppMaterialCacheLike;
  readonly standard: PreparedAppMaterialCacheLike;
  readonly debugNormal: PreparedAppMaterialCacheLike;
}

type PreparedAppMaterialFallbackReason =
  | "missing-layout"
  | "missing-prepared-dependency"
  | "helper-failed"
  | "adapter-mismatch";

type PreparedAppMaterialFallbackJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly PreparedAppMaterialFallbackJsonValue[]
  | { readonly [key: string]: PreparedAppMaterialFallbackJsonValue };

export interface PreparedAppMaterialFallbackDiagnostic {
  readonly code: "webGpuApp.preparedMaterialFallback";
  readonly materialFamily: PreparedAppMaterialCacheSummaryFamily;
  readonly materialKey: string;
  readonly reason: PreparedAppMaterialFallbackReason;
  readonly diagnostics: readonly PreparedAppMaterialFallbackJsonValue[];
  readonly message: string;
}

export interface CreatePreparedAppMaterialFallbackDiagnosticOptions {
  readonly materialFamily: PreparedAppMaterialCacheSummaryFamily;
  readonly materialKey: string;
  readonly status: string;
  readonly diagnostics: readonly unknown[];
}

export function recordPreparedAppMaterialResourceUse(
  counters: PreparedAppMaterialResourceReuseCounters,
  use: PreparedAppMaterialResourceUse<unknown>,
  totalBindGroupCount: number,
): void {
  if (use.status === "reused") {
    counters.materialBuffersReused += 1;
    counters.bindGroupsReused += 1;
    counters.preparedMaterialBuffersReused += 1;
    counters.preparedMaterialBindGroupsReused += 1;
  } else {
    counters.materialBuffersCreated += 1;
    counters.bindGroupsCreated += 1;
    counters.preparedMaterialBuffersCreated += 1;
    counters.preparedMaterialBindGroupsCreated += 1;
  }

  counters.bindGroupsCreated += Math.max(0, totalBindGroupCount - 1);
}

export function createPreparedAppMaterialCacheSummary(): PreparedAppMaterialCacheSummary {
  return {
    totalEntries: 0,
    families: {
      unlit: { entries: 0 },
      matcap: { entries: 0 },
      standard: { entries: 0 },
      "debug-normal": { entries: 0 },
    },
  };
}

export function writePreparedAppMaterialCacheSummary(
  summary: PreparedAppMaterialCacheSummary,
  input: PreparedAppMaterialCacheSummaryInput,
): PreparedAppMaterialCacheSummary {
  const unlitEntries = input.unlit.resources.size;
  const matcapEntries = input.matcap.resources.size;
  const standardEntries = input.standard.resources.size;
  const debugNormalEntries = input.debugNormal.resources.size;

  summary.families.unlit.entries = unlitEntries;
  summary.families.matcap.entries = matcapEntries;
  summary.families.standard.entries = standardEntries;
  summary.families["debug-normal"].entries = debugNormalEntries;
  summary.totalEntries =
    unlitEntries + matcapEntries + standardEntries + debugNormalEntries;

  return summary;
}

export function createPreparedAppMaterialFallbackDiagnostic(
  options: CreatePreparedAppMaterialFallbackDiagnosticOptions,
): PreparedAppMaterialFallbackDiagnostic | null {
  if (options.status === "skipped" || options.diagnostics.length === 0) {
    return null;
  }

  const reason = preparedAppMaterialFallbackReason(options.diagnostics);

  return {
    code: "webGpuApp.preparedMaterialFallback",
    materialFamily: options.materialFamily,
    materialKey: options.materialKey,
    reason,
    diagnostics: options.diagnostics.map((diagnostic) =>
      toPreparedAppMaterialFallbackJsonValue(diagnostic),
    ),
    message: `Prepared ${options.materialFamily} material resource creation failed for '${options.materialKey}' and fell back to direct frame-resource creation.`,
  };
}

function preparedAppMaterialFallbackReason(
  diagnostics: readonly unknown[],
): PreparedAppMaterialFallbackReason {
  for (const diagnostic of diagnostics) {
    const code = diagnosticCode(diagnostic);

    if (code === null) {
      continue;
    }

    if (code.endsWith(".missingLayout")) {
      return "missing-layout";
    }

    if (
      code.endsWith(".missingTextureResource") ||
      code.endsWith(".missingSamplerResource")
    ) {
      return "missing-prepared-dependency";
    }

    if (code.includes(".not") || code.includes("unsupportedMaterialKind")) {
      return "adapter-mismatch";
    }
  }

  return "helper-failed";
}

function diagnosticCode(diagnostic: unknown): string | null {
  if (typeof diagnostic !== "object" || diagnostic === null) {
    return null;
  }

  const code = (diagnostic as { readonly code?: unknown }).code;

  return typeof code === "string" ? code : null;
}

function toPreparedAppMaterialFallbackJsonValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): PreparedAppMaterialFallbackJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map((entry) =>
      toPreparedAppMaterialFallbackJsonValue(entry, seen),
    );
  }

  if (typeof value !== "object") {
    return null;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  const result: Record<string, PreparedAppMaterialFallbackJsonValue> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (
      entry === undefined ||
      typeof entry === "function" ||
      typeof entry === "symbol" ||
      typeof entry === "bigint"
    ) {
      continue;
    }

    result[key] = toPreparedAppMaterialFallbackJsonValue(entry, seen);
  }

  return result;
}
