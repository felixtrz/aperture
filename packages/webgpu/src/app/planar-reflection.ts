import type { AssetRegistry } from "@aperture-engine/simulation";
import type { RenderSnapshot } from "@aperture-engine/render";
import type { WebGpuOutputTarget } from "../gpu/output-target.js";
import type { WebGpuPostEffect } from "../post/post-pass.js";
import type {
  WebGpuApp,
  CreateWebGpuAppOptions,
  CreateWebGpuAppResult,
  WebGpuAppRenderOptions,
} from "./app.js";
import {
  createPlanarReflectionView,
  resolvePlanarReflectionOptions,
  type WebGpuPlanarReflectionOptions,
} from "./planar-reflection-view.js";
import { planarReflectionWgsl } from "./planar-reflection-shader.js";

export function createPlanarReflectionRenderer(input: {
  readonly options: WebGpuPlanarReflectionOptions;
  readonly device: GPUDevice;
  readonly sourceAssets: AssetRegistry;
  readonly createApp: (
    options: CreateWebGpuAppOptions,
  ) => Promise<CreateWebGpuAppResult>;
}): {
  readonly effect: WebGpuPostEffect;
  render(
    snapshot: RenderSnapshot,
    width: number,
    height: number,
    options: WebGpuAppRenderOptions,
  ): Promise<void>;
  dispose(): Promise<void>;
} {
  const options = resolvePlanarReflectionOptions(input.options);
  const device = input.device;
  let width = 1,
    height = 1;
  let texture: GPUTexture | undefined;
  let app: WebGpuApp | undefined;
  let uniform: GPUBuffer | undefined;
  let sampler: GPUSampler | undefined;
  let compositeTarget: GPUTexture | undefined;
  let compositeTargetKey = "";
  const pipelines = new Map<string, GPURenderPipeline>();
  const output: WebGpuOutputTarget = {
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    format: "rgba16float",
    colorSpace: "srgb",
    alphaMode: "opaque",
    sampleCount: 1,
    acquire() {
      if (texture === undefined)
        throw new Error("Reflection output is not ready.");
      return texture;
    },
  };
  return {
    effect: {
      id: "planar-reflection",
      requiresDepthTexture: true,
      prepare(context) {
        if (
          texture === undefined ||
          uniform === undefined ||
          context.depth === undefined
        )
          throw new Error(
            "planarReflection requires a prepared reflection and scene depth.",
          );
        const key = `${context.outputFormat}/${context.depth.sampleCount}`;
        const samples = context.depth.sampleCount;
        if (samples > 1) {
          const targetKey = `${key}/${context.width}/${context.height}`;
          if (compositeTargetKey !== targetKey) {
            const next = device.createTexture({
              label: "aperture/planar-reflection/msaa-composite",
              size: [context.width, context.height],
              format: context.outputFormat as GPUTextureFormat,
              sampleCount: samples,
              usage: 0x10,
            });
            compositeTarget?.destroy();
            compositeTarget = next;
            compositeTargetKey = targetKey;
          }
        } else {
          compositeTarget?.destroy();
          compositeTarget = undefined;
          compositeTargetKey = "";
        }
        let pipeline = pipelines.get(key);
        if (pipeline === undefined) {
          const module = device.createShaderModule({
            label: "aperture/planar-reflection",
            code: planarReflectionWgsl(context.depth.sampleCount),
          });
          pipeline = device.createRenderPipeline({
            label: "aperture/planar-reflection",
            layout: "auto",
            vertex: { module, entryPoint: "vs" },
            fragment: {
              module,
              entryPoint: "fs",
              targets: [{ format: context.outputFormat as GPUTextureFormat }],
            },
            primitive: { topology: "triangle-list" },
            multisample: { count: samples },
          });
          pipelines.set(key, pipeline);
        }
        sampler ??= device.createSampler({
          magFilter: "linear",
          minFilter: "linear",
        });
        const bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: sampler },
            {
              binding: 1,
              resource: context.input.texture.createView!() as GPUTextureView,
            },
            {
              binding: 2,
              resource: context.depth.texture.createView!() as GPUTextureView,
            },
            { binding: 3, resource: texture.createView() },
            { binding: 4, resource: { buffer: uniform } },
          ],
        });
        return {
          effectId: "planar-reflection",
          label: "Planar scene reflection",
          diagnostics: [],
          ...(samples <= 1
            ? {}
            : {
                msaaColorTarget: {
                  view: compositeTarget!.createView(),
                  sampleCount: samples,
                },
              }),
          commands: [
            { kind: "setPipeline", renderId: 0, pipelineKey: key, pipeline },
            {
              kind: "setBindGroup",
              renderId: 0,
              resourceKey: "planar-reflection",
              index: 0,
              bindGroup,
            },
            {
              kind: "draw",
              renderId: 0,
              vertexCount: 3,
              instanceCount: 1,
              firstVertex: 0,
              firstInstance: 0,
            },
          ],
        };
      },
    },
    async render(snapshot, outputWidth, outputHeight, renderOptions) {
      const derived = createPlanarReflectionView(
        snapshot,
        options.height,
        options.clipBias,
      );
      const nextWidth = Math.max(
        1,
        Math.round(outputWidth * options.resolutionScale),
      );
      const nextHeight = Math.max(
        1,
        Math.round(outputHeight * options.resolutionScale),
      );
      if (
        texture === undefined ||
        width !== nextWidth ||
        height !== nextHeight
      ) {
        await device.queue.onSubmittedWorkDone();
        const next = device.createTexture({
          label: "aperture/planar-reflection/color",
          size: [nextWidth, nextHeight],
          format: "rgba16float",
          usage: 0x10 | 0x04,
        });
        texture?.destroy();
        texture = next;
        width = nextWidth;
        height = nextHeight;
      }
      if (app === undefined) {
        const created = await input.createApp({
          deviceContext: { device },
          output,
          sourceAssets: input.sourceAssets,
          autoStart: false,
          msaaSampleCount: 1,
          tonemap: "none",
          outputColorSpace: "linear",
        });
        if (!created.ok)
          throw new Error(
            `Reflection initialization failed: ${created.message}`,
          );
        app = created.app;
      }
      const report = await app.renderSnapshot(derived.snapshot, {
        ...(renderOptions.standardMaterialIblResources === undefined
          ? {}
          : {
              standardMaterialIblResources:
                renderOptions.standardMaterialIblResources,
            }),
      });
      if (!report.ok)
        throw new Error(
          `Reflection rendering failed: ${JSON.stringify(report.diagnostics)}`,
        );
      uniform ??= device.createBuffer({
        label: "aperture/planar-reflection/parameters",
        size: 176,
        usage: 0x40 | 0x08,
      });
      const data = new Float32Array(44);
      data.set(derived.inverseViewProjection);
      data.set(derived.reflectionViewProjection, 16);
      data.set(
        [
          options.height,
          options.strength,
          options.surfaceTolerance,
          options.distortion,
          options.blurPixels,
          options.distortionFrequency,
          snapshot.time ?? 0,
          0,
        ],
        32,
      );
      data.set([...options.tint, 1], 40);
      device.queue.writeBuffer(uniform, 0, data);
    },
    async dispose() {
      try {
        await app?.dispose();
        await device.queue.onSubmittedWorkDone();
      } finally {
        texture?.destroy();
        compositeTarget?.destroy();
        uniform?.destroy();
        texture = undefined;
        compositeTarget = undefined;
        compositeTargetKey = "";
        uniform = undefined;
        app = undefined;
        pipelines.clear();
      }
    },
  };
}
