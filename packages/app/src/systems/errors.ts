export class ApertureSystemError extends Error {
  readonly code: string;
  readonly suggestedFix: string;
  readonly detail: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: string,
    message: string,
    suggestedFix: string,
    detail?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions,
  ) {
    super(`${message} Suggested fix: ${suggestedFix}`, options);
    this.name = "ApertureSystemError";
    this.code = code;
    this.suggestedFix = suggestedFix;
    this.detail = detail;
  }
}
