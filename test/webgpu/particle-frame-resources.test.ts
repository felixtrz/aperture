import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  createPackedSnapshotViewUniformsScratch,
  createParticleEffectAsset,
  createParticleEffectHandle,
  createRenderSortKey,
  createTextureAsset,
  createTextureHandle,
  createWebGpuAppResourceCache,
  prepareParticleFrameResourcesForSnapshot,
  writePackedSnapshotViewUniforms,
  type RenderSnapshot,
} from "@aperture-engine/webgpu/test-support";

describe("GPU particle app frame resources", () => {
  it("creates, reuses, dispatches, and cleans particle emitter GPU state", async () => {
    const effect = createParticleEffectHandle("spark-burst");
    const texture = createTextureHandle("spark-smoke");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createParticleSnapshot(effect);
    const viewUniforms = writePackedSnapshotViewUniforms(
      snapshot,
      createPackedSnapshotViewUniformsScratch(),
    );

    assets.register(effect);
    assets.register(texture);
    assets.markReady(
      texture,
      createTextureAsset({
        label: "spark-smoke",
        dimension: "2d",
        width: 2,
        height: 1,
        format: "rgba8unorm-srgb",
        colorSpace: "srgb",
        semantic: "base-color",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: new Uint8Array([255, 255, 255, 255, 0, 0, 0, 0]),
          bytesPerRow: 8,
        },
      }),
    );
    assets.markReady(
      effect,
      createParticleEffectAsset({
        label: "SparkBurst",
        capacity: 8,
        blendMode: "alpha",
        texture,
        startSpeed: { min: 0.5, max: 1.5 },
        startSize: { min: 0.2, max: 0.4 },
        startColor: [1, 0.25, 0.1, 0.8],
        endColor: [0.1, 0.6, 1, 0.5],
        sizeOverLifetime: [
          { t: 0, value: 0.5 },
          { t: 0.5, value: 2 },
          { t: 1, value: 0.25 },
        ],
        colorOverLifetime: [
          { t: 0, color: [1, 0, 0, 1] },
          { t: 0.5, color: [0, 1, 0.5, 0.75] },
          { t: 1, color: [0, 0, 1, 0] },
        ],
      }),
    );

    const first = await prepareParticleFrameResourcesForSnapshot({
      app: {
        canvas: { width: 320, height: 180 } as never,
        initialization: { device: fixture.device, format: "bgra8unorm" },
        msaa: { sampleCount: 1 },
      },
      assets,
      cache,
      snapshot,
      viewUniforms,
      time: 2.5,
    });

    expect(first.valid).toBe(true);
    expect(first.diagnostics).toEqual([]);
    expect(first.report).toEqual({
      emitters: 1,
      liveParticles: 4,
      texturedEmitters: 1,
      statesCreated: 1,
      statesReused: 0,
      staleStatesRemoved: 0,
      dispatches: 1,
      textureResourcesCreated: 1,
      textureResourcesReused: 0,
      samplerResourcesCreated: 1,
      samplerResourcesReused: 0,
    });
    expect(first.commands).toEqual([
      expect.objectContaining({
        kind: "setPipeline",
        renderId: 99,
        pipelineKey:
          "aperture/gpu-particles-render:bgra8unorm:depth24plus:samples-1:blend-alpha",
      }),
      expect.objectContaining({
        kind: "setBindGroup",
        renderId: 99,
        index: 0,
      }),
      expect.objectContaining({
        kind: "setBindGroup",
        renderId: 99,
        index: 1,
        resourceKey: "particle:99:effect-v1:capacity-4:reset-0",
      }),
      expect.objectContaining({
        kind: "setBindGroup",
        renderId: 99,
        index: 2,
        resourceKey: "texture:spark-smoke@1:particle:default-linear-sampler",
      }),
      {
        kind: "draw",
        renderId: 99,
        vertexCount: 6,
        instanceCount: 4,
        firstVertex: 0,
        firstInstance: 0,
      },
    ]);
    expect(fixture.dispatches).toEqual([[1, 1, 1]]);
    expect(fixture.submissions).toHaveLength(1);
    expect(cache.particleEmitterStates).toHaveLength(1);
    expect(
      fixture.writes.filter((write) => write.label === "Particle/State/99"),
    ).toHaveLength(1);
    expect(fixture.textureWrites).toEqual([
      expect.objectContaining({
        layout: { bytesPerRow: 8 },
        size: [2, 1, 1],
      }),
    ]);
    expect(fixture.createdSamplers).toEqual([
      expect.objectContaining({
        label: "Particle default linear sampler",
        magFilter: "linear",
        minFilter: "linear",
      }),
    ]);

    const paramUpload = fixture.writes.find(
      (write) => write.label === "Particle/Params/99",
    );
    const params = bytesUpload(paramUpload);
    const words = new Uint32Array(params.buffer, params.byteOffset, 4);
    const floats = new Float32Array(
      params.buffer,
      params.byteOffset + 16,
      (params.byteLength - 16) / 4,
    );

    expect(params.byteLength).toBe(400);
    expect(Array.from(words)).toEqual([3, 7, 4, 16]);
    expect(roundFloats(Array.from(floats.slice(0, 16)))).toEqual([
      2, 3, 5, 1.5, 1, 0.25, 0.1, 0.8, 0.1, 0.6, 1, 0.5, 0.2, 0.4, 1, 0,
    ]);
    expect(roundFloats(Array.from(floats.slice(16, 20)))).toEqual([
      0.5, 0.7, 0.9, 1.1,
    ]);
    expect(roundFloats(Array.from(floats.slice(32, 36)))).toEqual([1, 0, 0, 1]);
    expect(roundFloats(Array.from(floats.slice(92, 96)))).toEqual([0, 0, 1, 0]);

    const second = await prepareParticleFrameResourcesForSnapshot({
      app: {
        canvas: { width: 320, height: 180 } as never,
        initialization: { device: fixture.device, format: "bgra8unorm" },
        msaa: { sampleCount: 1 },
      },
      assets,
      cache,
      snapshot: { ...snapshot, frame: 4 },
      viewUniforms,
      time: 3,
    });

    expect(second.report.statesCreated).toBe(0);
    expect(second.report.statesReused).toBe(1);
    expect(second.report.dispatches).toBe(1);
    expect(second.report.textureResourcesCreated).toBe(0);
    expect(second.report.textureResourcesReused).toBe(1);
    expect(second.report.samplerResourcesCreated).toBe(0);
    expect(second.report.samplerResourcesReused).toBe(1);
    expect(cache.particleEmitterStates).toHaveLength(1);
    expect(
      fixture.writes.filter((write) => write.label === "Particle/State/99"),
    ).toHaveLength(1);
    expect(
      fixture.createdBuffers.filter(
        (buffer) => buffer.label === "Particle/ViewUniforms",
      ),
    ).toHaveLength(1);
    expect(
      fixture.writes.filter((write) => write.label === "Particle/ViewUniforms"),
    ).toHaveLength(2);

    const expandedSnapshot = {
      ...snapshot,
      frame: 5,
      views: [
        snapshot.views[0]!,
        {
          ...snapshot.views[0]!,
          viewId: 2,
        },
      ],
      report: {
        ...snapshot.report,
        views: 2,
      },
    };
    const expanded = await prepareParticleFrameResourcesForSnapshot({
      app: {
        canvas: { width: 320, height: 180 } as never,
        initialization: { device: fixture.device, format: "bgra8unorm" },
        msaa: { sampleCount: 1 },
      },
      assets,
      cache,
      snapshot: expandedSnapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        expandedSnapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 3.25,
    });

    expect(expanded.valid).toBe(true);
    expect(
      fixture.createdBuffers.filter(
        (buffer) => buffer.label === "Particle/ViewUniforms",
      ),
    ).toHaveLength(2);
    expect(
      fixture.destroyedBuffers.filter(
        (buffer) => buffer.label === "Particle/ViewUniforms",
      ),
    ).toHaveLength(1);

    const empty = await prepareParticleFrameResourcesForSnapshot({
      app: {
        canvas: { width: 320, height: 180 } as never,
        initialization: { device: fixture.device, format: "bgra8unorm" },
        msaa: { sampleCount: 1 },
      },
      assets,
      cache,
      snapshot: { ...snapshot, frame: 6, particleEmitters: [] },
      viewUniforms,
    });

    expect(empty.report.staleStatesRemoved).toBe(1);
    expect(cache.particleEmitterStates).toHaveLength(0);
    expect(
      fixture.destroyedBuffers.filter(
        (buffer) => buffer.label === "Particle/State/99",
      ),
    ).toHaveLength(1);
  });

  it("uploads burst particle state without running the continuous compute pass", async () => {
    const effect = createParticleEffectHandle("smoke-burst");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createParticleSnapshot(effect, {
      mode: "burst",
      capacity: 3,
      resetEpoch: 12,
      burst: {
        burstId: 1,
        startFrame: 12,
        count: 3,
        position: [1, 2, 3],
        positionJitterMin: [-0.1, 0, -0.1],
        positionJitterMax: [0.1, 0.2, 0.1],
        velocityMin: [-0.1, 0.5, -0.1],
        velocityMax: [0.1, 1, 0.1],
      },
    });

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        label: "SmokeBurst",
        capacity: 16,
        emissionRate: 0,
        lifetime: { min: 1, max: 1 },
        startSize: { min: 0.5, max: 1 },
        linearDamping: 0.75,
        blendMode: "alpha",
        colorOverLifetime: [
          { t: 0, color: [0.4, 0.4, 0.45, 0.25] },
          { t: 1, color: [0.4, 0.4, 0.45, 0] },
        ],
      }),
    );

    const burst = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache,
      snapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        snapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 12 / 60,
    });

    expect(burst.diagnostics).toEqual([]);
    expect(burst.valid).toBe(true);
    expect(burst.report).toMatchObject({
      emitters: 1,
      liveParticles: 3,
      dispatches: 0,
      statesCreated: 2,
      textureResourcesCreated: 1,
      samplerResourcesCreated: 1,
    });
    expect(fixture.dispatches).toEqual([]);
    expect(
      fixture.writes.filter((write) => write.label === "Particle/State/99"),
    ).toEqual([]);
    expect(
      fixture.writes.filter((write) =>
        write.label.startsWith("Particle/BurstBatch/"),
      ),
    ).toMatchObject([{ size: 3 * 12 * 4 }]);
    expect(burst.commands).toContainEqual(
      expect.objectContaining({
        kind: "draw",
        renderId: 99,
        vertexCount: 6,
        instanceCount: 3,
      }),
    );
  });

  it("batches adjacent compatible burst emitters into one shared draw", async () => {
    const effect = createParticleEffectHandle("batched-smoke-burst");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const baseSnapshot = createParticleSnapshot(effect, {
      mode: "burst",
      capacity: 3,
      resetEpoch: 12,
      burst: {
        burstId: 1,
        startFrame: 12,
        count: 3,
        position: [1, 2, 3],
        positionJitterMin: [-0.1, 0, -0.1],
        positionJitterMax: [0.1, 0.2, 0.1],
        velocityMin: [-0.1, 0.5, -0.1],
        velocityMax: [0.1, 1, 0.1],
      },
    });
    const firstEmitter = baseSnapshot.particleEmitters?.[0];

    expect(firstEmitter).toBeDefined();

    const snapshot: RenderSnapshot = {
      ...baseSnapshot,
      particleEmitters: [
        firstEmitter as NonNullable<RenderSnapshot["particleEmitters"]>[number],
        {
          ...(firstEmitter as NonNullable<
            RenderSnapshot["particleEmitters"]
          >[number]),
          emitterId: 100,
          seed: 8,
          resetEpoch: 13,
          burst: {
            ...(
              firstEmitter as NonNullable<
                RenderSnapshot["particleEmitters"]
              >[number]
            ).burst!,
            burstId: 2,
            startFrame: 13,
            position: [2, 2, 3],
          },
        },
      ],
      report: {
        ...baseSnapshot.report,
        particleEmitters: 2,
      },
    };

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        label: "BatchedSmokeBurst",
        capacity: 16,
        emissionRate: 0,
        lifetime: { min: 1, max: 1 },
        startSize: { min: 0.5, max: 1 },
        linearDamping: 0.75,
        blendMode: "alpha",
        colorOverLifetime: [
          { t: 0, color: [0.4, 0.4, 0.45, 0.25] },
          { t: 1, color: [0.4, 0.4, 0.45, 0] },
        ],
      }),
    );

    const batched = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache,
      snapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        snapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 13 / 60,
    });

    const draws = batched.commands.filter((command) => command.kind === "draw");
    const batchWrites = fixture.writes.filter((write) =>
      write.label.startsWith("Particle/BurstBatch/"),
    );
    const emitterStateWrites = fixture.writes.filter((write) =>
      write.label.startsWith("Particle/State/"),
    );

    expect(batched.valid).toBe(true);
    expect(batched.diagnostics).toEqual([]);
    expect(batched.report).toMatchObject({
      emitters: 2,
      liveParticles: 6,
      dispatches: 0,
      statesCreated: 3,
    });
    expect(draws).toEqual([
      {
        kind: "draw",
        renderId: 99,
        vertexCount: 6,
        instanceCount: 6,
        firstVertex: 0,
        firstInstance: 0,
      },
    ]);
    expect(batchWrites).toHaveLength(1);
    expect(batchWrites[0]?.size).toBe(6 * 12 * 4);
    expect(emitterStateWrites).toEqual([]);
    expect(cache.particleEmitterStates).toHaveLength(0);
    expect(cache.particleBurstCpuStates).toHaveLength(2);
    expect(cache.particleBurstBatchStates).toHaveLength(1);

    const reused = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache,
      snapshot: { ...snapshot, frame: 14 },
      viewUniforms: writePackedSnapshotViewUniforms(
        snapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 14 / 60,
    });
    const reusedBatchWrites = fixture.writes.filter((write) =>
      write.label.startsWith("Particle/BurstBatch/"),
    );
    const paramWrites = fixture.writes.filter((write) =>
      write.label.startsWith("Particle/BurstBatchParams/"),
    );

    expect(reused.valid).toBe(true);
    expect(reused.report.statesReused).toBeGreaterThanOrEqual(3);
    expect(reusedBatchWrites).toHaveLength(1);
    expect(paramWrites).toMatchObject([{ size: 88 * 4 }, { size: 88 * 4 }]);
    const firstParamBytes = bytesUpload(paramWrites[0]);
    const firstParams = new Float32Array(
      firstParamBytes.buffer,
      firstParamBytes.byteOffset,
      firstParamBytes.byteLength / 4,
    );
    expect(firstParams[4]).toBeCloseTo(0.75, 6);

    const empty = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache,
      snapshot: { ...snapshot, frame: 14, particleEmitters: [] },
      viewUniforms: writePackedSnapshotViewUniforms(
        snapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
    });

    expect(empty.report.staleStatesRemoved).toBe(3);
    expect(cache.particleBurstCpuStates).toHaveLength(0);
    expect(cache.particleBurstBatchStates).toHaveLength(0);
    expect(
      fixture.destroyedBuffers.some((buffer) =>
        buffer.label.startsWith("Particle/BurstBatch/"),
      ),
    ).toBe(true);
  });

  it("splits burst batch draws around freed slot gaps", async () => {
    const effect = createParticleEffectHandle("gapped-smoke-burst");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const baseSnapshot = createParticleSnapshot(effect, {
      mode: "burst",
      capacity: 3,
      resetEpoch: 12,
      burst: {
        burstId: 1,
        startFrame: 12,
        count: 3,
        position: [1, 2, 3],
        positionJitterMin: [-0.1, 0, -0.1],
        positionJitterMax: [0.1, 0.2, 0.1],
        velocityMin: [-0.1, 0.5, -0.1],
        velocityMax: [0.1, 1, 0.1],
      },
    });
    const emitter = baseSnapshot.particleEmitters?.[0] as NonNullable<
      RenderSnapshot["particleEmitters"]
    >[number];
    const middleEmitter = {
      ...emitter,
      emitterId: 100,
      seed: 8,
      resetEpoch: 13,
      burst: {
        ...emitter.burst!,
        burstId: 2,
        startFrame: 13,
        position: [2, 2, 3] as const,
      },
    };
    const lastEmitter = {
      ...emitter,
      emitterId: 101,
      seed: 9,
      resetEpoch: 14,
      burst: {
        ...emitter.burst!,
        burstId: 3,
        startFrame: 14,
        position: [3, 2, 3] as const,
      },
    };
    const initialSnapshot: RenderSnapshot = {
      ...baseSnapshot,
      particleEmitters: [emitter, middleEmitter, lastEmitter],
      report: {
        ...baseSnapshot.report,
        particleEmitters: 3,
      },
    };

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        label: "GappedSmokeBurst",
        capacity: 16,
        emissionRate: 0,
        lifetime: { min: 1, max: 1 },
        startSize: { min: 0.5, max: 1 },
        blendMode: "alpha",
      }),
    );

    const initial = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache,
      snapshot: initialSnapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        initialSnapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 14 / 60,
    });

    expect(initial.valid).toBe(true);
    expect(
      initial.commands.filter((command) => command.kind === "draw"),
    ).toEqual([
      {
        kind: "draw",
        renderId: 99,
        vertexCount: 6,
        instanceCount: 9,
        firstVertex: 0,
        firstInstance: 0,
      },
    ]);

    const gappedSnapshot: RenderSnapshot = {
      ...initialSnapshot,
      frame: 15,
      particleEmitters: [emitter, lastEmitter],
      report: {
        ...initialSnapshot.report,
        particleEmitters: 2,
      },
    };
    const gapped = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache,
      snapshot: gappedSnapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        gappedSnapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 15 / 60,
    });

    expect(gapped.valid).toBe(true);
    expect(gapped.diagnostics).toEqual([]);
    expect(
      gapped.commands.filter((command) => command.kind === "draw"),
    ).toEqual([
      {
        kind: "draw",
        renderId: 99,
        vertexCount: 6,
        instanceCount: 3,
        firstVertex: 0,
        firstInstance: 0,
      },
      {
        kind: "draw",
        renderId: 99,
        vertexCount: 6,
        instanceCount: 3,
        firstVertex: 0,
        firstInstance: 6,
      },
    ]);
  });

  it("reports per-frame particle texture and sampler reuse deltas", async () => {
    const effect = createParticleEffectHandle("spark-delta");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createParticleSnapshot(effect);
    const reuse = {
      textureResourcesCreated: 7,
      textureResourcesReused: 11,
      samplerResourcesCreated: 13,
      samplerResourcesReused: 17,
    };

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        label: "SparkDelta",
        capacity: 4,
        blendMode: "alpha",
      }),
    );

    const result = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache,
      snapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        snapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      reuse,
      time: 0,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.report).toMatchObject({
      textureResourcesCreated: 1,
      textureResourcesReused: 0,
      samplerResourcesCreated: 1,
      samplerResourcesReused: 0,
    });
    expect(reuse).toEqual({
      textureResourcesCreated: 8,
      textureResourcesReused: 11,
      samplerResourcesCreated: 14,
      samplerResourcesReused: 17,
    });
  });

  it("builds particle render pipelines for the HDR scene pass format", async () => {
    const effect = createParticleEffectHandle("smoke-burst");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createParticleSnapshot(effect, {
      mode: "burst",
      capacity: 2,
      resetEpoch: 1,
      burst: {
        burstId: 1,
        startFrame: 1,
        count: 2,
        position: [0, 0, 0],
        positionJitterMin: [0, 0, 0],
        positionJitterMax: [0, 0, 0],
        velocityMin: [0, 1, 0],
        velocityMax: [0, 1, 0],
      },
    });

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        label: "HdrSmokeBurst",
        capacity: 2,
        emissionRate: 0,
        lifetime: { min: 1, max: 1 },
        startSize: { min: 0.5, max: 1 },
        blendMode: "alpha",
      }),
    );

    const result = await prepareParticleFrameResourcesForSnapshot({
      app: {
        ...createParticleAppContext(fixture.device),
        sceneRenderFormat: "rgba16float",
        tonemap: "aces",
        outputColorSpace: "srgb",
      },
      assets,
      cache,
      snapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        snapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 1 / 60,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.commands).toContainEqual(
      expect.objectContaining({
        kind: "setPipeline",
        pipelineKey:
          "aperture/gpu-particles-burst-render:rgba16float:depth24plus:samples-1:blend-alpha",
      }),
    );
    expect([...cache.particleRenderPipelines.keys()]).toEqual([
      "aperture/gpu-particles-burst-render:rgba16float:depth24plus:samples-1:blend-alpha",
    ]);
  });
});

interface BufferWriteRecord {
  readonly label: string;
  readonly data: ArrayBufferLike | ArrayBufferView;
  readonly dataOffset?: number;
  readonly size?: number;
}

function createParticleAppContext(device: unknown) {
  return {
    canvas: { width: 320, height: 180 } as never,
    initialization: { device, format: "bgra8unorm" },
    msaa: { sampleCount: 1 },
  };
}

function createParticleDeviceFixture(): {
  readonly device: unknown;
  readonly writes: BufferWriteRecord[];
  readonly createdBuffers: { readonly label: string }[];
  readonly createdTextures: unknown[];
  readonly createdSamplers: unknown[];
  readonly textureWrites: unknown[];
  readonly dispatches: [number, number, number][];
  readonly submissions: readonly unknown[][];
  readonly destroyedBuffers: { readonly label: string }[];
} {
  const writes: BufferWriteRecord[] = [];
  const createdBuffers: { readonly label: string }[] = [];
  const createdTextures: unknown[] = [];
  const createdSamplers: unknown[] = [];
  const textureWrites: unknown[] = [];
  const dispatches: [number, number, number][] = [];
  const submissions: unknown[][] = [];
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
    createTexture: (descriptor: unknown) => {
      createdTextures.push(descriptor);
      return { createView: () => ({ label: "particle-texture-view" }) };
    },
    createSampler: (descriptor: unknown) => {
      createdSamplers.push(descriptor);
      return { label: "particle-sampler" };
    },
    createBuffer: (descriptor: { readonly label?: string }) => {
      const buffer = {
        label: descriptor.label ?? "buffer",
        descriptor,
        destroy: () => {
          destroyedBuffers.push(buffer);
        },
      };
      createdBuffers.push(buffer);
      return buffer;
    },
    createBindGroup: (descriptor: unknown) => ({ descriptor }),
    createCommandEncoder: () => ({
      beginComputePass: () => ({
        setPipeline: () => undefined,
        setBindGroup: () => undefined,
        dispatchWorkgroups: (x: number, y: number, z: number) => {
          dispatches.push([x, y, z]);
        },
        end: () => undefined,
      }),
      finish: () => ({ commandBuffer: true }),
    }),
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
      submit: (buffers: readonly unknown[]) => {
        submissions.push([...buffers]);
      },
      writeTexture: (
        destination: unknown,
        data: Uint8Array,
        layout: unknown,
        size: unknown,
      ) => {
        textureWrites.push({ destination, data, layout, size });
      },
    },
  };

  return {
    device,
    writes,
    createdBuffers,
    createdTextures,
    createdSamplers,
    textureWrites,
    dispatches,
    submissions,
    destroyedBuffers,
  };
}

function createParticleSnapshot(
  effect: ReturnType<typeof createParticleEffectHandle>,
  overrides: Partial<
    NonNullable<RenderSnapshot["particleEmitters"]>[number]
  > = {},
): RenderSnapshot {
  const transforms = identityMatrix();

  transforms[12] = 2;
  transforms[13] = 3;
  transforms[14] = -1;

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
    particleEmitters: [
      {
        emitterId: 99,
        entity: { index: 99, generation: 1 },
        effect,
        effectVersion: 1,
        capacity: 4,
        seed: 7,
        resetEpoch: 0,
        timeScale: 2,
        simulationSpace: "world",
        worldTransformOffset: 0,
        boundsIndex: 0,
        layerMask: 1,
        sortKey: createRenderSortKey({
          queue: "transparent",
          viewId: 1,
          layer: 1,
          pipelineKey: "gpu-particles",
          materialKey: "particle-effect:spark-burst",
          meshKey: "particle-quad",
          stableId: 99,
        }),
        ...overrides,
      },
    ],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms,
    viewMatrices: matrixPair(),
    diagnostics: [],
    report: {
      views: 1,
      meshDraws: 0,
      particleEmitters: 1,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function identityMatrix(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function matrixPair(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0,
    0, 1, 0, 0, 0, 0, 1,
  ]);
}

function bytesUpload(upload: BufferWriteRecord | undefined): Uint8Array {
  if (upload === undefined) {
    return new Uint8Array(0);
  }

  if (ArrayBuffer.isView(upload.data)) {
    return new Uint8Array(
      upload.data.buffer,
      upload.data.byteOffset + (upload.dataOffset ?? 0),
      upload.size ?? upload.data.byteLength,
    );
  }

  return new Uint8Array(
    upload.data,
    upload.dataOffset ?? 0,
    upload.size ?? upload.data.byteLength,
  );
}

function roundFloats(values: readonly number[]): number[] {
  return values.map((value) => Math.round(value * 1000) / 1000);
}
