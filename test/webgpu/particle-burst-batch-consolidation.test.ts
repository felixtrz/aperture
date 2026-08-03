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
 * Burst draw-batch consolidation.
 *
 * A batched burst draw is fixed by its pipeline (formats, sample count, blend
 * mode, render mode, output stage), its texture/sampler pair and its sort
 * placement — not by which effect asset authored it. These assert that bursts
 * of DIFFERENT effects that agree on all of that render in one draw, that each
 * effect keeps its own immutable state through the per-instance params array,
 * and that genuinely incompatible bursts still separate.
 */
describe("GPU particle burst batch consolidation", () => {
  it("merges bursts of different effects that share a pipeline and texture", async () => {
    const effects = [
      registerBurstEffect("merge-a", { dampen: 0.25, tiles: [1, 1] }),
      registerBurstEffect("merge-b", { dampen: 0.5, tiles: [2, 2] }),
      registerBurstEffect("merge-c", { dampen: 0.75, tiles: [4, 2] }),
    ];
    const assets = registerAll(effects);
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createBurstSnapshot(effects.map((entry) => entry.handle));

    const frame = await prepareBurstFrame(
      fixture.device,
      assets,
      cache,
      snapshot,
    );
    const draws = frame.commands.filter((command) => command.kind === "draw");

    expect(frame.valid).toBe(true);
    expect(frame.diagnostics).toEqual([]);
    // Three effects, ONE shared draw group.
    expect(frame.report.batchGroups).toBe(1);
    expect(frame.report.drawCalls).toBe(1);
    expect(frame.report.batchedEmitters).toBe(3);
    expect(frame.report.emitters).toBe(3);
    expect(frame.report.liveParticles).toBe(3 * BURST_COUNT);
    expect(draws).toHaveLength(1);
    expect(draws[0]).toMatchObject({
      kind: "draw",
      vertexCount: 6,
      instanceCount: 3 * BURST_COUNT,
      firstInstance: 0,
    });
    expect(cache.particleBurstBatchStates).toHaveLength(1);
  });

  it("gives every merged effect its own params block, indexed per particle", async () => {
    const effects = [
      registerBurstEffect("block-a", { dampen: 0.25, tiles: [1, 1] }),
      registerBurstEffect("block-b", { dampen: 0.5, tiles: [2, 2] }),
      registerBurstEffect("block-c", { dampen: 0.75, tiles: [4, 2] }),
    ];
    const assets = registerAll(effects);
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createBurstSnapshot(effects.map((entry) => entry.handle));

    await prepareBurstFrame(fixture.device, assets, cache, snapshot);

    const paramWrites = fixture.writes.filter((write) =>
      write.label.startsWith("Particle/BurstBatchParams/"),
    );

    expect(paramWrites).toHaveLength(1);
    // One 272-float block per effect, appended — the single-effect layout is
    // unchanged, an N-effect batch is N blocks.
    expect(paramWrites[0]?.size).toBe(3 * PARAM_FLOAT_COUNT * 4);

    const params = floatsOf(paramWrites[0]);

    for (let block = 0; block < 3; block += 1) {
      const base = block * PARAM_FLOAT_COUNT;
      const authored = effects[block]!;

      // linearDamping and the texture-sheet tiles are per-effect: collapsing
      // the batch onto one effect's state would repeat block 0 three times.
      expect(params[base + 4]).toBeCloseTo(authored.dampen, 6);
      expect(params[base + 8]).toBe(authored.tiles[0]);
      expect(params[base + 9]).toBe(authored.tiles[1]);
    }

    const particleWrites = fixture.writes.filter((write) =>
      write.label.startsWith("Particle/BurstBatch/"),
    );

    expect(particleWrites).toHaveLength(1);

    const particles = floatsOf(particleWrites[0]);

    expect(particles).toHaveLength(3 * BURST_COUNT * BURST_FLOAT_STRIDE);

    // Every particle carries the params block its effect occupies, in the
    // reserved spare of the appended emitter-origin vec4 (float 19).
    for (let index = 0; index < 3 * BURST_COUNT; index += 1) {
      const paramIndex =
        particles[index * BURST_FLOAT_STRIDE + BURST_PARAM_INDEX_FLOAT];

      expect(paramIndex).toBe(Math.floor(index / BURST_COUNT));
    }
  });

  it("keeps bursts apart when the pipeline or the texture differs", async () => {
    const effects = [
      registerBurstEffect("split-billboard", { dampen: 0.25, tiles: [1, 1] }),
      registerBurstEffect("split-horizontal", {
        dampen: 0.25,
        tiles: [1, 1],
        renderMode: "horizontal-billboard",
      }),
      registerBurstEffect("split-stretched", {
        dampen: 0.25,
        tiles: [1, 1],
        renderMode: "stretched-billboard",
      }),
      registerBurstEffect("split-billboard-two", {
        dampen: 0.9,
        tiles: [2, 2],
      }),
    ];
    const assets = registerAll(effects);
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createBurstSnapshot(effects.map((entry) => entry.handle));

    const frame = await prepareBurstFrame(
      fixture.device,
      assets,
      cache,
      snapshot,
    );
    const draws = frame.commands.filter((command) => command.kind === "draw");

    // Three render modes are three pipelines, so three groups — and the two
    // plain billboards land in the same one.
    expect(frame.report.batchGroups).toBe(3);
    expect(frame.report.drawCalls).toBe(3);
    expect(frame.report.batchedEmitters).toBe(4);
    expect(draws).toHaveLength(3);
    expect(
      draws
        .map((draw) => (draw.kind === "draw" ? draw.instanceCount : 0))
        .sort((a, b) => a - b),
    ).toEqual([BURST_COUNT, BURST_COUNT, 2 * BURST_COUNT]);
  });

  it("reuses a frozen merged batch without resimulating or reuploading", async () => {
    const effects = [
      registerBurstEffect("frozen-a", { dampen: 0.25, tiles: [1, 1] }),
      registerBurstEffect("frozen-b", { dampen: 0.75, tiles: [4, 2] }),
    ];
    const assets = registerAll(effects);
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createBurstSnapshot(effects.map((entry) => entry.handle));

    const first = await prepareBurstFrame(
      fixture.device,
      assets,
      cache,
      snapshot,
    );

    expect(first.report.batchGroups).toBe(1);
    expect(first.report.uploadedBytes).toBeGreaterThan(0);

    const writesBefore = fixture.writes.length;
    const second = await prepareBurstFrame(fixture.device, assets, cache, {
      ...snapshot,
      frame: 4,
    });

    expect(second.report.batchGroups).toBe(1);
    expect(second.report.simulatedEmitters).toBe(0);
    expect(second.report.uploadedBytes).toBe(0);
    expect(second.report.liveParticles).toBe(first.report.liveParticles);
    expect(
      fixture.writes
        .slice(writesBefore)
        .filter((write) => write.label.startsWith("Particle/BurstBatch/")),
    ).toEqual([]);
  });

  it("repacks a frozen merged batch when its effect set changes", async () => {
    const effects = [
      registerBurstEffect("swap-a", { dampen: 0.25, tiles: [1, 1] }),
      registerBurstEffect("swap-b", { dampen: 0.75, tiles: [4, 2] }),
      registerBurstEffect("swap-c", { dampen: 0.5, tiles: [2, 2] }),
    ];
    const assets = registerAll(effects);
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createBurstSnapshot([
      effects[0]!.handle,
      effects[1]!.handle,
    ]);

    await prepareBurstFrame(fixture.device, assets, cache, snapshot);

    // Same emitter ids, same frozen clock, but the second emitter now plays a
    // different effect: the packed block indices and the params array both
    // have to be rewritten rather than reused.
    const swapped = createBurstSnapshot([
      effects[0]!.handle,
      effects[2]!.handle,
    ]);
    const writesBefore = fixture.writes.length;
    const second = await prepareBurstFrame(fixture.device, assets, cache, {
      ...swapped,
      frame: 4,
    });
    const after = fixture.writes.slice(writesBefore);

    expect(second.report.batchGroups).toBe(1);
    expect(
      after.filter((write) => write.label.startsWith("Particle/BurstBatch/")),
    ).not.toEqual([]);

    const paramWrite = after.filter((write) =>
      write.label.startsWith("Particle/BurstBatchParams/"),
    );

    expect(paramWrite).not.toEqual([]);

    const params = floatsOf(paramWrite[paramWrite.length - 1]);

    expect(params[PARAM_FLOAT_COUNT + 4]).toBeCloseTo(0.5, 6);
  });
});

/* ------------------------------------------------------------- utilities */

const BURST_COUNT = 3;
const BURST_FLOAT_STRIDE = 20;
const BURST_PARAM_INDEX_FLOAT = 19;
// 4 (time+gravity) + 4 (motion) + 4 (texture sheet) + 16 (size curve) + 16
// (frame-min curve) + 16 (frame curve) + 16*4 (color curve) + 16 (speed curve)
// + 16 (speed integral) + 16 (speed time integral) + 16 (size-by-speed) + 16*4
// (color-by-speed) + 20 (module params).
const PARAM_FLOAT_COUNT = 272;

interface RegisteredBurstEffect {
  readonly handle: ReturnType<typeof createParticleEffectHandle>;
  readonly asset: ReturnType<typeof createParticleEffectAsset>;
  readonly dampen: number;
  readonly tiles: readonly [number, number];
}

function registerBurstEffect(
  id: string,
  options: {
    readonly dampen: number;
    readonly tiles: readonly [number, number];
    readonly renderMode?: "horizontal-billboard" | "stretched-billboard";
  },
): RegisteredBurstEffect {
  return {
    handle: createParticleEffectHandle(id),
    asset: createParticleEffectAsset({
      version: 2,
      label: id,
      main: {
        maxParticles: 16,
        startLifetime: { min: 1, max: 1 },
        startSize: { min: 0.5, max: 1 },
      },
      emission: { rateOverTime: 0 },
      renderer: {
        blendMode: "additive",
        ...(options.renderMode === undefined
          ? {}
          : { renderMode: options.renderMode }),
      },
      limitVelocityOverLifetime: { enabled: true, dampen: options.dampen },
      textureSheetAnimation: {
        enabled: true,
        tiles: [options.tiles[0], options.tiles[1]] as [number, number],
      },
    }),
    dampen: options.dampen,
    tiles: options.tiles,
  };
}

function registerAll(effects: readonly RegisteredBurstEffect[]): AssetRegistry {
  const assets = new AssetRegistry();

  for (const effect of effects) {
    assets.register(effect.handle);
    assets.markReady(effect.handle, effect.asset);
  }

  return assets;
}

async function prepareBurstFrame(
  device: unknown,
  assets: AssetRegistry,
  cache: ReturnType<typeof createWebGpuAppResourceCache>,
  snapshot: RenderSnapshot,
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
    // Frozen timeline: every emitter is a stopped burst, so the batch layout
    // is stable frame to frame.
    time: 12 / 60,
  });
}

/**
 * One frozen burst per effect, in snapshot order, all at the same placement.
 */
function createBurstSnapshot(
  handles: readonly ReturnType<typeof createParticleEffectHandle>[],
): RenderSnapshot {
  const transforms = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 3, -1, 1,
  ]);

  return {
    frame: 3,
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
    particleEmitters: handles.map((effect, index) => ({
      emitterId: 200 + index,
      entity: { index: 200 + index, generation: 1 },
      effect,
      effectVersion: 1,
      capacity: BURST_COUNT,
      seed: 7 + index,
      resetEpoch: 12,
      timeScale: 0,
      simulationSpace: "world" as const,
      worldTransformOffset: 0,
      boundsIndex: 0,
      layerMask: 1,
      mode: "burst" as const,
      burst: {
        burstId: 1 + index,
        startFrame: 12,
        count: BURST_COUNT,
        position: [1, 2, 3] as [number, number, number],
        positionJitterMin: [-0.1, 0, -0.1] as [number, number, number],
        positionJitterMax: [0.1, 0.2, 0.1] as [number, number, number],
        velocityMin: [-0.1, 0.5, -0.1] as [number, number, number],
        velocityMax: [0.1, 1, 0.1] as [number, number, number],
        sizeScale: 1,
        colorTint: [1, 1, 1, 1] as [number, number, number, number],
      },
      sortKey: createRenderSortKey({
        queue: "transparent",
        viewId: 1,
        layer: 1,
        pipelineKey: "gpu-particles",
        materialKey: "particle-effect:burst-batch",
        meshKey: "particle-quad",
        stableId: 200 + index,
      }),
    })),
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
      particleEmitters: handles.length,
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
  readonly data: ArrayBufferLike | ArrayBufferView;
  readonly dataOffset?: number;
  readonly size?: number;
}

function floatsOf(write: BufferWriteRecord | undefined): Float32Array {
  if (write === undefined) {
    return new Float32Array(0);
  }

  const bytes = ArrayBuffer.isView(write.data)
    ? new Uint8Array(
        write.data.buffer,
        write.data.byteOffset + (write.dataOffset ?? 0),
        write.size ?? write.data.byteLength,
      )
    : new Uint8Array(
        write.data,
        write.dataOffset ?? 0,
        write.size ?? write.data.byteLength,
      );

  return new Float32Array(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
}

function createParticleDeviceFixture(): {
  readonly device: unknown;
  readonly writes: BufferWriteRecord[];
  readonly destroyedBuffers: { readonly label: string }[];
} {
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
      writeBuffer: (
        buffer: { readonly label: string },
        _bufferOffset: number,
        data: ArrayBufferLike | ArrayBufferView,
        dataOffset?: number,
        size?: number,
      ) => {
        writes.push({
          label: buffer.label,
          data,
          ...(dataOffset === undefined ? {} : { dataOffset }),
          ...(size === undefined ? {} : { size }),
        });
      },
      submit: () => undefined,
      writeTexture: () => undefined,
    },
  };

  return { device, writes, destroyedBuffers };
}
