/// <reference types="@webgpu/types" preserve="true" />
import {
  createGpuContext,
  renderShaderJob,
  type GpuContext,
  type GpuContextOptions,
  type GpuShaderJob,
} from "./context.js";
import type { WebGpuOutputTarget } from "./gpu/output-target.js";

export interface BrowserGpuOptions {
  readonly canvas: HTMLCanvasElement;
  /** Borrowed device; disposal releases only this context’s resources. */
  readonly device?: GPUDevice;
  readonly requiredFeatures?: readonly GPUFeatureName[];
  readonly optionalFeatures?: readonly GPUFeatureName[];
  readonly alphaMode?: GPUCanvasAlphaMode;
  readonly record?: boolean;
}

async function initialize(options: BrowserGpuOptions): Promise<{
  device: GPUDevice;
  adapter: GPUAdapter | null;
  output: GpuContextOptions["output"];
}> {
  if (navigator.gpu === undefined)
    throw new Error("WebGPU is unavailable in this browser.");
  const adapter =
    options.device === undefined ? await navigator.gpu.requestAdapter() : null;
  if (adapter === null && options.device === undefined)
    throw new Error("No WebGPU adapter is available.");
  const features = new Set(options.requiredFeatures ?? []);
  for (const feature of features)
    if (!(options.device?.features ?? adapter!.features).has(feature))
      throw new Error(`Required WebGPU feature '${feature}' is unavailable.`);
  for (const feature of options.optionalFeatures ?? [])
    if (adapter?.features.has(feature)) features.add(feature);
  const device =
    options.device ??
    (await adapter!.requestDevice({ requiredFeatures: [...features] }));
  try {
    const context = options.canvas.getContext("webgpu");
    if (context === null)
      throw new Error("The canvas did not provide a WebGPU context.");
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      colorSpace: "srgb",
      alphaMode: options.alphaMode ?? "opaque",
      usage: 0x10 | 0x01,
    });
    const output: WebGpuOutputTarget & {
      resize(width: number, height: number): void;
    } = {
      get width() {
        return options.canvas.width;
      },
      get height() {
        return options.canvas.height;
      },
      format,
      colorSpace: "srgb",
      alphaMode: options.alphaMode ?? "opaque",
      sampleCount: 1,
      acquire: () => context.getCurrentTexture(),
      resize(width, height) {
        options.canvas.width = width;
        options.canvas.height = height;
      },
    };
    return { device, adapter, output };
  } catch (error) {
    if (options.device === undefined) device.destroy();
    throw error;
  }
}

function ownsDevice(context: GpuContext, device?: GPUDevice): GpuContext {
  let disposal: Promise<void> | undefined;
  return {
    ...context,
    dispose() {
      return (disposal ??= context.dispose().finally(() => device?.destroy()));
    },
  };
}

export async function createBrowserGpuContext(
  options: BrowserGpuOptions,
): Promise<GpuContext> {
  const session = await initialize(options);
  try {
    return ownsDevice(
      createGpuContext({
        ...session,
        ...(options.record === undefined ? {} : { record: options.record }),
      }),
      options.device === undefined ? session.device : undefined,
    );
  } catch (error) {
    if (options.device === undefined) session.device.destroy();
    throw error;
  }
}

export async function renderShaderJobInCanvas(
  job: GpuShaderJob,
  options: BrowserGpuOptions,
): Promise<
  Awaited<ReturnType<typeof renderShaderJob>> & { readonly metadata: unknown }
> {
  const session = await initialize(options);
  try {
    const rendered = await renderShaderJob(job, session);
    return {
      ...rendered,
      context: ownsDevice(
        rendered.context,
        options.device === undefined ? session.device : undefined,
      ),
      metadata: {
        format: session.output.format,
        displayColorSpace: "srgb",
        adapterInfo: {
          vendor: session.adapter?.info.vendor,
          architecture: session.adapter?.info.architecture,
          device: session.adapter?.info.device,
          description: session.adapter?.info.description,
        },
        adapterFeatures: [...(session.adapter?.features ?? [])],
        deviceFeatures: [...session.device.features],
      },
    };
  } catch (error) {
    if (options.device === undefined) session.device.destroy();
    throw error;
  }
}

/** Browser scheduling is separate from the manually stepped, platform-free core. */
export function animateGpuContext(
  context: GpuContext,
  onError: (error: unknown) => void,
): () => void {
  let stopped = false,
    handle = 0,
    previous: number | undefined;
  const tick = (now: number): void => {
    if (stopped) return;
    const delta = previous === undefined ? 0 : (now - previous) / 1000;
    previous = now;
    void context.frame({ time: now / 1000, delta }).then(
      () => {
        if (!stopped) handle = requestAnimationFrame(tick);
      },
      (error: unknown) => {
        stopped = true;
        onError(error);
      },
    );
  };
  handle = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(handle);
  };
}

/** Decode once outside the frame loop; Node programs supply decoded RGBA bytes. */
export async function loadGpuTexture(
  context: GpuContext,
  id: string,
  url: string,
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Texture '${url}' failed: HTTP ${response.status}.`);
  const bitmap = await createImageBitmap(await response.blob(), {
    premultiplyAlpha: "none",
    colorSpaceConversion: "none",
  });
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
      drawing = canvas.getContext("2d");
    if (drawing === null) throw new Error("Cannot decode texture pixels.");
    drawing.drawImage(bitmap, 0, 0);
    context.resource({
      kind: "texture",
      id,
      width: bitmap.width,
      height: bitmap.height,
      format: "rgba8unorm-srgb",
      usage: ["sampled", "copy-dst"],
      data: new Uint8Array(
        drawing.getImageData(0, 0, bitmap.width, bitmap.height).data,
      ),
    });
  } finally {
    bitmap.close();
  }
}
