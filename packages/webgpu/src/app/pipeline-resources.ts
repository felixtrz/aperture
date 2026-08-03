import {
  MATERIAL_UNTONEMAPPED_FEATURE,
  type MeshRenderStage,
  type RenderSnapshot,
} from "@aperture-engine/render";
import { WEBGPU_APP_DEPTH_FORMAT } from "../resources/textures/depth-texture-resource.js";
import {
  createDebugNormalRenderPipelineResource,
  type CreateDebugNormalRenderPipelineResourceResult,
} from "../materials/debug-normal/debug-normal-pipeline.js";
import {
  createMatcapRenderPipelineResource,
  type CreateMatcapRenderPipelineResourceResult,
} from "../materials/matcap/matcap-pipeline.js";
import {
  createStandardRenderPipelineResource,
  type CreateStandardRenderPipelineResourceResult,
} from "../materials/standard/standard-pipeline.js";
import {
  createUnlitRenderPipelineResource,
  type CreateUnlitRenderPipelineResourceResult,
} from "../materials/unlit/unlit-pipeline.js";
import type { CreateCustomWgslMaterialRenderPipelineResourceResult } from "../materials/custom-wgsl/custom-wgsl-material.js";
import type { CreateSpriteRenderPipelineResourceResult } from "../render/sprites/sprite-pipeline.js";
import {
  createTonemapPipelineKey,
  type TonemapOperator,
} from "../output/output-stage-tonemap.js";
import { createOutputColorSpacePipelineKey } from "../output/output-stage-color-space.js";
import { webGpuAppUsesPostTonemapMeshStage } from "./render-color-format.js";
import type { WebGpuAppMaterialKind } from "./pipeline-layouts.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuApp, WebGpuAppResourceReuseReport } from "./app.js";

export type WebGpuAppPipelineResourceResult =
  | CreateUnlitRenderPipelineResourceResult
  | CreateMatcapRenderPipelineResourceResult
  | CreateStandardRenderPipelineResourceResult
  | CreateDebugNormalRenderPipelineResourceResult
  | CreateSpriteRenderPipelineResourceResult
  | CreateCustomWgslMaterialRenderPipelineResourceResult;

export function getOrCreateWebGpuAppPipeline(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly kind: WebGpuAppMaterialKind;
  readonly pipelineKey: string;
  readonly batchKey: RenderSnapshot["meshDraws"][number]["batchKey"];
  readonly motionVectorColorFormat?: string | null;
  readonly indirectColorFormat?: string | null;
  /**
   * The draw's material stage. `post-tonemap` builds a PRESENTATION pipeline
   * for the overlay boundary the post route encodes after its tonemap stage:
   * swapchain color format, the single color target that pass exposes, sample
   * count 1, and read-only single-sample depth.
   */
  readonly renderStage?: MeshRenderStage;
}): WebGpuAppPipelineResourceResult | Promise<WebGpuAppPipelineResourceResult> {
  // HDR scene-buffer path (M5-T4): the lit pass renders into rgba16float and the
  // material does NOT tonemap (tonemap+exposure+sRGB run in the final post
  // stage). Default path: sceneRenderFormat === the swapchain format -> unchanged.
  const isHdr =
    options.app.sceneRenderFormat !== options.app.initialization.format;
  const standardTonemap = isHdr ? "none" : options.app.tonemap;
  const standardOutputColorSpace = isHdr
    ? "linear"
    : options.app.outputColorSpace;

  // AI-17 / AI-91: mesh pipelines are created once per app and reused by every
  // pass, including render-to-texture previews and the transmission scene-color
  // copy, whose contents must stay LINEAR (they are sampled as scene content
  // and encoded once at the final output; three.js likewise only tonemaps when
  // no render target is bound). Until pipeline selection is per-render-target
  // (AI-91), the non-standard mesh families therefore resolve the no-op pair by
  // default; the wrap capability itself stays wired, keyed, and Dawn-verified.
  // A post-tonemap draw is encoded into the overlay boundary the post route
  // appends AFTER its tonemap stage: swapchain color format, exactly one color
  // target (no motion-vector / indirect attachments), sample count 1, and a
  // read-only single-sample depth attachment — the scene depth itself when the
  // app is single-sample, and the copy `overlay-depth-resolve.ts` makes of it
  // under MSAA.
  const postTonemap =
    options.renderStage === "post-tonemap" &&
    webGpuAppUsesPostTonemapMeshStage(options.app);
  const meshTonemap = postTonemap
    ? postTonemapPipelineTonemap(options.app, options.pipelineKey)
    : options.kind === "standard"
      ? standardTonemap
      : "none";
  const meshOutputColorSpace = postTonemap
    ? // The overlay boundary writes the presentation target, so a post-tonemap
      // draw owns the encode the tonemap stage would otherwise have done.
      options.app.outputColorSpace
    : options.kind === "standard"
      ? standardOutputColorSpace
      : "linear";
  const colorFormat = postTonemap
    ? options.app.initialization.format
    : options.app.sceneRenderFormat;
  const sampleCount = postTonemap ? 1 : options.app.msaa.sampleCount;
  // Always depth-tested. The overlay boundary is single-sample, so under MSAA
  // it binds a single-sample COPY of the scene depth rather than the
  // multisampled attachment itself (see `overlay-depth-resolve.ts`) — either
  // way the attachment a post-tonemap draw tests against is
  // WEBGPU_APP_DEPTH_FORMAT at one sample.
  const depthFormat = WEBGPU_APP_DEPTH_FORMAT;
  const motionVectorColorFormat = postTonemap
    ? undefined
    : options.motionVectorColorFormat;
  const indirectColorFormat = postTonemap
    ? undefined
    : options.indirectColorFormat;
  const key = [
    options.kind,
    colorFormat,
    `motion:${motionVectorColorFormat ?? "none"}`,
    `indirect:${indirectColorFormat ?? "none"}`,
    depthFormat ?? "none",
    `samples:${sampleCount}`,
    `stage:${postTonemap ? "post-tonemap" : "scene"}`,
    options.pipelineKey,
    // The created resource bakes its vertex buffer layout from batchKey, so
    // the cache must be at least as fine as the mesh layout: two meshes with
    // colliding material variants but different stream layouts (e.g. an
    // interleaved primitive floor vs a multi-stream glTF mesh) otherwise
    // share one pipeline and the second draw fails Dawn validation with
    // "Vertex buffer slot N required ... was not set".
    `layout:${options.batchKey.meshLayoutKey}`,
    // Primitive topology is baked into the render pipeline. Line and triangle
    // meshes can otherwise collide when they share the same material variant
    // and vertex layout, causing one topology to be rendered as the other.
    `topology:${options.batchKey.topology}`,
    // The resolved pair keys the cache for every kind so a future per-target
    // resolution (AI-91) cannot collide cached variants.
    createTonemapPipelineKey(meshTonemap),
    createOutputColorSpacePipelineKey(meshOutputColorSpace),
  ].join("|");
  const cached = options.cache.pipelines.get(key);

  if (cached !== undefined) {
    options.reuse.pipelineHits += 1;
    return cached;
  }

  options.reuse.pipelineMisses += 1;

  const pipeline =
    options.kind === "standard"
      ? createStandardRenderPipelineResource({
          device: options.app.initialization.device as Parameters<
            typeof createStandardRenderPipelineResource
          >[0]["device"],
          colorFormat,
          ...(motionVectorColorFormat === undefined
            ? {}
            : { motionVectorColorFormat }),
          ...(indirectColorFormat === undefined || indirectColorFormat === null
            ? {}
            : { indirectColorFormat }),
          depthFormat,
          sampleCount,
          batchKey: options.batchKey,
          tonemap: meshTonemap,
          outputColorSpace: meshOutputColorSpace,
        })
      : options.kind === "debug-normal"
        ? createDebugNormalRenderPipelineResource({
            device: options.app.initialization.device as Parameters<
              typeof createDebugNormalRenderPipelineResource
            >[0]["device"],
            colorFormat,
            ...(motionVectorColorFormat === undefined
              ? {}
              : { motionVectorColorFormat }),
            depthFormat,
            sampleCount,
            batchKey: options.batchKey,
            tonemap: meshTonemap,
            outputColorSpace: meshOutputColorSpace,
          })
        : options.kind === "matcap"
          ? createMatcapRenderPipelineResource({
              device: options.app.initialization.device as Parameters<
                typeof createMatcapRenderPipelineResource
              >[0]["device"],
              colorFormat,
              ...(motionVectorColorFormat === undefined
                ? {}
                : { motionVectorColorFormat }),
              depthFormat,
              sampleCount,
              batchKey: options.batchKey,
              tonemap: meshTonemap,
              outputColorSpace: meshOutputColorSpace,
            })
          : createUnlitRenderPipelineResource({
              device: options.app.initialization.device as Parameters<
                typeof createUnlitRenderPipelineResource
              >[0]["device"],
              colorFormat,
              ...(motionVectorColorFormat === undefined
                ? {}
                : { motionVectorColorFormat }),
              depthFormat,
              sampleCount,
              batchKey: options.batchKey,
              tonemap: meshTonemap,
              outputColorSpace: meshOutputColorSpace,
            });

  return cacheWebGpuAppPipelineWhenReady(options.cache, key, pipeline);
}

/**
 * Tonemap operator a post-tonemap pipeline applies to its own fragment output.
 *
 * `toneMapped: false` (the `tonemapped:false` pipeline-key feature, the direct
 * equivalent of three.js `MeshBasicMaterial({ toneMapped: false })`) writes the
 * authored color through untouched so the blend happens in display space
 * against already-tone-mapped pixels. `toneMapped: true` — the default,
 * matching `ParticleRendererModuleInput.toneMapped` — still tone-maps the
 * material's own value, it just blends in display space rather than in the
 * scene buffer.
 */
function postTonemapPipelineTonemap(
  app: WebGpuApp,
  pipelineKey: string,
): TonemapOperator {
  return pipelineKey.split("|").includes(MATERIAL_UNTONEMAPPED_FEATURE)
    ? "none"
    : app.tonemap;
}

function cacheWebGpuAppPipelineWhenReady(
  cache: WebGpuAppResourceCache,
  key: string,
  pipeline:
    | WebGpuAppPipelineResourceResult
    | Promise<WebGpuAppPipelineResourceResult>,
): WebGpuAppPipelineResourceResult | Promise<WebGpuAppPipelineResourceResult> {
  if (isPromiseLike(pipeline)) {
    return pipeline.then((resolved) =>
      cacheWebGpuAppPipelineResult(cache, key, resolved),
    );
  }

  return cacheWebGpuAppPipelineResult(cache, key, pipeline);
}

function cacheWebGpuAppPipelineResult(
  cache: WebGpuAppResourceCache,
  key: string,
  pipeline: WebGpuAppPipelineResourceResult,
): WebGpuAppPipelineResourceResult {
  if (pipeline.valid && pipeline.resource !== null) {
    cache.pipelines.set(key, pipeline);
  }

  return pipeline;
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { readonly then?: unknown }).then === "function"
  );
}
