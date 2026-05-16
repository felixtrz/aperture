import { shaderModuleResourceKey } from "./resource-keys.js";
import {
  createWebGpuShaderModule,
  type WebGpuShaderDeviceLike,
  type WebGpuShaderFailureReason,
  type WebGpuShaderModuleDescriptor,
  type WebGpuShaderDiagnostic,
} from "./shader.js";

export type ShaderModuleResourceDiagnosticCode =
  | "shaderResource.nullDescriptor"
  | "shaderResource.creationFailed"
  | "shaderResource.compilationDiagnostic";

export interface ShaderModuleResourceDiagnostic {
  readonly code: ShaderModuleResourceDiagnosticCode;
  readonly message: string;
  readonly reason?: WebGpuShaderFailureReason;
  readonly severity?: WebGpuShaderDiagnostic["severity"];
}

export interface ShaderModuleResource {
  readonly resourceKey: string;
  readonly module: unknown;
  readonly entryPoints: readonly string[];
}

export interface CreateShaderModuleResourceOptions {
  readonly device: WebGpuShaderDeviceLike;
  readonly descriptor: WebGpuShaderModuleDescriptor | null;
}

export interface CreateShaderModuleResourceResult {
  readonly valid: boolean;
  readonly resource: ShaderModuleResource | null;
  readonly diagnostics: readonly ShaderModuleResourceDiagnostic[];
}

export async function createShaderModuleResource(
  options: CreateShaderModuleResourceOptions,
): Promise<CreateShaderModuleResourceResult> {
  if (options.descriptor === null) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "shaderResource.nullDescriptor",
          message:
            "Cannot create shader module resource from a null descriptor.",
        },
      ],
    };
  }

  const result = await createWebGpuShaderModule({
    device: options.device,
    descriptor: options.descriptor,
  });
  const diagnostics = result.diagnostics.map((diagnostic) => ({
    code: "shaderResource.compilationDiagnostic" as const,
    severity: diagnostic.severity,
    message: diagnostic.message,
  }));

  if (!result.ok) {
    return {
      valid: false,
      resource: null,
      diagnostics: [
        ...diagnostics,
        {
          code: "shaderResource.creationFailed",
          reason: result.reason,
          message: result.message,
        },
      ],
    };
  }

  return {
    valid: true,
    resource: {
      resourceKey: shaderModuleResourceKey(
        options.descriptor.label ?? "shader",
      ),
      module: result.module,
      entryPoints: options.descriptor.entryPoints ?? [],
    },
    diagnostics,
  };
}
