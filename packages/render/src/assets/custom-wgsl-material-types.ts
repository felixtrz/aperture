import type { BufferHandle } from "@aperture-engine/simulation";
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
  readonly runtimeUniformKey?: string;
  /**
   * Storage-buffer bindings only: source buffer asset handle plus the
   * optional keyed dynamic-update channel. Value/handle identity stays out of
   * the pipeline key — only the binding kind participates — so buffer content
   * updates never rebuild pipelines (DECISIONS.md 0022).
   */
  readonly buffer?: BufferHandle;
  readonly runtimeBufferKey?: string;
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
    /**
     * Optional shadow-caster vertex entry point compiled from the same module
     * (see `CustomWgslMaterialEntryPoints.shadowVertex` for the bind
     * contract). Present only when the source material declares it.
     */
    readonly shadowVertexEntryPoint?: string;
  };
  readonly pipeline: {
    readonly pipelineKey: string;
    readonly shaderModuleKey: string;
    readonly vertexEntryPoint: string;
    readonly fragmentEntryPoint: string;
    /** Shadow-caster vertex entry point (mirrors `shader.shadowVertexEntryPoint`). */
    readonly shadowVertexEntryPoint?: string;
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
