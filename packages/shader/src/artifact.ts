/** Portable, data-only contracts. This entry never imports the compiler or GPU globals. */
export type ShaderStage = "vertex" | "fragment" | "compute";
export type ShaderScalar = "f32" | "f16" | "i32" | "u32";
export type ShaderValue =
  | number
  | readonly ShaderValue[]
  | { readonly [key: string]: ShaderValue };

interface LayoutBase {
  readonly type: string;
  readonly size: number;
  readonly align: number;
}
export type ShaderBufferLayout =
  | (LayoutBase & { readonly kind: "scalar"; readonly scalar: ShaderScalar })
  | (LayoutBase & {
      readonly kind: "vector";
      readonly scalar: ShaderScalar;
      readonly count: number;
    })
  | (LayoutBase & {
      readonly kind: "matrix";
      readonly scalar: ShaderScalar;
      readonly columns: number;
      readonly rows: number;
      readonly stride: number;
    })
  | (LayoutBase & {
      readonly kind: "array";
      readonly element: ShaderBufferLayout;
      readonly count: number;
      readonly stride: number;
    })
  | (LayoutBase & {
      readonly kind: "struct";
      readonly fields: readonly {
        readonly name: string;
        readonly offset: number;
        readonly size: number;
        readonly layout: ShaderBufferLayout;
      }[];
    });

export interface ShaderBinding {
  readonly name: string;
  readonly group: number;
  readonly binding: number;
  readonly visibility: readonly ShaderStage[];
  readonly kind:
    | "uniform-buffer"
    | "storage-buffer"
    | "texture"
    | "storage-texture"
    | "sampler";
  readonly access: "read" | "write" | "read_write";
  readonly layout?: ShaderBufferLayout;
  readonly minBindingSize?: number;
  readonly texture?: {
    readonly dimension: "1d" | "2d" | "2d-array" | "3d" | "cube" | "cube-array";
    readonly sampleType:
      | "float"
      | "unfilterable-float"
      | "depth"
      | "sint"
      | "uint";
    readonly multisampled: boolean;
    readonly format?: string;
  };
  readonly sampler?: "filtering" | "non-filtering" | "comparison";
}

export interface ShaderSourceLocation {
  readonly file: string;
  readonly line: number;
  readonly column?: number;
}
export interface ShaderDiagnostic {
  readonly severity: "error" | "warning" | "info";
  readonly code: string;
  readonly message: string;
  readonly location?: ShaderSourceLocation;
}
export interface ShaderArtifact {
  readonly format: "aperture.shader";
  readonly version: 1;
  readonly compiler: "aperture-wgsl/1:wgsl_reflect/1.6.0";
  readonly entry: string;
  readonly code: string;
  readonly hash: string;
  readonly layoutHash: string;
  readonly dependencies: readonly {
    readonly file: string;
    readonly hash: string;
  }[];
  /** Index 0 maps generated WGSL line 1. */
  readonly sourceMap: readonly ShaderSourceLocation[];
  readonly entryPoints: readonly {
    readonly name: string;
    readonly stage: ShaderStage;
    readonly bindings: readonly string[];
    readonly workgroupSize?: readonly [number, number, number];
  }[];
  readonly overrides: readonly {
    readonly name: string;
    readonly id: number;
    readonly type: string;
  }[];
  readonly bindings: readonly ShaderBinding[];
  readonly requiredFeatures: readonly string[];
}

export function mapShaderDiagnostic(
  artifact: ShaderArtifact,
  message: {
    readonly message: string;
    readonly type?: string;
    readonly lineNum?: number;
    readonly linePos?: number;
  },
): ShaderDiagnostic {
  const source = artifact.sourceMap[(message.lineNum ?? 0) - 1];
  return {
    code: "aperture.shader.compilation",
    severity:
      message.type === "warning"
        ? "warning"
        : message.type === "info"
          ? "info"
          : "error",
    message: message.message,
    ...(source === undefined
      ? {}
      : {
          location: {
            ...source,
            ...(message.linePos === undefined
              ? {}
              : { column: message.linePos }),
          },
        }),
  };
}

export class ShaderError extends Error {
  constructor(readonly diagnostics: readonly ShaderDiagnostic[]) {
    super(
      diagnostics
        .map(
          (d) =>
            `${d.location === undefined ? "" : `${d.location.file}:${d.location.line}: `}${d.message}`,
        )
        .join("\n"),
    );
    this.name = "ShaderError";
  }
}
