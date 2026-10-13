import type { UnlitMaterialResourceDependencies } from "@aperture-engine/render";

export type MaterialDependencyReadinessDiagnosticCode =
  | "materialDependency.missingTextureResource"
  | "materialDependency.missingSamplerResource";

export interface MaterialDependencyReadinessDiagnostic {
  readonly code: MaterialDependencyReadinessDiagnosticCode;
  readonly message: string;
  readonly resourceKey: string;
}

export interface MaterialDependencyReadinessInput {
  readonly dependencies: UnlitMaterialResourceDependencies;
  readonly availableTextureKeys: ReadonlySet<string>;
  readonly availableSamplerKeys: ReadonlySet<string>;
}

export interface MaterialDependencyReadinessReport {
  readonly ready: boolean;
  readonly diagnostics: readonly MaterialDependencyReadinessDiagnostic[];
}

export function checkMaterialDependencyReadiness(
  input: MaterialDependencyReadinessInput,
): MaterialDependencyReadinessReport {
  const diagnostics: MaterialDependencyReadinessDiagnostic[] = [];

  if (
    input.dependencies.baseColorTextureKey !== null &&
    !input.availableTextureKeys.has(input.dependencies.baseColorTextureKey)
  ) {
    diagnostics.push({
      code: "materialDependency.missingTextureResource",
      resourceKey: input.dependencies.baseColorTextureKey,
      message: `Missing texture resource '${input.dependencies.baseColorTextureKey}'.`,
    });
  }

  if (
    input.dependencies.baseColorSamplerKey !== null &&
    !input.availableSamplerKeys.has(input.dependencies.baseColorSamplerKey)
  ) {
    diagnostics.push({
      code: "materialDependency.missingSamplerResource",
      resourceKey: input.dependencies.baseColorSamplerKey,
      message: `Missing sampler resource '${input.dependencies.baseColorSamplerKey}'.`,
    });
  }

  return {
    ready: diagnostics.length === 0,
    diagnostics,
  };
}
