import type { CommandAccess } from "./commands.js";
import { type ResourceStore } from "./resources.js";
export declare const APERTURE_HTML_BRIDGE_COMMAND_CHANNEL = "aperture.html.bridge";
export declare const APERTURE_HTML_EVENT_CHANNEL_PREFIX = "aperture.html.event.";
export interface HtmlBridgeRect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
}
export interface HtmlBridgeViewport {
    readonly width: number;
    readonly height: number;
    readonly devicePixelRatio: number;
    readonly scrollX: number;
    readonly scrollY: number;
    readonly rect?: HtmlBridgeRect;
}
export interface HtmlSlotSnapshot {
    readonly slot: string;
    readonly rect: HtmlBridgeRect;
    readonly viewport: HtmlBridgeViewport;
    readonly visible: boolean;
    readonly sequence: number;
    readonly time: number;
    readonly reason?: string;
}
export type HtmlBridgeCommand = {
    readonly kind: "slot";
    readonly slot: string;
    readonly rect: HtmlBridgeRect;
    readonly viewport: HtmlBridgeViewport;
    readonly visible: boolean;
    readonly sequence?: number;
    readonly time?: number;
    readonly reason?: string;
} | {
    readonly kind: "remove-slot";
    readonly slot: string;
    readonly sequence?: number;
    readonly time?: number;
    readonly reason?: string;
};
export interface HtmlBridgeState {
    readonly slots: Record<string, HtmlSlotSnapshot>;
}
export interface HtmlBridgeAccess {
    slot(slot: string): HtmlSlotSnapshot | null;
    slots(): readonly HtmlSlotSnapshot[];
    eventChannel(name: string): string;
}
export declare const HtmlBridgeStateResource: import("./resources.js").ApertureResourceDescriptor<import("./resources.js").ApertureResourceStateFromSchema<{
    readonly slots: import("./resources.js").ApertureResourceField<Record<string, HtmlSlotSnapshot>>;
}>>;
export declare function createHtmlBridgeAccess(resources: ResourceStore): HtmlBridgeAccess;
export declare function htmlEventChannel(name: string): string;
export declare function runHtmlBridgeFrame(input: {
    readonly commands: CommandAccess;
    readonly resources: ResourceStore;
}): boolean;
//# sourceMappingURL=html-bridge.d.ts.map