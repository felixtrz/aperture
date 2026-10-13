import { type ProceduralSkyPacket, type RenderSnapshot } from "@aperture-engine/render";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuAppResourceReuseReport } from "./app.js";
interface WebGpuAppProceduralSkyContext {
    readonly initialization: {
        readonly device: unknown;
        readonly format: string;
    };
    readonly sceneRenderFormat?: string;
    readonly msaa: {
        readonly sampleCount: number;
    };
}
interface ProceduralSkyFrameCommands {
    readonly valid: boolean;
    readonly commands: readonly RenderPassCommand[];
    readonly diagnostics: readonly unknown[];
}
export declare function writeProceduralSkyCommandsForView(options: {
    readonly app: WebGpuAppProceduralSkyContext;
    readonly cache: WebGpuAppResourceCache;
    readonly snapshot: RenderSnapshot;
    readonly view: RenderSnapshot["views"][number];
    readonly target: RenderPassCommand[];
    readonly reuse: WebGpuAppResourceReuseReport;
}): Promise<ProceduralSkyFrameCommands>;
export declare function createProceduralSkyUniformData(input: {
    readonly snapshot: RenderSnapshot;
    readonly view: RenderSnapshot["views"][number];
    readonly sky: ProceduralSkyPacket;
    readonly diagnostics?: unknown[];
}): Float32Array | null;
export {};
//# sourceMappingURL=procedural-sky.d.ts.map