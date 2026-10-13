import type { StandardMaterialPatch } from "@aperture-engine/render";
import type { MaterialAppearancePresetDescriptor, MaterialAppearancePresetName, SpawnGltfMaterialOverrides } from "./types.js";
export declare const MATERIAL_APPEARANCE_PRESET_VERSION: 1;
/** Public, inspectable preset values. Presets only change uniform-level fields. */
export declare const MATERIAL_APPEARANCE_PRESETS: Readonly<Record<MaterialAppearancePresetName, Readonly<StandardMaterialPatch>>>;
export declare function createMaterialAppearancePreset(name: MaterialAppearancePresetName, overrides?: StandardMaterialPatch): MaterialAppearancePresetDescriptor;
export declare function resolveSpawnGltfMaterialOverrides(value: SpawnGltfMaterialOverrides | undefined): StandardMaterialPatch | undefined;
export declare function isMaterialAppearancePreset(value: SpawnGltfMaterialOverrides): value is MaterialAppearancePresetDescriptor;
//# sourceMappingURL=material-presets.d.ts.map