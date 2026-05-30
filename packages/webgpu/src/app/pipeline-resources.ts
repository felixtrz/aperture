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
  const key = [
    options.kind,
    options.app.sceneRenderFormat,
    `motion:${options.motionVectorColorFormat ?? "none"}`,
    `indirect:${options.indirectColorFormat ?? "none"}`,
    WEBGPU_APP_DEPTH_FORMAT,
    `samples:${options.app.msaa.sampleCount}`,
    options.pipelineKey,
    options.kind === "standard"
      ? createTonemapPipelineKey(standardTonemap)
      : "tonemap:none",
    options.kind === "standard"
      ? createOutputColorSpacePipelineKey(standardOutputColorSpace)
      : createOutputColorSpacePipelineKey("linear"),
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
          tonemap: standardTonemap,
          outputColorSpace: standardOutputColorSpace,
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
            });

  if (pipeline.valid && pipeline.resource !== null) {
    options.cache.pipelines.set(key, pipeline);
  }

  return pipeline;
}
