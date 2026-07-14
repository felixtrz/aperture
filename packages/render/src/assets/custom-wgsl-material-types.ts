import type {
  BufferHandle,
  RenderTargetHandle,
} from "@aperture-engine/simulation";
import type {
  ColorWriteMask,
  CustomWgslBindingKind,
  CustomWgslColorTargetDeclaration,
  CustomWgslMaterialAsset,
  CustomWgslSamplerType,
  CustomWgslShaderRef,
  CustomWgslShaderStage,
  CustomWgslTextureBindingSource,
  CustomWgslTextureSampleType,
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
  /**
   * Texture bindings (B4): the layout variant closing the pre-B4
   * float/2d/filtering hard-coding. Each is present ONLY when the declaration
   * set it to a non-default value, so materials that keep the defaults produce
   * byte-identical layout entries + pipeline keys.
   */
  readonly sampleType?: CustomWgslTextureSampleType;
  readonly viewDimension?: "2d" | "cube" | "3d" | "2d-array";
  readonly multisampled?: boolean;
  /**
   * Renderer-owned texture source for a texture binding (B4, e.g.
   * `"scene-depth"`). Present only when the declaration named one; the binding
   * then needs no `texture` handle and the frame supplies the resource.
   */
  readonly source?: CustomWgslTextureBindingSource;
  /** Sampler bindings (B4): the layout variant (default `"filtering"`). */
  readonly samplerType?: CustomWgslSamplerType;
}

export interface PreparedCustomWgslBindingResourceEntry {
  readonly binding: number;
  readonly kind: CustomWgslBindingKind;
  readonly resourceKey: string;
}

/**
 * One normalized color target of an MRT custom material (B3): the declared
 * format (index 0 keeps the "swapchain" sentinel resolved renderer-side),
 * the write mask (defaulted), and — for indices >= 1 — the paired facade
 * render-target handle whose realized texture attaches at @location(index).
 */
export interface PreparedCustomWgslColorTarget {
  readonly format: CustomWgslColorTargetDeclaration["format"];
  readonly writeMask: ColorWriteMask;
  readonly renderTarget?: RenderTargetHandle;
}

export interface PreparedCustomWgslMaterial {
  readonly resourceFamily: "custom-wgsl-material";
  readonly sourceMaterialKey: string;
  readonly materialKey: string;
  readonly label: string;
  readonly materialFamily: MaterialFamilyKey;
  /**
   * Present (as `"lit"`) only when the source opted into the group(3) lit
   * contract: `shader.code` then starts with `APERTURE_LIT_WGSL_HEADER`, the
   * pipeline key carries the `lit:v<N>` segment, and the renderer binds the
   * lit bind group at group(3).
   */
  readonly lighting?: "lit";
  /**
   * Present (as `true`) only when the source opted into the group(4) skinning
   * contract (`skinned: true`): `shader.code` then starts with
   * `APERTURE_SKINNED_WGSL_HEADER`, the pipeline key carries the `skinned:v<N>`
   * segment, the vertex layout gains the `JOINTS_0`/`WEIGHTS_0` attributes, and
   * the renderer binds the joint palette at group(4). Absent for every
   * non-skinned material so their keys + prepared shape stay byte-identical.
   */
  readonly skinned?: true;
  /**
   * Present (as `true`) only when at least one texture binding declared a
   * renderer-owned `source: "scene-depth"` (B4): the renderer binds the
   * frame's stored scene depth (read-only), routes the draw into a post-opaque
   * read-only-depth boundary, and stamps the `:scene-depth` marker onto the
   * render pipeline cache key. Absent for every other material so their keys
   * and prepared shape stay byte-identical.
   */
  readonly samplesSceneDepth?: true;
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
    /**
     * Buffer-backed instance stream (C1): present ONLY when the source declared
     * `instanceBuffer`, marking that slot 1's instance vertex buffer is the
     * realized `buffer` asset (shared zero-copy with any storage binding on the
     * same handle) rather than CPU-packed InstanceData. `instanceAttributes`
     * still describes the layout. Absent ⇒ byte-identical prepared shape.
     */
    readonly instanceBuffer?: {
      readonly buffer: BufferHandle;
    };
    /**
     * MRT declaration (B3), normalized (writeMask defaulted to "all").
     * Present ONLY when the source declared colorTargets so materials
     * without one stay byte-identical.
     */
    readonly colorTargets?: readonly PreparedCustomWgslColorTarget[];
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
