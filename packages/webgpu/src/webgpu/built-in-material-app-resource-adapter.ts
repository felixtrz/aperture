import type { BuiltInMaterialQueueFamily } from "./built-in-material-queue-family.js";
import {
  createBuiltInMaterialQueueRouteAdapterRegistry,
  type BuiltInMaterialQueueRouteAdapter,
} from "./built-in-material-queue-adapter.js";
import type { PreparedAppTextureSamplerResources } from "./app-texture-sampler-resources.js";
import type {
  CreateMatcapFrameGpuResourcesResult,
  MatcapFrameGpuResources,
} from "./matcap-frame-resources.js";
import type {
  CreateStandardFrameGpuResourcesResult,
  StandardFrameGpuResources,
} from "./standard-frame-resources.js";
import type {
  CreateUnlitFrameGpuResourcesResult,
  UnlitFrameGpuResources,
} from "./unlit-frame-resources.js";
import {
  createQueuedMaterialAdapterRegistry,
  type QueuedMaterialAdapterRegistration,
  type QueuedMaterialAdapterRegistry,
} from "./queued-material-adapter.js";

export type QueuedBuiltInFrameResource =
  | UnlitFrameGpuResources
  | MatcapFrameGpuResources
  | StandardFrameGpuResources;

export type CreateQueuedBuiltInFamilyFrameResourcesResult =
  | CreateUnlitFrameGpuResourcesResult
  | CreateMatcapFrameGpuResourcesResult
  | CreateStandardFrameGpuResourcesResult;

export interface QueuedBuiltInFrameResourceBuckets {
  readonly unlit: UnlitFrameGpuResources[];
  readonly matcap: MatcapFrameGpuResources[];
  readonly standard: StandardFrameGpuResources[];
}

export interface QueuedBuiltInAppResourceAdapter<TextureOptions, FrameOptions>
  extends
    BuiltInMaterialQueueRouteAdapter,
    QueuedMaterialAdapterRegistration<BuiltInMaterialQueueFamily> {
  readonly kind: BuiltInMaterialQueueFamily;
  prepareTextureSamplerResources(
    options: TextureOptions,
  ): PreparedAppTextureSamplerResources;
  createFrameResources(
    options: FrameOptions,
  ): CreateQueuedBuiltInFamilyFrameResourcesResult;
  appendFrameResource(
    resource: QueuedBuiltInFrameResource,
    buckets: QueuedBuiltInFrameResourceBuckets,
  ): void;
}

export interface QueuedBuiltInAppResourceAdapterFactoryOptions<
  TextureOptions,
  FrameOptions,
> {
  prepareUnlitTextureSamplerResources(
    options: TextureOptions,
  ): PreparedAppTextureSamplerResources;
  prepareMatcapTextureSamplerResources(
    options: TextureOptions,
  ): PreparedAppTextureSamplerResources;
  prepareStandardTextureSamplerResources(
    options: TextureOptions,
  ): PreparedAppTextureSamplerResources;
  createUnlitFrameResources(
    options: FrameOptions,
  ): CreateUnlitFrameGpuResourcesResult;
  createMatcapFrameResources(
    options: FrameOptions,
  ): CreateMatcapFrameGpuResourcesResult;
  createStandardFrameResources(
    options: FrameOptions,
  ): CreateStandardFrameGpuResourcesResult;
}

export function createQueuedBuiltInAppResourceAdapterRegistry<
  TextureOptions,
  FrameOptions,
>(
  options: QueuedBuiltInAppResourceAdapterFactoryOptions<
    TextureOptions,
    FrameOptions
  >,
): QueuedMaterialAdapterRegistry<
  QueuedBuiltInAppResourceAdapter<TextureOptions, FrameOptions>
> {
  return createQueuedMaterialAdapterRegistry(
    createBuiltInMaterialQueueRouteAdapterRegistry().adapters.map(
      (routeAdapter) =>
        createQueuedBuiltInAppResourceAdapter(routeAdapter, options),
    ),
  );
}

function createQueuedBuiltInAppResourceAdapter<TextureOptions, FrameOptions>(
  routeAdapter: BuiltInMaterialQueueRouteAdapter,
  options: QueuedBuiltInAppResourceAdapterFactoryOptions<
    TextureOptions,
    FrameOptions
  >,
): QueuedBuiltInAppResourceAdapter<TextureOptions, FrameOptions> {
  switch (routeAdapter.kind) {
    case "unlit":
      return {
        ...routeAdapter,
        prepareTextureSamplerResources:
          options.prepareUnlitTextureSamplerResources,
        createFrameResources: options.createUnlitFrameResources,
        appendFrameResource: (resource, buckets) => {
          buckets.unlit.push(resource as UnlitFrameGpuResources);
        },
      };
    case "matcap":
      return {
        ...routeAdapter,
        prepareTextureSamplerResources:
          options.prepareMatcapTextureSamplerResources,
        createFrameResources: options.createMatcapFrameResources,
        appendFrameResource: (resource, buckets) => {
          buckets.matcap.push(resource as MatcapFrameGpuResources);
        },
      };
    case "standard":
      return {
        ...routeAdapter,
        prepareTextureSamplerResources:
          options.prepareStandardTextureSamplerResources,
        createFrameResources: options.createStandardFrameResources,
        appendFrameResource: (resource, buckets) => {
          buckets.standard.push(resource as StandardFrameGpuResources);
        },
      };
  }
}
