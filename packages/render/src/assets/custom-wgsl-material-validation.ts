import type { RenderAssetPreparationDiagnostic } from "./preparation-types.js";
import type {
  CustomWgslBindingDeclaration,
  CustomWgslMaterialSource,
} from "./custom-wgsl-material-types.js";

export interface ValidateCustomMaterialSourceOptions {
  readonly assetKey?: string;
  readonly expectedFamily?: string;
}

export function validateCustomWgslMaterialSource(
  source: CustomWgslMaterialSource,
  assetKey: string,
  expectedFamily: string,
): readonly RenderAssetPreparationDiagnostic[] {
  const diagnostics: RenderAssetPreparationDiagnostic[] = [];

  if (source.family !== expectedFamily) {
    diagnostics.push({
      code: "renderAsset.customWgslMaterial.familyMismatch",
      message: `Custom WGSL material '${assetKey}' uses family '${source.family}', expected '${expectedFamily}'.`,
      severity: "error",
      assetKey,
    });
  }

  if (source.label.trim().length === 0) {
    diagnostics.push({
      code: "renderAsset.customWgslMaterial.invalidLabel",
      message: `Custom WGSL material '${assetKey}' must provide a label.`,
      severity: "error",
      assetKey,
    });
  }

  if (
    !containsWgslEntrypoint(source.shader.code, source.shader.vertexEntryPoint)
  ) {
    diagnostics.push({
      code: "renderAsset.customWgslMaterial.missingVertexEntryPoint",
      message: `Custom WGSL material '${assetKey}' is missing vertex entry point '${source.shader.vertexEntryPoint}'.`,
      severity: "error",
      assetKey,
    });
  }

  if (
    !containsWgslEntrypoint(
      source.shader.code,
      source.shader.fragmentEntryPoint,
    )
  ) {
    diagnostics.push({
      code: "renderAsset.customWgslMaterial.missingFragmentEntryPoint",
      message: `Custom WGSL material '${assetKey}' is missing fragment entry point '${source.shader.fragmentEntryPoint}'.`,
      severity: "error",
      assetKey,
    });
  }

  validateCustomWgslBindings(source.bindings ?? [], assetKey, diagnostics);

  return diagnostics;
}

function validateCustomWgslBindings(
  bindings: readonly CustomWgslBindingDeclaration[],
  assetKey: string,
  diagnostics: RenderAssetPreparationDiagnostic[],
): void {
  const seen = new Set<number>();

  for (const binding of bindings) {
    if (!Number.isInteger(binding.binding) || binding.binding < 0) {
      diagnostics.push({
        code: "renderAsset.customWgslMaterial.invalidBinding",
        message: `Custom WGSL material '${assetKey}' has an invalid binding index '${binding.binding}'.`,
        severity: "error",
        assetKey,
      });
      continue;
    }

    if (seen.has(binding.binding)) {
      diagnostics.push({
        code: "renderAsset.customWgslMaterial.duplicateBinding",
        message: `Custom WGSL material '${assetKey}' declares binding ${binding.binding} more than once.`,
        severity: "error",
        assetKey,
      });
    }
    seen.add(binding.binding);

    if (binding.visibility.length === 0) {
      diagnostics.push({
        code: "renderAsset.customWgslMaterial.invalidBindingVisibility",
        message: `Custom WGSL material '${assetKey}' binding ${binding.binding} must be visible to at least one shader stage.`,
        severity: "error",
        assetKey,
      });
    }
  }
}

function containsWgslEntrypoint(code: string, entryPoint: string): boolean {
  return new RegExp(`\\bfn\\s+${escapeRegExp(entryPoint)}\\s*\\(`).test(code);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
