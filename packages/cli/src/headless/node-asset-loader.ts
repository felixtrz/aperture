import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";
import { decode as decodeJpeg } from "jpeg-js";
import type {
  ApertureAssetLoadContext,
  ApertureAssetLoader,
  ApertureAssetLoadResult,
  SystemAssetHandle,
  SystemAssetKind,
  SystemAudioAssetHandle,
  SystemGltfAnimationClip,
  SystemGltfAssetHandle,
  SystemGltfLoadedScene,
  SystemParticleEffectAssetHandle,
  SystemShaderAssetHandle,
  SystemTextureAssetHandle,
  SystemGltfAssetDecoderProvider,
} from "@aperture-engine/app/systems";
import {
  assetHandleKey,
  createAnimationClipHandle,
  createMaterialHandle,
  createParticleEffectHandle,
  type AnimationClip,
  type AssetHandle,
} from "@aperture-engine/simulation";
import {
  createAudioClipAsset,
  createBasisUniversalKtx2Transcoder,
  createDracoMeshDecoder,
  createGlbUriLoadCache,
  createGltfEcsAuthoringCommandPlan,
  createGltfPrimitiveMaterialResolutionReport,
  createGltfUriLoadCache,
  createMeshoptDecoder,
  createParticleEffectAsset,
  createStandardMaterialAsset,
  createTextureAsset,
  createWgslShaderAsset,
  decodeKtx2TextureDataAsync,
  loadGlbFromUri,
  loadGltfFromUri,
  parseHdrRgbe,
  registerGltfSourceAssetsFromReports,
  validateAudioClipAsset,
  validateParticleEffectAsset,
  validateTextureAsset,
  type AudioClipAsset,
  type DracoMeshDecoder,
  type GltfImageBytesDecoder,
  type HdrRgbeImage,
  type Ktx2BasisTranscoder,
  type Ktx2TextureCompressionSupport,
  type LoadGlbFromUriOptions,
  type LoadGltfFromUriOptions,
  type MeshoptBufferDecoder,
  type TextureAsset,
} from "@aperture-engine/render";

export type NodeAssetLoaderMode = "strict" | "hybrid" | "placeholder";

export interface NodeApertureAssetLoaderOptions {
  readonly mode?: NodeAssetLoaderMode;
  readonly root?: string;
  readonly publicDir?: string;
  readonly allowHttp?: boolean;
  /**
   * Directory containing decoder assets with browser-compatible subpaths:
   * draco/draco_wasm_wrapper.js, draco/draco_decoder.wasm,
   * meshopt/meshopt_decoder.module.js, basis/basis_transcoder.js, and
   * basis/basis_transcoder.wasm.
   */
  readonly decoderAssetsDir?: string;
  readonly ktx2TextureCompression?: Ktx2TextureCompressionSupport;
}

interface NodeAssetLoaderResolvedOptions {
  readonly mode: NodeAssetLoaderMode;
  readonly root: string;
  readonly publicDir: string;
  readonly allowHttp: boolean;
  readonly gltfAssetDecoders?: SystemGltfAssetDecoderProvider;
}

interface NodeFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

interface NodeReadableFetchResponse extends NodeFetchResponse {
  readonly text: () => Promise<string>;
}

const DEFAULT_NODE_ASSET_MODE: NodeAssetLoaderMode = "placeholder";
const DEFAULT_PUBLIC_DIR = "public";

// Node can now materialize local files for the asset families that are
// renderer-independent: shaders, audio bytes, PNG/JPEG textures, RGBE HDR
// environment maps, and glTF/GLB graphs with PNG/JPEG image data or configured
// Draco, meshopt, and Basis/KTX2 decoders. Unsupported browser-only decode
// cases are explicit:
// strict mode throws, hybrid mode records a placeholder, and placeholder mode
// preserves the original fast structural path.
export function createNodeApertureAssetLoader(
  options: NodeApertureAssetLoaderOptions = {},
): ApertureAssetLoader {
  const resolvedOptions: NodeAssetLoaderResolvedOptions = {
    mode: options.mode ?? DEFAULT_NODE_ASSET_MODE,
    root: path.resolve(options.root ?? process.cwd()),
    publicDir: options.publicDir ?? DEFAULT_PUBLIC_DIR,
    allowHttp: options.allowHttp ?? false,
    ...decoderProviderOption(options),
  };
  const glbCache = createGlbUriLoadCache();
  const gltfCache = createGltfUriLoadCache();

  return {
    async load(
      handle: SystemAssetHandle<SystemAssetKind>,
      context: ApertureAssetLoadContext,
    ): Promise<ApertureAssetLoadResult> {
      if (resolvedOptions.mode === "placeholder") {
        markPlaceholderReady(handle, context);
        return { placeholder: true };
      }

      try {
        await loadRealNodeAsset({
          handle,
          context,
          options: resolvedOptions,
          glbCache,
          gltfCache,
        });
        return {};
      } catch (error) {
        if (resolvedOptions.mode === "hybrid") {
          markPlaceholderReady(handle, context);
          return { placeholder: true };
        }

        throw error;
      }
    },
  };
}

async function loadRealNodeAsset(input: {
  readonly handle: SystemAssetHandle<SystemAssetKind>;
  readonly context: ApertureAssetLoadContext;
  readonly options: NodeAssetLoaderResolvedOptions;
  readonly glbCache: ReturnType<typeof createGlbUriLoadCache>;
  readonly gltfCache: ReturnType<typeof createGltfUriLoadCache>;
}): Promise<void> {
  const { handle, context, options } = input;
  const registryHandle = handle.renderHandle as AssetHandle;

  if (handle.kind === "gltf") {
    const gltfHandle = handle as SystemGltfAssetHandle;
    gltfHandle.scene.value = await loadNodeGltfAsset({
      handle: gltfHandle,
      context,
      options,
      glbCache: input.glbCache,
      gltfCache: input.gltfCache,
    });
    return;
  }

  if (handle.kind === "shader") {
    const shaderHandle = handle as SystemShaderAssetHandle;
    const url = await resolveNodeAssetUrl(shaderHandle.url, options);
    const source = await readTextAsset(url);
    context.registry.markReady(
      registryHandle,
      createWgslShaderAsset({
        label: shaderHandle.label ?? shaderHandle.id,
        source,
        url,
        virtualPath: shaderHandle.url,
      }),
    );
    return;
  }

  if (handle.kind === "audio") {
    const audioHandle = handle as SystemAudioAssetHandle;
    const url = await resolveNodeAssetUrl(audioHandle.url, options);
    const bytes = await readBinaryAsset(url);
    const asset = validatedAudioClip(
      audioHandle,
      createAudioClipAsset({
        label: audioHandle.label ?? audioHandle.id,
        bytes,
        streaming: false,
        ...(audioHandle.durationHint === undefined
          ? {}
          : { durationHint: audioHandle.durationHint }),
        ...(audioHandle.channels === undefined
          ? {}
          : { channels: audioHandle.channels }),
        ...(audioHandle.captionTrackId === undefined
          ? {}
          : { captionTrackId: audioHandle.captionTrackId }),
      }),
    );
    context.registry.markReady(registryHandle, asset);
    return;
  }

  if (handle.kind === "texture") {
    const textureHandle = handle as SystemTextureAssetHandle;
    const url = await resolveNodeAssetUrl(textureHandle.url, options);
    const decoded = await decodeNodeImageAsset({
      url,
      ...(textureHandle.mimeType === undefined
        ? {}
        : { mimeType: textureHandle.mimeType }),
    });
    const asset = validatedTexture(
      textureHandle,
      createTextureAsset({
        label: textureHandle.label ?? textureHandle.id,
        dimension: "2d",
        width: decoded.width,
        height: decoded.height,
        format:
          textureHandle.colorSpace === "srgb"
            ? "rgba8unorm-srgb"
            : "rgba8unorm",
        colorSpace: textureHandle.colorSpace,
        semantic: textureHandle.semantic,
        sourceData: decoded.sourceData,
      }),
    );
    context.registry.markReady(registryHandle, asset);
    return;
  }

  if (handle.kind === "particle-effect") {
    const particleEffect = loadNodeParticleEffectAsset(
      handle as SystemParticleEffectAssetHandle,
    );
    context.registry.markReady(registryHandle, particleEffect);
    return;
  }

  if (handle.kind === "hdr") {
    const url = await resolveNodeAssetUrl(requiredAssetUrl(handle), options);
    const parsed = parseHdrRgbe(await readBinaryAsset(url));

    if (!parsed.ok || parsed.image === null) {
      throw new Error(
        `HDR asset '${handle.id}' failed to load. ${parsed.diagnostics
          .map((diagnostic) => diagnostic.message)
          .join(" ")}`,
      );
    }

    context.registry.markReady(
      registryHandle,
      createNodeEnvironmentMapAsset(
        handle as SystemAssetHandle<"hdr">,
        parsed.image,
        url,
      ),
    );
    return;
  }

  throw new Error(
    `Node asset loader does not support '${handle.kind}' assets yet.`,
  );
}

async function loadNodeGltfAsset(input: {
  readonly handle: SystemGltfAssetHandle;
  readonly context: ApertureAssetLoadContext;
  readonly options: NodeAssetLoaderResolvedOptions;
  readonly glbCache: ReturnType<typeof createGlbUriLoadCache>;
  readonly gltfCache: ReturnType<typeof createGltfUriLoadCache>;
}): Promise<SystemGltfLoadedScene> {
  const url = await resolveNodeAssetUrl(input.handle.url, input.options);
  const sourceKind = gltfSourceKindFromUrl(url);
  const fetch = createNodeAssetFetch(input.options);
  const decodeImageData = createNodeGltfImageDataDecoder(
    input.options.gltfAssetDecoders,
  );
  const loaded =
    sourceKind === "gltf"
      ? await loadGltfFromUri(url, {
          cache: input.gltfCache,
          fetch,
          decodeImageData,
          ...(await eagerGltfDecoderOptions(input.options.gltfAssetDecoders)),
          keyPrefix: input.handle.id,
          createAssetMapping: true,
          createMeshAssets: true,
        })
      : await loadGlbFromUri(url, {
          cache: input.glbCache,
          fetch,
          decodeImageData,
          ...lazyGltfDecoderOptions(input.options.gltfAssetDecoders),
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
    throw new Error(
      `GLTF asset '${input.handle.id}' failed to load. ${loaded.diagnostics
        .map((diagnostic) => diagnostic.message)
        .join(" ")}`,
    );
  }

  if (
    importReport.assetMapping === null ||
    importReport.meshConstruction === null ||
    importReport.meshPrimitive === null
  ) {
    throw new Error(
      `GLTF asset '${input.handle.id}' did not produce renderable mesh/material reports.`,
    );
  }

  const defaultMaterialHandle = createMaterialHandle(
    `${input.handle.id}.default-material`,
  );
  const defaultMaterialHandleKey = assetHandleKey(defaultMaterialHandle);

  if (!input.context.registry.has(defaultMaterialHandle)) {
    input.context.registry.register(defaultMaterialHandle, {
      label: `${input.handle.id} default GLTF material`,
    });
    input.context.registry.markReady(
      defaultMaterialHandle,
      createStandardMaterialAsset({
        label: `${input.handle.id} default GLTF material`,
      }),
    );
  }

  const registration = registerGltfSourceAssetsFromReports({
    registry: input.context.registry,
    assetMapping: importReport.assetMapping,
    meshConstruction: importReport.meshConstruction,
  });

  if (
    !registration.valid ||
    registration.sourceRegistration === null ||
    registration.meshRegistration === null
  ) {
    throw new Error(
      `GLTF asset '${input.handle.id}' source assets could not be registered. ${registration.diagnostics
        .map((diagnostic) => diagnostic.message)
        .join(" ")}`,
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
    throw new Error(
      `GLTF asset '${input.handle.id}' primitive materials could not be resolved. ${primitiveMaterials.diagnostics
        .map((diagnostic) => diagnostic.message)
        .join(" ")}`,
    );
  }

  const commandPlan = createGltfEcsAuthoringCommandPlan({
    traversalReport: importReport.sceneTraversal,
    meshRegistrationReport: registration.meshRegistration,
    primitiveMaterialReport: primitiveMaterials,
    skinReport: importReport.skinImport,
  });

  if (!commandPlan.valid) {
    throw new Error(
      `GLTF asset '${input.handle.id}' could not be converted to ECS spawn commands. ${commandPlan.diagnostics
        .map((diagnostic) => diagnostic.message)
        .join(" ")}`,
    );
  }

  const clips: SystemGltfAnimationClip[] = importReport.animation.clips.map(
    (imported) =>
      registerAnimationClip({
        registry: input.context.registry,
        assetId: input.handle.id,
        imported,
      }),
  );

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
    skin: importReport.skinImport,
    clips,
    animationReport: importReport.animation.report,
  };
}

function registerAnimationClip(input: {
  readonly registry: ApertureAssetLoadContext["registry"];
  readonly assetId: string;
  readonly imported: {
    readonly animationIndex: number;
    readonly clip: AnimationClip;
  };
}): SystemGltfAnimationClip {
  const handle = createAnimationClipHandle(
    `${input.assetId}:animation:${input.imported.animationIndex}`,
  );

  if (!input.registry.has(handle)) {
    input.registry.register(handle, { label: input.imported.clip.name });
    input.registry.markReady(handle, input.imported.clip);
  }

  return {
    animationIndex: input.imported.animationIndex,
    name: input.imported.clip.name,
    handle,
    clip: input.imported.clip,
  };
}

function markPlaceholderReady(
  handle: SystemAssetHandle<SystemAssetKind>,
  context: ApertureAssetLoadContext,
): void {
  context.registry.markReady(
    handle.renderHandle as AssetHandle,
    {
      id: handle.id,
      kind: handle.kind,
      ...(handle.url === undefined ? {} : { url: handle.url }),
    },
    [],
    "placeholder",
  );
}

function decoderProviderOption(
  options: NodeApertureAssetLoaderOptions,
): Pick<NodeAssetLoaderResolvedOptions, "gltfAssetDecoders"> {
  if (options.decoderAssetsDir === undefined) {
    return {};
  }

  const root = path.resolve(options.root ?? process.cwd());
  const decoderAssetsDir = path.isAbsolute(options.decoderAssetsDir)
    ? options.decoderAssetsDir
    : path.resolve(root, options.decoderAssetsDir);
  const gltfAssetDecoders = createNodeGltfAssetDecoderProvider({
    decoderAssetsDir,
    ...(options.ktx2TextureCompression === undefined
      ? {}
      : { ktx2TextureCompression: options.ktx2TextureCompression }),
  });

  return { gltfAssetDecoders };
}

function createNodeGltfAssetDecoderProvider(options: {
  readonly decoderAssetsDir: string;
  readonly ktx2TextureCompression?: Ktx2TextureCompressionSupport;
}): SystemGltfAssetDecoderProvider {
  let dracoDecoder: Promise<DracoMeshDecoder> | null = null;
  let meshoptDecoder: Promise<MeshoptBufferDecoder> | null = null;
  let basisTranscoder: Promise<Ktx2BasisTranscoder> | null = null;

  return {
    createDracoDecoder() {
      dracoDecoder ??= Promise.all([
        readDecoderText(
          options.decoderAssetsDir,
          "draco/draco_wasm_wrapper.js",
        ),
        readDecoderBinary(options.decoderAssetsDir, "draco/draco_decoder.wasm"),
      ]).then(([jsSource, wasmBinary]) =>
        createDracoMeshDecoder({ jsSource, wasmBinary }),
      );
      return dracoDecoder;
    },
    createMeshoptDecoder() {
      meshoptDecoder ??= readDecoderText(
        options.decoderAssetsDir,
        "meshopt/meshopt_decoder.module.js",
      ).then((jsSource) => createMeshoptDecoder({ jsSource }));
      return meshoptDecoder;
    },
    createBasisKtx2Transcoder() {
      basisTranscoder ??= Promise.all([
        readDecoderText(options.decoderAssetsDir, "basis/basis_transcoder.js"),
        readDecoderBinary(
          options.decoderAssetsDir,
          "basis/basis_transcoder.wasm",
        ),
      ]).then(([jsSource, wasmBinary]) =>
        createBasisUniversalKtx2Transcoder({ jsSource, wasmBinary }),
      );
      return basisTranscoder;
    },
    ...(options.ktx2TextureCompression === undefined
      ? {}
      : { ktx2TextureCompression: options.ktx2TextureCompression }),
  };
}

async function eagerGltfDecoderOptions(
  provider: SystemGltfAssetDecoderProvider | undefined,
): Promise<
  Partial<
    Pick<
      LoadGltfFromUriOptions,
      | "dracoDecoder"
      | "meshoptDecoder"
      | "createBasisKtx2Transcoder"
      | "ktx2TextureCompression"
    >
  >
> {
  if (provider === undefined) {
    return {};
  }

  const [dracoDecoder, meshoptDecoder] = await Promise.all([
    provider.createDracoDecoder?.(),
    provider.createMeshoptDecoder?.(),
  ]);

  return {
    ...(dracoDecoder === undefined ? {} : { dracoDecoder }),
    ...(meshoptDecoder === undefined ? {} : { meshoptDecoder }),
    ...(provider.createBasisKtx2Transcoder === undefined
      ? {}
      : { createBasisKtx2Transcoder: provider.createBasisKtx2Transcoder }),
    ...(provider.ktx2TextureCompression === undefined
      ? {}
      : { ktx2TextureCompression: provider.ktx2TextureCompression }),
  };
}

function lazyGltfDecoderOptions(
  provider: SystemGltfAssetDecoderProvider | undefined,
): Partial<
  Pick<
    LoadGlbFromUriOptions,
    | "createDracoDecoder"
    | "createMeshoptDecoder"
    | "createBasisKtx2Transcoder"
    | "ktx2TextureCompression"
  >
> {
  if (provider === undefined) {
    return {};
  }

  return {
    ...(provider.createDracoDecoder === undefined
      ? {}
      : { createDracoDecoder: provider.createDracoDecoder }),
    ...(provider.createMeshoptDecoder === undefined
      ? {}
      : { createMeshoptDecoder: provider.createMeshoptDecoder }),
    ...(provider.createBasisKtx2Transcoder === undefined
      ? {}
      : { createBasisKtx2Transcoder: provider.createBasisKtx2Transcoder }),
    ...(provider.ktx2TextureCompression === undefined
      ? {}
      : { ktx2TextureCompression: provider.ktx2TextureCompression }),
  };
}

async function readDecoderText(
  decoderAssetsDir: string,
  relativePath: string,
): Promise<string> {
  return await readFile(path.join(decoderAssetsDir, relativePath), "utf8");
}

async function readDecoderBinary(
  decoderAssetsDir: string,
  relativePath: string,
): Promise<ArrayBuffer> {
  const bytes = await readFile(path.join(decoderAssetsDir, relativePath));
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
}

function loadNodeParticleEffectAsset(
  handle: SystemParticleEffectAssetHandle,
): ReturnType<typeof createParticleEffectAsset> {
  const descriptor = handle.descriptor;
  const asset =
    descriptor.type === "composite"
      ? createParticleEffectAsset({
          version: 2,
          type: "composite",
          label: handle.label ?? handle.id,
          emitters: descriptor.emitters.map((emitter) => ({
            ...(emitter.label === undefined ? {} : { label: emitter.label }),
            effect: createParticleEffectHandle(emitter.effect),
            ...(emitter.delay === undefined ? {} : { delay: emitter.delay }),
            ...(emitter.duration === undefined
              ? {}
              : { duration: emitter.duration }),
            ...(emitter.timeScale === undefined
              ? {}
              : { timeScale: emitter.timeScale }),
            ...(emitter.transform === undefined
              ? {}
              : { transform: emitter.transform }),
          })),
          ...(descriptor.source === undefined
            ? {}
            : { source: descriptor.source }),
        })
      : createParticleEffectAsset({
          version: 2,
          type: "emitter",
          label: handle.label ?? handle.id,
          ...(descriptor.main === undefined ? {} : { main: descriptor.main }),
          ...(descriptor.emission === undefined
            ? {}
            : { emission: descriptor.emission }),
          ...(descriptor.shape === undefined
            ? {}
            : { shape: descriptor.shape }),
          renderer: {
            ...(descriptor.renderer?.renderMode === undefined
              ? {}
              : { renderMode: descriptor.renderer.renderMode }),
            ...(descriptor.renderer?.blendMode === undefined
              ? {}
              : { blendMode: descriptor.renderer.blendMode }),
            ...(descriptor.renderer?.sortMode === undefined
              ? {}
              : { sortMode: descriptor.renderer.sortMode }),
            ...(descriptor.renderer?.renderOrder === undefined
              ? {}
              : { renderOrder: descriptor.renderer.renderOrder }),
            ...(descriptor.renderer?.softParticles === undefined
              ? {}
              : { softParticles: descriptor.renderer.softParticles }),
            ...(handle.texture === undefined
              ? {}
              : { texture: handle.texture }),
            ...(handle.sampler === undefined
              ? {}
              : { sampler: handle.sampler }),
          },
          ...(descriptor.textureSheetAnimation === undefined
            ? {}
            : { textureSheetAnimation: descriptor.textureSheetAnimation }),
          ...(descriptor.colorOverLifetime === undefined
            ? {}
            : { colorOverLifetime: descriptor.colorOverLifetime }),
          ...(descriptor.sizeOverLifetime === undefined
            ? {}
            : { sizeOverLifetime: descriptor.sizeOverLifetime }),
          ...(descriptor.rotationOverLifetime === undefined
            ? {}
            : { rotationOverLifetime: descriptor.rotationOverLifetime }),
          ...(descriptor.velocityOverLifetime === undefined
            ? {}
            : { velocityOverLifetime: descriptor.velocityOverLifetime }),
          ...(descriptor.forceOverLifetime === undefined
            ? {}
            : { forceOverLifetime: descriptor.forceOverLifetime }),
          ...(descriptor.limitVelocityOverLifetime === undefined
            ? {}
            : {
                limitVelocityOverLifetime: descriptor.limitVelocityOverLifetime,
              }),
          ...(descriptor.noise === undefined
            ? {}
            : { noise: descriptor.noise }),
          ...(descriptor.subEmitters === undefined
            ? {}
            : { subEmitters: descriptor.subEmitters }),
          ...(descriptor.source === undefined
            ? {}
            : { source: descriptor.source }),
          ...(descriptor.curveSampleCount === undefined
            ? {}
            : { curveSampleCount: descriptor.curveSampleCount }),
        });
  const report = validateParticleEffectAsset(asset);

  if (!report.valid) {
    throw new Error(
      `Particle effect asset '${handle.id}' is invalid. ${report.diagnostics
        .map((diagnostic) => diagnostic.message)
        .join(" ")}`,
    );
  }

  return asset;
}

function createNodeEnvironmentMapAsset(
  handle: SystemAssetHandle<"hdr">,
  image: HdrRgbeImage,
  resolvedUrl: string,
): {
  readonly kind: "environment-map";
  readonly label: string;
  readonly url: string;
  readonly virtualPath: string;
  readonly diffuseResourceKey: string;
  readonly specularResourceKey: string;
  readonly equirectSource: {
    readonly label: string;
    readonly resourceKey: string;
    readonly width: number;
    readonly height: number;
    readonly data: Uint8Array;
    readonly faceSize: number;
    readonly format: "rgba8unorm";
    readonly mipLevelCount: number;
  };
  readonly source: {
    readonly kind: "hdr-rgbe";
    readonly format: "rgba32float";
    readonly colorSpace: "linear";
    readonly gamma: number;
    readonly exposure: number;
    readonly byteLength: number;
  };
  readonly standardMaterialCount: 1;
} {
  const label = handle.label ?? handle.id;
  const faceSize = defaultEnvironmentFaceSize(image);

  return {
    kind: "environment-map",
    label,
    url: resolvedUrl,
    virtualPath: requiredAssetUrl(handle),
    diffuseResourceKey: `environment-map:${handle.id}:diffuse`,
    specularResourceKey: `environment-map:${handle.id}:specular`,
    equirectSource: {
      label,
      resourceKey: `environment-map:${handle.id}:equirect-cube`,
      width: image.width,
      height: image.height,
      data: hdrImageToRgba8(image),
      faceSize,
      format: "rgba8unorm",
      mipLevelCount: defaultEnvironmentMipLevelCount(faceSize),
    },
    source: {
      kind: image.kind,
      format: image.format,
      colorSpace: image.colorSpace,
      gamma: image.gamma,
      exposure: image.exposure,
      byteLength: image.rgbe.byteLength,
    },
    standardMaterialCount: 1,
  };
}

function requiredAssetUrl(handle: SystemAssetHandle<SystemAssetKind>): string {
  if (handle.url === undefined) {
    throw new Error(`Asset '${handle.id}' does not declare a URL.`);
  }

  return handle.url;
}

function hdrImageToRgba8(image: HdrRgbeImage): Uint8Array {
  const pixelCount = image.width * image.height;
  const bytes = new Uint8Array(pixelCount * 4);

  for (let index = 0; index < pixelCount; index += 1) {
    const sourceOffset = index * 4;
    bytes[sourceOffset] = floatChannelToByte(image.data[sourceOffset] ?? 0);
    bytes[sourceOffset + 1] = floatChannelToByte(
      image.data[sourceOffset + 1] ?? 0,
    );
    bytes[sourceOffset + 2] = floatChannelToByte(
      image.data[sourceOffset + 2] ?? 0,
    );
    bytes[sourceOffset + 3] = 255;
  }

  return bytes;
}

function floatChannelToByte(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(255, Math.max(0, Math.round(value * 255)));
}

function defaultEnvironmentFaceSize(image: HdrRgbeImage): number {
  return Math.max(
    4,
    Math.min(128, highestPowerOfTwoAtMost(Math.min(image.width, image.height))),
  );
}

function defaultEnvironmentMipLevelCount(faceSize: number): number {
  return Math.max(1, Math.min(4, Math.floor(Math.log2(faceSize)) + 1));
}

function highestPowerOfTwoAtMost(value: number): number {
  let size = 1;
  const finite = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;

  while (size * 2 <= finite) {
    size *= 2;
  }

  return size;
}

async function resolveNodeAssetUrl(
  url: string,
  options: NodeAssetLoaderResolvedOptions,
): Promise<string> {
  if (url.startsWith("data:")) {
    return url;
  }

  const parsed = parseUrl(url);

  if (parsed !== null) {
    if (parsed.protocol === "file:") {
      return verifiedFileUrl(fileURLToPath(parsed), options.root);
    }

    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      if (options.allowHttp) {
        return parsed.href;
      }

      throw new Error(
        `Node asset loader does not fetch '${parsed.protocol}' assets unless allowHttp is enabled.`,
      );
    }

    throw new Error(
      `Node asset loader does not fetch '${parsed.protocol}' assets; use a local file or Vite public asset path.`,
    );
  }

  const root = path.resolve(options.root);
  const publicRoot = path.resolve(root, options.publicDir);
  const candidate = url.startsWith("/")
    ? path.resolve(publicRoot, `.${url}`)
    : path.resolve(root, url);
  const boundary = url.startsWith("/") ? publicRoot : root;

  return verifiedFileUrl(candidate, boundary);
}

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

async function verifiedFileUrl(
  filePath: string,
  boundary: string,
): Promise<string> {
  const [realFile, realBoundary] = await Promise.all([
    realpath(filePath),
    realpath(boundary),
  ]);
  const relative = path.relative(realBoundary, realFile);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Asset file '${filePath}' escapes '${realBoundary}'.`);
  }

  return pathToFileURL(realFile).href;
}

function createNodeAssetFetch(
  options: NodeAssetLoaderResolvedOptions,
): (url: string) => Promise<NodeFetchResponse> {
  return async (url: string) => {
    try {
      const bytes = await readBinaryAsset(
        await resolveNodeAssetUrl(url, options),
      );
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: async () => bytes,
      };
    } catch (error) {
      return {
        ok: false,
        status: 404,
        statusText: error instanceof Error ? error.message : String(error),
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    }
  };
}

async function readTextAsset(url: string): Promise<string> {
  if (url.startsWith("data:") || isHttpUrl(url)) {
    const response = await fetchReadableAsset(url);
    return await response.text();
  }

  return await readFile(fileURLToPath(url), "utf8");
}

async function readBinaryAsset(url: string): Promise<ArrayBuffer> {
  if (url.startsWith("data:") || isHttpUrl(url)) {
    const response = await fetchReadableAsset(url);
    return await response.arrayBuffer();
  }

  const bytes = await readFile(fileURLToPath(url));
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
}

async function fetchReadableAsset(
  url: string,
): Promise<NodeReadableFetchResponse> {
  if (typeof fetch !== "function") {
    throw new Error(`Asset URL '${url}' requires fetch in this Node runtime.`);
  }

  const response = (await fetch(url)) as NodeReadableFetchResponse;

  if (!response.ok) {
    throw new Error(
      `Fetching asset URL '${url}' failed with HTTP ${response.status} ${response.statusText}.`,
    );
  }

  return response;
}

function isHttpUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

async function decodeNodeImageAsset(input: {
  readonly url: string;
  readonly mimeType?: string;
}): Promise<{
  readonly width: number;
  readonly height: number;
  readonly sourceData: {
    readonly bytes: Uint8Array;
    readonly bytesPerRow: number;
  };
}> {
  const bytes = new Uint8Array(await readBinaryAsset(input.url));
  return decodeNodeImageRgba8(bytes, input.mimeType);
}

function createNodeGltfImageDataDecoder(
  provider: SystemGltfAssetDecoderProvider | undefined,
): GltfImageBytesDecoder {
  return async (input) => {
    const resolvedMimeType = input.mimeType ?? inferImageMimeType(input.bytes);

    if (resolvedMimeType === "image/ktx2") {
      const basisTranscoder = await provider?.createBasisKtx2Transcoder?.();
      return await decodeKtx2TextureDataAsync(input.bytes, {
        ...(basisTranscoder === undefined ? {} : { basisTranscoder }),
        ...(provider?.ktx2TextureCompression === undefined
          ? {}
          : { textureCompression: provider.ktx2TextureCompression }),
      });
    }

    return decodeNodeImageRgba8(input.bytes, resolvedMimeType);
  };
}

function decodeNodeImageRgba8(
  bytes: Uint8Array,
  mimeType: string | undefined,
): {
  readonly width: number;
  readonly height: number;
  readonly sourceData: {
    readonly bytes: Uint8Array;
    readonly bytesPerRow: number;
  };
} {
  const resolvedMimeType = mimeType ?? inferImageMimeType(bytes);

  if (resolvedMimeType === "image/png") {
    return decodePngRgba8(bytes, resolvedMimeType);
  }

  if (resolvedMimeType === "image/jpeg") {
    return decodeJpegRgba8(bytes, resolvedMimeType);
  }

  throw new Error(
    `Node image decoder supports image/png and image/jpeg, not '${resolvedMimeType}'.`,
  );
}

function decodeJpegRgba8(
  bytes: Uint8Array,
  mimeType: string | undefined,
): {
  readonly width: number;
  readonly height: number;
  readonly sourceData: {
    readonly bytes: Uint8Array;
    readonly bytesPerRow: number;
  };
} {
  if (mimeType !== undefined && mimeType !== "image/jpeg") {
    throw new Error(
      `Node JPEG decoder supports image/jpeg, not '${mimeType}'.`,
    );
  }

  assertJpegSignature(bytes);

  const decoded = decodeJpeg(bytes, { useTArray: true });
  if (decoded.width <= 0 || decoded.height <= 0) {
    throw new Error("JPEG decoded without a valid width and height.");
  }

  const expectedBytes = decoded.width * decoded.height * 4;
  if (decoded.data.byteLength !== expectedBytes) {
    throw new Error(
      `JPEG decoder returned ${decoded.data.byteLength} bytes; expected ${expectedBytes}.`,
    );
  }

  return {
    width: decoded.width,
    height: decoded.height,
    sourceData: {
      bytes: new Uint8Array(decoded.data),
      bytesPerRow: decoded.width * 4,
    },
  };
}

function decodePngRgba8(
  bytes: Uint8Array,
  mimeType: string | undefined,
): {
  readonly width: number;
  readonly height: number;
  readonly sourceData: {
    readonly bytes: Uint8Array;
    readonly bytesPerRow: number;
  };
} {
  if (mimeType !== undefined && mimeType !== "image/png") {
    throw new Error(
      `Node image decoder supports image/png, not '${mimeType}'.`,
    );
  }

  assertPngSignature(bytes);

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlaceMethod = 0;
  const idatChunks: Uint8Array[] = [];

  while (offset + 12 <= bytes.byteLength) {
    const length = readUint32(bytes, offset);
    offset += 4;
    const type = readAscii(bytes, offset, 4);
    offset += 4;

    if (offset + length + 4 > bytes.byteLength) {
      throw new Error("PNG chunk length exceeds file size.");
    }

    const chunk = bytes.subarray(offset, offset + length);
    offset += length;
    offset += 4;

    if (type === "IHDR") {
      width = readUint32(chunk, 0);
      height = readUint32(chunk, 4);
      bitDepth = chunk[8] ?? 0;
      colorType = chunk[9] ?? 0;
      interlaceMethod = chunk[12] ?? 0;
    } else if (type === "IDAT") {
      idatChunks.push(chunk);
    } else if (type === "IEND") {
      break;
    }
  }

  if (width <= 0 || height <= 0) {
    throw new Error("PNG is missing a valid IHDR chunk.");
  }
  if (bitDepth !== 8) {
    throw new Error(
      `Node PNG decoder supports 8-bit PNGs, not ${bitDepth}-bit.`,
    );
  }
  if (![0, 2, 4, 6].includes(colorType)) {
    throw new Error(
      `Node PNG decoder does not support color type ${colorType}.`,
    );
  }
  if (interlaceMethod !== 0) {
    throw new Error("Node PNG decoder does not support interlaced PNGs.");
  }

  const channels = pngChannels(colorType);
  const scanlineBytes = width * channels;
  const inflated = inflateSync(concatBytes(idatChunks));
  const expectedBytes = height * (scanlineBytes + 1);

  if (inflated.byteLength < expectedBytes) {
    throw new Error("PNG image data ended before all scanlines were decoded.");
  }

  const rgba = new Uint8Array(width * height * 4);
  let readOffset = 0;
  let previous = new Uint8Array(scanlineBytes);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[readOffset];
    readOffset += 1;
    const current = new Uint8Array(
      inflated.subarray(readOffset, readOffset + scanlineBytes),
    );
    readOffset += scanlineBytes;
    unfilterPngScanline(current, previous, filter ?? 0, channels);
    writeRgbaScanline({ source: current, target: rgba, y, width, colorType });
    previous = current;
  }

  return {
    width,
    height,
    sourceData: {
      bytes: rgba,
      bytesPerRow: width * 4,
    },
  };
}

function inferImageMimeType(bytes: Uint8Array): string {
  if (hasPngSignature(bytes)) {
    return "image/png";
  }

  if (hasJpegSignature(bytes)) {
    return "image/jpeg";
  }

  if (hasKtx2Signature(bytes)) {
    return "image/ktx2";
  }

  return "application/octet-stream";
}

function unfilterPngScanline(
  current: Uint8Array,
  previous: Uint8Array,
  filter: number,
  bytesPerPixel: number,
): void {
  for (let index = 0; index < current.byteLength; index += 1) {
    const left =
      index >= bytesPerPixel ? (current[index - bytesPerPixel] ?? 0) : 0;
    const up = previous[index] ?? 0;
    const upLeft =
      index >= bytesPerPixel ? (previous[index - bytesPerPixel] ?? 0) : 0;
    const value = current[index] ?? 0;

    switch (filter) {
      case 0:
        break;
      case 1:
        current[index] = (value + left) & 0xff;
        break;
      case 2:
        current[index] = (value + up) & 0xff;
        break;
      case 3:
        current[index] = (value + Math.floor((left + up) / 2)) & 0xff;
        break;
      case 4:
        current[index] = (value + paethPredictor(left, up, upLeft)) & 0xff;
        break;
      default:
        throw new Error(`PNG filter ${filter} is not supported.`);
    }
  }
}

function writeRgbaScanline(input: {
  readonly source: Uint8Array;
  readonly target: Uint8Array;
  readonly y: number;
  readonly width: number;
  readonly colorType: number;
}): void {
  for (let x = 0; x < input.width; x += 1) {
    const targetOffset = (input.y * input.width + x) * 4;

    if (input.colorType === 0) {
      const gray = input.source[x] ?? 0;
      input.target[targetOffset] = gray;
      input.target[targetOffset + 1] = gray;
      input.target[targetOffset + 2] = gray;
      input.target[targetOffset + 3] = 255;
      continue;
    }

    if (input.colorType === 4) {
      const sourceOffset = x * 2;
      const gray = input.source[sourceOffset] ?? 0;
      input.target[targetOffset] = gray;
      input.target[targetOffset + 1] = gray;
      input.target[targetOffset + 2] = gray;
      input.target[targetOffset + 3] = input.source[sourceOffset + 1] ?? 255;
      continue;
    }

    if (input.colorType === 2) {
      const sourceOffset = x * 3;
      input.target[targetOffset] = input.source[sourceOffset] ?? 0;
      input.target[targetOffset + 1] = input.source[sourceOffset + 1] ?? 0;
      input.target[targetOffset + 2] = input.source[sourceOffset + 2] ?? 0;
      input.target[targetOffset + 3] = 255;
      continue;
    }

    const sourceOffset = x * 4;
    input.target[targetOffset] = input.source[sourceOffset] ?? 0;
    input.target[targetOffset + 1] = input.source[sourceOffset + 1] ?? 0;
    input.target[targetOffset + 2] = input.source[sourceOffset + 2] ?? 0;
    input.target[targetOffset + 3] = input.source[sourceOffset + 3] ?? 255;
  }
}

function validatedTexture(
  handle: SystemTextureAssetHandle,
  asset: TextureAsset,
): TextureAsset {
  const report = validateTextureAsset(asset);
  if (report.valid) {
    return asset;
  }

  throw new Error(
    `Texture asset '${handle.id}' is invalid. ${report.diagnostics
      .map((diagnostic) => diagnostic.message)
      .join(" ")}`,
  );
}

function validatedAudioClip(
  handle: SystemAudioAssetHandle,
  asset: AudioClipAsset,
): AudioClipAsset {
  const report = validateAudioClipAsset(asset);
  if (report.valid) {
    return asset;
  }

  throw new Error(
    `Audio asset '${handle.id}' is invalid. ${report.diagnostics
      .map((diagnostic) => diagnostic.message)
      .join(" ")}`,
  );
}

function gltfSourceKindFromUrl(url: string): "glb" | "gltf" {
  const pathname = new URL(url).pathname.toLowerCase();
  return pathname.endsWith(".gltf") ? "gltf" : "glb";
}

function pngChannels(colorType: number): number {
  switch (colorType) {
    case 0:
      return 1;
    case 2:
      return 3;
    case 4:
      return 2;
    case 6:
      return 4;
    default:
      throw new Error(`Unsupported PNG color type ${colorType}.`);
  }
}

function paethPredictor(left: number, up: number, upLeft: number): number {
  const predictor = left + up - upLeft;
  const leftDistance = Math.abs(predictor - left);
  const upDistance = Math.abs(predictor - up);
  const upLeftDistance = Math.abs(predictor - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }
  if (upDistance <= upLeftDistance) {
    return up;
  }
  return upLeft;
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}

function assertPngSignature(bytes: Uint8Array): void {
  if (!hasPngSignature(bytes)) {
    throw new Error("Image is not a PNG file.");
  }
}

function hasPngSignature(bytes: Uint8Array): boolean {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];

  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) {
      return false;
    }
  }

  return true;
}

function assertJpegSignature(bytes: Uint8Array): void {
  if (!hasJpegSignature(bytes)) {
    throw new Error("Image is not a JPEG file.");
  }
}

function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function hasKtx2Signature(bytes: Uint8Array): boolean {
  const signature = [
    0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a,
  ];

  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) {
      return false;
    }
  }

  return true;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) * 0x1000000 +
      ((bytes[offset + 1] ?? 0) << 16) +
      ((bytes[offset + 2] ?? 0) << 8) +
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let value = "";

  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(bytes[offset + index] ?? 0);
  }

  return value;
}
