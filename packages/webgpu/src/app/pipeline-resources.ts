import type { RenderSnapshot } from "@aperture-engine/render";
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
import { createTonemapPipelineKey } from "../output/output-stage-tonemap.js";
import { createOutputColorSpacePipelineKey } from "../output/output-stage-color-space.js";
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

export async function getOrCreateWebGpuAppPipeline(options: {
  readonly app: WebGpuApp;
  readonly cache: WebGpuAppResourceCache;
  readonly reuse: WebGpuAppResourceReuseReport;
  readonly kind: WebGpuAppMaterialKind;
  readonly pipelineKey: string;
  readonly batchKey: RenderSnapshot["meshDraws"][number]["batchKey"];
  readonly motionVectorColorFormat?: string | null;
  readonly indirectColorFormat?: string | null;
}): Promise<WebGpuAppPipelineResourceResult> {
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
  const meshTonemap = options.kind === "standard" ? standardTonemap : "none";
  const meshOutputColorSpace =
    options.kind === "standard" ? standardOutputColorSpace : "linear";
  const key = [
    options.kind,
    options.app.sceneRenderFormat,
    `motion:${options.motionVectorColorFormat ?? "none"}`,
    `indirect:${options.indirectColorFormat ?? "none"}`,
    WEBGPU_APP_DEPTH_FORMAT,
    `samples:${options.app.msaa.sampleCount}`,
    options.pipelineKey,
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
      ? await createStandardRenderPipelineResource({
          device: options.app.initialization.device as Parameters<
            typeof createStandardRenderPipelineResource
          >[0]["device"],
          colorFormat: options.app.sceneRenderFormat,
          ...(options.motionVectorColorFormat === undefined
            ? {}
            : { motionVectorColorFormat: options.motionVectorColorFormat }),
          ...(options.indirectColorFormat === undefined ||
          options.indirectColorFormat === null
            ? {}
            : { indirectColorFormat: options.indirectColorFormat }),
          depthFormat: WEBGPU_APP_DEPTH_FORMAT,
          sampleCount: options.app.msaa.sampleCount,
          batchKey: options.batchKey,
          tonemap: meshTonemap,
          outputColorSpace: meshOutputColorSpace,
        })
      : options.kind === "debug-normal"
        ? await createDebugNormalRenderPipelineResource({
            device: options.app.initialization.device as Parameters<
              typeof createDebugNormalRenderPipelineResource
            >[0]["device"],
            colorFormat: options.app.sceneRenderFormat,
            ...(options.motionVectorColorFormat === undefined
              ? {}
              : { motionVectorColorFormat: options.motionVectorColorFormat }),
            depthFormat: WEBGPU_APP_DEPTH_FORMAT,
            sampleCount: options.app.msaa.sampleCount,
            batchKey: options.batchKey,
            tonemap: meshTonemap,
            outputColorSpace: meshOutputColorSpace,
          })
        : options.kind === "matcap"
          ? await createMatcapRenderPipelineResource({
              device: options.app.initialization.device as Parameters<
                typeof createMatcapRenderPipelineResource
              >[0]["device"],
              colorFormat: options.app.sceneRenderFormat,
              ...(options.motionVectorColorFormat === undefined
                ? {}
                : { motionVectorColorFormat: options.motionVectorColorFormat }),
              depthFormat: WEBGPU_APP_DEPTH_FORMAT,
              sampleCount: options.app.msaa.sampleCount,
              batchKey: options.batchKey,
              tonemap: meshTonemap,
              outputColorSpace: meshOutputColorSpace,
            })
          : await createUnlitRenderPipelineResource({
              device: options.app.initialization.device as Parameters<
                typeof createUnlitRenderPipelineResource
              >[0]["device"],
              colorFormat: options.app.sceneRenderFormat,
              ...(options.motionVectorColorFormat === undefined
                ? {}
                : { motionVectorColorFormat: options.motionVectorColorFormat }),
              depthFormat: WEBGPU_APP_DEPTH_FORMAT,
              sampleCount: options.app.msaa.sampleCount,
              batchKey: options.batchKey,
              tonemap: meshTonemap,
              outputColorSpace: meshOutputColorSpace,
            });

  if (pipeline.valid && pipeline.resource !== null) {
    options.cache.pipelines.set(key, pipeline);
  }

  return pipeline;
}
