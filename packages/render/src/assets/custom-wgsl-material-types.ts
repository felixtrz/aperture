import type {
  CustomWgslBindingKind,
  CustomWgslMaterialAsset,
  CustomWgslShaderRef,
  CustomWgslShaderStage,
  CustomWgslUniformBindingDeclaration,
  MaterialFamilyKey,
  RenderStateDescriptor,
} from "../materials/index.js";
import type { InstanceAttributeLayout } from "../materials/instance-attributes.js";

export type {
  CustomWgslBindingDeclaration,
  CustomWgslBindingKind,
  CustomWgslShaderStage,
  WgslShaderAsset,
} from "../materials/index.js";

export type CustomWgslMaterialSource = CustomWgslMaterialAsset;
export type CustomWgslShaderSource = CustomWgslShaderRef;

export interface PreparedCustomWgslBindingLayoutEntry {
  readonly binding: number;
  readonly kind: CustomWgslBindingKind;
  readonly visibility: readonly CustomWgslShaderStage[];
  readonly label: string;
  readonly fields?: CustomWgslUniformBindingDeclaration["fields"];
  readonly values?: CustomWgslUniformBindingDeclaration["values"];
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
  readonly materialFamily: MaterialFamilyKey;
  readonly pipelineKey: string;
  readonly materialResourceKey: string;
  readonly bindGroupResourceKey: string;
  readonly shader: {
    readonly language: "wgsl";
    readonly moduleKey: string;
    readonly code: string;
    readonly sourceKey: string;
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
