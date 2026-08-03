import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  createPackedSnapshotViewUniformsScratch,
  createParticleEffectAsset,
  createParticleEffectHandle,
  createRenderSortKey,
  createWebGpuAppResourceCache,
  prepareParticleFrameResourcesForSnapshot,
  writePackedSnapshotViewUniforms,
  type RenderSnapshot,
} from "@aperture-engine/webgpu/test-support";

/**
 * Throughput properties of the particle frame path.
 *
 * These assert structure, not wall clock: how many emitters the renderer
 * simulates, how many bytes it uploads, whether frame assembly can be held
 * open by a GPU fence, and whether per-emitter resource lookup yields to the
 * microtask queue. All four decide whether a live particle scene keeps
 * producing frames.
 */
describe("GPU particle frame throughput", () => {
  it("completes frame assembly while the stale-buffer fence is still pending", async () => {
    const effect = createParticleEffectHandle("churn-smoke");
    const assets = registerContinuousEffect(effect);
    const cache = createWebGpuAppResourceCache();
    const fence = createPendingFence();
    const fixture = createParticleDeviceFixture(fence.queueExtras);

    // Two emitters share one continuous batch; dropping one retires that
    // batch's GPU buffers, which is what used to force a queue fence into the
    // middle of frame assembly.
    const first = createContinuousSnapshot({ effect, count: 2, timeScale: 1 });
    await prepareParticleFrame(fixture.device, assets, cache, first, 1 / 60);

    const second = createContinuousSnapshot({
      effect,
      count: 1,
      timeScale: 1,
      frame: 4,
    });
    const pendingBefore = fixture.destroyedBuffers.length;
    const frame = await withTimeout(
      prepareParticleFrame(fixture.device, assets, cache, second, 2 / 60),
      "particle frame assembly blocked on the stale-buffer fence",
    );

    expect(frame.valid).toBe(true);
    expect(frame.report.staleStatesRemoved).toBeGreaterThan(0);
    // The fence is still used — retirement must not race the previous
    // submission — but it no longer gates the frame.
    expect(fence.calls).toBeGreaterThan(0);
    expect(fixture.destroyedBuffers.length).toBe(pendingBefore);

    fence.release();
    await Promise.resolve();
    await Promise.resolve();

    expect(fixture.destroyedBuffers.length).toBeGreaterThan(pendingBefore);
  });

  it("prepares warm per-emitter resources without yielding per emitter", async () => {
    const effect = createParticleEffectHandle("warm-cache-smoke");
    const assets = registerContinuousEffect(effect);
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const emitterCount = 64;

    // Warm the pipeline/texture caches so the measured frame has nothing left
    // to compile: every emitter is a pure cache hit.
    const warm = createContinuousSnapshot({
      effect,
      count: emitterCount,
      timeScale: 1,
    });
    await prepareParticleFrame(fixture.device, assets, cache, warm, 1 / 60);

    const measured = createContinuousSnapshot({
      effect,
      count: emitterCount,
      timeScale: 1,
      frame: 4,
    });
    const ticks = countMicrotaskTicks();
    const frame = await prepareParticleFrame(
      fixture.device,
      assets,
      cache,
      measured,
      2 / 60,
    );
    const yielded = ticks.stop();

    expect(frame.valid).toBe(true);
    expect(frame.report.emitters).toBe(emitterCount);
    // Awaiting resource preparation per emitter cost one microtask turn each,
    // so this used to scale with the emitter count. The cache-hit path is now
    // synchronous and only the frame's own async boundary remains.
    expect(yielded).toBeLessThan(16);
  });

  it("reuses a frozen continuous emitter instead of resimulating and reuploading", async () => {
    const effect = createParticleEffectHandle("frozen-single");
    const assets = registerContinuousEffect(effect);
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();

    const live = createContinuousSnapshot({ effect, count: 1, timeScale: 1 });
    const first = await prepareParticleFrame(
      fixture.device,
      assets,
      cache,
      live,
      1 / 60,
    );

    expect(first.report.liveParticles).toBeGreaterThan(0);
    expect(first.report.simulatedEmitters).toBe(1);
    expect(first.report.uploadedBytes).toBeGreaterThan(0);

    const writesBefore = fixture.writes.filter(isParticleStateWrite).length;
    const frozen = createContinuousSnapshot({
      effect,
      count: 1,
      timeScale: 0,
      frame: 4,
    });
    const second = await prepareParticleFrame(
      fixture.device,
      assets,
      cache,
      frozen,
      2 / 60,
    );

    expect(second.report.simulatedEmitters).toBe(0);
    expect(second.report.uploadedBytes).toBe(0);
    expect(fixture.writes.filter(isParticleStateWrite).length).toBe(
      writesBefore,
    );
    // The field must still draw exactly what it drew while live.
    expect(second.report.liveParticles).toBe(first.report.liveParticles);
    expect(second.report.drawCalls).toBe(first.report.drawCalls);
  });

  it("reuses a frozen continuous batch without touching the shared buffer", async () => {
    const effect = createParticleEffectHandle("frozen-batch");
    const assets = registerContinuousEffect(effect);
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();

    const live = createContinuousSnapshot({ effect, count: 3, timeScale: 1 });
    const first = await prepareParticleFrame(
      fixture.device,
      assets,
      cache,
      live,
      1 / 60,
    );

    expect(first.report.batchGroups).toBe(1);
    expect(first.report.batchedEmitters).toBe(3);
    expect(first.report.simulatedEmitters).toBe(3);
    expect(first.report.uploadedBytes).toBeGreaterThan(0);

    const writesBefore = fixture.writes.length;
    const frozen = createContinuousSnapshot({
      effect,
      count: 3,
      timeScale: 0,
      frame: 4,
    });
    const second = await prepareParticleFrame(
      fixture.device,
      assets,
      cache,
      frozen,
      2 / 60,
    );

    expect(second.report.simulatedEmitters).toBe(0);
    expect(second.report.uploadedBytes).toBe(0);
    expect(second.report.liveParticles).toBe(first.report.liveParticles);
    expect(second.report.drawCalls).toBe(first.report.drawCalls);
    expect(second.report.batchGroups).toBe(1);
    expect(
      fixture.writes.slice(writesBefore).filter(isParticleBatchWrite),
    ).toEqual([]);
  });

  it("resimulates a frozen emitter that moved", async () => {
    const effect = createParticleEffectHandle("frozen-moved");
    const assets = registerContinuousEffect(effect);
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();

    const live = createContinuousSnapshot({ effect, count: 1, timeScale: 1 });
    await prepareParticleFrame(fixture.device, assets, cache, live, 1 / 60);

    const held = createContinuousSnapshot({
      effect,
      count: 1,
      timeScale: 0,
      frame: 4,
    });
    const stationary = await prepareParticleFrame(
      fixture.device,
      assets,
      cache,
      held,
      2 / 60,
    );

    expect(stationary.report.simulatedEmitters).toBe(0);

    const moved = createContinuousSnapshot({
      effect,
      count: 1,
      timeScale: 0,
      frame: 5,
      originZ: 4,
    });
    const carried = await prepareParticleFrame(
      fixture.device,
      assets,
      cache,
      moved,
      3 / 60,
    );

    // Placement is an input to the packed record, so a frozen emitter that is
    // carried somewhere else must repack and reupload.
    expect(carried.report.simulatedEmitters).toBe(1);
    expect(carried.report.uploadedBytes).toBeGreaterThan(0);
  });

  it("resumes simulation when the timeline restarts", async () => {
    const effect = createParticleEffectHandle("frozen-resumed");
    const assets = registerContinuousEffect(effect);
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();

    const live = createContinuousSnapshot({ effect, count: 2, timeScale: 1 });
    await prepareParticleFrame(fixture.device, assets, cache, live, 1 / 60);

    const frozen = createContinuousSnapshot({
      effect,
      count: 2,
      timeScale: 0,
      frame: 4,
    });
    const held = await prepareParticleFrame(
      fixture.device,
      assets,
      cache,
      frozen,
      2 / 60,
    );

    expect(held.report.simulatedEmitters).toBe(0);

    const resumed = createContinuousSnapshot({
      effect,
      count: 2,
      timeScale: 1,
      frame: 5,
    });
    const running = await prepareParticleFrame(
      fixture.device,
      assets,
      cache,
      resumed,
      3 / 60,
    );

    expect(running.report.simulatedEmitters).toBe(2);
    expect(running.report.uploadedBytes).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------- utilities */

function registerContinuousEffect(
  effect: ReturnType<typeof createParticleEffectHandle>,
): AssetRegistry {
  const assets = new AssetRegistry();

  assets.register(effect);
  assets.markReady(
    effect,
    createParticleEffectAsset({
      version: 2,
      label: "ContinuousSmoke",
      main: {
        maxParticles: 8,
        startLifetime: 10,
        startSpeed: 1,
        startSize: 1,
      },
      emission: {
        rateOverTime: 240,
      },
      shape: {
        type: "point",
      },
      renderer: {
        blendMode: "alpha",
      },
    }),
  );

  return assets;
}

async function prepareParticleFrame(
  device: unknown,
  assets: AssetRegistry,
  cache: ReturnType<typeof createWebGpuAppResourceCache>,
  snapshot: RenderSnapshot,
  time: number,
) {
  return prepareParticleFrameResourcesForSnapshot({
    app: {
      canvas: { width: 320, height: 180 } as never,
      initialization: { device, format: "bgra8unorm" },
      msaa: { sampleCount: 1 },
    },
    assets,
    cache,
    snapshot,
    viewUniforms: writePackedSnapshotViewUniforms(
      snapshot,
      createPackedSnapshotViewUniformsScratch(),
    ),
    time,
  });
}

function createContinuousSnapshot(options: {
  readonly effect: ReturnType<typeof createParticleEffectHandle>;
  readonly count: number;
  readonly timeScale: number;
  readonly frame?: number;
  readonly originZ?: number;
}): RenderSnapshot {
  const transforms = new Float32Array(16 * options.count);
  const emitters = [];

  for (let index = 0; index < options.count; index += 1) {
    const offset = index * 16;

    transforms[offset] = 1;
    transforms[offset + 5] = 1;
    transforms[offset + 10] = 1;
    transforms[offset + 15] = 1;
    transforms[offset + 12] = index;
    transforms[offset + 14] = options.originZ ?? 0;

    emitters.push({
      emitterId: 100 + index,
      entity: { index: 100 + index, generation: 1 },
      effect: options.effect,
      effectVersion: 1,
      capacity: 8,
      seed: 7 + index,
      resetEpoch: 0,
      timeScale: options.timeScale,
      simulationSpace: "world" as const,
      worldTransformOffset: offset,
      boundsIndex: 0,
      layerMask: 1,
      sortKey: createRenderSortKey({
        queue: "transparent",
        viewId: 1,
        layer: 1,
        pipelineKey: "gpu-particles",
        materialKey: "particle-effect:continuous",
        meshKey: "particle-quad",
        stableId: 100 + index,
      }),
    });
  }

  return {
    frame: options.frame ?? 3,
    views: [
      {
        viewId: 1,
        camera: { index: 1, generation: 1 },
        priority: 0,
        layerMask: 1,
        viewMatrixOffset: 16,
        projectionMatrixOffset: 0,
        viewProjectionMatrixOffset: 0,
        viewport: [0, 0, 1, 1],
        scissor: [0, 0, 1, 1],
        clearColor: [0, 0, 0, 1],
        clearDepth: 1,
        clearStencil: 0,
        renderTarget: null,
      },
    ],
    meshDraws: [],
    particleEmitters: emitters,
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms,
    viewMatrices: new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0,
      0, 1, 0, 0, 0, 0, 1,
    ]),
    diagnostics: [],
    report: {
      views: 1,
      meshDraws: 0,
      particleEmitters: options.count,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  } as unknown as RenderSnapshot;
}

interface BufferWriteRecord {
  readonly label: string;
}

function isParticleStateWrite(write: BufferWriteRecord): boolean {
  return write.label.startsWith("Particle/State/");
}

function isParticleBatchWrite(write: BufferWriteRecord): boolean {
  return write.label.startsWith("Particle/BurstBatch/");
}

/**
 * A `queue.onSubmittedWorkDone` that stays pending until released.
 *
 * Frame assembly must not depend on it: a renderer that awaits this fence
 * inline stops producing frames for as long as the GPU is busy.
 */
function createPendingFence(): {
  readonly queueExtras: Record<string, unknown>;
  readonly calls: number;
  release(): void;
} {
  const resolvers: (() => void)[] = [];
  const fence = {
    calls: 0,
    queueExtras: {
      onSubmittedWorkDone: (): Promise<void> => {
        fence.calls += 1;
        return new Promise<void>((resolve) => {
          resolvers.push(resolve);
        });
      },
    },
    release: (): void => {
      for (const resolve of resolvers.splice(0, resolvers.length)) {
        resolve();
      }
    },
  };

  return fence;
}

/**
 * Count microtask turns taken while an operation runs.
 *
 * The counter re-queues itself, so the FIFO microtask queue interleaves it
 * with every `await` the measured operation performs: the tally is the number
 * of times that operation yielded.
 */
function countMicrotaskTicks(): { stop(): number } {
  let ticks = 0;
  let sampling = true;
  const bump = (): void => {
    if (!sampling) {
      return;
    }

    ticks += 1;
    void Promise.resolve().then(bump);
  };

  bump();

  return {
    stop: (): number => {
      sampling = false;
      return ticks;
    },
  };
}

async function withTimeout<T>(
  work: Promise<T>,
  message: string,
  timeoutMs = 2000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    return await Promise.race([work, guard]);
  } finally {
    clearTimeout(timer);
  }
}

function createParticleDeviceFixture(
  queueExtras: Record<string, unknown> = {},
) {
  const writes: BufferWriteRecord[] = [];
  const destroyedBuffers: { readonly label: string }[] = [];
  const device = {
    createShaderModule: () => ({
      compilationInfo: async () => ({ messages: [] }),
    }),
    createComputePipeline: (descriptor: unknown) => ({
      descriptor,
      getBindGroupLayout: (group: number) => ({ kind: "compute", group }),
    }),
    createRenderPipeline: (descriptor: unknown) => ({
      descriptor,
      getBindGroupLayout: (group: number) => ({ kind: "render", group }),
    }),
    createTexture: () => ({
      createView: () => ({ label: "particle-texture-view" }),
    }),
    createSampler: () => ({ label: "particle-sampler" }),
    createBuffer: (descriptor: { readonly label?: string }) => {
      const buffer = {
        label: descriptor.label ?? "buffer",
        descriptor,
        destroy: () => {
          destroyedBuffers.push(buffer);
        },
      };

      return buffer;
    },
    createBindGroup: (descriptor: unknown) => ({ descriptor }),
    queue: {
      writeBuffer: (buffer: { readonly label: string }) => {
        writes.push({ label: buffer.label });
      },
      submit: () => undefined,
      writeTexture: () => undefined,
      ...queueExtras,
    },
  };

  return { device, writes, destroyedBuffers };
}
