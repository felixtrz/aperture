export class ApertureSystemError extends Error {
    code;
    suggestedFix;
    detail;
    constructor(code, message, suggestedFix, detail, options) {
        super(`${message} Suggested fix: ${suggestedFix}`, options);
        this.name = "ApertureSystemError";
        this.code = code;
        this.suggestedFix = suggestedFix;
        this.detail = detail;
    }
}
//# sourceMappingURL=errors.js.map