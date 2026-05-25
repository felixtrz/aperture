export const APERTURE_GENERATED_COMMAND_MESSAGE =
  "aperture.generated.command";
export const APERTURE_GENERATED_COMMAND_EVENT = "aperture:command";

export interface ApertureGeneratedCommand {
  readonly channel: string;
  readonly payload?: unknown;
}

export interface ApertureGeneratedCommandMessage {
  readonly type: typeof APERTURE_GENERATED_COMMAND_MESSAGE;
  readonly command: ApertureGeneratedCommand;
}

export function createGeneratedCommandMessage(
  command: ApertureGeneratedCommand,
): ApertureGeneratedCommandMessage {
  return {
    type: APERTURE_GENERATED_COMMAND_MESSAGE,
    command,
  };
}

export function isGeneratedCommandMessage(
  value: unknown,
): value is ApertureGeneratedCommandMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly type?: unknown }).type ===
      APERTURE_GENERATED_COMMAND_MESSAGE &&
    isGeneratedCommand((value as { readonly command?: unknown }).command)
  );
}

export function parseGeneratedCommand(
  value: unknown,
): ApertureGeneratedCommand | null {
  if (!isRecord(value)) {
    return null;
  }

  const channel = value["channel"];

  if (typeof channel !== "string" || channel.length === 0) {
    return null;
  }

  return {
    channel,
    ...(Object.prototype.hasOwnProperty.call(value, "payload")
      ? { payload: value["payload"] }
      : {}),
  };
}

function isGeneratedCommand(value: unknown): value is ApertureGeneratedCommand {
  return parseGeneratedCommand(value) !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
