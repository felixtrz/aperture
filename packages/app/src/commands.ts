export const APERTURE_GENERATED_COMMAND_MESSAGE = "aperture.generated.command";
export const APERTURE_GENERATED_COMMAND_EVENT = "aperture:command";
export const APERTURE_ENTITY_FIND_COMMAND_CHANNEL =
  "aperture.devtools.entity.find";
export const APERTURE_ENTITY_GET_COMMAND_CHANNEL =
  "aperture.devtools.entity.get";
export const APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL =
  "aperture.devtools.entity.setComponent";
export const APERTURE_ENTITY_SNAPSHOT_COMMAND_CHANNEL =
  "aperture.devtools.entity.snapshot";
export const APERTURE_ENTITY_DIFF_COMMAND_CHANNEL =
  "aperture.devtools.entity.diff";
export const APERTURE_ENTITY_HIERARCHY_COMMAND_CHANNEL =
  "aperture.devtools.entity.hierarchy";
export const APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL =
  "aperture.viewport.resize";
export const APERTURE_DEVTOOLS_PROTOCOL_VERSION = 1;
export const APERTURE_DEVTOOLS_REQUEST_MESSAGE = "aperture.devtools.request";
export const APERTURE_DEVTOOLS_RESPONSE_MESSAGE = "aperture.devtools.response";

export interface ApertureGeneratedCommand {
  readonly channel: string;
  readonly payload?: unknown;
}

export interface ApertureViewportResizeCommandPayload {
  readonly width: number;
  readonly height: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly pixelRatio: number;
  readonly aspect: number;
  readonly devicePixelRatio?: number;
  readonly maxPixelRatio?: number;
  readonly pixelRatioSource?: string;
  readonly resizeSource?: string;
  readonly measurementSource?: string;
}

export interface ApertureGeneratedCommandMessage {
  readonly type: typeof APERTURE_GENERATED_COMMAND_MESSAGE;
  readonly command: ApertureGeneratedCommand;
}

export interface ApertureDevtoolsRequest {
  readonly type: typeof APERTURE_DEVTOOLS_REQUEST_MESSAGE;
  readonly version: typeof APERTURE_DEVTOOLS_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly tool: string;
  readonly payload?: unknown;
}

export interface ApertureDevtoolsResponse {
  readonly type: typeof APERTURE_DEVTOOLS_RESPONSE_MESSAGE;
  readonly version: typeof APERTURE_DEVTOOLS_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly diagnostics?: readonly unknown[];
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

export function createApertureDevtoolsRequest(input: {
  readonly requestId: string;
  readonly tool: string;
  readonly payload?: unknown;
}): ApertureDevtoolsRequest {
  return {
    type: APERTURE_DEVTOOLS_REQUEST_MESSAGE,
    version: APERTURE_DEVTOOLS_PROTOCOL_VERSION,
    requestId: input.requestId,
    tool: input.tool,
    ...(Object.prototype.hasOwnProperty.call(input, "payload")
      ? { payload: input.payload }
      : {}),
  };
}

export function createApertureDevtoolsResponse(input: {
  readonly requestId: string;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly diagnostics?: readonly unknown[];
}): ApertureDevtoolsResponse {
  return {
    type: APERTURE_DEVTOOLS_RESPONSE_MESSAGE,
    version: APERTURE_DEVTOOLS_PROTOCOL_VERSION,
    requestId: input.requestId,
    ok: input.ok,
    ...(Object.prototype.hasOwnProperty.call(input, "result")
      ? { result: input.result }
      : {}),
    ...(input.diagnostics === undefined
      ? {}
      : { diagnostics: input.diagnostics }),
  };
}

export function isApertureDevtoolsRequest(
  value: unknown,
): value is ApertureDevtoolsRequest {
  return (
    isRecord(value) &&
    value["type"] === APERTURE_DEVTOOLS_REQUEST_MESSAGE &&
    value["version"] === APERTURE_DEVTOOLS_PROTOCOL_VERSION &&
    typeof value["requestId"] === "string" &&
    value["requestId"].length > 0 &&
    typeof value["tool"] === "string" &&
    value["tool"].length > 0
  );
}

export function isApertureDevtoolsResponse(
  value: unknown,
): value is ApertureDevtoolsResponse {
  return (
    isRecord(value) &&
    value["type"] === APERTURE_DEVTOOLS_RESPONSE_MESSAGE &&
    value["version"] === APERTURE_DEVTOOLS_PROTOCOL_VERSION &&
    typeof value["requestId"] === "string" &&
    value["requestId"].length > 0 &&
    typeof value["ok"] === "boolean"
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
