import type { BuiltInMaterialQueueFamily } from "./built-in-material-queue-family.js";
import {
  createBuiltInMaterialQueueRouteAdapterRegistry,
  type BuiltInMaterialQueueRouteAdapter,
} from "./built-in-material-queue-adapter.js";
import type { PreparedAppTextureSamplerResources } from "./app-texture-sampler-resources.js";
import type { MatcapFrameGpuResources } from "./matcap-frame-resources.js";
import type { StandardFrameGpuResources } from "./standard-frame-resources.js";
import type { UnlitFrameGpuResources } from "./unlit-frame-resources.js";
import type { CreateMatcapAppFrameResourcesResult } from "./matcap-app-frame-resources.js";
import type { CreateStandardAppFrameResourcesResult } from "./standard-app-frame-resources.js";
import type { CreateUnlitAppFrameResourcesResult } from "./unlit-app-frame-resources.js";
import {
  createQueuedMaterialAdapterRegistry,
  type QueuedMaterialAdapterRegistration,
  type QueuedMaterialAdapterRegistry,
} from "./queued-material-adapter.js";

export type QueuedBuiltInFrameResource =
  | UnlitFrameGpuResources
  | MatcapFrameGpuResources
  | StandardFrameGpuResources;

export interface QueuedMaterialFrameResourceAdapterResult<
  TResources = unknown,
  TDiagnostic = unknown,
> {
  readonly valid: boolean;
  readonly resources: TResources | null;
  readonly diagnostics: readonly TDiagnostic[];
}

export interface QueuedMaterialFrameResourceAdapterContext<TItem, TOptions> {
  readonly item: TItem;
  readonly options: TOptions;
}

export type CreateQueuedBuiltInFamilyFrameResourcesResult =
  | CreateUnlitAppFrameResourcesResult
  | CreateMatcapAppFrameResourcesResult
  | CreateStandardAppFrameResourcesResult;

export interface QueuedBuiltInFrameResourceBuckets {
  readonly unlit: UnlitFrameGpuResources[];
  readonly matcap: MatcapFrameGpuResources[];
  readonly standard: StandardFrameGpuResources[];
}

export type QueuedBuiltInFrameResourceAdapterStatus =
  | "appended"
  | "skipped"
  | "failed";

export interface QueuedBuiltInFrameResourceAdapterReport<
  TDiagnostic = unknown,
> {
  readonly valid: boolean;
  readonly status: QueuedBuiltInFrameResourceAdapterStatus;
  readonly family: BuiltInMaterialQueueFamily;
  readonly diagnostics: readonly TDiagnostic[];
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

export interface QueuedBuiltInAppResourceFamilyAdapter<
  TextureOptions,
  FrameOptions,
> {
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

export type QueuedBuiltInAppResourceFamilyAdapterTable<
  TextureOptions,
  FrameOptions,
> = {
  readonly [Family in BuiltInMaterialQueueFamily]: QueuedBuiltInAppResourceFamilyAdapter<
    TextureOptions,
    FrameOptions
  >;
};

export interface QueuedBuiltInAppResourceAdapterCallbacks<
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
  ): CreateUnlitAppFrameResourcesResult;
  createMatcapFrameResources(
    options: FrameOptions,
  ): CreateMatcapAppFrameResourcesResult;
  createStandardFrameResources(
    options: FrameOptions,
  ): CreateStandardAppFrameResourcesResult;
}

export interface QueuedBuiltInAppResourceAdapterTableOptions<
  TextureOptions,
  FrameOptions,
> {
  readonly families: QueuedBuiltInAppResourceFamilyAdapterTable<
    TextureOptions,
    FrameOptions
  >;
}

export type QueuedBuiltInAppResourceAdapterFactoryOptions<
  TextureOptions,
  FrameOptions,
> =
  | QueuedBuiltInAppResourceAdapterCallbacks<TextureOptions, FrameOptions>
  | QueuedBuiltInAppResourceAdapterTableOptions<TextureOptions, FrameOptions>;

export function createQueuedBuiltInAppResourceFamilyAdapterTable<
  TextureOptions,
  FrameOptions,
>(
  options: QueuedBuiltInAppResourceAdapterCallbacks<
    TextureOptions,
    FrameOptions
  >,
): QueuedBuiltInAppResourceFamilyAdapterTable<TextureOptions, FrameOptions> {
  return {
    unlit: {
      prepareTextureSamplerResources:
        options.prepareUnlitTextureSamplerResources,
      createFrameResources: options.createUnlitFrameResources,
      appendFrameResource: (resource, buckets) => {
        buckets.unlit.push(resource as UnlitFrameGpuResources);
      },
    },
    matcap: {
      prepareTextureSamplerResources:
        options.prepareMatcapTextureSamplerResources,
      createFrameResources: options.createMatcapFrameResources,
      appendFrameResource: (resource, buckets) => {
        buckets.matcap.push(resource as MatcapFrameGpuResources);
      },
    },
    standard: {
      prepareTextureSamplerResources:
        options.prepareStandardTextureSamplerResources,
      createFrameResources: options.createStandardFrameResources,
      appendFrameResource: (resource, buckets) => {
        buckets.standard.push(resource as StandardFrameGpuResources);
      },
    },
  };
}

export function createQueuedBuiltInFrameResourceViaAdapter<
  FrameOptions,
>(input: {
  readonly adapter: Pick<
    QueuedBuiltInAppResourceAdapter<unknown, FrameOptions>,
    "kind" | "createFrameResources" | "appendFrameResource"
  >;
  readonly frameOptions: FrameOptions;
  readonly buckets: QueuedBuiltInFrameResourceBuckets;
}): QueuedBuiltInFrameResourceAdapterReport {
  const result = input.adapter.createFrameResources(input.frameOptions);

  return appendQueuedBuiltInFrameResourceViaAdapter({
    adapter: input.adapter,
    result,
    buckets: input.buckets,
  });
}

export function appendQueuedBuiltInFrameResourceViaAdapter(input: {
  readonly adapter: Pick<
    QueuedBuiltInAppResourceAdapter<unknown, unknown>,
    "kind" | "appendFrameResource"
  >;
  readonly result: CreateQueuedBuiltInFamilyFrameResourcesResult;
  readonly buckets: QueuedBuiltInFrameResourceBuckets;
}): QueuedBuiltInFrameResourceAdapterReport {
  const result = input.result;

  if (!result.valid) {
    return {
      valid: false,
      status: "failed",
      family: input.adapter.kind,
      diagnostics: result.diagnostics,
    };
  }

  if (result.resources === null) {
    return {
      valid: true,
      status: "skipped",
      family: input.adapter.kind,
      diagnostics: result.diagnostics,
    };
  }

  input.adapter.appendFrameResource(result.resources, input.buckets);

  return {
    valid: true,
    status: "appended",
    family: input.adapter.kind,
    diagnostics: result.diagnostics,
  };
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
  const familyAdapters =
    resolveQueuedBuiltInAppResourceFamilyAdapterTable(options);

  return createQueuedMaterialAdapterRegistry(
    createBuiltInMaterialQueueRouteAdapterRegistry().adapters.map(
      (routeAdapter) =>
        createQueuedBuiltInAppResourceAdapter(routeAdapter, familyAdapters),
    ),
  );
}

function resolveQueuedBuiltInAppResourceFamilyAdapterTable<
  TextureOptions,
  FrameOptions,
>(
  options: QueuedBuiltInAppResourceAdapterFactoryOptions<
    TextureOptions,
    FrameOptions
  >,
): QueuedBuiltInAppResourceFamilyAdapterTable<TextureOptions, FrameOptions> {
  return "families" in options
    ? options.families
    : createQueuedBuiltInAppResourceFamilyAdapterTable(options);
}

function createQueuedBuiltInAppResourceAdapter<TextureOptions, FrameOptions>(
  routeAdapter: BuiltInMaterialQueueRouteAdapter,
  familyAdapters: QueuedBuiltInAppResourceFamilyAdapterTable<
    TextureOptions,
    FrameOptions
  >,
): QueuedBuiltInAppResourceAdapter<TextureOptions, FrameOptions> {
  return {
    ...routeAdapter,
    ...familyAdapters[routeAdapter.kind],
  };
}
