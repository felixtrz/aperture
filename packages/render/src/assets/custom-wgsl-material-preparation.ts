import type {
  RenderAssetAdapter,
  RenderAssetPreparationDiagnostic,
} from "./preparation-types.js";
import { createPreparedCustomWgslMaterial } from "./custom-wgsl-material-prepared.js";
import {
  validateCustomWgslMaterialSource,
  type ValidateCustomMaterialSourceOptions,
} from "./custom-wgsl-material-validation.js";
import type {
  CustomWgslMaterialSource,
  PreparedCustomWgslMaterial,
} from "./custom-wgsl-material-types.js";

export type {
  CustomWgslBindingDeclaration,
  CustomWgslBindingKind,
  CustomWgslMaterialSource,
  CustomWgslShaderSource,
  CustomWgslShaderStage,
  PreparedCustomWgslBindingLayoutEntry,
  PreparedCustomWgslBindingResourceEntry,
  PreparedCustomWgslMaterial,
} from "./custom-wgsl-material-types.js";
export type { ValidateCustomMaterialSourceOptions } from "./custom-wgsl-material-validation.js";

export function createCustomWgslMaterialRenderAssetAdapter(
  family: string,
): RenderAssetAdapter<
  "material",
  CustomWgslMaterialSource,
  PreparedCustomWgslMaterial
> {
  return {
    kind: "material",
    family,
    prepare(input) {
      if (!input.dependencyState.ready) {
        return {
          status: "retry",
          diagnostics: input.dependencyState.diagnostics.map((diagnostic) => ({
            code: `renderAsset.${diagnostic.code}`,
            message: diagnostic.message,
            severity: "warning",
            assetKey: input.assetKey,
            dependencyKey: diagnostic.dependencyKey,
          })),
        };
      }

      const diagnostics = validateCustomMaterialSource(input.source, {
        assetKey: input.assetKey,
        expectedFamily: family,
      });

      if (diagnostics.length > 0) {
        return {
          status: "failed",
          diagnostics,
        };
      }

      return {
        status: "prepared",
        prepared: createPreparedCustomWgslMaterial({
          source: input.source,
          assetKey: input.assetKey,
        }),
      };
    },
    unload(input) {
      return {
        diagnostics: [
          {
            code: "renderAsset.customWgslMaterial.unloaded",
            message: `Custom WGSL material '${input.assetKey}' was unloaded.`,
            severity: "info",
            assetKey: input.assetKey,
          },
        ],
      };
    },
  };
}

export function validateCustomMaterialSource(
  source: CustomWgslMaterialSource,
  options: ValidateCustomMaterialSourceOptions = {},
): readonly RenderAssetPreparationDiagnostic[] {
  return validateCustomWgslMaterialSource(
    source,
    options.assetKey ?? "material:custom-material",
    options.expectedFamily ?? source.family,
  );
}
