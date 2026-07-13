// C3 (three.js parity plan): a data-described compute kernel — the compute
// sibling of a custom WGSL material. A `ComputeKernelAsset` pairs a WGSL shader
// ref (inline source or a shader-asset handle) with an entry point and a typed
// `bindings` array that reuses the SAME `CustomWgslBindingDeclaration` union
// custom materials use (uniform-buffer / storage-buffer / texture / sampler).
// It is data-only (DECISIONS 0016): it carries no live GPU objects, so it flows
// through the asset mirror like every other source. The WebGPU backend realizes
// the compute pipeline + bind group from this description (mirroring the custom
// material pipeline realization), so a user dispatches a kernel with typed
// bindings and NEVER calls `createComputePipeline` / `createBindGroup` /
// `createBuffer` themselves.
//
// This is the analog of three.js TSL `wgslFn` / `computeShader` data-described
// compute: the kernel is described as data and dispatched from a command.

import type {
  CustomWgslBindingDeclaration,
  CustomWgslShaderRef,
  CustomWgslShaderStage,
  CustomWgslUniformField,
  CustomWgslUniformFieldType,
  JsonPrimitive,
} from "./types.js";

/**
 * A data-described compute kernel. Shaped like {@link CustomWgslMaterialAsset}
 * but for compute: a shader ref + a single compute `entryPoint` + typed
 * `bindings`. The bindings reuse the custom-material union so uniform packing,
 * storage-buffer realization (C1's writable `BufferAsset`), texture, and sampler
 * wiring are all shared with the material path. Bindings on a compute kernel are
 * bound to `@group(0)`; declare their `binding` numbers accordingly.
 */
export interface ComputeKernelAsset {
  readonly kind: "compute-kernel";
  readonly label: string;
  readonly shader: CustomWgslShaderRef;
  /** WGSL `@compute` entry-point function name (e.g. `"main"`). */
  readonly entryPoint: string;
  readonly bindings: readonly CustomWgslBindingDeclaration[];
}

export interface CreateComputeKernelAssetInput {
  readonly label?: string;
  readonly shader: CustomWgslShaderRef;
  readonly entryPoint?: string;
  readonly bindings?: readonly CustomWgslBindingDeclaration[];
}

/**
 * Build a {@link ComputeKernelAsset} from a partial input. `entryPoint` defaults
 * to `"main"`, `bindings` to `[]`, and `label` to `"Compute Kernel"`.
 */
export function createComputeKernelAsset(
  input: CreateComputeKernelAssetInput,
): ComputeKernelAsset {
  return {
    kind: "compute-kernel",
    label: input.label ?? "Compute Kernel",
    shader: input.shader,
    entryPoint: input.entryPoint ?? "main",
    bindings: input.bindings ?? [],
  };
}

export function isComputeKernelAsset(
  value: unknown,
): value is ComputeKernelAsset {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const asset = value as ComputeKernelAsset;
  return (
    asset.kind === "compute-kernel" &&
    typeof asset.label === "string" &&
    typeof asset.entryPoint === "string" &&
    typeof asset.shader === "object" &&
    asset.shader !== null &&
    Array.isArray(asset.bindings)
  );
}

/**
 * A dispatch's workgroup counts. A bare number is `[x, 1, 1]`; a tuple fills
 * missing dimensions with 1. Each dimension should be a positive integer within
 * the WebGPU `maxComputeWorkgroupsPerDimension` limit (65535).
 */
export type ComputeKernelWorkgroups =
  | number
  | readonly [number]
  | readonly [number, number]
  | readonly [number, number, number];

/** Normalize {@link ComputeKernelWorkgroups} to a `[x, y, z]` triple. */
export function normalizeComputeKernelWorkgroups(
  workgroups: ComputeKernelWorkgroups,
): readonly [number, number, number] {
  if (typeof workgroups === "number") {
    return [workgroups, 1, 1];
  }
  return [workgroups[0], workgroups[1] ?? 1, workgroups[2] ?? 1];
}

export type ComputeKernelDiagnosticCode =
  | "computeKernel.invalidKind"
  | "computeKernel.invalidLabel"
  | "computeKernel.invalidShader"
  | "computeKernel.invalidEntryPoint"
  | "computeKernel.missingEntryPoint"
  | "computeKernel.invalidBindingDeclaration";

export interface ComputeKernelValidationDiagnostic {
  readonly code: ComputeKernelDiagnosticCode;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly field?: string;
}

export interface ComputeKernelValidationReport {
  readonly valid: boolean;
  readonly diagnostics: readonly ComputeKernelValidationDiagnostic[];
}

const WGSL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BINDING_KINDS: readonly CustomWgslBindingDeclaration["kind"][] = [
  "uniform-buffer",
  "storage-buffer",
  "texture",
  "sampler",
];
const SHADER_STAGES: readonly CustomWgslShaderStage[] = [
  "vertex",
  "fragment",
  "compute",
];

/**
 * Validate a {@link ComputeKernelAsset} (the compute analog of
 * `validateCustomWgslMaterialSource`). Checks the kind/label/shader ref/entry
 * point and the typed bindings (unique binding numbers, valid kind, per-kind
 * resource references), and — for an inline source — that the entry point is
 * declared in the WGSL. Returns structured diagnostics rather than throwing, so
 * a malformed kernel degrades loudly at dispatch time instead of a device error.
 */
export function validateComputeKernelAsset(
  asset: ComputeKernelAsset,
  assetKey = asset.label,
): ComputeKernelValidationReport {
  const diagnostics: ComputeKernelValidationDiagnostic[] = [];

  if (asset.kind !== "compute-kernel") {
    diagnostics.push({
      code: "computeKernel.invalidKind",
      severity: "error",
      message: `Compute kernel '${assetKey}' must declare kind 'compute-kernel'.`,
      field: "kind",
    });
  }

  if (typeof asset.label !== "string" || asset.label.trim().length === 0) {
    diagnostics.push({
      code: "computeKernel.invalidLabel",
      severity: "warning",
      message: `Compute kernel '${assetKey}' should provide a non-empty label.`,
      field: "label",
    });
  }

  validateComputeKernelShader(asset, assetKey, diagnostics);
  validateComputeKernelBindings(asset.bindings, assetKey, diagnostics);

  return {
    valid: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    diagnostics,
  };
}

function validateComputeKernelShader(
  asset: ComputeKernelAsset,
  assetKey: string,
  diagnostics: ComputeKernelValidationDiagnostic[],
): void {
  const shader = asset.shader;

  if (typeof shader !== "object" || shader === null) {
    diagnostics.push({
      code: "computeKernel.invalidShader",
      severity: "error",
      message: `Compute kernel '${assetKey}' shader must be an inline WGSL source or a shader-asset handle.`,
      field: "shader",
    });
    return;
  }

  if (shader.kind === "inline-wgsl") {
    if (typeof shader.code !== "string" || shader.code.trim().length === 0) {
      diagnostics.push({
        code: "computeKernel.invalidShader",
        severity: "error",
        message: `Compute kernel '${assetKey}' inline WGSL source must be non-empty.`,
        field: "shader",
      });
    }
  } else if (
    shader.kind !== "shader-asset" ||
    shader.handle?.kind !== "shader"
  ) {
    diagnostics.push({
      code: "computeKernel.invalidShader",
      severity: "error",
      message: `Compute kernel '${assetKey}' shader must be an inline WGSL source or a shader-asset handle.`,
      field: "shader",
    });
  }

  if (
    typeof asset.entryPoint !== "string" ||
    !WGSL_IDENTIFIER.test(asset.entryPoint)
  ) {
    diagnostics.push({
      code: "computeKernel.invalidEntryPoint",
      severity: "error",
      message: `Compute kernel '${assetKey}' entryPoint must be a WGSL function name.`,
      field: "entryPoint",
    });
    return;
  }

  if (
    shader.kind === "inline-wgsl" &&
    typeof shader.code === "string" &&
    !new RegExp(`\\bfn\\s+${asset.entryPoint}\\s*\\(`).test(shader.code)
  ) {
    diagnostics.push({
      code: "computeKernel.missingEntryPoint",
      severity: "error",
      message: `Compute kernel '${assetKey}' is missing compute entry point '${asset.entryPoint}'.`,
      field: "entryPoint",
    });
  }
}

function validateComputeKernelBindings(
  bindings: readonly CustomWgslBindingDeclaration[],
  assetKey: string,
  diagnostics: ComputeKernelValidationDiagnostic[],
): void {
  const invalidBinding = (message: string): void => {
    diagnostics.push({
      code: "computeKernel.invalidBindingDeclaration",
      severity: "error",
      message: `Compute kernel '${assetKey}' ${message}`,
      field: "bindings",
    });
  };

  if (!Array.isArray(bindings)) {
    invalidBinding("bindings must be an array.");
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
      !BINDING_KINDS.includes(binding.kind) ||
      !validComputeKernelVisibility(binding.visibility)
    ) {
      invalidBinding(
        `binding ${String(binding.binding)} ('${String(binding.name)}') is malformed or duplicated.`,
      );
      continue;
    }

    seen.add(binding.binding);

    if (
      binding.kind === "uniform-buffer" &&
      (typeof binding.fields !== "object" ||
        binding.fields === null ||
        Object.keys(binding.fields).length === 0)
    ) {
      invalidBinding(
        `uniform binding '${binding.name}' must declare at least one field.`,
      );
    }

    if (
      binding.kind === "storage-buffer" &&
      (binding.buffer === undefined ||
        binding.buffer === null ||
        binding.buffer.kind !== "buffer")
    ) {
      invalidBinding(
        `storage binding '${binding.name}' must reference a buffer handle.`,
      );
    }

    if (
      binding.kind === "texture" &&
      (binding.texture === undefined ||
        binding.texture === null ||
        binding.texture.kind !== "texture")
    ) {
      invalidBinding(
        `texture binding '${binding.name}' must reference a texture handle.`,
      );
    }

    if (
      binding.kind === "sampler" &&
      (binding.sampler === undefined ||
        binding.sampler === null ||
        binding.sampler.kind !== "sampler")
    ) {
      invalidBinding(
        `sampler binding '${binding.name}' must reference a sampler handle.`,
      );
    }
  }
}

function validComputeKernelVisibility(
  visibility: readonly CustomWgslShaderStage[],
): boolean {
  return (
    Array.isArray(visibility) &&
    visibility.length > 0 &&
    visibility.every((stage) => SHADER_STAGES.includes(stage))
  );
}

// --- std140 uniform packing (shared layout rules with the custom-material
// uniform packer, kept self-contained so the kernel path never depends on the
// material's prepared-material internals). scalar → 4, vec2 → 8, vec3/vec4/
// Color/mat4x4 → 16 alignment; sizes scalar 4, vec2 8, vec3/vec4/Color 16,
// mat4x4 64. Little-endian, matching queue.writeBuffer.

/**
 * Pack a uniform binding's `fields` + `values` into a std140-laid-out byte
 * buffer for `var<uniform>`. Missing values fall back to the field `default`
 * then 0. The returned buffer length is padded up to a 16-byte multiple (min
 * 16). Pure + deterministic so it can be unit-tested against known layouts.
 */
export function packComputeKernelUniformBytes(
  fields: Readonly<Record<string, CustomWgslUniformField>>,
  values?: Readonly<Record<string, JsonPrimitive | readonly number[]>>,
): Uint8Array {
  const entries = Object.entries(fields);

  if (entries.length === 0) {
    return new Uint8Array(16);
  }

  const layout = entries.map(([name, field]) => ({
    type: field.type,
    value: values?.[name] ?? field.default ?? 0,
  }));

  let offset = 0;
  for (const field of layout) {
    offset = alignTo(offset, uniformFieldAlignment(field.type));
    offset += uniformFieldSize(field.type);
  }

  const byteLength = alignTo(Math.max(offset, 4), 16);
  const bytes = new Uint8Array(byteLength);
  const view = new DataView(bytes.buffer);
  offset = 0;

  for (const field of layout) {
    offset = alignTo(offset, uniformFieldAlignment(field.type));
    writeUniformField(view, offset, field.type, field.value);
    offset += uniformFieldSize(field.type);
  }

  return bytes;
}

function uniformFieldAlignment(type: CustomWgslUniformFieldType): number {
  switch (type) {
    case "vec2":
    case "Vec2":
      return 8;
    case "vec3":
    case "Vec3":
    case "vec4":
    case "Vec4":
    case "Color":
    case "mat4x4":
      return 16;
    default:
      return 4;
  }
}

function uniformFieldSize(type: CustomWgslUniformFieldType): number {
  switch (type) {
    case "vec2":
    case "Vec2":
      return 8;
    case "vec3":
    case "Vec3":
    case "vec4":
    case "Vec4":
    case "Color":
      return 16;
    case "mat4x4":
      return 64;
    default:
      return 4;
  }
}

function uniformFieldComponentCount(type: CustomWgslUniformFieldType): number {
  switch (type) {
    case "vec2":
    case "Vec2":
      return 2;
    case "vec3":
    case "Vec3":
      return 3;
    case "vec4":
    case "Vec4":
    case "Color":
      return 4;
    case "mat4x4":
      return 16;
    default:
      return 1;
  }
}

function isIntegerFieldType(type: CustomWgslUniformFieldType): boolean {
  return (
    type === "int32" ||
    type === "Int32" ||
    type === "uint32" ||
    type === "Uint32"
  );
}

function isUnsignedFieldType(type: CustomWgslUniformFieldType): boolean {
  return type === "uint32" || type === "Uint32";
}

function writeUniformField(
  view: DataView,
  offset: number,
  type: CustomWgslUniformFieldType,
  value: JsonPrimitive | readonly number[],
): void {
  const components = uniformFieldComponentCount(type);
  const numbers = toNumberComponents(value, components);
  const integer = isIntegerFieldType(type);
  const unsigned = isUnsignedFieldType(type);

  for (let index = 0; index < components; index += 1) {
    const component = numbers[index] ?? 0;
    const byteOffset = offset + index * 4;

    if (integer) {
      if (unsigned) {
        view.setUint32(byteOffset, component >>> 0, true);
      } else {
        view.setInt32(byteOffset, component | 0, true);
      }
    } else {
      view.setFloat32(byteOffset, component, true);
    }
  }
}

function toNumberComponents(
  value: JsonPrimitive | readonly number[],
  components: number,
): readonly number[] {
  if (Array.isArray(value)) {
    return value.map((entry) => (typeof entry === "number" ? entry : 0));
  }

  if (typeof value === "number") {
    return components === 1
      ? [value]
      : new Array<number>(components).fill(value);
  }

  if (typeof value === "boolean") {
    return [value ? 1 : 0];
  }

  return [];
}

function alignTo(value: number, alignment: number): number {
  return Math.ceil(value / alignment) * alignment;
}
