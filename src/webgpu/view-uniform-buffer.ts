import type {
  PackedSnapshotViewUniformRecord,
  PackedSnapshotViewUniforms,
} from "../rendering/index.js";
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

export function createViewUniformBufferDescriptor(
  packed: PackedSnapshotViewUniforms,
  options: CreateViewUniformBufferDescriptorOptions = {},
): ViewUniformBufferDescriptorResult {
  const diagnostics: ViewUniformBufferDescriptorDiagnostic[] =
    packed.diagnostics.map((diagnostic) => ({
      code: "viewUniformBuffer.packDiagnostic",
      sourceCode: diagnostic.code,
      message: diagnostic.message,
    }));
  const usage = options.usage ?? DEFAULT_UNLIT_MATERIAL_BUFFER_USAGE;

  if (!Number.isInteger(usage) || usage <= 0) {
    diagnostics.push({
      code: "viewUniformBuffer.invalidUsageFlags",
      field: "usage",
      message: "View uniform buffer usage flags must be a positive integer.",
    });
  }

  if (packed.data.byteLength === 0 || packed.views.length === 0) {
    diagnostics.push({
      code: "viewUniformBuffer.emptyData",
      field: "data",
      message:
        "Packed view uniform data must contain at least one view matrix.",
    });
  }

  if (diagnostics.length > 0) {
    return { valid: false, plan: null, diagnostics };
  }

  return {
    valid: true,
    plan: {
      source: packed.data,
      views: packed.views,
      descriptor: {
        label: options.label ?? "ViewUniforms/uniform",
        size: packed.data.byteLength,
        usage,
        initialData: packed.data,
      },
    },
    diagnostics,
  };
}
