export const APERTURE_GENERATED_COMMAND_MESSAGE = "aperture.generated.command";
export const APERTURE_GENERATED_COMMAND_EVENT = "aperture:command";
export const APERTURE_ENTITY_FIND_COMMAND_CHANNEL = "aperture.devtools.entity.find";
export const APERTURE_ENTITY_GET_COMMAND_CHANNEL = "aperture.devtools.entity.get";
export const APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL = "aperture.devtools.entity.setComponent";
export const APERTURE_ENTITY_SNAPSHOT_COMMAND_CHANNEL = "aperture.devtools.entity.snapshot";
export const APERTURE_ENTITY_DIFF_COMMAND_CHANNEL = "aperture.devtools.entity.diff";
export const APERTURE_ENTITY_HIERARCHY_COMMAND_CHANNEL = "aperture.devtools.entity.hierarchy";
export const APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL = "aperture.viewport.resize";
export const APERTURE_DEVTOOLS_PROTOCOL_VERSION = 1;
export const APERTURE_DEVTOOLS_REQUEST_MESSAGE = "aperture.devtools.request";
export const APERTURE_DEVTOOLS_RESPONSE_MESSAGE = "aperture.devtools.response";
export function createGeneratedCommandMessage(command) {
    return {
        type: APERTURE_GENERATED_COMMAND_MESSAGE,
        command,
    };
}
export function isGeneratedCommandMessage(value) {
    return (typeof value === "object" &&
        value !== null &&
        value.type ===
            APERTURE_GENERATED_COMMAND_MESSAGE &&
        isGeneratedCommand(value.command));
}
export function createApertureDevtoolsRequest(input) {
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
export function createApertureDevtoolsResponse(input) {
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
export function isApertureDevtoolsRequest(value) {
    return (isRecord(value) &&
        value["type"] === APERTURE_DEVTOOLS_REQUEST_MESSAGE &&
        value["version"] === APERTURE_DEVTOOLS_PROTOCOL_VERSION &&
        typeof value["requestId"] === "string" &&
        value["requestId"].length > 0 &&
        typeof value["tool"] === "string" &&
        value["tool"].length > 0);
}
export function isApertureDevtoolsResponse(value) {
    return (isRecord(value) &&
        value["type"] === APERTURE_DEVTOOLS_RESPONSE_MESSAGE &&
        value["version"] === APERTURE_DEVTOOLS_PROTOCOL_VERSION &&
        typeof value["requestId"] === "string" &&
        value["requestId"].length > 0 &&
        typeof value["ok"] === "boolean");
}
export function parseGeneratedCommand(value) {
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
function isGeneratedCommand(value) {
    return parseGeneratedCommand(value) !== null;
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
//# sourceMappingURL=commands.js.map