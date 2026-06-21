export class ApertureConfigError extends Error {
    code;
    suggestedFix;
    constructor(code, message, suggestedFix) {
        super(`${message} Suggested fix: ${suggestedFix}`);
        this.name = "ApertureConfigError";
        this.code = code;
        this.suggestedFix = suggestedFix;
    }
}
//# sourceMappingURL=errors.js.map