import type { MaterialAsset, MaterialQueueItem } from "@aperture-engine/render";
import type {
  QueuedMaterialAdapterRegistration,
  QueuedMaterialAdapterRegistry,
} from "./queued-material-adapter.js";

export type QueuedMaterialPrepareRouteStatus =
  | "prepared"
  | "reused"
  | "skipped"
  | "failed";

export type QueuedMaterialPrepareRouteDiagnosticCode =
  | "queuedMaterialPrepareRoute.missingAdapter"
  | "queuedMaterialPrepareRoute.materialMismatch";

export interface QueuedMaterialPrepareRouteDiagnostic {
  readonly code: QueuedMaterialPrepareRouteDiagnosticCode;
  readonly message: string;
  readonly renderId: number;
  readonly drawIndex: number;
  readonly materialFamily: string;
  readonly materialKind?: string;
  readonly materialKey: string;
  readonly entity?: {
    readonly index: number;
    readonly generation: number;
  };
}

export interface QueuedMaterialPrepareRouteContext<TMaterial = MaterialAsset> {
  readonly queueItem: MaterialQueueItem;
  readonly material: TMaterial;
  readonly sourceVersion: number;
  readonly frame: number;
}

export interface QueuedMaterialPrepareRouteResult<TDiagnostic = unknown> {
  readonly valid: boolean;
  readonly status: QueuedMaterialPrepareRouteStatus;
  readonly family: string;
  readonly materialKey: string;
  readonly meshResourceKey: string | null;
  readonly materialResourceKey: string | null;
  readonly pipelineKey: string;
  readonly sourceVersion: number;
  readonly frame: number;
  readonly diagnostics: readonly TDiagnostic[];
}

export interface QueuedMaterialPrepareRouteAdapter<
  Kind extends string = string,
  TMaterial = MaterialAsset,
  TDiagnostic = unknown,
> extends QueuedMaterialAdapterRegistration<Kind> {
  acceptsMaterial(material: unknown): material is TMaterial;
  validateQueueItem(queueItem: MaterialQueueItem): TDiagnostic | null;
  prepareRoute(
    context: QueuedMaterialPrepareRouteContext<TMaterial>,
  ): QueuedMaterialPrepareRouteResult<TDiagnostic>;
}

export type QueuedMaterialPrepareRouteAdapterDiagnostic<TAdapter> =
  TAdapter extends QueuedMaterialPrepareRouteAdapter<
    infer _Kind,
    infer _Material,
    infer TDiagnostic
  >
    ? TDiagnostic
    : never;

type QueuedMaterialPrepareRouteResultDiagnostic<
  TAdapter extends QueuedMaterialPrepareRouteAdapter<string, unknown, unknown>,
> =
  | QueuedMaterialPrepareRouteDiagnostic
  | QueuedMaterialPrepareRouteAdapterDiagnostic<TAdapter>;

export function routeQueuedMaterialPrepare<
  TAdapter extends QueuedMaterialPrepareRouteAdapter<string, unknown, unknown>,
>(
  registry: QueuedMaterialAdapterRegistry<TAdapter>,
  context: QueuedMaterialPrepareRouteContext<unknown>,
): QueuedMaterialPrepareRouteResult<
  QueuedMaterialPrepareRouteResultDiagnostic<TAdapter>
> {
  const adapter = registry.get(context.queueItem.materialFamily);

  if (adapter === null) {
    return createQueuedMaterialPrepareRouteFailure(context, {
      status: "skipped",
      diagnostics: [missingAdapterDiagnostic(context)],
    });
  }

  if (!adapter.acceptsMaterial(context.material)) {
    return createQueuedMaterialPrepareRouteFailure(context, {
      status: "failed",
      diagnostics: [materialMismatchDiagnostic(context)],
    });
  }

  const routeDiagnostic = adapter.validateQueueItem(context.queueItem);

  if (routeDiagnostic !== null) {
    return createQueuedMaterialPrepareRouteFailure<
      QueuedMaterialPrepareRouteResultDiagnostic<TAdapter>
    >(context, {
      status: "failed",
      diagnostics: [
        routeDiagnostic as QueuedMaterialPrepareRouteResultDiagnostic<TAdapter>,
      ],
    });
  }

  return adapter.prepareRoute(context) as QueuedMaterialPrepareRouteResult<
    QueuedMaterialPrepareRouteResultDiagnostic<TAdapter>
  >;
}

export function createQueuedMaterialPrepareRouteResult<TDiagnostic = never>(
  context: QueuedMaterialPrepareRouteContext<unknown>,
  options: {
    readonly valid?: boolean;
    readonly status?: QueuedMaterialPrepareRouteStatus;
    readonly diagnostics?: readonly TDiagnostic[];
  } = {},
): QueuedMaterialPrepareRouteResult<TDiagnostic> {
  return {
    valid: options.valid ?? true,
    status: options.status ?? "prepared",
    family: context.queueItem.materialFamily,
    materialKey: context.queueItem.materialKey,
    meshResourceKey: context.queueItem.meshResourceKey,
    materialResourceKey: context.queueItem.materialResourceKey,
    pipelineKey: context.queueItem.pipelineKey,
    sourceVersion: context.sourceVersion,
    frame: context.frame,
    diagnostics: options.diagnostics ?? [],
  };
}

function createQueuedMaterialPrepareRouteFailure<TDiagnostic>(
  context: QueuedMaterialPrepareRouteContext<unknown>,
  options: {
    readonly status: Extract<
      QueuedMaterialPrepareRouteStatus,
      "skipped" | "failed"
    >;
    readonly diagnostics: readonly TDiagnostic[];
  },
): QueuedMaterialPrepareRouteResult<TDiagnostic> {
  return createQueuedMaterialPrepareRouteResult(context, {
    valid: false,
    status: options.status,
    diagnostics: options.diagnostics,
  });
}

function missingAdapterDiagnostic(
  context: QueuedMaterialPrepareRouteContext<unknown>,
): QueuedMaterialPrepareRouteDiagnostic {
  const materialKind = readQueuedMaterialKind(context.material);

  return {
    code: "queuedMaterialPrepareRoute.missingAdapter",
    renderId: context.queueItem.renderId,
    drawIndex: context.queueItem.drawIndex,
    materialFamily: context.queueItem.materialFamily,
    ...(materialKind === undefined ? {} : { materialKind }),
    materialKey: context.queueItem.materialKey,
    entity: context.queueItem.entity,
    message: `No queued material prepare route adapter is registered for material family '${context.queueItem.materialFamily}'.`,
  };
}

function materialMismatchDiagnostic(
  context: QueuedMaterialPrepareRouteContext<unknown>,
): QueuedMaterialPrepareRouteDiagnostic {
  const materialKind = readQueuedMaterialKind(context.material);

  return {
    code: "queuedMaterialPrepareRoute.materialMismatch",
    renderId: context.queueItem.renderId,
    drawIndex: context.queueItem.drawIndex,
    materialFamily: context.queueItem.materialFamily,
    ...(materialKind === undefined ? {} : { materialKind }),
    materialKey: context.queueItem.materialKey,
    entity: context.queueItem.entity,
    message:
      materialKind === undefined
        ? `Queued material family '${context.queueItem.materialFamily}' does not match source material.`
        : `Queued material family '${context.queueItem.materialFamily}' does not match source material kind '${materialKind}'.`,
  };
}

function readQueuedMaterialKind(material: unknown): string | undefined {
  return typeof material === "object" &&
    material !== null &&
    "kind" in material &&
    typeof material.kind === "string"
    ? material.kind
    : undefined;
}
