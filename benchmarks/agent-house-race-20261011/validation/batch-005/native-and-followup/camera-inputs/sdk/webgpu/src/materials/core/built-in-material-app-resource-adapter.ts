import {
  BUILT_IN_MATERIAL_QUEUE_FAMILIES,
  type BuiltInMaterialQueueFamily,
} from "./built-in-material-queue-family.js";
import {
  createBuiltInMaterialQueueRouteAdapterRegistry,
  type BuiltInMaterialQueueRouteAdapter,
} from "./built-in-material-queue-adapter.js";
import type { PreparedAppTextureSamplerResources } from "../../app/app-texture-sampler-resources.js";
import type { DebugNormalFrameGpuResources } from "../debug-normal/debug-normal-frame-resources.js";
import type { MatcapFrameGpuResources } from "../matcap/matcap-frame-resources.js";
import type { StandardFrameGpuResources } from "../standard/standard-frame-resources.js";
import type { UnlitFrameGpuResources } from "../unlit/unlit-frame-resources.js";
import type { CreateDebugNormalAppFrameResourcesResult } from "../debug-normal/debug-normal-app-frame-resources.js";
import type { CreateMatcapAppFrameResourcesResult } from "../matcap/matcap-app-frame-resources.js";
import type { CreateStandardAppFrameResourcesResult } from "../standard/standard-app-frame-resources.js";
import type { CreateUnlitAppFrameResourcesResult } from "../unlit/unlit-app-frame-resources.js";
import {
  createQueuedMaterialAdapterRegistry,
  type QueuedMaterialAdapterRegistry,
  type QueuedMaterialAdapterRegistryDiagnostic,
  type QueuedMaterialAdapterRegistration,
} from "../../render/queues/queued-material-adapter.js";

export const BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES =
  BUILT_IN_MATERIAL_QUEUE_FAMILIES;

export type QueuedBuiltInFrameResource =
  | UnlitFrameGpuResources
  | MatcapFrameGpuResources
  | StandardFrameGpuResources
  | DebugNormalFrameGpuResources;

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
  | CreateStandardAppFrameResourcesResult
  | CreateDebugNormalAppFrameResourcesResult;

export interface QueuedBuiltInFrameResourceBuckets {
  readonly unlit: UnlitFrameGpuResources[];
  readonly matcap: MatcapFrameGpuResources[];
  readonly standard: StandardFrameGpuResources[];
  readonly debugNormal: DebugNormalFrameGpuResources[];
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
  prepareDebugNormalTextureSamplerResources(
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
  createDebugNormalFrameResources(
    options: FrameOptions,
  ): CreateDebugNormalAppFrameResourcesResult;
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

export type QueuedBuiltInAppResourceAdapterRegistryDiagnostic =
  | QueuedMaterialAdapterRegistryDiagnostic
  | {
      readonly code: "queuedBuiltInAppResourceAdapter.missingFamily";
      readonly severity: "error";
      readonly family: BuiltInMaterialQueueFamily;
      readonly message: string;
    };

export interface QueuedBuiltInAppResourceAdapterRegistryValidationReport {
  readonly valid: boolean;
  readonly expectedFamilies: readonly BuiltInMaterialQueueFamily[];
  readonly registeredFamilies: readonly string[];
  readonly diagnostics: readonly QueuedBuiltInAppResourceAdapterRegistryDiagnostic[];
}

export interface QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue {
  readonly valid: boolean;
  readonly expectedFamilies: readonly BuiltInMaterialQueueFamily[];
  readonly registeredFamilies: readonly string[];
  readonly diagnostics: readonly QueuedBuiltInAppResourceAdapterRegistryDiagnostic[];
}

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
    "debug-normal": {
      prepareTextureSamplerResources:
        options.prepareDebugNormalTextureSamplerResources,
      createFrameResources: options.createDebugNormalFrameResources,
      appendFrameResource: (resource, buckets) => {
        buckets.debugNormal.push(resource as DebugNormalFrameGpuResources);
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
  return createQueuedMaterialAdapterRegistry(
    createQueuedBuiltInAppResourceAdapterRegistrations(options),
  );
}

export function validateQueuedBuiltInAppResourceAdapterRegistry(
  registry: QueuedMaterialAdapterRegistry<
    QueuedMaterialAdapterRegistration<string>
  >,
): QueuedBuiltInAppResourceAdapterRegistryValidationReport {
  const registeredFamilies = registry.adapters.map((adapter) => adapter.kind);
  const registeredFamilySet = new Set(registeredFamilies);
  const diagnostics: QueuedBuiltInAppResourceAdapterRegistryDiagnostic[] = [
    ...registry.diagnostics,
  ];

  for (const family of BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES) {
    if (registeredFamilySet.has(family)) {
      continue;
    }

    diagnostics.push({
      code: "queuedBuiltInAppResourceAdapter.missingFamily",
      severity: "error",
      family,
      message: `Built-in app resource adapter family '${family}' is not registered.`,
    });
  }

  return {
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    expectedFamilies: BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES,
    registeredFamilies,
    diagnostics,
  };
}

export function queuedBuiltInAppResourceAdapterRegistryValidationReportToJsonValue(
  report: QueuedBuiltInAppResourceAdapterRegistryValidationReport,
): QueuedBuiltInAppResourceAdapterRegistryValidationJsonValue {
  return {
    valid: report.valid,
    expectedFamilies: [...report.expectedFamilies],
    registeredFamilies: [...report.registeredFamilies],
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function createQueuedBuiltInAppResourceAdapterRegistrations<
  TextureOptions,
  FrameOptions,
>(
  options: QueuedBuiltInAppResourceAdapterFactoryOptions<
    TextureOptions,
    FrameOptions
  >,
): readonly QueuedBuiltInAppResourceAdapter<TextureOptions, FrameOptions>[] {
  const familyAdapters =
    resolveQueuedBuiltInAppResourceFamilyAdapterTable(options);
  const routeRegistry = createBuiltInMaterialQueueRouteAdapterRegistry();

  return BUILT_IN_APP_RESOURCE_ADAPTER_FAMILIES.map((family) =>
    createQueuedBuiltInAppResourceAdapter(
      requireBuiltInMaterialRouteAdapter(routeRegistry, family),
      familyAdapters,
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

function requireBuiltInMaterialRouteAdapter(
  registry: QueuedMaterialAdapterRegistry<BuiltInMaterialQueueRouteAdapter>,
  family: BuiltInMaterialQueueFamily,
): BuiltInMaterialQueueRouteAdapter {
  const adapter = registry.get(family);

  if (adapter === null) {
    throw new Error(
      `Missing built-in material queue route adapter for '${family}'.`,
    );
  }

  return adapter;
}
