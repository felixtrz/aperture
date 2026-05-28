export class ApertureConfigError extends Error {
  readonly code: string;
  readonly suggestedFix: string;

  constructor(code: string, message: string, suggestedFix: string) {
    super(`${message} Suggested fix: ${suggestedFix}`);
    this.name = "ApertureConfigError";
    this.code = code;
    this.suggestedFix = suggestedFix;
  }
}
