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

    expect(distanceFromOrigin).toBeCloseTo(0.5 / 15, 4);
    expect(roundFloats(Array.from(stateFloats.slice(3, 8)))).toEqual([
      3, 0.5, 0.75, 1, 0.625,
    ]);
    expect(stateFloats[11]).toBeCloseTo(1 / 15, 5);
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
    expect(reusedBatchWrites).toHaveLength(2);
    expect(reusedBatchWrites[1]?.size).toBe(6 * 12 * 4);
    expect(paramWrites).toMatchObject([{ size: 108 * 4 }, { size: 108 * 4 }]);
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
        write.size === 6 * 12 * 4,
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
