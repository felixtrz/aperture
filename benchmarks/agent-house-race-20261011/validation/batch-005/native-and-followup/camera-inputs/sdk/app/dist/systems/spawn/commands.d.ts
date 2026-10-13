import { type AssetRegistry, type EcsWorld } from "@aperture-engine/simulation";
import type { SystemAssetAccess } from "../assets.js";
import type { SystemDiagnostics } from "../diagnostics.js";
import type { SpawnCommands } from "./types.js";
export declare function createSpawnCommands(options: {
    readonly world: EcsWorld;
    readonly registry: AssetRegistry;
    readonly diagnostics: SystemDiagnostics;
    readonly assets: SystemAssetAccess;
    /** App-level render defaults applied to spawned entities (#67). */
    readonly renderDefaults?: {
        readonly clearColor?: readonly [number, number, number, number];
    };
}): SpawnCommands;
//# sourceMappingURL=commands.d.ts.map