export type WebGpuShaderDiagnosticSeverity = "error" | "warning" | "info";

export type WebGpuShaderFailureReason =
  | "create-shader-module-unavailable"
  | "missing-entry-point"
  | "compilation-error";

export interface WebGpuShaderDiagnostic {
  readonly severity: WebGpuShaderDiagnosticSeverity;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
}

export interface WebGpuShaderModuleDescriptor {
  readonly label?: string;
  readonly code: string;
  readonly entryPoints?: readonly string[];
}

export interface WebGpuShaderCreateDescriptor {
  readonly label?: string;
  readonly code: string;
}

export interface WebGpuShaderModuleLike {
  compilationInfo?: () => Promise<{
    readonly messages: readonly WebGpuShaderCompilationMessageLike[];
  }>;
}

export interface WebGpuShaderCompilationMessageLike {
  readonly type?: string;
  readonly message: string;
  readonly lineNum?: number;
  readonly linePos?: number;
}

export interface WebGpuShaderDeviceLike {
  createShaderModule?: (
    descriptor: WebGpuShaderCreateDescriptor,
  ) => WebGpuShaderModuleLike;
}

export interface CreateWebGpuShaderModuleOptions {
  readonly device: WebGpuShaderDeviceLike;
  readonly descriptor: WebGpuShaderModuleDescriptor;
}

export interface WebGpuShaderModuleSuccess {
  readonly ok: true;
  readonly module: WebGpuShaderModuleLike;
  readonly diagnostics: readonly WebGpuShaderDiagnostic[];
}

export interface WebGpuShaderModuleFailure {
  readonly ok: false;
  readonly reason: WebGpuShaderFailureReason;
  readonly message: string;
  readonly diagnostics: readonly WebGpuShaderDiagnostic[];
}

export type WebGpuShaderModuleResult =
  | WebGpuShaderModuleSuccess
  | WebGpuShaderModuleFailure;

export async function createWebGpuShaderModule(
  options: CreateWebGpuShaderModuleOptions,
): Promise<WebGpuShaderModuleResult> {
  const entryPointDiagnostics = validateEntryPoints(options.descriptor);

  if (entryPointDiagnostics.length > 0) {
    return failure(
      "missing-entry-point",
      "WGSL source is missing one or more expected entry points.",
      entryPointDiagnostics,
    );
  }

  if (options.device.createShaderModule === undefined) {
    return failure(
      "create-shader-module-unavailable",
      "WebGPU device cannot create shader modules.",
      [],
    );
  }

  const module = options.device.createShaderModule(
    createDescriptor(options.descriptor),
  );
  const diagnostics = await readCompilationDiagnostics(module);

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return failure(
      "compilation-error",
      "WGSL shader compilation reported errors.",
      diagnostics,
    );
  }

  return { ok: true, module, diagnostics };
}

function validateEntryPoints(
  descriptor: WebGpuShaderModuleDescriptor,
): WebGpuShaderDiagnostic[] {
  const diagnostics: WebGpuShaderDiagnostic[] = [];

  for (const entryPoint of descriptor.entryPoints ?? []) {
    const pattern = new RegExp(`\\bfn\\s+${escapeRegExp(entryPoint)}\\s*\\(`);

    if (!pattern.test(descriptor.code)) {
      diagnostics.push({
        severity: "error",
        message: `WGSL source is missing expected entry point '${entryPoint}'.`,
      });
    }
  }

  return diagnostics;
}

async function readCompilationDiagnostics(
  module: WebGpuShaderModuleLike,
): Promise<WebGpuShaderDiagnostic[]> {
  const info = await module.compilationInfo?.();

  return (info?.messages ?? []).map((message) => {
    const diagnostic: WebGpuShaderDiagnostic = {
      severity: mapSeverity(message.type),
      message: message.message,
    };

    if (message.lineNum !== undefined) {
      return {
        ...diagnostic,
        line: message.lineNum,
        ...(message.linePos === undefined ? {} : { column: message.linePos }),
      };
    }

    if (message.linePos !== undefined) {
      return { ...diagnostic, column: message.linePos };
    }

    return diagnostic;
  });
}

function createDescriptor(
  descriptor: WebGpuShaderModuleDescriptor,
): WebGpuShaderCreateDescriptor {
  const result: WebGpuShaderCreateDescriptor = { code: descriptor.code };

  if (descriptor.label !== undefined) {
    return { ...result, label: descriptor.label };
  }

  return result;
}

function mapSeverity(type: string | undefined): WebGpuShaderDiagnosticSeverity {
  switch (type) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    default:
      return "info";
  }
}

function failure(
  reason: WebGpuShaderFailureReason,
  message: string,
  diagnostics: readonly WebGpuShaderDiagnostic[],
): WebGpuShaderModuleFailure {
  return { ok: false, reason, message, diagnostics };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
