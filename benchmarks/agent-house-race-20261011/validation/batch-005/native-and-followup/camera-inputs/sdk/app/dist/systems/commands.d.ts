import type { SystemAssetAccess, SystemAssetHandle, SystemAssetKind } from "./assets.js";
export interface CommandAccess {
    requestAsset(idOrHandle: string | SystemAssetHandle<SystemAssetKind>): Promise<void>;
    queue<TCommand>(channel: string, payload: TCommand): void;
    drain<TCommand = unknown>(channel: string): TCommand[];
    summary(): CommandAccessSummary;
}
export interface CommandAccessSummary {
    readonly enqueued: number;
    readonly drained: number;
    readonly queuedByChannel: Readonly<Record<string, number>>;
    readonly lastQueued: CommandChannelEntry | null;
    readonly lastDrained: CommandChannelEntry | null;
    readonly requestedAssets: readonly CommandAssetRequestSummary[];
}
export interface CommandChannelEntry {
    readonly channel: string;
    readonly payload: unknown;
}
export interface CommandAssetRequestSummary {
    readonly id: string;
    readonly status: "pending" | "ready" | "error";
    readonly ready: boolean;
    readonly errorCode?: string;
    readonly message?: string;
}
export declare function createCommandAccess(assets: SystemAssetAccess): CommandAccess;
//# sourceMappingURL=commands.d.ts.map