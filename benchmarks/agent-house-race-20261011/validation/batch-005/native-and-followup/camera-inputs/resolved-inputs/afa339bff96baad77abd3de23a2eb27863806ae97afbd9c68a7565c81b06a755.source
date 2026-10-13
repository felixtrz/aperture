import { jsonSafeValue } from "./internal/json-safe.js";
import { diagnosticErrorDetails, normalizedDiagnosticError, } from "./internal/diagnostic-error.js";
export { APERTURE_DIAGNOSTIC_ERROR_LIMITS } from "./internal/diagnostic-error.js";
export function createApertureGeneratedDiagnosticsStatus(input) {
    return {
        status: input.status,
        diagnostics: input.diagnostics.map((diagnostic) => normalizeApertureDiagnostic(diagnostic, input.fallback)),
    };
}
export function createApertureGeneratedFailureStatus(input) {
    return {
        status: "failed",
        diagnostics: [errorToApertureDiagnostic(input.error, input.fallback)],
    };
}
export function normalizeApertureDiagnostic(value, fallback = {
    code: "aperture.diagnostic.unknown",
    severity: "error",
    message: "Aperture reported an unknown diagnostic.",
    suggestedFix: "Inspect the generated status details and rerun validation.",
}) {
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
    const error = normalizedDiagnosticError(value["error"]);
    return {
        code: readString(value["code"], fallback.code),
        severity: readSeverity(value["severity"], fallback.severity ?? "error"),
        message: readString(value["message"], fallback.message),
        ...(source === undefined ? {} : { source }),
        ...(Object.keys(data).length === 0 ? {} : { data }),
        ...(error === undefined ? {} : { error }),
        suggestedFix: readString(value["suggestedFix"], fallback.suggestedFix),
    };
}
export function errorToApertureDiagnostic(error, fallback) {
    const source = isRecord(error)
        ? sourceFromDiagnostic(error, fallback.source)
        : fallback.source;
    const detail = isRecord(error) ? readRecord(error["detail"]) : undefined;
    // ApertureFeatureError carries the per-feature diagnostics that explain the
    // failure; without this they would be dropped at the worker error boundary.
    const attachedDiagnostics = isRecord(error) && Array.isArray(error["diagnostics"])
        ? error["diagnostics"].filter(isRecord)
        : [];
    const data = {
        ...(fallback.data ?? {}),
        ...(detail ?? {}),
        ...(attachedDiagnostics.length === 0
            ? {}
            : { diagnostics: attachedDiagnostics }),
    };
    return {
        code: isRecord(error)
            ? readString(error["code"], fallback.code)
            : fallback.code,
        severity: fallback.severity ?? "error",
        message: error instanceof Error ? error.message : fallback.message,
        ...(source === undefined ? {} : { source }),
        ...(Object.keys(data).length === 0 ? {} : { data }),
        error: diagnosticErrorDetails(error),
        suggestedFix: isRecord(error)
            ? readString(error["suggestedFix"], fallback.suggestedFix)
            : fallback.suggestedFix,
    };
}
function sourceFromDiagnostic(value, fallback) {
    const source = {
        ...(fallback ?? {}),
        ...nestedSource(value["source"]),
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
function nestedSource(value) {
    if (!isRecord(value) || Array.isArray(value))
        return {};
    return {
        ...stringField(value, "file"),
        ...stringField(value, "module"),
        ...stringField(value, "asset"),
        ...stringField(value, "worker"),
        ...stringField(value, "glob"),
    };
}
function isCanonicalSource(value) {
    if (!isRecord(value) || Array.isArray(value))
        return false;
    const known = Object.keys(nestedSource(value)).length;
    return known > 0 && known === Object.keys(value).length;
}
function sourceFromDetail(detail) {
    if (!isRecord(detail)) {
        return {};
    }
    const output = {};
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
function recordData(value) {
    const canonical = readRecord(value["data"]);
    const data = canonical === undefined || Array.isArray(canonical)
        ? {}
        : Object.fromEntries(Object.entries(canonical).map(([key, entry]) => [
            key,
            jsonSafeValue(entry),
        ]));
    for (const [key, entry] of Object.entries(value)) {
        if (key === "code" ||
            key === "severity" ||
            key === "message" ||
            key === "suggestedFix" ||
            key === "file" ||
            key === "module" ||
            key === "moduleUrl" ||
            key === "asset" ||
            key === "worker" ||
            key === "glob" ||
            (key === "data" &&
                canonical !== undefined &&
                !Array.isArray(canonical)) ||
            (key === "source" && isCanonicalSource(entry)) ||
            (key === "error" && normalizedDiagnosticError(entry) !== undefined)) {
            continue;
        }
        data[key] = jsonSafeValue(entry);
    }
    return data;
}
function stringField(value, key, outputKey = key) {
    const entry = value[key];
    return typeof entry === "string" && entry.length > 0
        ? { [outputKey]: entry }
        : {};
}
function readString(value, fallback) {
    return typeof value === "string" && value.length > 0 ? value : fallback;
}
function readSeverity(value, fallback) {
    return value === "info" || value === "warning" || value === "error"
        ? value
        : fallback;
}
function readRecord(value) {
    return isRecord(value) ? value : undefined;
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
//# sourceMappingURL=diagnostics.js.map