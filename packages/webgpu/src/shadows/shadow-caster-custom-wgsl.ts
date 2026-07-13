// A4 (three.js parity plan): per-material shadow-caster pipelines for custom
// WGSL materials that declare `entryPoints.shadowVertex` — the analog of
// three.js `customDepthMaterial`/`castShadowPositionNode`. Meshes using such a
// material render into shadow maps through a depth-only pipeline whose vertex
// stage is compiled from the material's OWN WGSL module, so vertex
// displacement applied by the main vertex entry can be mirrored into the
// shadow silhouette.
//
// Caster bind contract (documented on `CustomWgslMaterialEntryPoints`):
// - group(0) mirrors the shared position-only caster exactly:
//   @binding(0) uniform  — the pass's light `viewProjection: mat4x4<f32>`
//   @binding(1) storage  — caster world transforms indexed by instance_index
//   so the existing per-pass matrix bind groups bind unchanged (explicit
//   layouts with equal descriptors are group-equivalent).
// - group(1) is reserved and bound with an empty bind group (the pipeline
//   layout needs a placeholder so the material bindings stay at group(2)).
// - group(2) is the material's own bind group, created here against an
//   explicit layout (the main-pass bind group targets that pipeline's `auto`
//   layout and cannot be shared), from the SAME realized GPU resources.
// - No fragment stage: the caster pipeline is depth-only.

import type { PreparedCustomWgslMaterial } from "@aperture-engine/render";

import {
  createCustomWgslMaterialBindGroupLayoutDescriptor,
  createCustomWgslMaterialBindGroupResource,
  type CustomWgslMaterialGpuResource,
  type CustomWgslMaterialResourceDiagnosticCode,
} from "../materials/custom-wgsl/custom-wgsl-material.js";
import type { WebGpuRenderPipelineCreateDescriptor } from "../gpu/pipeline-cache.js";
import type { WebGpuShaderCreateDescriptor } from "../gpu/shader.js";
import {
  bindGroupResourceKey,
  renderPipelineResourceKey,
  shaderModuleResourceKey,
} from "../resources/core/resource-keys.js";
import type { ShadowCasterCullMode } from "./shadow-caster-draw-list-plan.js";
import { createShadowCasterMatrixBindGroupLayoutDescriptor } from "./shadow-caster-matrix-bind-group-resource.js";
import { resolveShadowCasterVertexBufferLayouts } from "./shadow-caster-pipeline-resource.js";

const EMPTY_GROUP1_LAYOUT_KEY = "shadow-caster/custom-wgsl/group-1:empty";

export interface CustomWgslShadowCasterMaterialInput {
  /** Asset-handle key of the source material (matches caster draw materialKey). */
  readonly materialKey: string;
  readonly material: PreparedCustomWgslMaterial;
  /**
   * Realized GPU resources for every group(2) binding, keyed like
   * `PreparedCustomWgslMaterial.bindGroup.entries[].resourceKey` (the same
   * inputs the main pass hands to `createCustomWgslMaterialBindGroupResource`).
   */
  readonly bindingResources: readonly CustomWgslMaterialGpuResource[];
}

/** One distinct (material, mesh layout, caster cull) combination in the frame. */
export interface CustomWgslShadowCasterDrawUse {
  readonly materialKey: string;
  readonly meshLayoutKey: string;
  readonly casterCullMode: ShadowCasterCullMode;
}

export interface CustomWgslShadowCasterPipelineResource {
  readonly pipelineKey: string;
  readonly resourceKey: string;
  readonly shaderModuleKey: string;
  readonly materialKey: string;
  readonly label: string;
  readonly shaderModule: unknown;
  readonly pipeline: unknown;
}

export interface CustomWgslShadowCasterBindGroupResource {
  readonly materialKey: string;
  readonly resourceKey: string;
  readonly group: 2;
  readonly layout: unknown;
  readonly bindGroup: unknown;
  /** Material bind-group layout identity guard (bindings signature). */
  readonly layoutResourceKey: string;
  /** Resolved binding resource identities; a change forces recreation. */
  readonly entryResources: readonly unknown[];
  readonly generation: number;
}

export interface CustomWgslShadowCasterEmptyBindGroupResource {
  readonly resourceKey: string;
  readonly group: 1;
  readonly layout: unknown;
  readonly bindGroup: unknown;
}

export interface CustomWgslShadowCasterResourceCache {
  readonly shaderModules: Map<string, unknown>;
  readonly pipelines: Map<string, CustomWgslShadowCasterPipelineResource>;
  readonly materialBindGroups: Map<
    string,
    CustomWgslShadowCasterBindGroupResource
  >;
  emptyBindGroup: CustomWgslShadowCasterEmptyBindGroupResource | null;
}

export function createCustomWgslShadowCasterResourceCache(): CustomWgslShadowCasterResourceCache {
  return {
    shaderModules: new Map(),
    pipelines: new Map(),
    materialBindGroups: new Map(),
    emptyBindGroup: null,
  };
}

export interface CustomWgslShadowCasterDeviceLike {
  createShaderModule?: (descriptor: WebGpuShaderCreateDescriptor) => unknown;
  createBindGroupLayout?: (descriptor: unknown) => unknown;
  createPipelineLayout?: (descriptor: unknown) => unknown;
  createRenderPipeline?: (
    descriptor: WebGpuRenderPipelineCreateDescriptor,
  ) => unknown;
  createBindGroup?: (descriptor: unknown) => unknown;
}

export type CustomWgslShadowCasterDiagnosticCode =
  | "customWgslMaterial.shadowCasterDeviceUnavailable"
  | "customWgslMaterial.shadowCasterEntryPointMissing"
  | "customWgslMaterial.shadowCasterShaderModuleFailed"
  | "customWgslMaterial.shadowCasterPipelineCreationFailed"
  | "customWgslMaterial.shadowCasterBindGroupFailed"
  | CustomWgslMaterialResourceDiagnosticCode;

export interface CustomWgslShadowCasterDiagnostic {
  readonly code: CustomWgslShadowCasterDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly materialKey?: string;
  readonly pipelineKey?: string;
}

export interface CustomWgslShadowCasterDrawBindGroup {
  readonly group: number;
  readonly resourceKey: string;
  readonly bindGroup: unknown;
}

export interface CustomWgslShadowCasterResourceReport {
  readonly status: "not-required" | "available" | "partial" | "missing";
  /** Distinct (material, layout, cull) combinations requested this frame. */
  readonly requestedDrawUseCount: number;
  /** Combinations that resolved to a live per-material caster pipeline. */
  readonly readyDrawUseCount: number;
  readonly createdPipelineCount: number;
  readonly reusedPipelineCount: number;
  readonly createdBindGroupCount: number;
  readonly reusedBindGroupCount: number;
  readonly pipelines: readonly CustomWgslShadowCasterPipelineResource[];
  /**
   * `${materialKey}|${meshLayoutKey}|${casterCullMode}` → caster pipeline key.
   * Draws without an entry fall back to the shared position-only caster.
   */
  readonly pipelineKeyByDraw: ReadonlyMap<string, string>;
  /** Caster pipeline key → extra bind groups (group 1 empty + group 2 material). */
  readonly drawBindGroupsByPipelineKey: ReadonlyMap<
    string,
    readonly CustomWgslShadowCasterDrawBindGroup[]
  >;
  readonly diagnostics: readonly CustomWgslShadowCasterDiagnostic[];
}

export interface CreateCustomWgslShadowCasterResourceReportOptions {
  readonly device: CustomWgslShadowCasterDeviceLike;
  readonly casters: readonly CustomWgslShadowCasterMaterialInput[];
  readonly draws: readonly CustomWgslShadowCasterDrawUse[];
  /** Authored constant depth bias (depth-buffer units), mirroring the shared caster. */
  readonly depthBias?: number;
  /** Authored slope-scaled depth bias, mirroring the shared caster. */
  readonly slopeBias?: number;
  readonly cache?: CustomWgslShadowCasterResourceCache;
}

export function customWgslShadowCasterDrawKey(
  materialKey: string,
  meshLayoutKey: string,
  casterCullMode: ShadowCasterCullMode,
): string {
  return `${materialKey}|${meshLayoutKey}|${casterCullMode}`;
}

export function customWgslShadowCasterPipelineKey(input: {
  readonly materialKey: string;
  readonly materialPipelineKey: string;
  readonly meshLayoutKey: string;
  readonly casterCullMode: ShadowCasterCullMode;
  readonly depthBias: number;
  readonly depthBiasSlopeScale: number;
}): string {
  const bias =
    input.depthBias === 0 && input.depthBiasSlopeScale === 0
      ? ""
      : `/bias:${input.depthBias}:${input.depthBiasSlopeScale}`;

  // The material pipeline key already hashes the shader source and includes
  // the `shadow-vs:` entry-point segment, so shader or entry-point edits
  // rebuild the caster pipeline; hash it here to keep the key bounded.
  return [
    "shadow-caster/custom-wgsl",
    encodeURIComponent(input.materialKey),
    `material:${stableStringHash(input.materialPipelineKey)}`,
    `mesh-layout:${encodeURIComponent(input.meshLayoutKey)}`,
    `cull:${input.casterCullMode}${bias}`,
  ].join("/");
}

export function createCustomWgslShadowCasterResourceReport(
  options: CreateCustomWgslShadowCasterResourceReportOptions,
): CustomWgslShadowCasterResourceReport {
  const castersByMaterial = new Map(
    options.casters.map((caster) => [caster.materialKey, caster]),
  );
  const drawUses = dedupeDrawUses(options.draws).filter((draw) =>
    castersByMaterial.has(draw.materialKey),
  );

  if (drawUses.length === 0) {
    return {
      status: "not-required",
      requestedDrawUseCount: 0,
      readyDrawUseCount: 0,
      createdPipelineCount: 0,
      reusedPipelineCount: 0,
      createdBindGroupCount: 0,
      reusedBindGroupCount: 0,
      pipelines: [],
      pipelineKeyByDraw: new Map(),
      drawBindGroupsByPipelineKey: new Map(),
      diagnostics: [],
    };
  }

  if (
    options.device.createShaderModule === undefined ||
    options.device.createBindGroupLayout === undefined ||
    options.device.createPipelineLayout === undefined ||
    options.device.createRenderPipeline === undefined ||
    options.device.createBindGroup === undefined
  ) {
    return {
      status: "missing",
      requestedDrawUseCount: drawUses.length,
      readyDrawUseCount: 0,
      createdPipelineCount: 0,
      reusedPipelineCount: 0,
      createdBindGroupCount: 0,
      reusedBindGroupCount: 0,
      pipelines: [],
      pipelineKeyByDraw: new Map(),
      drawBindGroupsByPipelineKey: new Map(),
      diagnostics: [
        {
          code: "customWgslMaterial.shadowCasterDeviceUnavailable",
          severity: "warning",
          message:
            "WebGPU device cannot create per-material custom WGSL shadow caster pipelines (createShaderModule/createBindGroupLayout/createPipelineLayout/createRenderPipeline/createBindGroup required); affected casters fall back to the shared position-only caster.",
        },
      ],
    };
  }

  const diagnostics: CustomWgslShadowCasterDiagnostic[] = [];
  const pipelines: CustomWgslShadowCasterPipelineResource[] = [];
  const pipelineKeyByDraw = new Map<string, string>();
  const drawBindGroupsByPipelineKey = new Map<
    string,
    readonly CustomWgslShadowCasterDrawBindGroup[]
  >();
  const bias = {
    depthBias: Math.max(0, Math.round(options.depthBias ?? 0)),
    depthBiasSlopeScale: Math.max(0, options.slopeBias ?? 0),
  };
  let createdPipelineCount = 0;
  let reusedPipelineCount = 0;
  let createdBindGroupCount = 0;
  let reusedBindGroupCount = 0;
  let readyDrawUseCount = 0;
  const failedMaterials = new Set<string>();
  const materialBindGroups = new Map<
    string,
    CustomWgslShadowCasterBindGroupResource
  >();
  const pipelineLayoutsByMaterial = new Map<string, unknown>();
  let emptyBindGroup: CustomWgslShadowCasterEmptyBindGroupResource | null =
    options.cache?.emptyBindGroup ?? null;
  let matrixBindGroupLayout: unknown = undefined;

  for (const drawUse of drawUses) {
    const caster = castersByMaterial.get(drawUse.materialKey);

    if (caster === undefined || failedMaterials.has(drawUse.materialKey)) {
      continue;
    }

    const entryPoint = caster.material.shader.shadowVertexEntryPoint;

    if (entryPoint === undefined || entryPoint.trim().length === 0) {
      // Not an error: the material simply does not opt into a custom caster.
      failedMaterials.add(drawUse.materialKey);
      continue;
    }

    if (!containsWgslEntrypoint(caster.material.shader.code, entryPoint)) {
      diagnostics.push({
        code: "customWgslMaterial.shadowCasterEntryPointMissing",
        severity: "error",
        materialKey: drawUse.materialKey,
        message: `Custom WGSL material '${caster.material.materialKey}' declares shadow caster entry point '${entryPoint}' but its WGSL module does not define it; its casters fall back to the shared position-only caster.`,
      });
      failedMaterials.add(drawUse.materialKey);
      continue;
    }

    const pipelineKey = customWgslShadowCasterPipelineKey({
      materialKey: drawUse.materialKey,
      materialPipelineKey: caster.material.pipeline.pipelineKey,
      meshLayoutKey: drawUse.meshLayoutKey,
      casterCullMode: drawUse.casterCullMode,
      ...bias,
    });
    const drawKey = customWgslShadowCasterDrawKey(
      drawUse.materialKey,
      drawUse.meshLayoutKey,
      drawUse.casterCullMode,
    );

    // Group(2): per-material caster bind group over the same realized GPU
    // resources as the main pass, recreated only when a resolved resource's
    // identity changes (e.g. a storage buffer was reallocated).
    let bindGroup = materialBindGroups.get(drawUse.materialKey);

    if (bindGroup === undefined) {
      const result = getOrCreateCasterMaterialBindGroup({
        device: options.device,
        caster,
        cache: options.cache,
        diagnostics,
      });

      if (result === null) {
        failedMaterials.add(drawUse.materialKey);
        continue;
      }

      bindGroup = result.resource;

      if (result.reused) {
        reusedBindGroupCount += 1;
      } else {
        createdBindGroupCount += 1;
      }

      materialBindGroups.set(drawUse.materialKey, bindGroup);
    }

    if (emptyBindGroup === null) {
      emptyBindGroup = createEmptyGroup1BindGroup(options.device, diagnostics);

      if (emptyBindGroup === null) {
        failedMaterials.add(drawUse.materialKey);
        continue;
      }

      if (options.cache !== undefined) {
        options.cache.emptyBindGroup = emptyBindGroup;
      }
    }

    const cachedPipeline = options.cache?.pipelines.get(pipelineKey);

    if (cachedPipeline !== undefined) {
      reusedPipelineCount += 1;
      pipelines.push(cachedPipeline);
      pipelineKeyByDraw.set(drawKey, pipelineKey);
      drawBindGroupsByPipelineKey.set(pipelineKey, [
        {
          group: emptyBindGroup.group,
          resourceKey: emptyBindGroup.resourceKey,
          bindGroup: emptyBindGroup.bindGroup,
        },
        {
          group: bindGroup.group,
          resourceKey: bindGroup.resourceKey,
          bindGroup: bindGroup.bindGroup,
        },
      ]);
      readyDrawUseCount += 1;
      continue;
    }

    const shaderModule = getOrCreateCasterShaderModule({
      device: options.device,
      caster,
      cache: options.cache,
      diagnostics,
    });

    if (shaderModule === null) {
      failedMaterials.add(drawUse.materialKey);
      continue;
    }

    try {
      let pipelineLayout = pipelineLayoutsByMaterial.get(drawUse.materialKey);

      if (pipelineLayout === undefined) {
        matrixBindGroupLayout ??= options.device.createBindGroupLayout(
          createShadowCasterMatrixBindGroupLayoutDescriptor(),
        );
        const emptyLayout = emptyBindGroup.layout;
        pipelineLayout = options.device.createPipelineLayout({
          label: `shadow-caster/custom-wgsl/${caster.material.materialKey}:pipeline-layout`,
          bindGroupLayouts: [
            matrixBindGroupLayout,
            emptyLayout,
            bindGroup.layout,
          ],
        });
        pipelineLayoutsByMaterial.set(drawUse.materialKey, pipelineLayout);
      }

      const label = `shadow-caster-custom-wgsl:${caster.material.label}:${drawUse.meshLayoutKey}:cull:${drawUse.casterCullMode}`;
      const pipeline = options.device.createRenderPipeline({
        label,
        layout: pipelineLayout,
        vertex: {
          module: shaderModule,
          entryPoint,
          buffers: resolveShadowCasterVertexBufferLayouts(
            drawUse.meshLayoutKey,
          ),
        },
        primitive: {
          topology: "triangle-list",
          frontFace: "ccw",
          cullMode: drawUse.casterCullMode,
        },
        depthStencil: {
          format: "depth24plus",
          depthWriteEnabled: true,
          depthCompare: "less-equal",
          depthBias: bias.depthBias,
          depthBiasSlopeScale: bias.depthBiasSlopeScale,
        },
      });
      const resource: CustomWgslShadowCasterPipelineResource = {
        pipelineKey,
        resourceKey: renderPipelineResourceKey(pipelineKey),
        shaderModuleKey: shaderModuleResourceKey(
          casterShaderModuleKey(caster.material),
        ),
        materialKey: drawUse.materialKey,
        label,
        shaderModule,
        pipeline,
      };

      options.cache?.pipelines.set(pipelineKey, resource);
      createdPipelineCount += 1;
      pipelines.push(resource);
      pipelineKeyByDraw.set(drawKey, pipelineKey);
      drawBindGroupsByPipelineKey.set(pipelineKey, [
        {
          group: emptyBindGroup.group,
          resourceKey: emptyBindGroup.resourceKey,
          bindGroup: emptyBindGroup.bindGroup,
        },
        {
          group: bindGroup.group,
          resourceKey: bindGroup.resourceKey,
          bindGroup: bindGroup.bindGroup,
        },
      ]);
      readyDrawUseCount += 1;
    } catch (error) {
      diagnostics.push({
        code: "customWgslMaterial.shadowCasterPipelineCreationFailed",
        severity: "error",
        materialKey: drawUse.materialKey,
        pipelineKey,
        message: `Failed to create custom WGSL shadow caster pipeline '${pipelineKey}': ${messageFromCause(error)}; its casters fall back to the shared position-only caster.`,
      });
      failedMaterials.add(drawUse.materialKey);
    }
  }

  return {
    status:
      readyDrawUseCount === drawUses.length
        ? "available"
        : readyDrawUseCount > 0
          ? "partial"
          : "missing",
    requestedDrawUseCount: drawUses.length,
    readyDrawUseCount,
    createdPipelineCount,
    reusedPipelineCount,
    createdBindGroupCount,
    reusedBindGroupCount,
    pipelines,
    pipelineKeyByDraw,
    drawBindGroupsByPipelineKey,
    diagnostics,
  };
}

function getOrCreateCasterMaterialBindGroup(input: {
  readonly device: CustomWgslShadowCasterDeviceLike;
  readonly caster: CustomWgslShadowCasterMaterialInput;
  readonly cache: CustomWgslShadowCasterResourceCache | undefined;
  readonly diagnostics: CustomWgslShadowCasterDiagnostic[];
}): {
  readonly resource: CustomWgslShadowCasterBindGroupResource;
  readonly reused: boolean;
} | null {
  const material = input.caster.material;
  const resourcesByKey = new Map(
    input.caster.bindingResources.map((resource) => [
      resource.resourceKey,
      resource.resource,
    ]),
  );
  const entryResources = material.bindGroup.entries.map((entry) =>
    resourcesByKey.get(entry.resourceKey),
  );
  const cached = input.cache?.materialBindGroups.get(input.caster.materialKey);

  if (
    cached !== undefined &&
    cached.layoutResourceKey === material.bindGroupLayout.resourceKey &&
    entryResourcesMatch(cached.entryResources, entryResources)
  ) {
    return { resource: cached, reused: true };
  }

  let layout: unknown;

  try {
    // Reuse the cached explicit layout when only the bound resources changed —
    // the pipeline layout embedded in cached caster pipelines references it.
    layout =
      cached !== undefined &&
      cached.layoutResourceKey === material.bindGroupLayout.resourceKey
        ? cached.layout
        : input.device.createBindGroupLayout?.(
            createCustomWgslMaterialBindGroupLayoutDescriptor(material),
          );
  } catch (error) {
    input.diagnostics.push({
      code: "customWgslMaterial.shadowCasterBindGroupFailed",
      severity: "error",
      materialKey: input.caster.materialKey,
      message: `Failed to create custom WGSL shadow caster bind group layout for '${material.materialKey}': ${messageFromCause(error)}; its casters fall back to the shared position-only caster.`,
    });
    return null;
  }

  const result = createCustomWgslMaterialBindGroupResource({
    device: input.device,
    material,
    pipeline: {
      getBindGroupLayout: (group: number) => (group === 2 ? layout : undefined),
    },
    resources: input.caster.bindingResources,
  });

  for (const diagnostic of result.diagnostics) {
    input.diagnostics.push({
      code: diagnostic.code,
      severity: "error",
      materialKey: input.caster.materialKey,
      message: `Custom WGSL shadow caster bind group for '${material.materialKey}': ${diagnostic.message}`,
    });
  }

  if (!result.valid || result.resource === null) {
    input.diagnostics.push({
      code: "customWgslMaterial.shadowCasterBindGroupFailed",
      severity: "error",
      materialKey: input.caster.materialKey,
      message: `Custom WGSL material '${material.materialKey}' could not realize its shadow caster bind group; its casters fall back to the shared position-only caster.`,
    });
    return null;
  }

  const generation = (cached?.generation ?? 0) + 1;
  const resource: CustomWgslShadowCasterBindGroupResource = {
    materialKey: input.caster.materialKey,
    // The generation suffix makes recreation observable to the caster command
    // topology cache (resource keys change when the bind group is rebuilt).
    resourceKey: bindGroupResourceKey(
      `shadow-caster/custom-wgsl/${input.caster.materialKey}#${generation}`,
    ),
    group: 2,
    layout,
    bindGroup: result.resource.bindGroup,
    layoutResourceKey: material.bindGroupLayout.resourceKey,
    entryResources,
    generation,
  };

  input.cache?.materialBindGroups.set(input.caster.materialKey, resource);

  return { resource, reused: false };
}

function createEmptyGroup1BindGroup(
  device: CustomWgslShadowCasterDeviceLike,
  diagnostics: CustomWgslShadowCasterDiagnostic[],
): CustomWgslShadowCasterEmptyBindGroupResource | null {
  try {
    const layout = device.createBindGroupLayout?.({
      label: EMPTY_GROUP1_LAYOUT_KEY,
      entries: [],
    });
    const bindGroup = device.createBindGroup?.({
      label: EMPTY_GROUP1_LAYOUT_KEY,
      layout,
      entries: [],
    });

    return {
      resourceKey: bindGroupResourceKey(EMPTY_GROUP1_LAYOUT_KEY),
      group: 1,
      layout,
      bindGroup,
    };
  } catch (error) {
    diagnostics.push({
      code: "customWgslMaterial.shadowCasterBindGroupFailed",
      severity: "error",
      message: `Failed to create the reserved empty group(1) bind group for custom WGSL shadow casters: ${messageFromCause(error)}.`,
    });
    return null;
  }
}

function getOrCreateCasterShaderModule(input: {
  readonly device: CustomWgslShadowCasterDeviceLike;
  readonly caster: CustomWgslShadowCasterMaterialInput;
  readonly cache: CustomWgslShadowCasterResourceCache | undefined;
  readonly diagnostics: CustomWgslShadowCasterDiagnostic[];
}): unknown {
  const moduleKey = casterShaderModuleKey(input.caster.material);
  const cached = input.cache?.shaderModules.get(moduleKey);

  if (cached !== undefined) {
    return cached;
  }

  try {
    const shaderModule = input.device.createShaderModule?.({
      label: moduleKey,
      code: input.caster.material.shader.code,
    });

    if (shaderModule === undefined) {
      return null;
    }

    input.cache?.shaderModules.set(moduleKey, shaderModule);
    return shaderModule;
  } catch (error) {
    input.diagnostics.push({
      code: "customWgslMaterial.shadowCasterShaderModuleFailed",
      severity: "error",
      materialKey: input.caster.materialKey,
      message: `Failed to create the shadow caster shader module for custom WGSL material '${input.caster.material.materialKey}': ${messageFromCause(error)}; its casters fall back to the shared position-only caster.`,
    });
    return null;
  }
}

function casterShaderModuleKey(material: PreparedCustomWgslMaterial): string {
  return `${material.shader.moduleKey}:shadow-caster`;
}

function dedupeDrawUses(
  draws: readonly CustomWgslShadowCasterDrawUse[],
): readonly CustomWgslShadowCasterDrawUse[] {
  const byKey = new Map<string, CustomWgslShadowCasterDrawUse>();

  for (const draw of draws) {
    byKey.set(
      customWgslShadowCasterDrawKey(
        draw.materialKey,
        draw.meshLayoutKey,
        draw.casterCullMode,
      ),
      draw,
    );
  }

  return [...byKey.values()];
}

function entryResourcesMatch(
  a: readonly unknown[],
  b: readonly unknown[],
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
}

function containsWgslEntrypoint(code: string, entryPoint: string): boolean {
  return new RegExp(`\\bfn\\s+${escapeRegExp(entryPoint)}\\s*\\(`).test(code);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function messageFromCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function stableStringHash(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
