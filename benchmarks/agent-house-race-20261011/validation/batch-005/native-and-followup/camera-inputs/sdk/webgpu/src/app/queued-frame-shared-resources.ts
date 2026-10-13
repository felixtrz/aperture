import type {
  PackedSnapshotTransforms,
  PackedSnapshotViewUniforms,
} from "@aperture-engine/render";
import { retireWebGpuBuffer } from "../gpu/buffer.js";
import {
  createViewUniformBufferDescriptorScratch,
  writeViewUniformBufferDescriptor,
  type ViewUniformBufferDescriptorScratch,
} from "../resources/views/view-uniform-buffer.js";
import {
  createViewUniformGpuBuffer,
  type ViewUniformGpuBufferResource,
} from "../resources/views/view-uniform-buffer-resource.js";
import {
  createWorldTransformGpuBuffer,
  createWorldTransformBufferDescriptorScratch,
  writeWorldTransformBufferDescriptor,
  type WorldTransformBufferDescriptorScratch,
  type WorldTransformGpuBufferResource,
} from "../resources/transforms/world-transform-buffer.js";
import {
  writeVersionedBufferData,
  type VersionedUploadStamp,
} from "./app-frame-resource-utils.js";

interface SharedViewUniformResource {
  readonly resource: ViewUniformGpuBufferResource;
  /** Allocated GPU byte capacity, not necessarily the current active byte length. */
  readonly byteLength: number;
  readonly uploadStamp: VersionedUploadStamp;
}

interface SharedWorldTransformResource {
  readonly resource: WorldTransformGpuBufferResource;
  /** Allocated GPU byte capacity, not necessarily the current active byte length. */
  readonly byteLength: number;
  readonly uploadStamp: VersionedUploadStamp;
}

export interface QueuedBuiltInSharedFrameResourceCache {
  viewUniform: SharedViewUniformResource | null;
  worldTransforms: SharedWorldTransformResource | null;
  readonly viewDescriptorScratch: ViewUniformBufferDescriptorScratch;
  readonly worldTransformDescriptorScratch: WorldTransformBufferDescriptorScratch;
}

export interface PrepareQueuedBuiltInSharedFrameResourcesResult {
  readonly valid: boolean;
  readonly viewUniform: ViewUniformGpuBufferResource | null;
  readonly worldTransforms: WorldTransformGpuBufferResource | null;
  readonly diagnostics: readonly unknown[];
}

export function createQueuedBuiltInSharedFrameResourceCache(): QueuedBuiltInSharedFrameResourceCache {
  return {
    viewUniform: null,
    worldTransforms: null,
    viewDescriptorScratch: createViewUniformBufferDescriptorScratch(),
    worldTransformDescriptorScratch:
      createWorldTransformBufferDescriptorScratch(),
  };
}

export function prepareQueuedBuiltInSharedFrameResources(input: {
  readonly device: unknown;
  readonly cache: QueuedBuiltInSharedFrameResourceCache;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly worldTransforms: PackedSnapshotTransforms;
}): PrepareQueuedBuiltInSharedFrameResourcesResult {
  const viewDescriptor = writeViewUniformBufferDescriptor(
    input.viewUniforms,
    input.cache.viewDescriptorScratch,
  );
  const transformDescriptor = writeWorldTransformBufferDescriptor(
    input.worldTransforms,
    input.cache.worldTransformDescriptorScratch,
  );
  const diagnostics: unknown[] = [
    ...viewDescriptor.diagnostics,
    ...transformDescriptor.diagnostics,
  ];

  if (viewDescriptor.plan === null || transformDescriptor.plan === null) {
    return {
      valid: false,
      viewUniform: null,
      worldTransforms: null,
      diagnostics,
    };
  }

  const viewUniform = prepareSharedViewUniformResource(
    {
      device: input.device,
      cache: input.cache,
      viewUniforms: input.viewUniforms,
      source: viewDescriptor.plan.source,
      views: viewDescriptor.plan.views,
      plan: viewDescriptor.plan,
    },
    diagnostics,
  );
  const worldTransforms = prepareSharedWorldTransformResource(
    {
      device: input.device,
      cache: input.cache,
      worldTransforms: input.worldTransforms,
      source: transformDescriptor.plan.source,
      offsets: transformDescriptor.plan.offsets,
      plan: transformDescriptor.plan,
    },
    diagnostics,
  );

  return {
    valid: viewUniform !== null && worldTransforms !== null,
    viewUniform,
    worldTransforms,
    diagnostics,
  };
}

function prepareSharedViewUniformResource(
  input: {
    readonly device: unknown;
    readonly cache: QueuedBuiltInSharedFrameResourceCache;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly source: Float32Array;
    readonly views: ViewUniformGpuBufferResource["views"];
    readonly plan: Parameters<typeof createViewUniformGpuBuffer>[0]["plan"];
  },
  diagnostics: unknown[],
): ViewUniformGpuBufferResource | null {
  const cached = input.cache.viewUniform;

  if (cached !== null && cached.byteLength >= input.source.byteLength) {
    const outcome = writeVersionedBufferData(
      input.device,
      cached.resource.buffer,
      input.source,
      input.viewUniforms,
      cached.uploadStamp,
    );

    if (outcome === false) {
      return null;
    }

    (
      cached.resource as {
        views: typeof input.views;
      }
    ).views = input.views;
    return cached.resource;
  }

  if (cached !== null) {
    retireWebGpuBuffer(input.device, cached.resource.buffer);
    input.cache.viewUniform = null;
  }

  const capacity = nextSharedFrameBufferCapacity(input.source.byteLength);
  const plan =
    input.plan === null ? null : withDescriptorSize(input.plan, capacity);
  const created = createViewUniformGpuBuffer({
    device: input.device as Parameters<
      typeof createViewUniformGpuBuffer
    >[0]["device"],
    plan,
  });

  diagnostics.push(...created.diagnostics);

  if (!created.valid || created.resource === null) {
    return null;
  }

  input.cache.viewUniform = {
    resource: created.resource,
    byteLength: capacity,
    uploadStamp: { version: input.viewUniforms.contentVersion },
  };

  return created.resource;
}

function prepareSharedWorldTransformResource(
  input: {
    readonly device: unknown;
    readonly cache: QueuedBuiltInSharedFrameResourceCache;
    readonly worldTransforms: PackedSnapshotTransforms;
    readonly source: Float32Array;
    readonly offsets: WorldTransformGpuBufferResource["offsets"];
    readonly plan: Parameters<typeof createWorldTransformGpuBuffer>[0]["plan"];
  },
  diagnostics: unknown[],
): WorldTransformGpuBufferResource | null {
  const cached = input.cache.worldTransforms;

  if (cached !== null && cached.byteLength >= input.source.byteLength) {
    const outcome = writeVersionedBufferData(
      input.device,
      cached.resource.buffer,
      input.source,
      input.worldTransforms,
      cached.uploadStamp,
    );

    if (outcome === false) {
      return null;
    }

    (
      cached.resource as {
        offsets: typeof input.offsets;
      }
    ).offsets = input.offsets;
    return cached.resource;
  }

  if (cached !== null) {
    retireWebGpuBuffer(input.device, cached.resource.buffer);
    input.cache.worldTransforms = null;
  }

  const capacity = nextSharedFrameBufferCapacity(input.source.byteLength);
  const plan =
    input.plan === null ? null : withDescriptorSize(input.plan, capacity);
  const created = createWorldTransformGpuBuffer({
    device: input.device as Parameters<
      typeof createWorldTransformGpuBuffer
    >[0]["device"],
    plan,
  });

  diagnostics.push(...created.diagnostics);

  if (!created.valid || created.resource === null) {
    return null;
  }

  input.cache.worldTransforms = {
    resource: created.resource,
    byteLength: capacity,
    uploadStamp: { version: input.worldTransforms.contentVersion },
  };

  return created.resource;
}

function nextSharedFrameBufferCapacity(byteLength: number): number {
  let capacity = 256;

  while (capacity < byteLength) {
    capacity *= 2;
  }

  return capacity;
}

function withDescriptorSize<
  TPlan extends {
    readonly descriptor: { readonly size: number };
  },
>(plan: TPlan, size: number): TPlan {
  if (plan.descriptor.size === size) {
    return plan;
  }

  return {
    ...plan,
    descriptor: {
      ...plan.descriptor,
      size,
    },
  };
}
