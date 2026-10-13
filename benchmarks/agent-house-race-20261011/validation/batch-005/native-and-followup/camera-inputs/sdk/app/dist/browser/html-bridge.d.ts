export interface ApertureHtmlSlotObserverOptions {
    readonly scope?: ParentNode;
    readonly selector?: string;
    readonly eventTarget?: EventTarget;
    readonly viewportElement?: Element | string | null;
    readonly epsilonPx?: number;
    readonly observeMutations?: boolean;
}
export interface ApertureHtmlSlotObserver {
    flush(reason?: string): void;
    disconnect(): void;
}
export declare function dispatchApertureHtmlEvent(channel: string, payload?: unknown, eventTarget?: EventTarget): void;
export declare function observeApertureHtmlSlots(options?: ApertureHtmlSlotObserverOptions): ApertureHtmlSlotObserver;
//# sourceMappingURL=html-bridge.d.ts.map