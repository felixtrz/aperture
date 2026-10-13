import type { LightRigPresetName, SpawnEnvironmentOptions, SpawnLightOptions } from "./types.js";
export interface LightRigPresetDefinition {
    readonly environment: Readonly<Omit<SpawnEnvironmentOptions, "source">> | null;
    readonly keyLight: Readonly<SpawnLightOptions> | null;
    readonly rimLight: Readonly<SpawnLightOptions> | null;
}
/**
 * Public preset values. These are authoring data, not hidden renderer state;
 * `spawn.lightRig` expands them into ordinary ECS entities.
 */
export declare const LIGHT_RIG_PRESETS: Readonly<Record<LightRigPresetName, LightRigPresetDefinition>>;
//# sourceMappingURL=light-rig-presets.d.ts.map