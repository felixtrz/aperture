/** String limits count JavaScript string characters; causeRecords includes the root error. */
export const APERTURE_DIAGNOSTIC_ERROR_LIMITS = Object.freeze({
    nameCharacters: 256,
    messageCharacters: 2048,
    stackCharacters: 8192,
    causeRecords: 4,
});
export function diagnosticErrorDetails(value) {
    return errorDetails(value, new Set(), 0);
}
export function normalizedDiagnosticError(value) {
    return isObject(value) && typeof read(value, "message") === "string"
        ? diagnosticErrorDetails(value)
        : undefined;
}
function errorDetails(value, seen, depth) {
    if (isObject(value) && seen.has(value)) {
        return {
            name: "Error",
            message: "[Circular error cause]",
            truncated: true,
        };
    }
    if (isObject(value))
        seen.add(value);
    const rawName = read(value, "name");
    const rawMessage = read(value, "message");
    const rawStack = read(value, "stack");
    const name = typeof rawName === "string" && rawName ? rawName : "Error";
    const message = typeof rawMessage === "string" ? rawMessage : printable(value);
    const stack = typeof rawStack === "string" && rawStack ? rawStack : undefined;
    const hasCause = isObject(value) && has(value, "cause");
    const cause = hasCause && depth + 1 < APERTURE_DIAGNOSTIC_ERROR_LIMITS.causeRecords
        ? errorDetails(read(value, "cause"), seen, depth + 1)
        : undefined;
    const truncated = read(value, "truncated") === true ||
        name.length > APERTURE_DIAGNOSTIC_ERROR_LIMITS.nameCharacters ||
        message.length > APERTURE_DIAGNOSTIC_ERROR_LIMITS.messageCharacters ||
        (stack !== undefined &&
            stack.length > APERTURE_DIAGNOSTIC_ERROR_LIMITS.stackCharacters) ||
        (hasCause && cause === undefined) ||
        cause?.truncated === true;
    return {
        name: bounded(name, APERTURE_DIAGNOSTIC_ERROR_LIMITS.nameCharacters),
        message: bounded(message, APERTURE_DIAGNOSTIC_ERROR_LIMITS.messageCharacters),
        ...(stack === undefined
            ? {}
            : {
                stack: bounded(stack, APERTURE_DIAGNOSTIC_ERROR_LIMITS.stackCharacters),
            }),
        ...(cause === undefined ? {} : { cause }),
        ...(truncated ? { truncated: true } : {}),
    };
}
function bounded(value, limit) {
    return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}
function printable(value) {
    try {
        return String(value);
    }
    catch {
        return "[Unprintable thrown value]";
    }
}
function read(value, key) {
    try {
        return isObject(value) ? value[key] : undefined;
    }
    catch {
        return undefined;
    }
}
function has(value, key) {
    try {
        return key in value;
    }
    catch {
        return false;
    }
}
function isObject(value) {
    return typeof value === "object" && value !== null;
}
//# sourceMappingURL=diagnostic-error.js.map