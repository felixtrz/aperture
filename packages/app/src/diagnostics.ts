import { jsonSafeValue } from "./internal/json-safe.js";

export interface ApertureGeneratedDiagnosticSource {
  readonly file?: string;
  readonly module?: string;
  readonly asset?: string;
  readonly worker?: string;
  readonly glob?: string;
}

export interface ApertureGeneratedDiagnostic {
  readonly code: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  readonly source?: ApertureGeneratedDiagnosticSource;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly suggestedFix: string;
}

export interface ApertureGeneratedDiagnosticsStatus {
  readonly status: "ok" | "failed";
  readonly diagnostics: readonly ApertureGeneratedDiagnostic[];
}

export interface ApertureDiagnosticFallback {
  readonly code: string;
  readonly message: string;
  readonly severity?: ApertureGeneratedDiagnostic["severity"];
  readonly suggestedFix: string;
  readonly source?: ApertureGeneratedDiagnosticSource;
  readonly data?: Readonly<Record<string, unknown>>;
}

export function createApertureGeneratedDiagnosticsStatus(input: {
  readonly status: "ok" | "failed";
  readonly diagnostics: readonly unknown[];
  readonly fallback?: ApertureDiagnosticFallback;
}): ApertureGeneratedDiagnosticsStatus {
  return {
    status: input.status,
    diagnostics: input.diagnostics.map((diagnostic) =>
      normalizeApertureDiagnostic(diagnostic, input.fallback),
    ),
  };
}

export function createApertureGeneratedFailureStatus(input: {
  readonly error: unknown;
  readonly fallback: ApertureDiagnosticFallback;
}): ApertureGeneratedDiagnosticsStatus {
  return {
    status: "failed",
    diagnostics: [errorToApertureDiagnostic(input.error, input.fallback)],
  };
}

export function normalizeApertureDiagnostic(
  value: unknown,
  fallback: ApertureDiagnosticFallback = {
    code: "aperture.diagnostic.unknown",
    severity: "error",
    message: "Aperture reported an unknown diagnostic.",
    suggestedFix: "Inspect the generated status details and rerun validation.",
  },
): ApertureGeneratedDiagnostic {
  if (!isRecord(value)) {
    return {
      code: fallback.code,
      severity: fallback.severity ?? "error",
      message: fallback.message,
      ...(fallback.source === undefined ? {} : { source: fallback.source }),
      ...(fallback.data === undefined ? {} : { data: fallback.data }),
      suggestedFix: fallback.suggestedFix,
    };
  }

  const data = recordData(value);
  const source = sourceFromDiagnostic(value, fallback.source);

  return {
    code: readString(value["code"], fallback.code),
    severity: readSeverity(value["severity"], fallback.severity ?? "error"),
    message: readString(value["message"], fallback.message),
    ...(source === undefined ? {} : { source }),
    ...(Object.keys(data).length === 0 ? {} : { data }),
    suggestedFix: readString(value["suggestedFix"], fallback.suggestedFix),
  };
}

export function errorToApertureDiagnostic(
  error: unknown,
  fallback: ApertureDiagnosticFallback,
): ApertureGeneratedDiagnostic {
  const source = isRecord(error)
    ? sourceFromDiagnostic(error, fallback.source)
    : fallback.source;
  const detail = isRecord(error) ? readRecord(error["detail"]) : undefined;
  const data = {
    ...(fallback.data ?? {}),
    ...(detail ?? {}),
  };

  return {
    code: isRecord(error)
      ? readString(error["code"], fallback.code)
      : fallback.code,
    severity: fallback.severity ?? "error",
    message: error instanceof Error ? error.message : fallback.message,
    ...(source === undefined ? {} : { source }),
    ...(Object.keys(data).length === 0 ? {} : { data }),
    suggestedFix: isRecord(error)
      ? readString(error["suggestedFix"], fallback.suggestedFix)
      : fallback.suggestedFix,
  };
}

function sourceFromDiagnostic(
  value: Readonly<Record<string, unknown>>,
  fallback: ApertureGeneratedDiagnosticSource | undefined,
): ApertureGeneratedDiagnosticSource | undefined {
  const source = {
    ...(fallback ?? {}),
    ...stringField(value, "file"),
    ...stringField(value, "module"),
    ...stringField(value, "moduleUrl", "module"),
    ...stringField(value, "asset"),
    ...stringField(value, "worker"),
    ...stringField(value, "glob"),
    ...sourceFromDetail(value["detail"]),
  };

  return Object.keys(source).length === 0 ? undefined : source;
}

function sourceFromDetail(detail: unknown): ApertureGeneratedDiagnosticSource {
  if (!isRecord(detail)) {
    return {};
  }

  const output: Record<string, string> = {};
  const index = detail["index"];

  if (Number.isInteger(index)) {
    output["module"] = `systems[${String(index)}]`;
  }

  const asset = detail["asset"];
  if (typeof asset === "string") {
    output["asset"] = asset;
  }

  return output;
}

function recordData(
  value: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const data: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (
      key === "code" ||
      key === "severity" ||
      key === "message" ||
      key === "suggestedFix" ||
      key === "file" ||
      key === "module" ||
      key === "moduleUrl" ||
      key === "asset" ||
      key === "worker" ||
      key === "glob"
    ) {
      continue;
    }

    data[key] = jsonSafeValue(entry);
  }

  return data;
}

function stringField(
  value: Readonly<Record<string, unknown>>,
  key: string,
  outputKey: keyof ApertureGeneratedDiagnosticSource = key as keyof ApertureGeneratedDiagnosticSource,
): Record<string, string> {
  const entry = value[key];

  return typeof entry === "string" && entry.length > 0
    ? { [outputKey]: entry }
    : {};
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readSeverity(
  value: unknown,
  fallback: ApertureGeneratedDiagnostic["severity"],
): ApertureGeneratedDiagnostic["severity"] {
  return value === "info" || value === "warning" || value === "error"
    ? value
    : fallback;
}

function readRecord(
  value: unknown,
): Readonly<Record<string, unknown>> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
