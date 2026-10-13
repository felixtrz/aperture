import {
  assetHandleKey,
  type AssetRegistry,
  type MaterialHandle,
} from "@aperture-engine/simulation";
import {
  createDebugNormalPreparedMaterialResourceDescriptor,
  type DebugNormalMaterialAsset,
  type PreparedMaterialResourceDiagnostic,
} from "@aperture-engine/render";
import {
  createDebugNormalMaterialBindGroupDescriptorPlan,
  createDebugNormalMaterialBindGroupResource,
  type DebugNormalMaterialBindGroupDescriptorDiagnostic,
  type DebugNormalMaterialBindGroupLayoutResource,
  type DebugNormalMaterialBindGroupResource,
  type DebugNormalMaterialBindGroupResourceDiagnostic,
} from "./debug-normal-bind-group.js";
import {
  createDebugNormalMaterialGpuPreparationPlan,
  type DebugNormalMaterialBufferDescriptorDiagnostic,
  type DebugNormalMaterialPackingDiagnostic,
} from "./debug-normal-material-buffer.js";
import {
  createDebugNormalMaterialGpuBuffer,
  type DebugNormalMaterialGpuBufferDiagnostic,
  type DebugNormalMaterialGpuBufferResource,
} from "./debug-normal-material-buffer-resource.js";
import type { DebugNormalFrameGpuResourceDeviceLike } from "./debug-normal-frame-resources.js";

export type PreparedDebugNormalMaterialCacheStatus =
  | "created"
  | "reused"
  | "failed";

export interface PreparedDebugNormalMaterialResource {
  readonly cacheKey: string;
  readonly sourceMaterialKey: string;
  readonly sourceVersion: number;
  lastUsedFrame: number;
  readonly pipelineKey: string;
  readonly layoutKey: string;
  readonly materialResourceKey: string;
  readonly bindGroupResourceKey: string;
  readonly material: DebugNormalMaterialGpuBufferResource;
  readonly bindGroup: DebugNormalMaterialBindGroupResource;
}

export interface PreparedDebugNormalMaterialCache {
  readonly resources: Map<string, PreparedDebugNormalMaterialResource>;
}

export type PreparedDebugNormalMaterialDiagnostic =
  | PreparedMaterialResourceDiagnostic
  | DebugNormalMaterialPackingDiagnostic
  | DebugNormalMaterialBufferDescriptorDiagnostic
  | DebugNormalMaterialGpuBufferDiagnostic
  | DebugNormalMaterialBindGroupDescriptorDiagnostic
  | DebugNormalMaterialBindGroupResourceDiagnostic
  | {
      readonly code:
        | "preparedDebugNormalMaterial.missingLayout"
        | "preparedDebugNormalMaterial.missingPreparedBindGroup";
      readonly message: string;
      readonly materialKey?: string;
      readonly layoutKey?: string;
    };

export interface PrepareDebugNormalMaterialResourceOptions {
  readonly registry: AssetRegistry;
  readonly device: DebugNormalFrameGpuResourceDeviceLike;
  readonly cache: PreparedDebugNormalMaterialCache;
  readonly handle: MaterialHandle;
  readonly material: DebugNormalMaterialAsset;
  readonly sourceVersion: number;
  readonly frame?: number | undefined;
  readonly pipelineKey: string;
  readonly layout: DebugNormalMaterialBindGroupLayoutResource | null;
}

export interface PrepareDebugNormalMaterialResourceResult {
  readonly valid: boolean;
  readonly status: PreparedDebugNormalMaterialCacheStatus;
  readonly resource: PreparedDebugNormalMaterialResource | null;
  readonly diagnostics: readonly PreparedDebugNormalMaterialDiagnostic[];
}

export function createPreparedDebugNormalMaterialCache(): PreparedDebugNormalMaterialCache {
  return { resources: new Map() };
}

export function prepareDebugNormalMaterialResource(
  options: PrepareDebugNormalMaterialResourceOptions,
): PrepareDebugNormalMaterialResourceResult {
  const sourceMaterialKey = assetHandleKey(options.handle);

  if (options.layout === null) {
    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: [
        {
          code: "preparedDebugNormalMaterial.missingLayout",
          materialKey: sourceMaterialKey,
          message:
            "DebugNormal prepared material caching requires a group-2 material bind group layout.",
        },
      ],
    };
  }

  const descriptorResult = createDebugNormalPreparedMaterialResourceDescriptor({
    registry: options.registry,
    material: options.handle,
  });

  if (!descriptorResult.valid || descriptorResult.descriptor === null) {
    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics: descriptorResult.diagnostics,
    };
  }

  const cacheKey = preparedDebugNormalMaterialCacheKey({
    sourceMaterialKey,
    sourceVersion: options.sourceVersion,
    pipelineKey: options.pipelineKey,
    layoutKey: options.layout.layoutKey,
  });
  const cached = options.cache.resources.get(cacheKey);

  if (cached !== undefined) {
    cached.lastUsedFrame = options.frame ?? 0;

    return {
      valid: true,
      status: "reused",
      resource: cached,
      diagnostics: [],
    };
  }

  const preparation = createDebugNormalMaterialGpuPreparationPlan(
    options.material,
    {
      label: descriptorResult.descriptor.materialResourceKey,
    },
  );
  const material = createDebugNormalMaterialGpuBuffer({
    device: options.device,
    plan: preparation.plan?.materialBuffer ?? null,
  });
  const bindGroupPlan = createDebugNormalMaterialBindGroupDescriptorPlan({
    materialResourceKey: material.resource?.resourceKey ?? null,
  });
  const bindGroup = createDebugNormalMaterialBindGroupResource({
    device: options.device,
    plan: bindGroupPlan,
    layout: options.layout,
    buffers:
      material.resource === null
        ? []
        : [
            {
              resourceKey: material.resource.resourceKey,
              buffer: material.resource.uniformBuffer,
            },
          ],
  });
  const diagnostics: PreparedDebugNormalMaterialDiagnostic[] = [
    ...preparation.diagnostics,
    ...material.diagnostics,
    ...bindGroupPlan.diagnostics,
    ...bindGroup.diagnostics,
  ];

  if (
    diagnostics.length > 0 ||
    !preparation.valid ||
    preparation.plan === null ||
    !material.valid ||
    material.resource === null ||
    !bindGroup.valid ||
    bindGroup.resource === null
  ) {
    if (bindGroup.resource === null && diagnostics.length === 0) {
      diagnostics.push({
        code: "preparedDebugNormalMaterial.missingPreparedBindGroup",
        materialKey: sourceMaterialKey,
        layoutKey: options.layout.layoutKey,
        message:
          "DebugNormal prepared material caching did not create a group-2 bind group.",
      });
    }

    return {
      valid: false,
      status: "failed",
      resource: null,
      diagnostics,
    };
  }

  const resource: PreparedDebugNormalMaterialResource = {
    cacheKey,
    sourceMaterialKey,
    sourceVersion: options.sourceVersion,
    lastUsedFrame: options.frame ?? 0,
    pipelineKey: options.pipelineKey,
    layoutKey: options.layout.layoutKey,
    materialResourceKey: material.resource.resourceKey,
    bindGroupResourceKey: bindGroup.resource.resourceKey,
    material: material.resource,
    bindGroup: bindGroup.resource,
  };

  options.cache.resources.set(cacheKey, resource);

  return {
    valid: true,
    status: "created",
    resource,
    diagnostics: [],
  };
}

export function preparedDebugNormalMaterialCacheKey(input: {
  readonly sourceMaterialKey: string;
  readonly sourceVersion: number;
  readonly pipelineKey: string;
  readonly layoutKey: string;
}): string {
  return [
    input.sourceMaterialKey,
    `version:${input.sourceVersion}`,
    `pipeline:${input.pipelineKey}`,
    `layout:${input.layoutKey}`,
  ].join("|");
}
