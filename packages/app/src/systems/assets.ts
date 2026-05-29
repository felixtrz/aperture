import { signal as createSignal, type Signal } from "@preact/signals-core";
import {
  createGlbUriLoadCache,
  createGltfEcsAuthoringCommandPlan,
  createGltfPrimitiveMaterialResolutionReport,
  createGltfUriLoadCache,
  createWgslShaderAsset,
  createStandardMaterialAsset,
  loadGlbFromUri,
  loadGltfFromUri,
  registerGltfSourceAssetsFromReports,
  type GltfEcsAuthoringCommandPlan,
  type GltfMeshSourceAssetRegistrationReport,
  type GltfPrimitiveMaterialResolutionReport,
  type GltfReportDrivenImportReport,
  type GltfSourceAssetRegistrationReport,
} from "@aperture-engine/render";
import {
  assetHandleKey,
  createEnvironmentMapHandle,
  createMaterialHandle,
  createSceneHandle,
  createShaderHandle,
  createTextureHandle,
  type AssetRegistry,
  type AssetHandle,
  type SceneHandle,
  type ShaderHandle,
} from "@aperture-engine/simulation";
import type {
  ApertureConfig,
  ApertureConfigAssetDescriptor,
  AssetPreloadPolicy,
  ConfigAssetKind,
} from "../config.js";
import {
  formatReportDiagnostics,
  type ApertureSystemDiagnostic,
  type SystemDiagnostics,
} from "./diagnostics.js";
import { ApertureSystemError } from "./errors.js";

export type SystemAssetKind = ConfigAssetKind;

export interface SystemAssetHandle<TKind extends SystemAssetKind> {
  readonly id: string;
  readonly kind: TKind;
  readonly url: string;
  readonly preload: AssetPreloadPolicy;
  readonly ready: Signal<boolean>;
  readonly error: Signal<ApertureSystemDiagnostic | null>;
  readonly renderHandle: TKind extends "gltf" ? SceneHandle : unknown;
}

export type SystemGltfAssetHandle = SystemAssetHandle<"gltf"> & {
  readonly renderHandle: SceneHandle;
  readonly scene: Signal<SystemGltfLoadedScene | null>;
};

export type SystemShaderAssetHandle = SystemAssetHandle<"shader"> & {
  readonly renderHandle: ShaderHandle;
};

export interface SystemGltfLoadedScene {
  readonly assetId: string;
  readonly url: string;
  readonly sourceKind: "glb" | "gltf";
  readonly byteLength: number | null;
  readonly importReport: GltfReportDrivenImportReport;
  readonly sourceRegistration: GltfSourceAssetRegistrationReport;
  readonly meshRegistration: GltfMeshSourceAssetRegistrationReport;
  readonly primitiveMaterials: GltfPrimitiveMaterialResolutionReport;
  readonly commandPlan: GltfEcsAuthoringCommandPlan;
  readonly defaultMaterialHandleKey: string;
}

export interface SystemAssetAccess {
  gltf(id: string): SystemGltfAssetHandle;
  texture(id: string): SystemAssetHandle<"texture">;
  hdr(id: string): SystemAssetHandle<"hdr">;
  shader(id: string): SystemShaderAssetHandle;
  request(
    idOrHandle: string | SystemAssetHandle<SystemAssetKind>,
  ): Promise<void>;
  readiness(id: string): Signal<boolean>;
  error(id: string): Signal<ApertureSystemDiagnostic | null>;
  list(): readonly SystemAssetHandle<SystemAssetKind>[];
}

export interface ApertureAssetLoader {
  load(asset: SystemAssetHandle<SystemAssetKind>): Promise<void>;
}

export function createSystemAssetAccess(options: {
  readonly config: ApertureConfig | undefined;
  readonly registry: AssetRegistry;
  readonly diagnostics: SystemDiagnostics;
  readonly loader: ApertureAssetLoader | undefined;
}): SystemAssetAccess {
  const assets = new Map<string, SystemAssetHandle<SystemAssetKind>>();
  const glbCache = createGlbUriLoadCache();
  const gltfCache = createGltfUriLoadCache();

  for (const [id, descriptor] of Object.entries(options.config?.assets ?? {})) {
    const handle = createSystemAssetHandle(id, descriptor);
    assets.set(id, handle);

    if (!options.registry.has(handle.renderHandle as SceneHandle)) {
      options.registry.register(handle.renderHandle as SceneHandle, {
        label: descriptor.label ?? descriptor.url,
      });
    }
  }

  async function request(
    idOrHandle: string | SystemAssetHandle<SystemAssetKind>,
  ): Promise<void> {
    const handle =
      typeof idOrHandle === "string" ? lookup(idOrHandle) : idOrHandle;
    const registryHandle = handle.renderHandle as AssetHandle;

    if (handle.ready.value) {
      return;
    }

    const entry = options.registry.get(registryHandle);
    if (entry?.status !== "loading") {
      options.registry.markLoading(registryHandle);
    }

    try {
      if (options.loader !== undefined) {
        await options.loader.load(handle);
      } else if (handle.kind === "gltf") {
        const scene = await loadSystemGltfAsset({
          handle: handle as SystemGltfAssetHandle,
          registry: options.registry,
          glbCache,
          gltfCache,
        });
        (handle as SystemGltfAssetHandle).scene.value = scene;
      } else if (handle.kind === "shader") {
        const shaderAsset = await loadSystemShaderAsset(
          handle as SystemShaderAssetHandle,
        );
        options.registry.markReady(registryHandle as ShaderHandle, shaderAsset);
      }

      if (handle.kind !== "shader") {
        options.registry.markReady(registryHandle, {
          id: handle.id,
          kind: handle.kind,
          url: handle.url,
          ...sceneReadyMetadata(handle),
        });
      }
      handle.ready.value = true;
      handle.error.value = null;
    } catch (error: unknown) {
      const diagnostic: ApertureSystemDiagnostic = {
        code: "aperture.asset.loadFailed",
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : `Asset '${handle.id}' failed to load.`,
        data: {
          asset: handle.id,
          kind: handle.kind,
          url: handle.url,
          phase: "load",
          blocksStartup: handle.preload === "blocking",
        },
        suggestedFix: "Check the asset URL in aperture.config.ts.",
      };

      options.registry.markFailed(registryHandle, [
        {
          code: diagnostic.code,
          severity: "error",
          message: diagnostic.message,
        },
      ]);
      handle.error.value = diagnostic;
      options.diagnostics.error(diagnostic.code, diagnostic.data);
      throw error;
    }
  }

  function lookup(id: string): SystemAssetHandle<SystemAssetKind> {
    const handle = assets.get(id);

    if (handle === undefined) {
      throw new ApertureSystemError(
        "aperture.asset.unknown",
        `Asset '${id}' is not declared in aperture.config.ts.`,
        "Add the asset to the config assets object before using this.assets.",
      );
    }

    return handle;
  }

  return {
    gltf(id) {
      const handle = lookup(id);
      if (handle.kind !== "gltf") {
        throw new ApertureSystemError(
          "aperture.asset.kindMismatch",
          `Asset '${id}' is '${handle.kind}', not 'gltf'.`,
          "Use this.assets.gltf() only with asset.gltf() declarations.",
        );
      }

      return handle as SystemGltfAssetHandle;
    },
    texture(id) {
      const handle = lookup(id);
      if (handle.kind !== "texture") {
        throw new ApertureSystemError(
          "aperture.asset.kindMismatch",
          `Asset '${id}' is '${handle.kind}', not 'texture'.`,
          "Use this.assets.texture() only with asset.texture() declarations.",
        );
      }

      return handle as SystemAssetHandle<"texture">;
    },
    hdr(id) {
      const handle = lookup(id);
      if (handle.kind !== "hdr") {
        throw new ApertureSystemError(
          "aperture.asset.kindMismatch",
          `Asset '${id}' is '${handle.kind}', not 'hdr'.`,
          "Use this.assets.hdr() only with asset.hdr() declarations.",
        );
      }

      return handle as SystemAssetHandle<"hdr">;
    },
    shader(id) {
      const handle = lookup(id);
      if (handle.kind !== "shader") {
        throw new ApertureSystemError(
          "aperture.asset.kindMismatch",
          `Asset '${id}' is '${handle.kind}', not 'shader'.`,
          "Use this.assets.shader() only with asset.shader() declarations.",
        );
      }

      return handle as SystemShaderAssetHandle;
    },
    request,
    readiness(id) {
      return lookup(id).ready;
    },
    error(id) {
      return lookup(id).error;
    },
    list() {
      return [...assets.values()];
    },
  };
}

function createSystemAssetHandle(
  id: string,
  descriptor: ApertureConfigAssetDescriptor,
): SystemAssetHandle<SystemAssetKind> {
  if (descriptor.kind === "gltf") {
    return {
      id,
      kind: descriptor.kind,
      url: descriptor.url,
      preload: descriptor.preload,
      ready: createSignal(false),
      error: createSignal<ApertureSystemDiagnostic | null>(null),
      renderHandle: createSceneHandle(id),
      scene: createSignal<SystemGltfLoadedScene | null>(null),
    } as SystemGltfAssetHandle;
  }

  return {
    id,
    kind: descriptor.kind,
    url: descriptor.url,
    preload: descriptor.preload,
    ready: createSignal(false),
    error: createSignal<ApertureSystemDiagnostic | null>(null),
    renderHandle:
      descriptor.kind === "texture"
        ? createTextureHandle(id)
        : descriptor.kind === "hdr"
          ? createEnvironmentMapHandle(id)
          : descriptor.kind === "shader"
            ? createShaderHandle(id)
            : createSceneHandle(id),
  } as SystemAssetHandle<SystemAssetKind>;
}

async function loadSystemShaderAsset(
  handle: SystemShaderAssetHandle,
): Promise<ReturnType<typeof createWgslShaderAsset>> {
  const resolvedUrl = resolveAssetUrl(handle.url);

  if (resolvedUrl === null) {
    throw new ApertureSystemError(
      "aperture.asset.invalidUrl",
      `Shader asset '${handle.id}' URL '${handle.url}' could not be resolved.`,
      "Use an absolute URL, a root-relative Vite public asset URL, or a data URL in aperture.config.ts.",
      {
        asset: handle.id,
        url: handle.url,
        kind: handle.kind,
        preload: handle.preload,
        phase: "load",
        blocksStartup: handle.preload === "blocking",
      },
    );
  }

  if (typeof fetch !== "function") {
    throw new ApertureSystemError(
      "aperture.asset.shaderFetchUnavailable",
      `Shader asset '${handle.id}' cannot be fetched in this environment.`,
      "Provide an ApertureAssetLoader in tests/headless mode or run in a browser worker with fetch support.",
      {
        asset: handle.id,
        url: handle.url,
        kind: handle.kind,
        preload: handle.preload,
        phase: "load",
        blocksStartup: handle.preload === "blocking",
      },
    );
  }

  const response = await fetch(resolvedUrl);

  if (!response.ok) {
    throw new ApertureSystemError(
      "aperture.asset.shaderLoadFailed",
      `Shader asset '${handle.id}' failed to load with HTTP ${response.status}.`,
      "Check the shader URL in aperture.config.ts.",
      {
        asset: handle.id,
        url: handle.url,
        status: response.status,
        kind: handle.kind,
        preload: handle.preload,
        phase: "load",
        blocksStartup: handle.preload === "blocking",
      },
    );
  }

  return createWgslShaderAsset({
    label: handle.id,
    source: await response.text(),
    url: resolvedUrl,
    virtualPath: handle.url,
  });
}

async function loadSystemGltfAsset(input: {
  readonly handle: SystemGltfAssetHandle;
  readonly registry: AssetRegistry;
  readonly glbCache: ReturnType<typeof createGlbUriLoadCache>;
  readonly gltfCache: ReturnType<typeof createGltfUriLoadCache>;
}): Promise<SystemGltfLoadedScene> {
  const resolvedUrl = resolveAssetUrl(input.handle.url);

  if (resolvedUrl === null) {
    throw new ApertureSystemError(
      "aperture.asset.invalidUrl",
      `GLTF asset '${input.handle.id}' URL '${input.handle.url}' could not be resolved.`,
      "Use an absolute URL, a root-relative Vite public asset URL, or a data URL in aperture.config.ts.",
      {
        asset: input.handle.id,
        url: input.handle.url,
        kind: input.handle.kind,
        preload: input.handle.preload,
        phase: "load",
        blocksStartup: input.handle.preload === "blocking",
      },
    );
  }

  const sourceKind = gltfSourceKindFromUrl(resolvedUrl);
  const loaded =
    sourceKind === "gltf"
      ? await loadGltfFromUri(resolvedUrl, {
          cache: input.gltfCache,
          keyPrefix: input.handle.id,
          createAssetMapping: true,
          createMeshAssets: true,
        })
      : await loadGlbFromUri(resolvedUrl, {
          cache: input.glbCache,
          keyPrefix: input.handle.id,
          createAssetMapping: true,
          createMeshAssets: true,
        });
  const importReport =
    loaded.loader === null
      ? null
      : "gltfImportReport" in loaded.loader
        ? loaded.loader.gltfImportReport
        : loaded.loader.glbImportReport.importReport;

  if (!loaded.ok || importReport === null) {
    throw new ApertureSystemError(
      "aperture.asset.gltfLoadFailed",
      `GLTF asset '${input.handle.id}' failed to load. ${formatReportDiagnostics(
        loaded.diagnostics,
      )}`,
      "Check the asset URL in aperture.config.ts and use a supported glTF/GLB file.",
    );
  }

  if (
    importReport.assetMapping === null ||
    importReport.meshConstruction === null ||
    importReport.meshPrimitive === null
  ) {
    throw new ApertureSystemError(
      "aperture.asset.gltfNotRenderable",
      `GLTF asset '${input.handle.id}' did not produce renderable mesh/material reports.`,
      "Use a glTF/GLB with triangle mesh primitives and supported material inputs.",
    );
  }

  const defaultMaterialHandle = createMaterialHandle(
    `${input.handle.id}.default-material`,
  );
  const defaultMaterialHandleKey = assetHandleKey(defaultMaterialHandle);
  if (!input.registry.has(defaultMaterialHandle)) {
    input.registry.register(defaultMaterialHandle, {
      label: `${input.handle.id} default GLTF material`,
    });
    input.registry.markReady(
      defaultMaterialHandle,
      createStandardMaterialAsset({
        label: `${input.handle.id} default GLTF material`,
      }),
    );
  }

  const registration = registerGltfSourceAssetsFromReports({
    registry: input.registry,
    assetMapping: importReport.assetMapping,
    meshConstruction: importReport.meshConstruction,
  });

  if (
    !registration.valid ||
    registration.sourceRegistration === null ||
    registration.meshRegistration === null
  ) {
    throw new ApertureSystemError(
      "aperture.asset.gltfRegistrationFailed",
      `GLTF asset '${input.handle.id}' source assets could not be registered. ${formatReportDiagnostics(
        registration.diagnostics,
      )}`,
      "Check for duplicate generated asset keys or unsupported glTF source assets.",
    );
  }

  const primitiveMaterials = createGltfPrimitiveMaterialResolutionReport({
    primitiveReport: importReport.meshPrimitive,
    registrationReport: registration.sourceRegistration,
    availableMaterialHandleKeys: [defaultMaterialHandleKey],
    defaultMaterialHandleKey,
    keyPrefix: input.handle.id,
  });

  if (!primitiveMaterials.valid) {
    throw new ApertureSystemError(
      "aperture.asset.gltfMaterialResolutionFailed",
      `GLTF asset '${input.handle.id}' primitive materials could not be resolved. ${formatReportDiagnostics(
        primitiveMaterials.diagnostics,
      )}`,
      "Use supported glTF materials or provide material data for all primitives.",
    );
  }

  const commandPlan = createGltfEcsAuthoringCommandPlan({
    traversalReport: importReport.sceneTraversal,
    meshRegistrationReport: registration.meshRegistration,
    primitiveMaterialReport: primitiveMaterials,
  });

  if (!commandPlan.valid) {
    throw new ApertureSystemError(
      "aperture.asset.gltfCommandPlanFailed",
      `GLTF asset '${input.handle.id}' could not be converted to ECS spawn commands. ${formatReportDiagnostics(
        commandPlan.diagnostics,
      )}`,
      "Check the glTF scene hierarchy and mesh primitive data.",
    );
  }

  return {
    assetId: input.handle.id,
    url: loaded.url,
    sourceKind,
    byteLength: loaded.byteLength,
    importReport,
    sourceRegistration: registration.sourceRegistration,
    meshRegistration: registration.meshRegistration,
    primitiveMaterials,
    commandPlan,
    defaultMaterialHandleKey,
  };
}

function sceneReadyMetadata(
  handle: SystemAssetHandle<SystemAssetKind>,
): Record<string, unknown> {
  if (handle.kind !== "gltf") {
    return {};
  }

  const scene = (handle as SystemGltfAssetHandle).scene.value;

  if (scene === null) {
    return {};
  }

  return {
    sourceKind: scene.sourceKind,
    byteLength: scene.byteLength,
    sceneIndex: scene.importReport.sceneTraversal.sceneIndex,
    rootEntityKeys: scene.commandPlan.rootEntityKeys,
    commandCount: scene.commandPlan.commands.length,
    meshPrimitiveCount: scene.importReport.meshPrimitive?.meshes.length ?? 0,
    meshAssetCount: scene.meshRegistration.written.length,
    materialAssetCount: scene.sourceRegistration.written.filter(
      (entry) => entry.kind === "material",
    ).length,
  };
}

function resolveAssetUrl(url: string): string | null {
  try {
    return new URL(url).href;
  } catch {
    const href = (
      globalThis as { readonly location?: { readonly href?: string } }
    ).location?.href;

    if (href === undefined) {
      return null;
    }

    try {
      return new URL(url, href).href;
    } catch {
      return null;
    }
  }
}

function gltfSourceKindFromUrl(url: string): "glb" | "gltf" {
  if (url.startsWith("data:")) {
    return "glb";
  }

  try {
    return new URL(url).pathname.toLowerCase().endsWith(".gltf")
      ? "gltf"
      : "glb";
  } catch {
    return url.toLowerCase().endsWith(".gltf") ? "gltf" : "glb";
  }
}
