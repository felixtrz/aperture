import type { AddressInfo } from "node:net";
export declare const APERTURE_VITE_DEVTOOLS_WS_CHANNEL = "aperture:devtools";
export interface ApertureViteDevServer {
    readonly config: {
        readonly root: string;
        readonly server?: {
            readonly host?: string | boolean;
            readonly port?: number;
        };
    };
    readonly httpServer?: {
        address(): string | AddressInfo | null;
        once(event: "listening" | "close", listener: () => void): unknown;
    } | null;
    readonly ws: {
        on?(event: typeof APERTURE_VITE_DEVTOOLS_WS_CHANNEL, listener: (payload: unknown, client: {
            send?(event: string, payload: unknown): void;
        }) => void): void;
        send?(event: string, payload: unknown): void;
    };
}
export declare function registerApertureViteDevtoolsBridge(server: ApertureViteDevServer): void;
export declare function scheduleApertureViteSessionWrite(input: {
    readonly root: string;
    readonly server: ApertureViteDevServer["httpServer"] | null;
    readonly configured: {
        readonly host?: string | boolean;
        readonly port?: number;
    } | undefined;
}): void;
//# sourceMappingURL=dev-session.d.ts.map