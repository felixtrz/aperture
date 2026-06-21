export class ApertureSystemError extends Error {
    code;
    suggestedFix;
    detail;
    constructor(code, message, suggestedFix, detail) {
        super(`${message} Suggested fix: ${suggestedFix}`);
        this.name = "ApertureSystemError";
        this.code = code;
        this.suggestedFix = suggestedFix;
        this.detail = detail;
    }
}
//# sourceMappingURL=errors.js.map