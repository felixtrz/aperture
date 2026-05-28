import {
  createInstanceAttributeLayout,
  type InstanceAttributeLayout,
  type InstanceAttributeLayoutInput,
  type RenderStateDescriptor,
} from "../materials/index.js";
import type {
  RenderAssetAdapter,
  RenderAssetPreparationDiagnostic,
} from "./preparation.js";

export type CustomWgslShaderStage = "vertex" | "fragment";
export type CustomWgslBindingKind =
  | "uniform-buffer"
  | "storage-buffer"
  | "texture"
  | "sampler";

export interface CustomWgslShaderSource {
  readonly code: string;
  readonly vertexEntryPoint: string;
  readonly fragmentEntryPoint: string;
}

export interface CustomWgslBindingDeclaration {
  readonly binding: number;
  readonly kind: CustomWgslBindingKind;
  readonly visibility: readonly CustomWgslShaderStage[];
  readonly label?: string;
}

export interface CustomWgslMaterialSource {
  readonly family: string;
  readonly label: string;
  readonly renderState: RenderStateDescriptor;
  readonly shader: CustomWgslShaderSource;
  readonly bindings?: readonly CustomWgslBindingDeclaration[];
  readonly instanceAttributes?: InstanceAttributeLayoutInput;
}

export interface ValidateCustomMaterialSourceOptions {
  readonly assetKey?: string;
  readonly expectedFamily?: string;
}

export interface PreparedCustomWgslBindingLayoutEntry {
  readonly binding: number;
  readonly kind: CustomWgslBindingKind;
  readonly visibility: readonly CustomWgslShaderStage[];
  readonly label: string;
}

export interface PreparedCustomWgslBindingResourceEntry {
  readonly binding: number;
  readonly kind: CustomWgslBindingKind;
  readonly resourceKey: string;
}

export interface PreparedCustomWgslMaterial {
  readonly resourceFamily: "custom-wgsl-material";
  readonly sourceMaterialKey: string;
  readonly materialKey: string;
  readonly label: string;
  readonly materialFamily: string;
  readonly shader: {
    readonly language: "wgsl";
    readonly moduleKey: string;
    readonly code: string;
    readonly vertexEntryPoint: string;
    readonly fragmentEntryPoint: string;
  };
  readonly pipeline: {
    readonly pipelineKey: string;
    readonly shaderModuleKey: string;
    readonly vertexEntryPoint: string;
    readonly fragmentEntryPoint: string;
    readonly renderState: RenderStateDescriptor;
    readonly instanceAttributes: InstanceAttributeLayout | null;
  };
  readonly bindGroupLayout: {
    readonly resourceKey: string;
    readonly entries: readonly PreparedCustomWgslBindingLayoutEntry[];
  };
  readonly bindGroup: {
    readonly resourceKey: string;
    readonly layoutResourceKey: string;
    readonly entries: readonly PreparedCustomWgslBindingResourceEntry[];
  };
}

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

function createPreparedCustomWgslMaterial(input: {
  readonly source: CustomWgslMaterialSource;
  readonly assetKey: string;
}): PreparedCustomWgslMaterial {
  const shaderHash = stableStringHash(input.source.shader.code);
  const instanceAttributes = createInstanceAttributeLayout(
    input.source.instanceAttributes,
  );
  const moduleKey = `custom-wgsl-module:${input.assetKey}:${shaderHash}`;
  const pipelineKey = customWgslMaterialPipelineKey(
    input.source,
    shaderHash,
    instanceAttributes,
  );
  const bindGroupLayoutResourceKey = `custom-wgsl-bind-group-layout:${input.assetKey}:${pipelineKey}`;
  const bindGroupResourceKey = `custom-wgsl-bind-group:${input.assetKey}:${pipelineKey}`;
  const bindings = [...(input.source.bindings ?? [])].sort(
    (a, b) => a.binding - b.binding,
  );
  const layoutEntries = bindings.map((binding) => ({
    binding: binding.binding,
    kind: binding.kind,
    visibility: [...binding.visibility].sort(),
    label: binding.label ?? `binding-${binding.binding}`,
  }));

  return {
    resourceFamily: "custom-wgsl-material",
    sourceMaterialKey: input.assetKey,
    materialKey: input.assetKey,
    label: input.source.label,
    materialFamily: input.source.family,
    shader: {
      language: "wgsl",
      moduleKey,
      code: input.source.shader.code,
      vertexEntryPoint: input.source.shader.vertexEntryPoint,
      fragmentEntryPoint: input.source.shader.fragmentEntryPoint,
    },
    pipeline: {
      pipelineKey,
      shaderModuleKey: moduleKey,
      vertexEntryPoint: input.source.shader.vertexEntryPoint,
      fragmentEntryPoint: input.source.shader.fragmentEntryPoint,
      renderState: input.source.renderState,
      instanceAttributes,
    },
    bindGroupLayout: {
      resourceKey: bindGroupLayoutResourceKey,
      entries: layoutEntries,
    },
    bindGroup: {
      resourceKey: bindGroupResourceKey,
      layoutResourceKey: bindGroupLayoutResourceKey,
      entries: layoutEntries.map((entry) => ({
        binding: entry.binding,
        kind: entry.kind,
        resourceKey: `${input.assetKey}:binding:${entry.binding}`,
      })),
    },
  };
}

function validateCustomWgslMaterialSource(
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

function customWgslMaterialPipelineKey(
  source: CustomWgslMaterialSource,
  shaderHash: string,
  instanceAttributes: InstanceAttributeLayout | null,
): string {
  return [
    source.family,
    `shader:${shaderHash}`,
    `vs:${source.shader.vertexEntryPoint}`,
    `fs:${source.shader.fragmentEntryPoint}`,
    `instance-attributes:${instanceAttributes?.layoutKey ?? "none"}`,
    `bindings:${(source.bindings ?? [])
      .map((binding) => `${binding.binding}:${binding.kind}`)
      .sort()
      .join(",")}`,
    source.renderState.alphaMode,
    source.renderState.cullMode,
    source.renderState.depth.compare,
    source.renderState.blend.preset,
  ].join("|");
}

function stableStringHash(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
