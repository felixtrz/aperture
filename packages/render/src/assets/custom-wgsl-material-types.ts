import type {
  InstanceAttributeLayout,
  InstanceAttributeLayoutInput,
  RenderStateDescriptor,
} from "../materials/index.js";

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
