import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  createMaterialHandle,
  createMeshHandle,
  createPackedSnapshotViewUniformsScratch,
  createParticleEffectAsset,
  createParticleEffectHandle,
  createRenderSortKey,
  createTextureAsset,
  createTextureHandle,
  createWebGpuAppResourceCache,
  mergeSnapshotSortedRenderPassCommands,
  prepareParticleFrameResourcesForSnapshot,
  writePackedSnapshotViewUniforms,
  type RenderSnapshot,
} from "@aperture-engine/webgpu/test-support";

describe("GPU particle app frame resources", () => {
  it("merges particle commands by snapshot transparent sort key", () => {
    const effect = createParticleEffectHandle("sorted-particles");
    const mesh = createMeshHandle("transparent-mesh");
    const material = createMaterialHandle("transparent-material");
    const particleSortKey = createRenderSortKey({
      queue: "transparent",
      viewId: 1,
      depth: 10,
      stableId: 99,
      pipelineKey: "gpu-particles",
      materialKey: "particle-effect:sorted-particles",
      meshKey: "particle-quad",
    });
    const meshSortKey = createRenderSortKey({
      queue: "transparent",
      viewId: 1,
      depth: 1,
      stableId: 11,
      pipelineKey: "standard",
      materialKey: "material:transparent-material",
      meshKey: "mesh:transparent-mesh",
    });
    const snapshot: RenderSnapshot = {
      ...createParticleSnapshot(effect, { sortKey: particleSortKey }),
      meshDraws: [
        {
          renderId: 11,
          entity: { index: 11, generation: 1 },
          mesh,
          material,
          submesh: 0,
          materialSlot: 0,
          worldTransformOffset: 0,
          boundsIndex: 0,
          layerMask: 1,
          sortKey: meshSortKey,
          batchKey: {
            pipelineKey: "standard",
            materialKey: "material:transparent-material",
            meshLayoutKey: "mesh:transparent-mesh",
            topology: "triangle-list",
            instanced: false,
            skinned: false,
            morphed: false,
          },
        },
      ],
    };
    const meshCommands = renderCommandGroup(11);
    const particleCommands = renderCommandGroup(99);

    const merged = mergeSnapshotSortedRenderPassCommands({
      snapshot,
      baseCommands: meshCommands,
      overlayCommands: particleCommands,
    });

    expect(merged.diagnostics).toEqual([]);
    expect(
      merged.commands.map((command) => `${command.kind}:${command.renderId}`),
    ).toEqual(["setPipeline:99", "draw:99", "setPipeline:11", "draw:11"]);
  });

  it("creates, reuses, updates, and cleans particle emitter GPU state", async () => {
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
        version: 2,
        label: "SparkBurst",
        main: {
          maxParticles: 8,
          startSpeed: 0,
          startSize: { min: 0.2, max: 0.4 },
          startColor: [1, 0.25, 0.1, 0.8],
        },
        shape: {
          type: "point",
        },
        renderer: {
          blendMode: "alpha",
          texture,
        },
        textureSheetAnimation: {
          enabled: true,
          tiles: [2, 2],
          startFrame: 2,
          frameOverTime: 0,
          cycleCount: 1,
        },
        sizeOverLifetime: {
          enabled: true,
          size: {
            mode: "curve",
            curve: [
              { t: 0, value: 0.5 },
              { t: 0.5, value: 2 },
              { t: 1, value: 0.25 },
            ],
          },
        },
        colorOverLifetime: {
          enabled: true,
          color: {
            mode: "gradient",
            gradient: [
              { t: 0, color: [1, 0, 0, 1] },
              { t: 0.5, color: [0, 1, 0.5, 0.75] },
              { t: 1, color: [0, 0, 1, 0] },
            ],
          },
        },
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
      // The lone continuous emitter takes the single-emitter path (a
      // one-record continuous batch collapses to "single"), which advances
      // its CPU state once per frame.
      simulatedEmitters: 1,
      // batchGroups/batchedEmitters only count shared burst/continuous draw
      // groups; the collapsed single emitter contributes to neither.
      batchGroups: 0,
      batchedEmitters: 0,
      // One draw is issued because liveParticles (4) > 0.
      drawCalls: 1,
      // liveParticles (4) * PARTICLE_DATA_FLOAT_STRIDE (16) * 4 bytes.
      uploadedBytes: 4 * 16 * 4,
      statesCreated: 1,
      statesReused: 0,
      staleStatesRemoved: 0,
      dispatches: 0,
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
    expect(fixture.dispatches).toEqual([]);
    expect(fixture.submissions).toHaveLength(0);
    expect(cache.particleEmitterStates).toHaveLength(1);
    const stateWrites = fixture.writes.filter(
      (write) => write.label === "Particle/State/99",
    );
    expect(stateWrites).toHaveLength(2);
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

    const stateUpload = bytesUpload(stateWrites[1]);
    const stateFloats = new Float32Array(
      stateUpload.buffer,
      stateUpload.byteOffset,
      stateUpload.byteLength / 4,
    );

    expect(stateUpload.byteLength).toBe(4 * 16 * 4);
    for (let particle = 0; particle < 4; particle += 1) {
      const offset = particle * 16;

      expect(
        roundFloats(Array.from(stateFloats.slice(offset, offset + 4))),
      ).toEqual([2, 3, -1, expect.any(Number)]);
      expect(stateFloats[offset + 3]).toBeGreaterThan(0);
      expect(Array.from(stateFloats.slice(offset + 8, offset + 12))).toEqual([
        2, 2, 2, 0,
      ]);
    }

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
    expect(second.report.dispatches).toBe(0);
    expect(second.report.textureResourcesCreated).toBe(0);
    expect(second.report.textureResourcesReused).toBe(1);
    expect(second.report.samplerResourcesCreated).toBe(0);
    expect(second.report.samplerResourcesReused).toBe(1);
    expect(cache.particleEmitterStates).toHaveLength(1);
    expect(
      fixture.writes.filter((write) => write.label === "Particle/State/99"),
    ).toHaveLength(3);
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

  it("packs velocity and billboard rotation modules for continuous emitters", async () => {
    const effect = createParticleEffectHandle("module-motion");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createParticleSnapshot(effect, { timeScale: 1 });

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        label: "ModuleMotion",
        main: {
          maxParticles: 4,
          startLifetime: 1,
          startSpeed: 0,
          startSize: 1,
          startRotation: 0.25,
        },
        emission: {
          rateOverTime: 60,
        },
        shape: {
          type: "point",
        },
        renderer: {
          blendMode: "alpha",
        },
        velocityOverLifetime: {
          enabled: true,
          velocity: [1, 0, 0],
        },
        rotationOverLifetime: {
          enabled: true,
          angularVelocity: 1,
        },
      }),
    );

    const frame = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache,
      snapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        snapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 1 / 15,
    });

    expect(frame.valid).toBe(true);
    expect(frame.diagnostics).toEqual([]);
    expect(frame.report.liveParticles).toBe(4);

    const stateWrites = fixture.writes.filter(
      (write) => write.label === "Particle/State/99",
    );
    const stateUpload = bytesUpload(stateWrites.at(-1));
    const stateFloats = new Float32Array(
      stateUpload.buffer,
      stateUpload.byteOffset,
      stateUpload.byteLength / 4,
    );

    expect(stateFloats[0]).toBeGreaterThan(2);
    expect(stateFloats[8]).toBe(1);
    expect(stateFloats[9]).toBe(1);
    expect(stateFloats[10]).toBe(0);
    expect(stateFloats[11]).toBeGreaterThan(0.25);
  });

  it("routes soft particles through overlay commands with scene-depth bindings", async () => {
    const effect = createParticleEffectHandle("soft-smoke");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createParticleSnapshot(effect, { timeScale: 1 });

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        label: "SoftSmoke",
        main: {
          maxParticles: 4,
          startLifetime: 1,
          startSpeed: 0,
          startSize: 1,
        },
        emission: {
          rateOverTime: 60,
        },
        shape: {
          type: "point",
        },
        renderer: {
          blendMode: "alpha",
          softParticles: {
            enabled: true,
            nearFade: 0.001,
            farFade: 0.2,
          },
        },
      }),
    );

    const frame = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache,
      snapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        snapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 1 / 15,
    });

    expect(frame.valid).toBe(true);
    expect(frame.diagnostics).toEqual([]);
    expect(frame.report.liveParticles).toBe(4);
    expect(frame.commands).toEqual([]);
    expect(frame.overlayCommands).toEqual([
      expect.objectContaining({
        kind: "setPipeline",
        renderId: 99,
        pipelineKey:
          "aperture/gpu-particles-render:bgra8unorm:depth24plus:samples-1:blend-alpha:soft-particles",
      }),
      expect.objectContaining({ kind: "setBindGroup", renderId: 99, index: 0 }),
      expect.objectContaining({ kind: "setBindGroup", renderId: 99, index: 1 }),
      expect.objectContaining({ kind: "setBindGroup", renderId: 99, index: 2 }),
      expect.objectContaining({
        kind: "setBindGroup",
        renderId: 99,
        index: 3,
        resourceKey: "particle:soft:0.001:0.2:depth:320x180",
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
    expect(cache.particleSoftParams).toHaveLength(1);
    expect(
      fixture.createdBuffers.some(
        (buffer) =>
          buffer.label === "Particle/SoftParams/particle:soft:0.001:0.2",
      ),
    ).toBe(true);
    expect(
      fixture.createdTextures.some(
        (texture) =>
          typeof texture === "object" &&
          texture !== null &&
          "format" in texture &&
          texture.format === "depth24plus",
      ),
    ).toBe(true);
  });

  it("applies continuous speed, speed-limit, and speed-by modules", async () => {
    const effect = createParticleEffectHandle("speed-modules");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createParticleSnapshot(effect, { timeScale: 1 });

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        label: "SpeedModules",
        main: {
          maxParticles: 4,
          startLifetime: 1,
          startSpeed: 1,
          startSize: 1,
          startColor: [1, 1, 1, 1],
        },
        emission: {
          rateOverTime: 60,
        },
        shape: {
          type: "point",
        },
        renderer: {
          blendMode: "alpha",
        },
        speedOverLifetime: {
          enabled: true,
          speed: 2,
        },
        limitVelocityOverLifetime: {
          enabled: true,
          speed: 0.5,
        },
        colorBySpeed: {
          enabled: true,
          color: {
            mode: "gradient",
            gradient: [
              { t: 0, color: [1, 1, 1, 1] },
              { t: 1, color: [0, 0.5, 1, 0.25] },
            ],
          },
          speedRange: { min: 0, max: 1 },
        },
        sizeBySpeed: {
          enabled: true,
          size: {
            mode: "curve",
            curve: [
              { t: 0, value: 2 },
              { t: 1, value: 4 },
            ],
          },
          speedRange: { min: 0, max: 1 },
        },
        rotationBySpeed: {
          enabled: true,
          angularVelocity: { min: 0, max: 2 },
          speedRange: { min: 0, max: 1 },
        },
      }),
    );

    const frame = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache,
      snapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        snapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 1 / 15,
    });

    expect(frame.valid).toBe(true);
    expect(frame.diagnostics).toEqual([]);
    expect(frame.report.liveParticles).toBe(4);

    const stateFloats = lastParticleStateFloats(fixture);
    const distanceFromOrigin = Math.hypot(
      (stateFloats[0] ?? 0) - 2,
      (stateFloats[1] ?? 0) - 3,
      (stateFloats[2] ?? 0) + 1,
    );

    // limitVelocityOverLifetime maps to runtime.maxSpeed + runtime.linearDamping
    // (= dampen, default 0) and only damps when linearDamping > 0 — the
    // Unity/three.quarks contract where Dampen 0 removes 0% of the excess
    // speed. With dampen unset the module is inert, so the particle moves at
    // startSpeed (1) * speedOverLifetime factor (2) = 2 for the single
    // clamped frame delta of 1/15 s.
    expect(distanceFromOrigin).toBeCloseTo(2 / 15, 4);
    // motionSpeed = 2 saturates every speedRange {min: 0, max: 1} (t = 1):
    // size  = startSize (1) * sizeBySpeed curve at t=1 -> 4
    // color = colorBySpeed gradient at t=1 -> [0, 0.5, 1, 0.25]
    expect(roundFloats(Array.from(stateFloats.slice(3, 8)))).toEqual([
      4, 0, 0.5, 1, 0.25,
    ]);
    // rotationBySpeed angular velocity = lerp(0, 2, t=1) = 2 rad/s applied
    // over the particle's render age of 1/15 s.
    expect(stateFloats[11]).toBeCloseTo(2 / 15, 5);
  });

  it("applies continuous noise and orbital motion modules", async () => {
    const moduleCases = [
      {
        label: "noise",
        shape: { type: "point" },
        modules: {
          noise: {
            enabled: true,
            strength: 1,
            frequency: 1,
            scrollSpeed: 0,
          },
        },
        assertParticle: (floats: Float32Array) => {
          expect(floats[15]).toBeCloseTo(1, 5);
          expect(
            Math.hypot(
              (floats[0] ?? 0) - 2,
              (floats[1] ?? 0) - 3,
              (floats[2] ?? 0) + 1,
            ),
          ).toBeCloseTo(1 / 15, 5);
        },
      },
      {
        label: "orbital",
        shape: { type: "circle", radius: 1 },
        modules: {
          orbitalVelocityOverLifetime: {
            enabled: true,
            orbital: [0, 0, 1],
          },
        },
        assertParticle: (floats: Float32Array) => {
          expect(floats[15]).toBeGreaterThan(0);
          expect(Math.hypot(floats[12] ?? 0, floats[13] ?? 0)).toBeGreaterThan(
            0,
          );
        },
      },
    ] as const;

    for (const moduleCase of moduleCases) {
      const effect = createParticleEffectHandle(`module-${moduleCase.label}`);
      const assets = new AssetRegistry();
      const cache = createWebGpuAppResourceCache();
      const fixture = createParticleDeviceFixture();
      const snapshot = createParticleSnapshot(effect, { timeScale: 1 });

      assets.register(effect);
      assets.markReady(
        effect,
        createParticleEffectAsset({
          version: 2,
          label: `Module${moduleCase.label}`,
          main: {
            maxParticles: 4,
            startLifetime: 1,
            startSpeed: 0,
            startSize: 1,
          },
          emission: {
            rateOverTime: 60,
          },
          shape: moduleCase.shape,
          renderer: {
            blendMode: "alpha",
          },
          ...moduleCase.modules,
        }),
      );

      const frame = await prepareParticleFrameResourcesForSnapshot({
        app: createParticleAppContext(fixture.device),
        assets,
        cache,
        snapshot,
        viewUniforms: writePackedSnapshotViewUniforms(
          snapshot,
          createPackedSnapshotViewUniformsScratch(),
        ),
        time: 1 / 15,
      });

      expect(frame.valid).toBe(true);
      expect(frame.diagnostics).toEqual([]);
      moduleCase.assertParticle(lastParticleStateFloats(fixture));
    }
  });

  it("samples donut, rectangle, and grid continuous emitter shapes", async () => {
    const cases = [
      {
        label: "donut",
        shape: { type: "donut", radius: 2, radiusThickness: 0.25 },
        assertParticle: (floats: Float32Array, offset: number) => {
          const radius = Math.hypot(
            (floats[offset] ?? 0) - 2,
            (floats[offset + 1] ?? 0) - 3,
          );

          expect(radius).toBeGreaterThanOrEqual(1.5);
          expect(radius).toBeLessThanOrEqual(2);
          expect(floats[offset + 2]).toBeCloseTo(-1, 6);
        },
      },
      {
        label: "rectangle",
        shape: { type: "rectangle", box: [4, 2, 8] },
        assertParticle: (floats: Float32Array, offset: number) => {
          expect(floats[offset]).toBeGreaterThanOrEqual(0);
          expect(floats[offset]).toBeLessThanOrEqual(4);
          expect(floats[offset + 1]).toBeGreaterThanOrEqual(2);
          expect(floats[offset + 1]).toBeLessThanOrEqual(4);
          expect(floats[offset + 2]).toBeCloseTo(-1, 6);
        },
      },
      {
        label: "grid",
        shape: { type: "grid", box: [4, 2, 6], scale: [3, 2, 2] },
        assertParticle: (floats: Float32Array, offset: number) => {
          expectCloseToOneOf(floats[offset] ?? 0, [0, 2, 4]);
          expectCloseToOneOf(floats[offset + 1] ?? 0, [2, 4]);
          expectCloseToOneOf(floats[offset + 2] ?? 0, [-4, 2]);
        },
      },
    ] as const;

    for (const fixtureCase of cases) {
      const effect = createParticleEffectHandle(`shape-${fixtureCase.label}`);
      const assets = new AssetRegistry();
      const cache = createWebGpuAppResourceCache();
      const fixture = createParticleDeviceFixture();
      const snapshot = createParticleSnapshot(effect, { timeScale: 1 });

      assets.register(effect);
      assets.markReady(
        effect,
        createParticleEffectAsset({
          version: 2,
          label: `Shape${fixtureCase.label}`,
          main: {
            maxParticles: 4,
            startLifetime: 1,
            startSpeed: 0,
            startSize: 1,
          },
          emission: {
            rateOverTime: 60,
          },
          shape: fixtureCase.shape,
          renderer: {
            blendMode: "alpha",
          },
        }),
      );

      const frame = await prepareParticleFrameResourcesForSnapshot({
        app: createParticleAppContext(fixture.device),
        assets,
        cache,
        snapshot,
        viewUniforms: writePackedSnapshotViewUniforms(
          snapshot,
          createPackedSnapshotViewUniformsScratch(),
        ),
        time: 1 / 15,
      });

      expect(frame.valid).toBe(true);
      expect(frame.diagnostics).toEqual([]);

      const stateFloats = lastParticleStateFloats(fixture);

      expect(frame.report.liveParticles).toBe(4);
      for (let particle = 0; particle < 4; particle += 1) {
        fixtureCase.assertParticle(stateFloats, particle * 16);
      }
    }
  });

  it("packs trail render mode motion length for continuous emitters", async () => {
    const effect = createParticleEffectHandle("trail-motion");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createParticleSnapshot(effect, { timeScale: 1 });

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        label: "TrailMotion",
        main: {
          maxParticles: 4,
          startLifetime: 1,
          startSpeed: 2,
          startSize: 1,
        },
        emission: {
          rateOverTime: 60,
        },
        shape: {
          type: "point",
        },
        renderer: {
          blendMode: "alpha",
          renderMode: "trail",
        },
        trails: {
          enabled: true,
          lifetime: 2,
          ratio: 0.5,
          minVertexDistance: 0.25,
        },
      }),
    );

    const frame = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache,
      snapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        snapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 1 / 15,
    });

    expect(frame.valid).toBe(true);
    expect(frame.diagnostics).toEqual([]);
    expect(frame.commands).toContainEqual(
      expect.objectContaining({
        kind: "setPipeline",
        pipelineKey:
          "aperture/gpu-particles-render:bgra8unorm:depth24plus:samples-1:blend-alpha:mode-trail",
      }),
    );

    const stateFloats = lastParticleStateFloats(fixture);

    expect(stateFloats[15]).toBeCloseTo(2, 5);
  });

  it("applies continuous world-plane collision response", async () => {
    const effect = createParticleEffectHandle("collision-plane");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createParticleSnapshot(effect, { timeScale: 1 });

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        label: "CollisionPlane",
        main: {
          maxParticles: 4,
          startLifetime: 1,
          startSpeed: 0,
          startSize: 1,
        },
        emission: {
          rateOverTime: 60,
        },
        shape: {
          type: "point",
        },
        renderer: {
          blendMode: "alpha",
        },
        forceOverLifetime: {
          enabled: true,
          force: [0, -15, 0],
        },
        collision: {
          enabled: true,
          mode: "world",
          bounce: 0.5,
          dampen: 0,
          lifetimeLoss: 0,
        },
      }),
    );

    const frame = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache,
      snapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        snapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 1 / 15,
    });

    expect(frame.valid).toBe(true);
    expect(frame.diagnostics).toEqual([]);

    const stateFloats = lastParticleStateFloats(fixture);

    expect(stateFloats[1]).toBeCloseTo(3, 6);
    expect(stateFloats[13]).toBeGreaterThan(0);
    expect(stateFloats[15]).toBeCloseTo(0.5, 5);
  });

  it("samples mesh-surface continuous emitters on authored bounds", async () => {
    const effect = createParticleEffectHandle("mesh-surface-shape");
    const mesh = createMeshHandle("surface-source");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createParticleSnapshot(effect, { timeScale: 1 });

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        label: "MeshSurfaceShape",
        main: {
          maxParticles: 4,
          startLifetime: 1,
          startSpeed: 0,
          startSize: 1,
        },
        emission: {
          rateOverTime: 60,
        },
        shape: {
          type: "mesh-surface",
          mesh,
          box: [4, 2, 6],
        },
        renderer: {
          blendMode: "alpha",
        },
      }),
    );

    const frame = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache,
      snapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        snapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 1 / 15,
    });

    expect(frame.valid).toBe(true);
    expect(frame.diagnostics).toEqual([]);

    const stateFloats = lastParticleStateFloats(fixture);

    for (let particle = 0; particle < 4; particle += 1) {
      const offset = particle * 16;
      const onSurface =
        isCloseToOneOf(stateFloats[offset] ?? 0, [0, 4]) ||
        isCloseToOneOf(stateFloats[offset + 1] ?? 0, [2, 4]) ||
        isCloseToOneOf(stateFloats[offset + 2] ?? 0, [-4, 2]);

      expect(onSurface).toBe(true);
    }
  });

  it("spawns continuous particles from rate over distance", async () => {
    const effect = createParticleEffectHandle("distance-emission");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const firstSnapshot = createParticleSnapshot(effect, { timeScale: 1 });
    const movedSnapshot = createParticleSnapshot(effect, { timeScale: 1 });

    movedSnapshot.transforms[12] = 4;
    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        label: "DistanceEmission",
        main: {
          maxParticles: 4,
          startLifetime: 1,
          startSpeed: 0,
        },
        emission: {
          rateOverTime: 0,
          rateOverDistance: 2,
        },
        shape: {
          type: "point",
        },
        renderer: {
          blendMode: "alpha",
        },
      }),
    );

    const first = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache,
      snapshot: firstSnapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        firstSnapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 1 / 15,
    });
    const second = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache,
      snapshot: movedSnapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        movedSnapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 2 / 15,
    });

    expect(first.report.liveParticles).toBe(0);
    expect(second.valid).toBe(true);
    expect(second.diagnostics).toEqual([]);
    expect(second.report.liveParticles).toBe(4);
  });

  it("gates continuous emission by composite child delay", async () => {
    const effect = createParticleEffectHandle("delayed-child");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        label: "DelayedChild",
        main: { maxParticles: 8, startLifetime: 5, startSpeed: 0 },
        emission: { rateOverTime: 100 },
        shape: { type: "point" },
        renderer: { blendMode: "alpha" },
      }),
    );

    const frame = (time: number) => {
      const snapshot = createParticleSnapshot(effect, {
        timeScale: 1,
        delay: 1,
      });
      return prepareParticleFrameResourcesForSnapshot({
        app: createParticleAppContext(fixture.device),
        assets,
        cache,
        snapshot,
        viewUniforms: writePackedSnapshotViewUniforms(
          snapshot,
          createPackedSnapshotViewUniformsScratch(),
        ),
        time,
      });
    };

    await frame(0);
    const beforeDelay = await frame(0.5);
    const afterDelay = await frame(2);

    expect(beforeDelay.report.liveParticles).toBe(0);
    expect(afterDelay.report.liveParticles).toBeGreaterThan(0);
  });

  it("stops continuous emission past a composite child duration", async () => {
    const effect = createParticleEffectHandle("bounded-child");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        label: "BoundedChild",
        main: { maxParticles: 8, startLifetime: 5, startSpeed: 0 },
        emission: { rateOverTime: 100 },
        shape: { type: "point" },
        renderer: { blendMode: "alpha" },
      }),
    );

    const frame = (time: number, duration: number | null) => {
      const snapshot = createParticleSnapshot(effect, {
        timeScale: 1,
        ...(duration === null ? {} : { duration }),
      });
      return prepareParticleFrameResourcesForSnapshot({
        app: createParticleAppContext(fixture.device),
        assets,
        cache,
        snapshot,
        viewUniforms: writePackedSnapshotViewUniforms(
          snapshot,
          createPackedSnapshotViewUniformsScratch(),
        ),
        time,
      });
    };

    // A child duration of 0.5s is a hard emission cutoff: at t=1s (past the
    // window) nothing spawns, whereas the same effect with no duration does.
    await frame(0, 0.5);
    const bounded = await frame(1, 0.5);
    expect(bounded.report.liveParticles).toBe(0);

    const unbounded = createParticleSnapshot(effect, { timeScale: 1 });
    const controlCache = createWebGpuAppResourceCache();
    await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache: controlCache,
      snapshot: unbounded,
      viewUniforms: writePackedSnapshotViewUniforms(
        unbounded,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 0,
    });
    const control = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache: controlCache,
      snapshot: unbounded,
      viewUniforms: writePackedSnapshotViewUniforms(
        unbounded,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 1,
    });
    expect(control.report.liveParticles).toBeGreaterThan(0);
  });

  it("schedules continuous emission bursts with cycles and intervals", async () => {
    const effect = createParticleEffectHandle("scheduled-bursts");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createParticleSnapshot(effect, { timeScale: 1 });

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        label: "ScheduledBursts",
        main: {
          maxParticles: 4,
          startLifetime: 1,
          startSpeed: 0,
        },
        emission: {
          rateOverTime: 0,
          bursts: [
            {
              time: 0,
              count: 2,
              cycle: 2,
              interval: 0.05,
              probability: 1,
            },
          ],
        },
        shape: {
          type: "point",
        },
        renderer: {
          blendMode: "alpha",
        },
      }),
    );

    const frame = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache,
      snapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        snapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 0.06,
    });

    expect(frame.valid).toBe(true);
    expect(frame.diagnostics).toEqual([]);
    expect(frame.report.liveParticles).toBe(4);
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
        sizeScale: 1,
        colorTint: [1, 1, 1, 1],
      },
    });

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        label: "SmokeBurst",
        main: {
          maxParticles: 16,
          startLifetime: { min: 1, max: 1 },
          startSize: { min: 0.5, max: 1 },
        },
        emission: {
          rateOverTime: 0,
        },
        renderer: {
          blendMode: "alpha",
        },
        limitVelocityOverLifetime: {
          enabled: true,
          dampen: 0.75,
        },
        colorOverLifetime: {
          enabled: true,
          color: {
            mode: "gradient",
            gradient: [
              { t: 0, color: [0.4, 0.4, 0.45, 0.25] },
              { t: 1, color: [0.4, 0.4, 0.45, 0] },
            ],
          },
        },
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
    // count (3) * PARTICLE_BURST_DATA_FLOAT_STRIDE (20, the 12-float record
    // plus the appended startColor*colorTint vec4 at floats 12-15 and the
    // appended burst emitter-origin vec4 at floats 16-19) * 4 bytes.
    expect(
      fixture.writes.filter((write) =>
        write.label.startsWith("Particle/BurstBatch/"),
      ),
    ).toMatchObject([{ size: 3 * 20 * 4 }]);
    expect(burst.commands).toContainEqual(
      expect.objectContaining({
        kind: "draw",
        renderId: 99,
        vertexCount: 6,
        instanceCount: 3,
      }),
    );
  });

  it("packs burst module curves, speed ranges, and per-particle emitter origin", async () => {
    const effect = createParticleEffectHandle("modulated-burst");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createParticleSnapshot(effect, {
      mode: "burst",
      capacity: 2,
      resetEpoch: 3,
      burst: {
        burstId: 1,
        startFrame: 3,
        count: 2,
        position: [1, 2, 3],
        positionJitterMin: [0, 0, 0],
        positionJitterMax: [0, 0, 0],
        velocityMin: [0, 0, 0],
        velocityMax: [0, 0, 0],
        sizeScale: 1,
        colorTint: [1, 1, 1, 1],
      },
    });

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        label: "ModulatedBurst",
        main: {
          maxParticles: 4,
          startLifetime: 1,
          startSpeed: 0,
          startSize: 1,
        },
        emission: {
          rateOverTime: 0,
        },
        renderer: {
          blendMode: "alpha",
        },
        speedOverLifetime: {
          enabled: true,
          speed: {
            mode: "curve",
            curve: [
              { t: 0, value: 0 },
              { t: 1, value: 2 },
            ],
          },
        },
        sizeBySpeed: {
          enabled: true,
          size: {
            mode: "curve",
            curve: [
              { t: 0, value: 1 },
              { t: 1, value: 3 },
            ],
          },
          speedRange: { min: 1, max: 5 },
        },
        colorBySpeed: {
          enabled: true,
          color: {
            mode: "gradient",
            gradient: [
              { t: 0, color: [1, 1, 1, 1] },
              { t: 1, color: [0, 0.5, 1, 0.25] },
            ],
          },
          speedRange: { min: 0, max: 2 },
        },
        rotationBySpeed: {
          enabled: true,
          angularVelocity: { min: 0.5, max: 2.5 },
          speedRange: { min: 0.25, max: 4 },
        },
        noise: {
          enabled: true,
          strength: 1.5,
          frequency: 2,
          scrollSpeed: 0.5,
          damping: true,
        },
        orbitalVelocityOverLifetime: {
          enabled: true,
          orbital: [0, 0, 3],
          offset: [0.5, 0, 0],
          radial: 0.75,
        },
      }),
    );

    const frame = await prepareParticleFrameResourcesForSnapshot({
      app: createParticleAppContext(fixture.device),
      assets,
      cache,
      snapshot,
      viewUniforms: writePackedSnapshotViewUniforms(
        snapshot,
        createPackedSnapshotViewUniformsScratch(),
      ),
      time: 3 / 60,
    });

    expect(frame.valid).toBe(true);
    expect(frame.diagnostics).toEqual([]);

    const [paramWrite] = fixture.writes.filter((write) =>
      write.label.startsWith("Particle/BurstBatchParams/"),
    );
    expect(paramWrite).toBeDefined();

    const paramBytes = bytesUpload(paramWrite);
    const params = new Float32Array(
      paramBytes.buffer,
      paramBytes.byteOffset,
      paramBytes.byteLength / 4,
    );

    // PARTICLE_BURST_RENDER_PARAM_FLOAT_COUNT = 124 (base) + 16 (speed curve)
    // + 16 (speed integral) + 16 (speed time integral) + 16 (size-by-speed)
    // + 64 (color-by-speed) + 20 (module params) = 272 floats.
    expect(params).toHaveLength(272);

    // Speed curve samples s(t) = 2t at the 16 uniform lifetime samples.
    for (let index = 0; index < 16; index += 1) {
      const t = index / 15;

      expect(params[124 + index]).toBeCloseTo(2 * t, 5);
      // Cumulative integral of s: S0(t) = t^2.
      expect(params[140 + index]).toBeCloseTo(t * t, 4);
      // Time-weighted integral of s: S1(t) = (2/3) t^3.
      expect(params[156 + index]).toBeCloseTo((2 / 3) * t * t * t, 4);
      // Size-by-speed curve 1 -> 3.
      expect(params[172 + index]).toBeCloseTo(1 + 2 * t, 5);
      // Color-by-speed gradient white -> [0, 0.5, 1, 0.25].
      expect(params[188 + index * 4]).toBeCloseTo(1 - t, 5);
      expect(params[188 + index * 4 + 1]).toBeCloseTo(1 - 0.5 * t, 5);
      expect(params[188 + index * 4 + 2]).toBeCloseTo(1, 5);
      expect(params[188 + index * 4 + 3]).toBeCloseTo(1 - 0.75 * t, 5);
    }

    // Packed module parameter vec4s appended after the curve tables:
    // sizeBySpeedRange min/max + colorBySpeedRange min/max.
    expect(Array.from(params.slice(252, 256))).toEqual([1, 5, 0, 2]);
    // rotationBySpeedRange min/max + angularVelocityBySpeed min/max.
    expect(Array.from(params.slice(256, 260))).toEqual([0.25, 4, 0.5, 2.5]);
    // Orbital velocity xyz + radial velocity.
    expect(Array.from(params.slice(260, 264))).toEqual([0, 0, 3, 0.75]);
    // Orbital offset xyz + speed-curve-enabled flag.
    expect(Array.from(params.slice(264, 268))).toEqual([0.5, 0, 0, 1]);
    // Noise strength, frequency, scroll speed, damping flag.
    expect(Array.from(params.slice(268, 272))).toEqual([1.5, 2, 0.5, 1]);

    // The per-particle record appends the burst emitter origin (the orbital
    // pivot) as a vec4 at floats 16-19 of the widened 20-float stride.
    const [batchWrite] = fixture.writes.filter((write) =>
      write.label.startsWith("Particle/BurstBatch/"),
    );
    expect(batchWrite).toBeDefined();
    expect(batchWrite?.size).toBe(2 * 20 * 4);

    const batchBytes = bytesUpload(batchWrite!);
    const batchFloats = new Float32Array(
      batchBytes.buffer,
      batchBytes.byteOffset,
      batchBytes.byteLength / 4,
    );

    for (let particle = 0; particle < 2; particle += 1) {
      const offset = particle * 20;

      expect(Array.from(batchFloats.slice(offset + 16, offset + 20))).toEqual([
        1, 2, 3, 0,
      ]);
    }
  });

  it("applies noise and orbital motion to non-batchable local-space bursts", async () => {
    const moduleCases = [
      {
        label: "noise",
        jitter: [0, 0, 0] as const,
        modules: {
          noise: {
            enabled: true,
            strength: 1,
            frequency: 1,
            scrollSpeed: 0,
          },
        },
        assertParticle: (floats: Float32Array) => {
          // Unit-length noise direction scaled by strength 1.
          expect(floats[15]).toBeCloseTo(1, 5);
        },
      },
      {
        label: "orbital",
        jitter: [1, 0, 0] as const,
        modules: {
          orbitalVelocityOverLifetime: {
            enabled: true,
            orbital: [0, 0, 1],
          },
        },
        assertParticle: (floats: Float32Array) => {
          // cross([0,0,1], [1,0,0]) = [0,1,0] around the burst origin.
          expect(floats[12]).toBeCloseTo(0, 5);
          expect(floats[13]).toBeCloseTo(1, 5);
          expect(floats[15]).toBeCloseTo(1, 5);
        },
      },
    ] as const;

    for (const moduleCase of moduleCases) {
      const effect = createParticleEffectHandle(
        `local-burst-${moduleCase.label}`,
      );
      const assets = new AssetRegistry();
      const cache = createWebGpuAppResourceCache();
      const fixture = createParticleDeviceFixture();
      const snapshot = createParticleSnapshot(effect, {
        mode: "burst",
        simulationSpace: "local",
        capacity: 1,
        resetEpoch: 1,
        burst: {
          burstId: 1,
          startFrame: 1,
          count: 1,
          position: [0, 0, 0],
          positionJitterMin: moduleCase.jitter,
          positionJitterMax: moduleCase.jitter,
          velocityMin: [0, 0, 0],
          velocityMax: [0, 0, 0],
          sizeScale: 1,
          colorTint: [1, 1, 1, 1],
        },
      });

      assets.register(effect);
      assets.markReady(
        effect,
        createParticleEffectAsset({
          version: 2,
          label: `LocalBurst${moduleCase.label}`,
          main: {
            maxParticles: 1,
            startLifetime: 1,
            startSpeed: 0,
            startSize: 1,
          },
          emission: {
            rateOverTime: 0,
          },
          shape: {
            type: "point",
          },
          renderer: {
            blendMode: "alpha",
          },
          ...moduleCase.modules,
        }),
      );

      const frame = await prepareParticleFrameResourcesForSnapshot({
        app: createParticleAppContext(fixture.device),
        assets,
        cache,
        snapshot,
        viewUniforms: writePackedSnapshotViewUniforms(
          snapshot,
          createPackedSnapshotViewUniformsScratch(),
        ),
        time: 1 / 60,
      });

      expect(frame.valid).toBe(true);
      expect(frame.diagnostics).toEqual([]);
      expect(frame.report.liveParticles).toBe(1);
      moduleCase.assertParticle(lastParticleStateFloats(fixture));
    }
  });

  it("packs authored burst billboard rotation and angular velocity", async () => {
    const effect = createParticleEffectHandle("rotating-smoke-burst");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createParticleSnapshot(effect, {
      mode: "burst",
      capacity: 1,
      resetEpoch: 12,
      burst: {
        burstId: 1,
        startFrame: 12,
        count: 1,
        position: [0, 0, 0],
        positionJitterMin: [0, 0, 0],
        positionJitterMax: [0, 0, 0],
        velocityMin: [0, 0, 0],
        velocityMax: [0, 0, 0],
        sizeScale: 1,
        colorTint: [1, 1, 1, 1],
      },
    });

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        label: "RotatingSmokeBurst",
        main: {
          maxParticles: 1,
          startLifetime: 1,
          startSize: 1,
          startRotation: 0.5,
        },
        emission: {
          rateOverTime: 0,
        },
        renderer: {
          blendMode: "alpha",
        },
        rotationOverLifetime: {
          enabled: true,
          angularVelocity: 2,
        },
      }),
    );

    const frame = await prepareParticleFrameResourcesForSnapshot({
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

    expect(frame.valid).toBe(true);
    expect(frame.diagnostics).toEqual([]);

    const [batchWrite] = fixture.writes.filter((write) =>
      write.label.startsWith("Particle/BurstBatch/"),
    );
    expect(batchWrite).toBeDefined();

    const upload = bytesUpload(batchWrite!);
    const floats = new Float32Array(
      upload.buffer,
      upload.byteOffset,
      upload.byteLength / 4,
    );

    expect(floats[10]).toBeCloseTo(0.5, 6);
    expect(floats[11]).toBeCloseTo(2, 6);
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
        sizeScale: 1,
        colorTint: [1, 1, 1, 1],
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
        version: 2,
        label: "BatchedSmokeBurst",
        main: {
          maxParticles: 16,
          startLifetime: { min: 1, max: 1 },
          startSize: { min: 0.5, max: 1 },
        },
        emission: {
          rateOverTime: 0,
        },
        renderer: {
          blendMode: "alpha",
        },
        limitVelocityOverLifetime: {
          enabled: true,
          dampen: 0.75,
        },
        colorOverLifetime: {
          enabled: true,
          color: {
            mode: "gradient",
            gradient: [
              { t: 0, color: [0.4, 0.4, 0.45, 0.25] },
              { t: 1, color: [0.4, 0.4, 0.45, 0] },
            ],
          },
        },
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
    // 6 particles * PARTICLE_BURST_DATA_FLOAT_STRIDE (20) * 4 bytes.
    expect(batchWrites[0]?.size).toBe(6 * 20 * 4);
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
    expect(reusedBatchWrites).toHaveLength(2);
    expect(reusedBatchWrites[1]?.size).toBe(6 * 20 * 4);
    // PARTICLE_BURST_RENDER_PARAM_FLOAT_COUNT = 4 (time+gravity) + 4
    // (damping/flags) + 4 (texture sheet) + 16 (size curve) + 16 (frame-min
    // curve) + 16 (frame curve) + 16*4 (color curve) + 16 (speed curve) + 16
    // (speed integral) + 16 (speed time integral) + 16 (size-by-speed) + 16*4
    // (color-by-speed) + 20 (module params, appended) = 272 floats.
    expect(paramWrites).toMatchObject([{ size: 272 * 4 }, { size: 272 * 4 }]);
    const firstParamBytes = bytesUpload(paramWrites[0]);
    const firstParams = new Float32Array(
      firstParamBytes.buffer,
      firstParamBytes.byteOffset,
      firstParamBytes.byteLength / 4,
    );
    expect(firstParams[4]).toBeCloseTo(0.75, 6);
    expect(Array.from(firstParams.slice(8, 12))).toEqual([1, 1, 0, 1]);
    expect(firstParams[28]).toBe(0);

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

  it("compacts gapped burst batches into one draw", async () => {
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
        sizeScale: 1,
        colorTint: [1, 1, 1, 1],
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
        version: 2,
        label: "GappedSmokeBurst",
        main: {
          maxParticles: 16,
          startLifetime: { min: 1, max: 1 },
          startSize: { min: 0.5, max: 1 },
        },
        emission: {
          rateOverTime: 0,
        },
        renderer: {
          blendMode: "alpha",
        },
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
    const writesBeforeGapped = fixture.writes.length;
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
        instanceCount: 6,
        firstVertex: 0,
        firstInstance: 0,
      },
    ]);
    const gappedWrites = fixture.writes.slice(writesBeforeGapped);
    const compactedBatchWrite = gappedWrites.find(
      (write) =>
        write.label.startsWith("Particle/BurstBatch/") &&
        write.dataOffset === 0 &&
        // 6 particles * PARTICLE_BURST_DATA_FLOAT_STRIDE (20) * 4 bytes.
        write.size === 6 * 20 * 4,
    );
    expect(compactedBatchWrite).toBeDefined();
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
        version: 2,
        label: "SparkDelta",
        main: {
          maxParticles: 4,
        },
        renderer: {
          blendMode: "alpha",
        },
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
        sizeScale: 1,
        colorTint: [1, 1, 1, 1],
      },
    });

    assets.register(effect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        label: "HdrSmokeBurst",
        main: {
          maxParticles: 2,
          startLifetime: { min: 1, max: 1 },
          startSize: { min: 0.5, max: 1 },
        },
        emission: {
          rateOverTime: 0,
        },
        renderer: {
          blendMode: "alpha",
        },
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

  it("spawns death subemitter children at the dying parent particle's position", async () => {
    const effect = createParticleEffectHandle("death-parent");
    const childEffect = createParticleEffectHandle("death-spark-child");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const snapshot = createParticleSnapshot(effect, { timeScale: 1 });
    const app = createParticleAppContext(fixture.device);
    const viewUniforms = writePackedSnapshotViewUniforms(
      snapshot,
      createPackedSnapshotViewUniformsScratch(),
    );

    assets.register(effect);
    assets.register(childEffect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        label: "DeathParent",
        main: {
          maxParticles: 4,
          startLifetime: { min: 0.05, max: 0.05 },
          startSpeed: 0,
          startSize: { min: 0.2, max: 0.2 },
        },
        emission: {
          rateOverTime: 0,
          bursts: [{ time: 0, count: 2 }],
        },
        shape: { type: "point" },
        renderer: { blendMode: "alpha" },
        subEmitters: [{ type: "death", effect: "death-spark-child" }],
      }),
    );
    assets.markReady(
      childEffect,
      createParticleEffectAsset({
        version: 2,
        label: "DeathSparkChild",
        main: {
          maxParticles: 8,
          startLifetime: { min: 1, max: 1 },
          startSpeed: 0,
          startSize: { min: 0.1, max: 0.1 },
        },
        emission: {
          rateOverTime: 0,
          bursts: [{ time: 0, count: 3 }],
        },
        shape: { type: "point" },
        renderer: { blendMode: "alpha" },
      }),
    );

    const first = await prepareParticleFrameResourcesForSnapshot({
      app,
      assets,
      cache,
      snapshot,
      viewUniforms,
      time: 1 / 60,
    });

    expect(first.valid).toBe(true);
    // A death subemitter is a real frame unit, not an unsupported-mode
    // diagnostic.
    expect(first.diagnostics).toEqual([]);
    expect(first.report.emitters).toBe(2);
    // Only the two parent particles are alive; no parent has died yet.
    expect(first.report.liveParticles).toBe(2);

    const second = await prepareParticleFrameResourcesForSnapshot({
      app,
      assets,
      cache,
      snapshot,
      viewUniforms,
      time: 1 / 60 + 1 / 15,
    });

    expect(second.valid).toBe(true);
    expect(second.diagnostics).toEqual([]);
    // Both parents crossed their 0.05 s lifetime this frame; each death seeds
    // the child effect, whose t=0 burst emits 3 particles per dead parent.
    expect(second.report.liveParticles).toBe(6);
    expect(second.report.drawCalls).toBe(1);

    // The only non-parent write of exactly six live particles is the death
    // child's frame-2 upload (its creation zero-fill covers full capacity).
    const childDataWrites = fixture.writes.filter(
      (write) =>
        write.label.startsWith("Particle/State/") &&
        write.label !== "Particle/State/99" &&
        write.size === 6 * 16 * 4,
    );
    expect(childDataWrites).toHaveLength(1);
    const childFloats = floatsUpload(childDataWrites[0]);
    expect(childFloats).toHaveLength(6 * 16);
    for (let index = 0; index < 6; index += 1) {
      // Children spawn at the parent emitter's world origin, where the
      // stationary parent particles died.
      expect(
        roundFloats([
          childFloats[index * 16] ?? Number.NaN,
          childFloats[index * 16 + 1] ?? Number.NaN,
          childFloats[index * 16 + 2] ?? Number.NaN,
        ]),
      ).toEqual([2, 3, -1]);
    }
  });

  it("spawns birth and death subemitter children for burst parents on the CPU burst path", async () => {
    const effect = createParticleEffectHandle("burst-subemitter-parent");
    const birthChildEffect = createParticleEffectHandle("burst-birth-child");
    const deathChildEffect = createParticleEffectHandle("burst-death-child");
    const assets = new AssetRegistry();
    const cache = createWebGpuAppResourceCache();
    const fixture = createParticleDeviceFixture();
    const app = createParticleAppContext(fixture.device);
    const snapshot = createParticleSnapshot(effect, {
      mode: "burst",
      capacity: 2,
      resetEpoch: 1,
      timeScale: 1,
      burst: {
        burstId: 1,
        startFrame: 1,
        count: 2,
        position: [5, 0, 0],
        positionJitterMin: [0, 0, 0],
        positionJitterMax: [0, 0, 0],
        velocityMin: [0, 0, 0],
        velocityMax: [0, 0, 0],
        sizeScale: 1,
        colorTint: [1, 1, 1, 1],
      },
    });
    const viewUniforms = writePackedSnapshotViewUniforms(
      snapshot,
      createPackedSnapshotViewUniformsScratch(),
    );

    assets.register(effect);
    assets.register(birthChildEffect);
    assets.register(deathChildEffect);
    assets.markReady(
      effect,
      createParticleEffectAsset({
        version: 2,
        label: "BurstSubemitterParent",
        main: {
          maxParticles: 2,
          startLifetime: { min: 0.05, max: 0.05 },
          startSpeed: 0,
          startSize: { min: 0.5, max: 0.5 },
        },
        emission: { rateOverTime: 0 },
        shape: { type: "point" },
        renderer: { blendMode: "alpha" },
        subEmitters: [
          { type: "birth", effect: "burst-birth-child" },
          { type: "death", effect: "burst-death-child" },
        ],
      }),
    );
    assets.markReady(
      birthChildEffect,
      createParticleEffectAsset({
        version: 2,
        label: "BurstBirthChild",
        main: {
          maxParticles: 8,
          startLifetime: { min: 2, max: 2 },
          startSpeed: 0,
          startSize: { min: 0.1, max: 0.1 },
        },
        emission: {
          rateOverTime: 0,
          bursts: [{ time: 0, count: 1 }],
        },
        shape: { type: "point" },
        renderer: { blendMode: "alpha" },
      }),
    );
    assets.markReady(
      deathChildEffect,
      createParticleEffectAsset({
        version: 2,
        label: "BurstDeathChild",
        main: {
          maxParticles: 8,
          startLifetime: { min: 2, max: 2 },
          startSpeed: 0,
          startSize: { min: 0.1, max: 0.1 },
        },
        emission: {
          rateOverTime: 0,
          bursts: [{ time: 0, count: 3 }],
        },
        shape: { type: "point" },
        renderer: { blendMode: "alpha" },
      }),
    );

    const first = await prepareParticleFrameResourcesForSnapshot({
      app,
      assets,
      cache,
      snapshot,
      viewUniforms,
      time: 1 / 60,
    });

    expect(first.valid).toBe(true);
    expect(first.diagnostics).toEqual([]);
    // The subemitter-bearing burst leaves the shared GPU-analytic batch and
    // takes the per-emitter CPU burst path, where births and deaths are
    // observable without GPU readback.
    expect(first.commands).toContainEqual(
      expect.objectContaining({
        kind: "setPipeline",
        pipelineKey:
          "aperture/gpu-particles-render:bgra8unorm:depth24plus:samples-1:blend-alpha",
      }),
    );
    expect(first.commands).not.toContainEqual(
      expect.objectContaining({
        pipelineKey: expect.stringContaining("gpu-particles-burst-render"),
      }),
    );
    expect(first.report.emitters).toBe(3);
    // 2 burst parents + 1 birth child per parent particle born this frame.
    expect(first.report.liveParticles).toBe(4);

    const second = await prepareParticleFrameResourcesForSnapshot({
      app,
      assets,
      cache,
      snapshot,
      viewUniforms,
      time: 1 / 60 + 1 / 15,
    });

    expect(second.valid).toBe(true);
    expect(second.diagnostics).toEqual([]);
    // Parents died; the 2 birth children live on and each death spawns the
    // death child's t=0 burst of 3 (and does not re-fire the birth child's
    // already-consumed t=0 burst).
    expect(second.report.liveParticles).toBe(8);

    // The death child's frame-2 upload is the only write of exactly six live
    // particles; creation zero-fills cover full capacity and the birth child
    // uploads two particles per frame.
    const deathChildWrite = fixture.writes.find(
      (write) =>
        write.label.startsWith("Particle/State/") &&
        write.label !== "Particle/State/99" &&
        write.size === 6 * 16 * 4,
    );
    expect(deathChildWrite).toBeDefined();
    const deathFloats = floatsUpload(deathChildWrite);
    for (let index = 0; index < 6; index += 1) {
      // Death children spawn at the burst's shared origin, where the
      // stationary parent particles died.
      expect(
        roundFloats([
          deathFloats[index * 16] ?? Number.NaN,
          deathFloats[index * 16 + 1] ?? Number.NaN,
          deathFloats[index * 16 + 2] ?? Number.NaN,
        ]),
      ).toEqual([5, 0, 0]);
    }
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

function floatsUpload(upload: BufferWriteRecord | undefined): Float32Array {
  const bytes = bytesUpload(upload);

  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

function lastParticleStateFloats(
  fixture: ReturnType<typeof createParticleDeviceFixture>,
): Float32Array {
  const stateWrites = fixture.writes.filter(
    (write) => write.label === "Particle/State/99",
  );
  const stateUpload = bytesUpload(stateWrites.at(-1));

  return new Float32Array(
    stateUpload.buffer,
    stateUpload.byteOffset,
    stateUpload.byteLength / 4,
  );
}

function expectCloseToOneOf(value: number, expected: readonly number[]): void {
  expect(isCloseToOneOf(value, expected)).toBe(true);
}

function isCloseToOneOf(value: number, expected: readonly number[]): boolean {
  return expected.some((candidate) => Math.abs(value - candidate) <= 0.0001);
}

function roundFloats(values: readonly number[]): number[] {
  return values.map((value) => Math.round(value * 1000) / 1000);
}

function renderCommandGroup(renderId: number) {
  return [
    {
      kind: "setPipeline" as const,
      renderId,
      pipelineKey: `pipeline:${renderId}`,
      pipeline: {},
    },
    {
      kind: "draw" as const,
      renderId,
      vertexCount: 6,
      instanceCount: 1,
      firstVertex: 0,
      firstInstance: 0,
    },
  ];
}
