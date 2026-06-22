import {
  isBuiltInMaterialKind,
  isValidCustomMaterialFamilyKey,
  type CustomWgslMaterialAsset,
  type CustomWgslShaderStage,
  type JsonValue,
  type MaterialAlphaMode,
  type MaterialCullMode,
  type MaterialFrontFace,
} from "../materials/index.js";
import type { RenderAssetPreparationDiagnostic } from "./preparation-types.js";

type CustomWgslMaterialSource = CustomWgslMaterialAsset;

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

  validateLiveRendererObjects(source, assetKey, diagnostics);
  validateSourceDiscriminator(source, assetKey, diagnostics);
  validateFamilyKey(source, assetKey, expectedFamily, diagnostics);
  validateLabel(source, assetKey, diagnostics);
  validateShader(source, assetKey, diagnostics);
  validateEntryPoints(source, assetKey, diagnostics);
  validateRenderState(source, assetKey, diagnostics);
  validatePipelineKeyInput(source, assetKey, diagnostics);
  validateBindings(
    (source as { readonly bindings?: unknown }).bindings,
    assetKey,
    diagnostics,
  );
  validateDependencies(
    (source as { readonly dependencies?: unknown }).dependencies,
    assetKey,
    diagnostics,
  );
  validateMetadata(source.metadata, assetKey, diagnostics);

  return diagnostics;
}

function validateSourceDiscriminator(
  source: CustomWgslMaterialSource,
  assetKey: string,
  diagnostics: RenderAssetPreparationDiagnostic[],
): void {
  if (
    source.sourceDiscriminator === "custom-material-source" &&
    source.shaderLanguage === "wgsl"
  ) {
    return;
  }

  diagnostics.push({
    code: "customMaterialSource.invalidDiscriminator",
    message: `Custom material '${assetKey}' must use sourceDiscriminator 'custom-material-source' and shaderLanguage 'wgsl'.`,
    severity: "error",
    assetKey,
  });
}

function validateFamilyKey(
  source: CustomWgslMaterialSource,
  assetKey: string,
  expectedFamily: string,
  diagnostics: RenderAssetPreparationDiagnostic[],
): void {
  if (typeof source.familyKey !== "string") {
    diagnostics.push({
      code: "customMaterialSource.invalidFamilyKey",
      message: `Custom material '${assetKey}' must provide a namespaced familyKey.`,
      severity: "error",
      assetKey,
    });
    return;
  }

  if (isBuiltInMaterialKind(source.familyKey)) {
    diagnostics.push({
      code: "customMaterialSource.reservedFamilyKey",
      message: `Custom material '${assetKey}' familyKey '${source.familyKey}' is reserved for a built-in material family.`,
      severity: "error",
      assetKey,
    });
    return;
  }

  if (!isValidCustomMaterialFamilyKey(source.familyKey)) {
    diagnostics.push({
      code: "customMaterialSource.invalidFamilyKey",
      message: `Custom material '${assetKey}' familyKey '${source.familyKey}' must be namespaced and must not contain '|'.`,
      severity: "error",
      assetKey,
    });
    return;
  }

  if (source.familyKey !== expectedFamily) {
    diagnostics.push({
      code: "customMaterialSource.invalidFamilyKey",
      message: `Custom material '${assetKey}' uses familyKey '${source.familyKey}', expected '${expectedFamily}'.`,
      severity: "error",
      assetKey,
    });
  }
}

function validateLabel(
  source: CustomWgslMaterialSource,
  assetKey: string,
  diagnostics: RenderAssetPreparationDiagnostic[],
): void {
  if (typeof source.label === "string" && source.label.trim().length > 0) {
    return;
  }

  diagnostics.push({
    code: "customMaterialSource.invalidLabel",
    message: `Custom material '${assetKey}' must provide a non-empty label.`,
    severity: "warning",
    assetKey,
  });
}

function validateShader(
  source: CustomWgslMaterialSource,
  assetKey: string,
  diagnostics: RenderAssetPreparationDiagnostic[],
): void {
  if (typeof source.shader !== "object" || source.shader === null) {
    diagnostics.push({
      code: "customMaterialSource.invalidDependency",
      message: `Custom material '${assetKey}' shader must be an inline WGSL source or shader asset handle.`,
      severity: "error",
      assetKey,
    });
    return;
  }

  if (source.shader.kind === "inline-wgsl") {
    if (
      typeof source.shader.code !== "string" ||
      source.shader.code.trim().length === 0
    ) {
      diagnostics.push({
        code: "customMaterialSource.invalidDependency",
        message: `Custom material '${assetKey}' inline WGSL source must be non-empty.`,
        severity: "error",
        assetKey,
      });
    }
    return;
  }

  if (
    source.shader.kind === "shader-asset" &&
    source.shader.handle?.kind === "shader"
  ) {
    return;
  }

  diagnostics.push({
    code: "customMaterialSource.invalidDependency",
    message: `Custom material '${assetKey}' shader must be an inline WGSL source or shader asset handle.`,
    severity: "error",
    assetKey,
  });
}

function validateEntryPoints(
  source: CustomWgslMaterialSource,
  assetKey: string,
  diagnostics: RenderAssetPreparationDiagnostic[],
): void {
  const vertex = source.entryPoints?.vertex;
  const fragment = source.entryPoints?.fragment;

  validateEntryPointName(vertex, "entryPoints.vertex", assetKey, diagnostics);
  validateEntryPointName(
    fragment,
    "entryPoints.fragment",
    assetKey,
    diagnostics,
  );

  if (
    source.shader?.kind !== "inline-wgsl" ||
    typeof source.shader.code !== "string" ||
    typeof vertex !== "string" ||
    typeof fragment !== "string"
  ) {
    return;
  }

  if (!containsWgslEntrypoint(source.shader.code, vertex)) {
    diagnostics.push({
      code: "customMaterialSource.invalidDependency",
      message: `Custom material '${assetKey}' is missing vertex entry point '${vertex}'.`,
      severity: "error",
      assetKey,
    });
  }

  if (!containsWgslEntrypoint(source.shader.code, fragment)) {
    diagnostics.push({
      code: "customMaterialSource.invalidDependency",
      message: `Custom material '${assetKey}' is missing fragment entry point '${fragment}'.`,
      severity: "error",
      assetKey,
    });
  }
}

function validateEntryPointName(
  value: unknown,
  field: string,
  assetKey: string,
  diagnostics: RenderAssetPreparationDiagnostic[],
): void {
  if (typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    return;
  }

  diagnostics.push({
    code: "customMaterialSource.invalidDependency",
    message: `Custom material '${assetKey}' ${field} must be a WGSL function name.`,
    severity: "error",
    assetKey,
  });
}

function validateRenderState(
  source: CustomWgslMaterialSource,
  assetKey: string,
  diagnostics: RenderAssetPreparationDiagnostic[],
): void {
  const renderState = source.renderState;

  if (
    typeof renderState !== "object" ||
    renderState === null ||
    !isAlphaMode(renderState.alphaMode) ||
    !Number.isFinite(renderState.alphaCutoff) ||
    renderState.alphaCutoff < 0 ||
    renderState.alphaCutoff > 1 ||
    !isCullMode(renderState.cullMode) ||
    !isFrontFace(renderState.frontFace) ||
    typeof renderState.depth?.test !== "boolean" ||
    typeof renderState.depth.write !== "boolean" ||
    typeof renderState.depth.compare !== "string" ||
    typeof renderState.blend?.preset !== "string" ||
    typeof renderState.colorWriteMask !== "string"
  ) {
    diagnostics.push({
      code: "customMaterialSource.invalidRenderState",
      message: `Custom material '${assetKey}' has an invalid renderState descriptor.`,
      severity: "error",
      assetKey,
    });
  }
}

function isAlphaMode(value: unknown): value is MaterialAlphaMode {
  return value === "opaque" || value === "mask" || value === "blend";
}

function isCullMode(value: unknown): value is MaterialCullMode {
  return value === "back" || value === "front" || value === "none";
}

function isFrontFace(value: unknown): value is MaterialFrontFace {
  return value === "ccw" || value === "cw";
}

function validatePipelineKeyInput(
  source: CustomWgslMaterialSource,
  assetKey: string,
  diagnostics: RenderAssetPreparationDiagnostic[],
): void {
  if (typeof source.pipelineKey !== "object" || source.pipelineKey === null) {
    diagnostics.push({
      code: "customMaterialSource.invalidPipelineKeyInput",
      message: `Custom material '${assetKey}' pipelineKey must be an object.`,
      severity: "error",
      assetKey,
    });
    return;
  }

  if (
    !Array.isArray(source.pipelineKey.features) ||
    !source.pipelineKey.features.every(
      (feature: unknown) => typeof feature === "string",
    )
  ) {
    diagnostics.push({
      code: "customMaterialSource.invalidPipelineKeyInput",
      message: `Custom material '${assetKey}' pipelineKey.features must be an array of strings.`,
      severity: "error",
      assetKey,
    });
  }

  if (!isJsonRecord(source.pipelineKey.specialization)) {
    diagnostics.push({
      code: "customMaterialSource.invalidPipelineKeyInput",
      message: `Custom material '${assetKey}' pipelineKey.specialization must be JSON-safe primitive values.`,
      severity: "error",
      assetKey,
    });
  }
}

function validateBindings(
  bindings: unknown,
  assetKey: string,
  diagnostics: RenderAssetPreparationDiagnostic[],
): void {
  if (!Array.isArray(bindings)) {
    diagnostics.push(invalidBinding(assetKey, "bindings must be an array."));
    return;
  }

  const seen = new Set<number>();

  for (const binding of bindings) {
    if (
      typeof binding.name !== "string" ||
      binding.name.trim().length === 0 ||
      !Number.isInteger(binding.binding) ||
      binding.binding < 0 ||
      seen.has(binding.binding) ||
      !isBindingKind(binding.kind) ||
      !validVisibility(binding.visibility)
    ) {
      diagnostics.push(
        invalidBinding(
          assetKey,
          `binding ${String(binding.binding)} is malformed or duplicated.`,
        ),
      );
      continue;
    }

    seen.add(binding.binding);

    if (binding.kind === "uniform-buffer") {
      if (
        typeof binding.fields !== "object" ||
        binding.fields === null ||
        Object.keys(binding.fields).length === 0 ||
        (binding.values !== undefined && !isJsonRecord(binding.values)) ||
        (binding.runtimeUniformKey !== undefined &&
          (typeof binding.runtimeUniformKey !== "string" ||
            binding.runtimeUniformKey.trim().length === 0))
      ) {
        diagnostics.push(
          invalidBinding(
            assetKey,
            `uniform binding '${binding.name}' must declare fields, JSON-safe values, and a valid runtimeUniformKey.`,
          ),
        );
      }
    }

    if (
      binding.kind === "texture" &&
      (binding.texture === null ||
        typeof binding.texture !== "object" ||
        binding.texture.kind !== "texture")
    ) {
      diagnostics.push(
        invalidBinding(
          assetKey,
          `texture binding '${binding.name}' must reference a texture handle.`,
        ),
      );
    }

    if (
      binding.kind === "sampler" &&
      (binding.sampler === null ||
        typeof binding.sampler !== "object" ||
        binding.sampler.kind !== "sampler")
    ) {
      diagnostics.push(
        invalidBinding(
          assetKey,
          `sampler binding '${binding.name}' must reference a sampler handle.`,
        ),
      );
    }
  }
}

function isBindingKind(value: unknown): boolean {
  return (
    value === "uniform-buffer" ||
    value === "storage-buffer" ||
    value === "texture" ||
    value === "sampler"
  );
}

function validVisibility(value: readonly CustomWgslShaderStage[]): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((stage) => stage === "vertex" || stage === "fragment")
  );
}

function invalidBinding(
  assetKey: string,
  message: string,
): RenderAssetPreparationDiagnostic {
  return {
    code: "customMaterialSource.invalidBindingDeclaration",
    message: `Custom material '${assetKey}' ${message}`,
    severity: "error",
    assetKey,
  };
}

function validateDependencies(
  dependencies: unknown,
  assetKey: string,
  diagnostics: RenderAssetPreparationDiagnostic[],
): void {
  if (!Array.isArray(dependencies)) {
    diagnostics.push(
      invalidDependency(assetKey, "dependencies must be an array."),
    );
    return;
  }

  for (const dependency of dependencies as CustomWgslMaterialSource["dependencies"]) {
    if (dependency.kind === "shader" && dependency.handle?.kind === "shader") {
      continue;
    }

    if (
      dependency.kind === "texture" &&
      dependency.handle?.kind === "texture"
    ) {
      continue;
    }

    if (
      dependency.kind === "sampler" &&
      dependency.handle?.kind === "sampler"
    ) {
      continue;
    }

    diagnostics.push(
      invalidDependency(
        assetKey,
        "dependencies must reference shader, texture, or sampler handles.",
      ),
    );
  }
}

function invalidDependency(
  assetKey: string,
  message: string,
): RenderAssetPreparationDiagnostic {
  return {
    code: "customMaterialSource.invalidDependency",
    message: `Custom material '${assetKey}' ${message}`,
    severity: "error",
    assetKey,
  };
}

function validateMetadata(
  metadata: CustomWgslMaterialSource["metadata"],
  assetKey: string,
  diagnostics: RenderAssetPreparationDiagnostic[],
): void {
  if (metadata === undefined || isJsonRecord(metadata)) {
    return;
  }

  diagnostics.push({
    code: "customMaterialSource.invalidMetadata",
    message: `Custom material '${assetKey}' metadata must be JSON-safe and must not contain typed arrays, functions, maps, sets, promises, or renderer objects.`,
    severity: "warning",
    assetKey,
  });
}

function isJsonRecord(value: unknown): value is Record<string, JsonValue> {
  if (!isPlainObject(value)) {
    return false;
  }

  return Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return typeof value !== "number" || Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  return isJsonRecord(value);
}

function validateLiveRendererObjects(
  value: unknown,
  assetKey: string,
  diagnostics: RenderAssetPreparationDiagnostic[],
): void {
  const seen = new Set<unknown>();
  const path = findFirstLiveRendererObjectPath(value, "source", seen);

  if (path === null) {
    return;
  }

  diagnostics.push({
    code: "customMaterialSource.liveRendererObject",
    message: `Custom material '${assetKey}' contains non-serializable or renderer-owned data at ${path}.`,
    severity: "error",
    assetKey,
  });
}

function findFirstLiveRendererObjectPath(
  value: unknown,
  path: string,
  seen: Set<unknown>,
): string | null {
  if (
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    return path;
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  if (looksLikeAssetHandle(value)) {
    return null;
  }

  if (seen.has(value)) {
    return path;
  }

  seen.add(value);

  if (
    ArrayBuffer.isView(value) ||
    value instanceof ArrayBuffer ||
    value instanceof Map ||
    value instanceof Set ||
    value instanceof WeakMap ||
    value instanceof WeakSet ||
    value instanceof Promise ||
    looksLikeWebGpuObject(value) ||
    (!isPlainObject(value) && !Array.isArray(value))
  ) {
    return path;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const child = findFirstLiveRendererObjectPath(
        value[index],
        `${path}[${index}]`,
        seen,
      );

      if (child !== null) {
        seen.delete(value);
        return child;
      }
    }
    seen.delete(value);
    return null;
  }

  for (const [key, childValue] of Object.entries(value)) {
    const child = findFirstLiveRendererObjectPath(
      childValue,
      `${path}.${key}`,
      seen,
    );

    if (child !== null) {
      seen.delete(value);
      return child;
    }
  }

  seen.delete(value);
  return null;
}

function looksLikeAssetHandle(value: object): boolean {
  return (
    Object.getPrototypeOf(value) === Object.prototype &&
    typeof (value as { readonly kind?: unknown }).kind === "string" &&
    typeof (value as { readonly id?: unknown }).id === "string" &&
    Object.keys(value).every((key) => key === "kind" || key === "id")
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function looksLikeWebGpuObject(value: object): boolean {
  const constructorName = value.constructor?.name ?? "";

  return (
    constructorName.startsWith("GPU") ||
    "createBindGroup" in value ||
    "createRenderPipeline" in value ||
    "createShaderModule" in value ||
    "getBindGroupLayout" in value
  );
}

function containsWgslEntrypoint(code: string, entryPoint: string): boolean {
  return new RegExp(`\\bfn\\s+${escapeRegExp(entryPoint)}\\s*\\(`).test(code);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
