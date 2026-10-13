export function jsonSafeValue(value) {
    if (value === undefined) {
        return null;
    }
    try {
        return JSON.parse(JSON.stringify(value));
    }
    catch {
        return String(value);
    }
}
//# sourceMappingURL=json-safe.js.map