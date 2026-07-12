// Automatic IBL wiring for the snapshot render loop. Before this module,
// prepareWebGpuAppEnvironmentAssets was only reachable from hand-written
// harnesses (examples, the CLI render harness): a generated app that authored
// an environment light extracted an EnvironmentPacket but no
// standardMaterialIblResources ever reached the frame, so IBL silently never
// rendered. createWebGpuApp now resolves the active snapshot environment
// against ready environment-map registry entries through this preparer.
//
// Preparation dispatches GPU compute (equirect→cube projection, PMREM
// prefilter, irradiance convolution), so results are memoized by the active
// handle plus every ready environment entry's registry version. A frame with
// an unchanged environment never re-prepares; a version bump (asset mutation)
// re-runs the chain exactly once.

import {
  assetHandleKey,
  type AssetRegistry,
  type EnvironmentMapHandle,
} from "@aperture-engine/simulation";
import type { RenderSnapshot } from "@aperture-engine/render";
import type { StandardFrameIblResources } from "../materials/standard/standard-frame-resources.js";
import {
  prepareWebGpuAppEnvironmentAssets,
  type WebGpuAppEnvironmentAssetInput,
  type WebGpuAppEnvironmentEquirectSource,
} from "./app-environment-resources.js";

export interface WebGpuAppEnvironmentFramePreparer {
  /**
   * Resolve prepared IBL resources for the snapshot's active environment, or
   * undefined when the snapshot references no environment or no matching
   * ready environment-map asset exists in the registry.
   */
  resolve(snapshot: RenderSnapshot): StandardFrameIblResources | undefined;
}

export function firstSnapshotEnvironmentHandle(
  snapshot: RenderSnapshot,
): EnvironmentMapHandle | null {
  for (const environment of snapshot.environments ?? []) {
    if (environment?.handle !== null && environment?.handle !== undefined) {
      return environment.handle;
    }
  }

  return null;
}

export function environmentAssetInputsFromRegistry(
  registry: AssetRegistry,
): WebGpuAppEnvironmentAssetInput[] {
  const inputs: WebGpuAppEnvironmentAssetInput[] = [];

  for (const entry of registry.list({
    kind: "environment-map",
    status: "ready",
  })) {
    const input = environmentAssetInputFromEntry(entry);

    if (input !== null) {
      inputs.push(input);
    }
  }

  return inputs;
}

export function createWebGpuAppEnvironmentFramePreparer(options: {
  readonly app: object;
  readonly registry: AssetRegistry;
}): WebGpuAppEnvironmentFramePreparer {
  let preparedKey: string | null = null;
  let preparedResources: StandardFrameIblResources | undefined;

  return {
    resolve(snapshot) {
      const activeHandle = firstSnapshotEnvironmentHandle(snapshot);

      if (activeHandle === null) {
        return undefined;
      }

      const inputs = environmentAssetInputsFromRegistry(options.registry);

      if (inputs.length === 0) {
        return undefined;
      }

      const key = preparationKey(activeHandle, inputs);

      if (key === preparedKey) {
        return preparedResources;
      }

      const prepared = prepareWebGpuAppEnvironmentAssets({
        app: options.app,
        assets: inputs,
        activeHandle,
      });

      // Cache misses as well as hits: an environment that cannot become ready
      // (unsupported device, malformed source) must not re-dispatch the
      // preparation compute chain every frame.
      preparedKey = key;
      preparedResources =
        prepared.active !== null && prepared.active.ready
          ? prepared.active.standardMaterialIblResources
          : undefined;
      return preparedResources;
    },
  };
}

function preparationKey(
  activeHandle: EnvironmentMapHandle,
  inputs: readonly WebGpuAppEnvironmentAssetInput[],
): string {
  const parts = [`active:${assetHandleKey(activeHandle)}`];

  for (const input of inputs) {
    parts.push(`${assetHandleKey(input.handle)}@${input.version ?? 0}`);
  }

  return parts.join("|");
}

function environmentAssetInputFromEntry(entry: {
  readonly handle: unknown;
  readonly label?: string;
  readonly version: number;
  readonly asset: unknown;
}): WebGpuAppEnvironmentAssetInput | null {
  if (entry.asset === null || typeof entry.asset !== "object") {
    return null;
  }

  const handle = entry.handle as EnvironmentMapHandle;
  const asset = entry.asset as {
    readonly label?: unknown;
    readonly diffuseResourceKey?: unknown;
    readonly specularResourceKey?: unknown;
    readonly equirectSource?: unknown;
    readonly standardMaterialCount?: unknown;
  };
  const equirectSource = equirectSourceFromValue(asset.equirectSource);

  if (equirectSource === null) {
    return null;
  }

  return {
    handle,
    label:
      typeof asset.label === "string"
        ? asset.label
        : (entry.label ?? handle.id),
    version: entry.version,
    diffuseResourceKey:
      typeof asset.diffuseResourceKey === "string"
        ? asset.diffuseResourceKey
        : `environment-map:${handle.id}:diffuse`,
    specularResourceKey:
      typeof asset.specularResourceKey === "string"
        ? asset.specularResourceKey
        : `environment-map:${handle.id}:specular`,
    equirectSource,
    ...(typeof asset.standardMaterialCount === "number" &&
    Number.isInteger(asset.standardMaterialCount)
      ? { standardMaterialCount: asset.standardMaterialCount }
      : {}),
  };
}

function equirectSourceFromValue(
  value: unknown,
): WebGpuAppEnvironmentEquirectSource | null {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const source = value as {
    readonly width?: unknown;
    readonly height?: unknown;
    readonly data?: unknown;
    readonly label?: unknown;
    readonly resourceKey?: unknown;
    readonly faceSize?: unknown;
    readonly format?: unknown;
    readonly mipLevelCount?: unknown;
  };

  if (
    !Number.isInteger(source.width) ||
    !Number.isInteger(source.height) ||
    !(source.data instanceof Uint8Array)
  ) {
    return null;
  }

  return {
    width: source.width as number,
    height: source.height as number,
    data: source.data,
    ...(typeof source.label === "string" ? { label: source.label } : {}),
    ...(typeof source.resourceKey === "string"
      ? { resourceKey: source.resourceKey }
      : {}),
    ...(Number.isInteger(source.faceSize)
      ? { faceSize: source.faceSize as number }
      : {}),
    ...(source.format === "rgba8unorm" || source.format === "rgba16float"
      ? { format: source.format }
      : {}),
    ...(Number.isInteger(source.mipLevelCount)
      ? { mipLevelCount: source.mipLevelCount as number }
      : {}),
  };
}
