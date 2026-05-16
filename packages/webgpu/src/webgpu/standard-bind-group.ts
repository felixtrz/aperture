import { bindGroupResourceKey } from "./resource-keys.js";
import type { StandardMaterialResourceDependencies } from "./standard-material-buffer.js";

export type StandardMaterialBindGroupResourceKind =
  | "buffer"
  | "texture-view"
  | "sampler";

export type StandardMaterialTextureSlot =
  | "baseColor"
  | "metallicRoughness"
  | "normal"
  | "occlusion"
  | "emissive";

export type StandardMaterialBindGroupDescriptorDiagnosticCode =
  | "standardMaterialBindGroup.missingMaterialResource"
  | "standardMaterialBindGroup.missingTextureResource"
  | "standardMaterialBindGroup.missingSamplerResource";

export interface StandardMaterialBindGroupDescriptorDiagnostic {
  readonly code: StandardMaterialBindGroupDescriptorDiagnosticCode;
  readonly message: string;
  readonly slot?: StandardMaterialTextureSlot;
  readonly binding?: number;
}

export interface StandardMaterialBindGroupResourceInput {
  readonly materialResourceKey: string | null;
  readonly dependencies: StandardMaterialResourceDependencies;
}

export interface StandardMaterialBindGroupDescriptorEntry {
  readonly group: 2;
  readonly binding: number;
  readonly resourceKey: string;
  readonly resourceKind: StandardMaterialBindGroupResourceKind;
}

export interface StandardMaterialBindGroupDescriptorPlan {
  readonly valid: boolean;
  readonly group: 2;
  readonly resourceKey: string | null;
  readonly entries: readonly StandardMaterialBindGroupDescriptorEntry[];
  readonly diagnostics: readonly StandardMaterialBindGroupDescriptorDiagnostic[];
}

export function createStandardMaterialBindGroupDescriptorPlan(
  input: StandardMaterialBindGroupResourceInput,
): StandardMaterialBindGroupDescriptorPlan {
  const diagnostics: StandardMaterialBindGroupDescriptorDiagnostic[] = [];
  const entries: StandardMaterialBindGroupDescriptorEntry[] = [];

  if (input.materialResourceKey === null) {
    diagnostics.push({
      code: "standardMaterialBindGroup.missingMaterialResource",
      binding: 0,
      message:
        "Standard material bind group planning requires a material uniform buffer resource.",
    });
  } else {
    entries.push({
      group: 2,
      binding: 0,
      resourceKey: input.materialResourceKey,
      resourceKind: "buffer",
    });
  }

  addTexturePair(
    entries,
    diagnostics,
    "baseColor",
    1,
    2,
    input.dependencies.baseColor,
  );
  addTexturePair(
    entries,
    diagnostics,
    "metallicRoughness",
    3,
    4,
    input.dependencies.metallicRoughness,
  );
  addTexturePair(
    entries,
    diagnostics,
    "normal",
    5,
    6,
    input.dependencies.normal,
  );
  addTexturePair(
    entries,
    diagnostics,
    "occlusion",
    7,
    8,
    input.dependencies.occlusion,
  );
  addTexturePair(
    entries,
    diagnostics,
    "emissive",
    9,
    10,
    input.dependencies.emissive,
  );

  return {
    valid: diagnostics.length === 0,
    group: 2,
    resourceKey:
      diagnostics.length === 0
        ? createStandardMaterialBindGroupResourceKey(entries)
        : null,
    entries,
    diagnostics,
  };
}

export function createStandardMaterialBindGroupResourceKey(
  entries: readonly StandardMaterialBindGroupDescriptorEntry[],
): string {
  return bindGroupResourceKey(
    `standard/group-2/${entries
      .slice()
      .sort((a, b) => a.binding - b.binding)
      .map((entry) => `${entry.binding}:${entry.resourceKey}`)
      .join("/")}`,
  );
}

function addTexturePair(
  entries: StandardMaterialBindGroupDescriptorEntry[],
  diagnostics: StandardMaterialBindGroupDescriptorDiagnostic[],
  slot: StandardMaterialTextureSlot,
  textureBinding: number,
  samplerBinding: number,
  dependency: StandardMaterialResourceDependencies[StandardMaterialTextureSlot],
): void {
  const textured =
    dependency.textureKey !== null || dependency.samplerKey !== null;

  if (!textured) {
    return;
  }

  if (dependency.textureKey === null) {
    diagnostics.push({
      code: "standardMaterialBindGroup.missingTextureResource",
      slot,
      binding: textureBinding,
      message: `${slot} texture binding requires a texture resource key.`,
    });
  } else {
    entries.push({
      group: 2,
      binding: textureBinding,
      resourceKey: dependency.textureKey,
      resourceKind: "texture-view",
    });
  }

  if (dependency.samplerKey === null) {
    diagnostics.push({
      code: "standardMaterialBindGroup.missingSamplerResource",
      slot,
      binding: samplerBinding,
      message: `${slot} texture binding requires a sampler resource key.`,
    });
  } else {
    entries.push({
      group: 2,
      binding: samplerBinding,
      resourceKey: dependency.samplerKey,
      resourceKind: "sampler",
    });
  }
}
