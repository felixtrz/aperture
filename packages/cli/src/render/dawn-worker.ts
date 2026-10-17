import {
  createNodeDevice,
  createOffscreenOutput,
  NodeGpuError,
  type NodeDevice,
} from "@aperture-engine/adapter-node";
import {
  renderPortableBundle,
  type PortableRenderStatus,
} from "@aperture-engine/app/render-bundle";
import { renderShaderJob, type GpuShaderJob } from "@aperture-engine/gpu";
import { decodeShaderJob, isShaderJob } from "@aperture-engine/shader";
import { preflightApertureSnapshotBundle } from "../headless/bundle.js";
import {
  readRenderBundleDigestMetadata,
  renderBundleFeedbackMetadata,
} from "./metadata.js";
import { encodeRenderPng } from "./png.js";
import type { DawnWorkerRequest, DawnWorkerResponse } from "./dawn-protocol.js";
import type { RenderBundleResult } from "./types.js";

let native: NodeDevice | null = null;
let chain: Promise<void> = Promise.resolve();
let closing = false;

process.on("message", (input: DawnWorkerRequest) => {
  if (closing) return;
  if (input.kind === "dispose") closing = true;
  chain = chain.then(async () => {
    let response: DawnWorkerResponse;
    try {
      if (input.kind === "initialize") {
        if (native !== null)
          throw new Error("Dawn session is already initialized.");
        native = await createNodeDevice(input.options);
        response = { id: input.id, ok: true, result: native.metadata };
      } else if (input.kind === "dispose") {
        await native?.dispose();
        native = null;
        response = { id: input.id, ok: true, result: null };
      } else {
        response = {
          id: input.id,
          ok: true,
          result: await render(input.options),
        };
      }
    } catch (error) {
      response = {
        id: input.id,
        ok: false,
        code:
          error instanceof NodeGpuError
            ? error.code
            : "aperture.render.renderFailed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
    if (process.connected)
      await new Promise<void>((resolve) => {
        const done = (): void => {
          process.off("disconnect", done);
          resolve();
        };
        // IPC can close before the send callback fires; releasing the response
        // wait lets the disconnect handler drain the job chain and destroy Dawn.
        process.once("disconnect", done);
        process.send!(response, done);
      });
    if (input.kind === "dispose" && process.connected) process.disconnect?.();
  });
});

process.on("disconnect", () => {
  closing = true;
  void chain
    .then(async () => {
      await native?.dispose();
      native = null;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
});

async function render(
  options: Extract<DawnWorkerRequest, { kind: "render" }>["options"],
): Promise<RenderBundleResult> {
  if (native === null) throw new Error("Dawn session is not initialized.");
  native.assertHealthy();
  const started = performance.now();
  const shaderJob = isShaderJob(options.bundle)
    ? decodeShaderJob(options.bundle)
    : null;
  if (shaderJob === null) {
    const preflight = preflightApertureSnapshotBundle(
      options.bundle as Parameters<typeof preflightApertureSnapshotBundle>[0],
      { allowPlaceholders: options.allowPlaceholders === true },
    );
    if (!preflight.ok)
      throw new Error(
        `Render bundle is incomplete: ${preflight.violations.join("; ")}`,
      );
  }
  const output = createOffscreenOutput(native.device, {
    width: options.width,
    height: options.height,
  });
  let rendered: {
    app: { dispose(): Promise<void> };
    status: PortableRenderStatus;
  } | null = null;
  let shaderReport: unknown;
  native.device.pushErrorScope("validation");
  let result: RenderBundleResult | null = null;
  let failure: unknown;
  try {
    if (shaderJob === null)
      rendered = await renderPortableBundle(options.bundle, {
        deviceContext: native,
        output,
      });
    else {
      const program = await renderShaderJob(
        shaderJob as unknown as GpuShaderJob,
        { device: native.device, output },
      );
      rendered = {
        app: program.context,
        status: {
          ok: true,
          frame: program.reports.at(-1)!.frame,
          diagnostics: program.reports.flatMap((report) => report.diagnostics),
          metadata: {
            webgpu: {
              format: output.format,
              displayColorSpace: "srgb",
              adapterInfo: native.metadata.adapterInfo,
              adapterFeatures: native.metadata.adapterFeatures,
              deviceFeatures: native.metadata.deviceFeatures,
            },
            lightingHealth: null,
          },
        },
      };
      shaderReport = {
        reports: program.reports,
        inspection: program.context.inspect(),
      };
    }
    if (!rendered.status.ok)
      throw new Error(
        `Aperture render failed: ${JSON.stringify(rendered.status.diagnostics)}`,
      );
    const renderedAt = performance.now();
    await native.device.queue.onSubmittedWorkDone();
    const gpuDoneAt = performance.now();
    const rgba = await output.readRgba();
    const readAt = performance.now();
    const png = encodeRenderPng(output.width, output.height, rgba);
    const pngAt = performance.now();
    native.assertHealthy();
    result = {
      png,
      frame: rendered.status.frame,
      metadata: {
        schemaVersion: 2,
        backend: "dawn",
        dawn: native.metadata,
        cpuTimings: {
          ...(rendered.status.timings === undefined
            ? {}
            : { portable: rendered.status.timings }),
          prepareAndRenderMs: renderedAt - started,
          gpuCompletionMs: gpuDoneAt - renderedAt,
          readbackMs: readAt - gpuDoneAt,
          pngMs: pngAt - readAt,
          totalMs: pngAt - started,
        },
        ...(shaderReport === undefined ? {} : { shader: shaderReport }),
        ...renderBundleFeedbackMetadata(rendered.status),
        requestedDimensions: { width: options.width, height: options.height },
        actualDimensions: { width: output.width, height: output.height },
        bundleDigest: readRenderBundleDigestMetadata(options.bundle),
        webgpu: rendered.status.metadata.webgpu,
        lightingHealth: rendered.status.metadata.lightingHealth,
      },
    };
  } catch (error) {
    failure = error;
  } finally {
    const cleanup = await Promise.allSettled([
      rendered?.app.dispose(),
      output.dispose(),
    ]);
    const errors = cleanup
      .filter(
        (item): item is PromiseRejectedResult => item.status === "rejected",
      )
      .map((item) => item.reason as unknown);
    if (errors.length > 0)
      failure = new AggregateError(
        [...(failure === undefined ? [] : [failure]), ...errors],
        "Native render cleanup failed.",
      );
  }
  const validation = await native.device.popErrorScope();
  if (validation !== null)
    throw new NodeGpuError(
      "aperture.dawn.validationFailed",
      validation.message,
      failure === undefined ? undefined : { cause: failure },
    );
  if (failure !== undefined) throw failure;
  const memory = process.memoryUsage();
  return {
    ...result!,
    metadata: {
      ...result!.metadata,
      processMemory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        external: memory.external,
      },
    },
  };
}
