import type { StandardMaterialPatch } from "@aperture-engine/render";
import type {
  MaterialAppearancePresetDescriptor,
  MaterialAppearancePresetName,
  SpawnGltfMaterialOverrides,
} from "./types.js";

export const MATERIAL_APPEARANCE_PRESET_VERSION = 1 as const;

/** Public, inspectable preset values. Presets only change uniform-level fields. */
export const MATERIAL_APPEARANCE_PRESETS: Readonly<
  Record<MaterialAppearancePresetName, Readonly<StandardMaterialPatch>>
> = Object.freeze({
  source: Object.freeze({}),
  "painted-stylized": Object.freeze({
    metallicFactor: 0.12,
    roughnessFactor: 0.72,
  }),
  matte: Object.freeze({
    metallicFactor: 0,
    roughnessFactor: 0.95,
  }),
  "preview-safe": Object.freeze({
    metallicFactor: 0.05,
    roughnessFactor: 0.65,
  }),
});

export function createMaterialAppearancePreset(
  name: MaterialAppearancePresetName,
  overrides: StandardMaterialPatch = {},
): MaterialAppearancePresetDescriptor {
  return Object.freeze({
    kind: "material-preset",
    name,
    version: MATERIAL_APPEARANCE_PRESET_VERSION,
    overrides: Object.freeze({ ...overrides }),
  });
}

export function resolveSpawnGltfMaterialOverrides(
  value: SpawnGltfMaterialOverrides | undefined,
): StandardMaterialPatch | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (isMaterialAppearancePreset(value)) {
    return Object.freeze({
      ...MATERIAL_APPEARANCE_PRESETS[value.name],
      ...value.overrides,
    });
  }

  return value;
}

export function isMaterialAppearancePreset(
  value: SpawnGltfMaterialOverrides,
): value is MaterialAppearancePresetDescriptor {
  return (
    "kind" in value &&
    value.kind === "material-preset" &&
    "name" in value &&
    value.name in MATERIAL_APPEARANCE_PRESETS
  );
}
