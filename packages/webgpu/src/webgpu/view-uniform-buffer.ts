import type {
  PackedSnapshotViewUniformRecord,
  PackedSnapshotViewUniforms,
} from "@aperture-engine/render";
import type { WebGpuBufferDescriptor } from "./buffer.js";
import { DEFAULT_UNLIT_MATERIAL_BUFFER_USAGE } from "./unlit-material-buffer.js";

export type ViewUniformBufferDescriptorDiagnosticCode =
  | "viewUniformBuffer.emptyData"
  | "viewUniformBuffer.invalidUsageFlags"
  | "viewUniformBuffer.packDiagnostic";

export interface ViewUniformBufferDescriptorDiagnostic {
  readonly code: ViewUniformBufferDescriptorDiagnosticCode;
  readonly message: string;
  readonly field?: string;
  readonly sourceCode?: string;
}

export interface ViewUniformBufferDescriptorPlan {
  readonly descriptor: WebGpuBufferDescriptor;
  readonly source: Float32Array;
  readonly views: readonly PackedSnapshotViewUniformRecord[];
}

export interface CreateViewUniformBufferDescriptorOptions {
  readonly label?: string;
  readonly usage?: number;
}

export interface ViewUniformBufferDescriptorResult {
  readonly valid: boolean;
  readonly plan: ViewUniformBufferDescriptorPlan | null;
  readonly diagnostics: readonly ViewUniformBufferDescriptorDiagnostic[];
}

export interface ViewUniformBufferDescriptorScratch {
  source: Float32Array;
  readonly descriptor: {
    label?: string;
    size: number;
    usage: number;
    mappedAtCreation?: boolean;
    initialData?: ArrayBufferView;
  };
  readonly plan: {
    descriptor: WebGpuBufferDescriptor;
    source: Float32Array;
    views: readonly PackedSnapshotViewUniformRecord[];
  };
  readonly diagnostics: ViewUniformBufferDescriptorDiagnostic[];
  readonly result: {
    valid: boolean;
    plan: ViewUniformBufferDescriptorPlan | null;
    diagnostics: readonly ViewUniformBufferDescriptorDiagnostic[];
  };
}

export function createViewUniformBufferDescriptorScratch(): ViewUniformBufferDescriptorScratch {
  const descriptor = {
    size: 0,
    usage: DEFAULT_UNLIT_MATERIAL_BUFFER_USAGE,
  };
  const plan = {
    descriptor,
    source: new Float32Array(0),
    views: [],
  };
  const diagnostics: ViewUniformBufferDescriptorDiagnostic[] = [];

  return {
    source: new Float32Array(0),
    descriptor,
    plan,
    diagnostics,
    result: { valid: false, plan: null, diagnostics },
  };
}

export function writeViewUniformBufferDescriptor(
  packed: PackedSnapshotViewUniforms,
  scratch: ViewUniformBufferDescriptorScratch,
  options: CreateViewUniformBufferDescriptorOptions = {},
): ViewUniformBufferDescriptorResult {
  const diagnostics = scratch.diagnostics;

  diagnostics.length = 0;

  for (const diagnostic of packed.diagnostics) {
    diagnostics.push({
      code: "viewUniformBuffer.packDiagnostic",
      sourceCode: diagnostic.code,
      message: diagnostic.message,
    });
  }

  const usage = options.usage ?? DEFAULT_UNLIT_MATERIAL_BUFFER_USAGE;

  if (!Number.isInteger(usage) || usage <= 0) {
    diagnostics.push({
      code: "viewUniformBuffer.invalidUsageFlags",
      field: "usage",
      message: "View uniform buffer usage flags must be a positive integer.",
    });
  }

  const floatCount = packed.floatCount ?? packed.data.length;
  const source = sourceViewFor(scratch, packed.data, floatCount);

  if (source.byteLength === 0 || packed.views.length === 0) {
    diagnostics.push({
      code: "viewUniformBuffer.emptyData",
      field: "data",
      message:
        "Packed view uniform data must contain at least one view matrix.",
    });
  }

  if (diagnostics.length > 0) {
    scratch.result.valid = false;
    scratch.result.plan = null;
    return scratch.result;
  }

  scratch.descriptor.label = options.label ?? "ViewUniforms/uniform";
  scratch.descriptor.size = source.byteLength;
  scratch.descriptor.usage = usage;
  scratch.descriptor.initialData = source;
  scratch.plan.source = source;
  scratch.plan.views = packed.views;
  scratch.result.valid = true;
  scratch.result.plan = scratch.plan;

  return scratch.result;
}

export function createViewUniformBufferDescriptor(
  packed: PackedSnapshotViewUniforms,
  options: CreateViewUniformBufferDescriptorOptions = {},
): ViewUniformBufferDescriptorResult {
  return writeViewUniformBufferDescriptor(
    packed,
    createViewUniformBufferDescriptorScratch(),
    options,
  );
}

function sourceViewFor(
  scratch: ViewUniformBufferDescriptorScratch,
  data: Float32Array,
  floatCount: number,
): Float32Array {
  if (floatCount === data.length) {
    scratch.source = data;
    return data;
  }

  if (
    scratch.source.buffer !== data.buffer ||
    scratch.source.byteOffset !== data.byteOffset ||
    scratch.source.length !== floatCount
  ) {
    scratch.source = data.subarray(0, floatCount);
  }

  return scratch.source;
}
