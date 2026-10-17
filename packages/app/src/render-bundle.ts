/** Renderer-only portable bundle consumption, shared by browser and native tooling. */
import { AssetRegistry } from "@aperture-engine/simulation";
import {
  decodeTypedArrayTree,
  renderSnapshotFromJsonValue,
} from "@aperture-engine/render";
import {
  createWebGpuApp,
  createWebGpuBloomPostEffect,
  createWebGpuSsaoPostEffect,
  firstSnapshotEnvironmentHandle,
  environmentAssetInputsFromRegistry,
  prepareWebGpuAppEnvironmentAssets,
  webGpuAppRenderReportToJsonValue,
  type CreateWebGpuAppOptions,
  type WebGpuApp,
  type WebGpuAppRenderReport,
  type WebGpuRendererInitializationSuccess,
} from "@aperture-engine/webgpu";
import { mirrorSourceAssetRegistryFromMessage } from "./asset-mirror.js";

export interface PortableRenderTimings {
  readonly decodeSnapshotMs: number;
  readonly restoreAssetsMs: number;
  readonly initializeRendererMs: number;
  readonly prepareEnvironmentMs: number;
  readonly renderCpuMs: number;
  readonly totalMs: number;
}

export interface PortableRenderStatus {
  readonly ok: boolean;
  readonly frame: number;
  readonly timings?: PortableRenderTimings;
  readonly diagnostics: readonly unknown[];
  readonly shadow?: unknown;
  readonly metadata: {
    readonly webgpu: {
      readonly format: string;
      readonly displayColorSpace: string;
      readonly adapterInfo: Readonly<Record<string, string | number | boolean>>;
      readonly adapterFeatures: readonly string[];
      readonly deviceFeatures: readonly string[];
    };
    readonly lightingHealth: unknown;
  };
}

export function portableRenderStatus(
  report: WebGpuAppRenderReport,
  webgpu: PortableRenderStatus["metadata"]["webgpu"],
): PortableRenderStatus {
  const status = webGpuAppRenderReportToJsonValue(report, { detail: "status" });
  return {
    ok: report.ok === true,
    frame: report.snapshot.frame,
    diagnostics: status.diagnostics,
    ...(status.shadow === undefined ? {} : { shadow: status.shadow }),
    metadata: { webgpu, lightingHealth: report.lightingHealth ?? null },
  };
}

/** Caller owns app disposal after presentation/readback. Failures dispose before rejecting. */
export async function renderPortableBundle(
  bundleValue: unknown,
  options: Omit<
    CreateWebGpuAppOptions,
    "sourceAssets" | "simulationWorker" | "autoStart"
  >,
): Promise<{
  readonly app: WebGpuApp;
  readonly status: PortableRenderStatus;
}> {
  const started = performance.now();
  const bundle = record(bundleValue);
  const portable = bundle.format === "aperture.render-bundle";
  const envelope = record(bundle.snapshot);
  const snapshotValue =
    portable && envelope.codec === "json-typed-array-v1"
      ? envelope.value
      : bundle.snapshot;
  const snapshot = renderSnapshotFromJsonValue(
    snapshotValue as Parameters<typeof renderSnapshotFromJsonValue>[0],
  );
  const decodedAt = performance.now();
  const assets = record(bundle.assets);
  const sourceAssets = new AssetRegistry();
  mirrorSourceAssetRegistryFromMessage(sourceAssets, {
    sourceAssets: decodeTypedArrayTree(
      portable ? { entries: assets.entries } : bundle.sourceAssets,
    ),
  });
  const restoredAt = performance.now();
  const target = portable ? record(bundle.renderTarget) : {};
  const postEffects = [
    ...(target.ssao !== null && typeof target.ssao === "object"
      ? [createWebGpuSsaoPostEffect(target.ssao)]
      : []),
    ...(target.bloom !== null && typeof target.bloom === "object"
      ? [createWebGpuBloomPostEffect(target.bloom)]
      : []),
    ...(options.postEffects ?? []),
  ];
  const result = await createWebGpuApp({
    ...options,
    sourceAssets,
    autoStart: false,
    ...(postEffects.length === 0 ? {} : { postEffects }),
    ...(typeof target.sampleCount === "number"
      ? { msaaSampleCount: target.sampleCount }
      : {}),
    ...(target.colorSpace === "srgb" ? { outputColorSpace: "srgb" } : {}),
    ...(typeof target.toneMapping === "string"
      ? {
          tonemap: target.toneMapping as NonNullable<
            CreateWebGpuAppOptions["tonemap"]
          >,
        }
      : {}),
    ...(typeof target.exposure === "number" && Number.isFinite(target.exposure)
      ? { exposure: target.exposure }
      : {}),
  });
  if (!result.ok)
    throw new Error(
      `WebGPU initialization failed (${result.reason}): ${result.message}`,
    );
  const initializedAt = performance.now();
  try {
    const activeHandle = firstSnapshotEnvironmentHandle(snapshot);
    let renderOptions: Parameters<WebGpuApp["renderSnapshot"]>[1] = {};
    if (activeHandle !== null) {
      const inputs = environmentAssetInputsFromRegistry(sourceAssets);
      if (inputs.length === 0)
        throw new Error(
          "Render bundle references an environment map but contains no embedded environment asset input.",
        );
      const prepared = prepareWebGpuAppEnvironmentAssets({
        app: result.app,
        assets: inputs,
        activeHandle,
      });
      if (prepared.active === null || !prepared.active.ready)
        throw new Error(
          "Embedded environment asset input could not be prepared.",
        );
      renderOptions = {
        standardMaterialIblResources:
          prepared.active.standardMaterialIblResources,
      };
    }
    const preparedAt = performance.now();
    const report = await result.app.renderSnapshot(snapshot, renderOptions);
    const renderedAt = performance.now();
    return {
      app: result.app,
      status: {
        ...portableRenderStatus(
          report,
          await webGpuMetadata(result.initialization),
        ),
        timings: {
          decodeSnapshotMs: decodedAt - started,
          restoreAssetsMs: restoredAt - decodedAt,
          initializeRendererMs: initializedAt - restoredAt,
          prepareEnvironmentMs: preparedAt - initializedAt,
          renderCpuMs: renderedAt - preparedAt,
          totalMs: renderedAt - started,
        },
      },
    };
  } catch (error) {
    await result.app.dispose();
    throw error;
  }
}

async function webGpuMetadata(
  initialization: WebGpuRendererInitializationSuccess,
): Promise<PortableRenderStatus["metadata"]["webgpu"]> {
  const adapter = initialization.adapter as unknown as {
    info?: unknown;
    requestAdapterInfo?: () => Promise<unknown>;
  } | null;
  let info = adapter?.info;
  if (info === undefined && adapter?.requestAdapterInfo !== undefined) {
    try {
      info = await adapter.requestAdapterInfo();
    } catch {
      info = {};
    }
  }
  const raw = record(info);
  const adapterInfo: Record<string, string | number | boolean> = {};
  for (const key of new Set([
    ...Object.keys(raw),
    "vendor",
    "architecture",
    "device",
    "description",
    "isFallbackAdapter",
  ])) {
    const value = raw[key];
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    )
      adapterInfo[key] = value;
  }
  const features = (value: unknown): string[] =>
    value !== null && typeof value === "object" && Symbol.iterator in value
      ? Array.from(value as Iterable<unknown>, String).sort()
      : [];
  return {
    format: initialization.format,
    displayColorSpace: initialization.displayColorSpace,
    adapterInfo,
    adapterFeatures: features(initialization.adapter?.features),
    deviceFeatures: features(initialization.device.features),
  };
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
