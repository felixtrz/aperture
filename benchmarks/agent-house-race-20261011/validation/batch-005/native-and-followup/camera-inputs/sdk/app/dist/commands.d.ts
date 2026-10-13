export declare const APERTURE_GENERATED_COMMAND_MESSAGE = "aperture.generated.command";
export declare const APERTURE_GENERATED_COMMAND_EVENT = "aperture:command";
export declare const APERTURE_ENTITY_FIND_COMMAND_CHANNEL = "aperture.devtools.entity.find";
export declare const APERTURE_ENTITY_GET_COMMAND_CHANNEL = "aperture.devtools.entity.get";
export declare const APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL = "aperture.devtools.entity.setComponent";
export declare const APERTURE_ENTITY_SNAPSHOT_COMMAND_CHANNEL = "aperture.devtools.entity.snapshot";
export declare const APERTURE_ENTITY_DIFF_COMMAND_CHANNEL = "aperture.devtools.entity.diff";
export declare const APERTURE_ENTITY_HIERARCHY_COMMAND_CHANNEL = "aperture.devtools.entity.hierarchy";
export declare const APERTURE_VIEWPORT_RESIZE_COMMAND_CHANNEL = "aperture.viewport.resize";
export declare const APERTURE_DEVTOOLS_PROTOCOL_VERSION = 1;
export declare const APERTURE_DEVTOOLS_REQUEST_MESSAGE = "aperture.devtools.request";
export declare const APERTURE_DEVTOOLS_RESPONSE_MESSAGE = "aperture.devtools.response";
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
export declare function createGeneratedCommandMessage(command: ApertureGeneratedCommand): ApertureGeneratedCommandMessage;
export declare function isGeneratedCommandMessage(value: unknown): value is ApertureGeneratedCommandMessage;
export declare function createApertureDevtoolsRequest(input: {
    readonly requestId: string;
    readonly tool: string;
    readonly payload?: unknown;
}): ApertureDevtoolsRequest;
export declare function createApertureDevtoolsResponse(input: {
    readonly requestId: string;
    readonly ok: boolean;
    readonly result?: unknown;
    readonly diagnostics?: readonly unknown[];
}): ApertureDevtoolsResponse;
export declare function isApertureDevtoolsRequest(value: unknown): value is ApertureDevtoolsRequest;
export declare function isApertureDevtoolsResponse(value: unknown): value is ApertureDevtoolsResponse;
export declare function parseGeneratedCommand(value: unknown): ApertureGeneratedCommand | null;
//# sourceMappingURL=commands.d.ts.map