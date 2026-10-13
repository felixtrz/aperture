import { type AssetRegistry } from "@aperture-engine/simulation";
import { type RenderSnapshot } from "@aperture-engine/render";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuAppResourceReuseReport } from "./app.js";
interface WebGpuAppSkyboxContext {
    readonly initialization: {
        readonly device: unknown;
        readonly format: string;
    };
    readonly sceneRenderFormat?: string;
    readonly msaa: {
        readonly sampleCount: number;
    };
}
interface SkyboxFrameCommands {
    readonly valid: boolean;
    readonly commands: readonly RenderPassCommand[];
    readonly diagnostics: readonly unknown[];
}
export declare function writeSkyboxCommandsForView(options: {
    readonly app: WebGpuAppSkyboxContext;
    readonly assets: AssetRegistry;
    readonly cache: WebGpuAppResourceCache;
    readonly snapshot: RenderSnapshot;
    readonly view: RenderSnapshot["views"][number];
    readonly target: RenderPassCommand[];
    readonly reuse: WebGpuAppResourceReuseReport;
}): Promise<SkyboxFrameCommands>;
export {};
//# sourceMappingURL=skybox.d.ts.map