import { meshBufferResourceKey } from "../resources/core/resource-keys.js";
import type {
  ShadowCasterExecutableMeshResourceView,
  ShadowCasterExecutableVertexBufferView,
} from "./shadow-caster-command-record-plan.js";
import type { ShadowCasterPreparedMeshResourceView } from "./shadow-caster-frame-resource-readiness.js";

export interface ShadowCasterPreparedMeshFacadeEntryLike {
  readonly assetKey: string;
  readonly sourceVersion?: number;
  readonly label: string;
  readonly meshResourceKey?: string;
}

export interface ShadowCasterMeshGpuResourceLike {
  readonly resourceKey: string;
  readonly vertexBuffers: readonly ShadowCasterMeshGpuVertexBufferLike[];
  readonly indexBuffer?: ShadowCasterMeshGpuIndexBufferLike | null;
}

export interface ShadowCasterMeshGpuVertexBufferLike {
  readonly resourceKey: string;
  readonly buffer?: unknown;
  readonly vertexCount?: number;
}

export interface ShadowCasterMeshGpuIndexBufferLike {
  readonly resourceKey: string;
  readonly buffer?: unknown;
  readonly format?: string;
  readonly indexCount?: number;
}

export interface ShadowCasterPreparedMeshSourceLike {
  readonly resources?: {
    readonly resources?: {
      readonly meshResources?: readonly ShadowCasterMeshGpuResourceLike[];
    };
  };
  readonly resourceReuse?: {
    readonly preparedMeshFacade?: {
      readonly entries?: readonly ShadowCasterPreparedMeshFacadeEntryLike[];
    };
  };
}

export interface ShadowCasterMeshViews {
  readonly preparedMeshes: readonly ShadowCasterPreparedMeshResourceView[];
  readonly executableMeshes: readonly ShadowCasterExecutableMeshResourceView[];
}

export function createShadowCasterMeshViewsFromAppReport(
  report: ShadowCasterPreparedMeshSourceLike,
): ShadowCasterMeshViews {
  return {
    preparedMeshes: createShadowCasterPreparedMeshViews(report),
    executableMeshes: createShadowCasterExecutableMeshViews(report),
  };
}

export function createShadowCasterPreparedMeshViews(
  report: ShadowCasterPreparedMeshSourceLike,
): readonly ShadowCasterPreparedMeshResourceView[] {
  const meshResourceByLabel = createMeshResourceByLabel(report);
  const meshResourceByKey = new Map<
    string,
    ShadowCasterPreparedMeshResourceView
  >();

  for (const entry of preparedMeshFacadeEntries(report)) {
    const resource = resolvePreparedMeshResource(meshResourceByLabel, entry);

    if (resource === undefined) {
      continue;
    }

    meshResourceByKey.set(entry.assetKey, {
      meshKey: entry.assetKey,
      meshResourceKey: resource.resourceKey,
      vertexBufferResourceKeys: resource.vertexBuffers.map(
        (buffer) => buffer.resourceKey,
      ),
      indexBufferResourceKey: resource.indexBuffer?.resourceKey ?? null,
    });
  }

  return [...meshResourceByKey.values()];
}

export function createShadowCasterExecutableMeshViews(
  report: ShadowCasterPreparedMeshSourceLike,
): readonly ShadowCasterExecutableMeshResourceView[] {
  const meshResourceByLabel = createMeshResourceByLabel(report);
  const meshResourceByKey = new Map<
    string,
    ShadowCasterExecutableMeshResourceView
  >();

  for (const entry of preparedMeshFacadeEntries(report)) {
    const resource = resolvePreparedMeshResource(meshResourceByLabel, entry);

    if (resource === undefined) {
      continue;
    }

    meshResourceByKey.set(entry.assetKey, {
      meshKey: entry.assetKey,
      meshResourceKey: resource.resourceKey,
      vertexBuffers: resource.vertexBuffers.map(toExecutableVertexBuffer),
      indexBuffer:
        resource.indexBuffer === undefined || resource.indexBuffer === null
          ? null
          : toExecutableIndexBuffer(resource.indexBuffer),
    });
  }

  return [...meshResourceByKey.values()];
}

function createMeshResourceByLabel(
  report: ShadowCasterPreparedMeshSourceLike,
): ReadonlyMap<string, ShadowCasterMeshGpuResourceLike> {
  return new Map(
    (report.resources?.resources?.meshResources ?? []).map((resource) => [
      resource.resourceKey,
      resource,
    ]),
  );
}

function resolvePreparedMeshResource(
  resources: ReadonlyMap<string, ShadowCasterMeshGpuResourceLike>,
  entry: ShadowCasterPreparedMeshFacadeEntryLike,
): ShadowCasterMeshGpuResourceLike | undefined {
  for (const key of preparedMeshResourceCandidateKeys(entry)) {
    const resource = resources.get(key);

    if (resource !== undefined) {
      return resource;
    }
  }

  return undefined;
}

function preparedMeshResourceCandidateKeys(
  entry: ShadowCasterPreparedMeshFacadeEntryLike,
): readonly string[] {
  return [
    ...(entry.meshResourceKey === undefined ? [] : [entry.meshResourceKey]),
    ...(entry.sourceVersion === undefined
      ? []
      : [meshBufferResourceKey(`${entry.assetKey}@v${entry.sourceVersion}`)]),
    meshBufferResourceKey(entry.label),
  ];
}

function preparedMeshFacadeEntries(
  report: ShadowCasterPreparedMeshSourceLike,
): readonly ShadowCasterPreparedMeshFacadeEntryLike[] {
  return report.resourceReuse?.preparedMeshFacade?.entries ?? [];
}

function toExecutableVertexBuffer(
  buffer: ShadowCasterMeshGpuVertexBufferLike,
): ShadowCasterExecutableVertexBufferView {
  return {
    resourceKey: buffer.resourceKey,
    buffer: buffer.buffer ?? null,
    vertexCount: buffer.vertexCount ?? 0,
  };
}

function toExecutableIndexBuffer(
  buffer: ShadowCasterMeshGpuIndexBufferLike,
): ShadowCasterExecutableMeshResourceView["indexBuffer"] {
  return {
    resourceKey: buffer.resourceKey,
    buffer: buffer.buffer ?? null,
    format: buffer.format ?? "uint32",
    indexCount: buffer.indexCount ?? 0,
  };
}
