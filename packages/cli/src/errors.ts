export class ApertureCliError extends Error {
  readonly code: string;
  readonly exitCode: number;

  constructor(code: string, message: string, exitCode = 1) {
    super(message);
    this.name = "ApertureCliError";
    this.code = code;
    this.exitCode = exitCode;
  }
}
