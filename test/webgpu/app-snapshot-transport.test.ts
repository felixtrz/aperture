import { describe, expect, it } from "vitest";
import {
  createQuadSnapshotBuffers,
  createSnapshotPacketRegistry,
  encodeSnapshotPackets,
  FogMode,
  type SnapshotPacketBundle,
} from "@aperture-engine/render";
import {
  createAudioClipHandle,
  createMaterialHandle,
  createMeshHandle,
  createParticleEffectHandle,
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";
import {
  createWebGpuAppSnapshotTransport,
  hasWebGpuAppSharedSnapshotPayload,
  readWebGpuAppSharedSnapshot,
} from "@aperture-engine/webgpu/test-support";

describe("WebGPU app snapshot transport", () => {
  it("selects SharedArrayBuffer in auto mode when host isolation is available", () => {
    const transport = createWebGpuAppSnapshotTransport({
      sharedSnapshotTransport: {
        maxEntities: 1,
        maxViews: 1,
        maxPacketWords: 32,
        crossOriginIsolated: true,
      },
    });

    expect(transport.mode).toBe("shared-array-buffer");
    expect(transport.diagnostics).toMatchObject({
      requested: "auto",
      active: "shared-array-buffer",
      fallback: null,
      sharedArrayBuffer: {
        supported: true,
      },
    });
  });

  it("falls back in auto mode when host isolation is unavailable", () => {
    const transport = createWebGpuAppSnapshotTransport({
      sharedSnapshotTransport: {
        maxEntities: 1,
        maxViews: 1,
        maxPacketWords: 32,
        crossOriginIsolated: false,
      },
    });

    expect(transport.mode).toBe("transferable");
    expect(transport.diagnostics).toMatchObject({
      requested: "auto",
      active: "transferable",
      fallback: "transferable",
      sharedArrayBuffer: {
        supported: false,
        diagnostic: {
          reason: "cross-origin-isolation-required",
        },
      },
    });
  });

  it("keeps the explicit transferable route available", () => {
    const transport = createWebGpuAppSnapshotTransport({
      mode: "transferable",
      sharedSnapshotTransport: {
        maxEntities: 1,
        maxViews: 1,
        maxPacketWords: 32,
        crossOriginIsolated: true,
      },
    });

    expect(transport).toMatchObject({
      mode: "transferable",
      diagnostics: {
        requested: "transferable",
        active: "transferable",
        fallback: null,
        sharedArrayBuffer: null,
      },
    });
  });

  it("reconstructs shared quad buffers and quad batch packets", () => {
    const transport = createWebGpuAppSnapshotTransport({
      mode: "shared-array-buffer",
      sharedSnapshotTransport: {
        maxEntities: 1,
        maxViews: 1,
        maxQuadInstances: 1,
        maxPacketWords: 320,
        requireCrossOriginIsolated: false,
      },
    });

    expect(transport.mode).toBe("shared-array-buffer");

    if (transport.mode !== "shared-array-buffer") {
      return;
    }

    const registry = createSnapshotPacketRegistry();
    const casterMesh = createMeshHandle("off-camera-caster");
    const casterMaterial = createMaterialHandle("caster");
    const particleEffect = createParticleEffectHandle("smoke");
    const audioClip = createAudioClipHandle("engine");
    const packetBundle: SnapshotPacketBundle = {
      views: [],
      meshDraws: [],
      shadowCasterDraws: [
        {
          renderId: 77,
          entity: { index: 77, generation: 0 },
          mesh: casterMesh,
          material: casterMaterial,
          submesh: 0,
          materialSlot: 0,
          worldTransformOffset: 0,
          boundsIndex: 0,
          layerMask: 1,
          castsShadow: true,
          receivesShadow: false,
          sortKey: {
            queue: "opaque",
            viewId: 0,
            layer: 0,
            order: 0,
            pipelineKey: "standard|opaque|back|less|none",
            materialKey: "material:caster",
            meshKey: "mesh:off-camera-caster",
            depth: 0,
            stableId: 77,
          },
          batchKey: {
            pipelineKey: "standard|opaque|back|less|none",
            materialKey: "material:caster",
            meshLayoutKey: "POSITION",
            topology: "triangle-list",
            instanced: false,
            skinned: false,
            morphed: false,
          },
        },
      ],
      lights: [],
      environments: [],
      fogs: [
        {
          fogId: 3,
          entity: { index: 3, generation: 1 },
          mode: FogMode.Exp,
          color: [0.4, 0.5, 0.6, 1],
          density: 0.025,
          start: 12,
          end: 48,
          layerMask: 1,
        },
      ],
      particleEmitters: [
        {
          emitterId: 9,
          entity: { index: -1, generation: 0 },
          effect: particleEffect,
          effectVersion: 2,
          capacity: 16,
          seed: -3,
          resetEpoch: 4,
          timeScale: 1,
          simulationSpace: "world",
          worldTransformOffset: 0,
          boundsIndex: 0,
          layerMask: 1,
          sortKey: {
            queue: "transparent",
            viewId: 0,
            layer: 0,
            order: 0,
            pipelineKey: "gpu-particles",
            materialKey: "particle-effect:smoke",
            meshKey: "particle-quad",
            depth: 2,
            stableId: 9,
          },
          mode: "burst",
          burst: {
            burstId: 4,
            startFrame: 4,
            startTime: 9.75,
            count: 16,
            position: [1, 2, 3],
            positionJitterMin: [-0.5, 0, -0.5],
            positionJitterMax: [0.5, 1, 0.5],
            velocityMin: [0, 1, 0],
            velocityMax: [1, 2, 1],
            sizeScale: 1,
            colorTint: [1, 1, 1, 1],
          },
        },
      ],
      audioEmitters: [
        {
          key: { kind: "entity", id: 123 },
          entity: { index: 12, generation: 1 },
          clip: audioClip,
          clipVersion: 1,
          busId: "sfx",
          gain: 0.75,
          loop: true,
          autoplay: true,
          playEpoch: 2,
          stopEpoch: 0,
          timeScale: 1,
          priority: 1,
          panningModel: "equalpower",
          simulationSpace: "world",
          distanceModel: "inverse",
          refDistance: 1,
          maxDistance: 100,
          rolloffFactor: 1,
          coneInnerAngle: 360,
          coneOuterAngle: 360,
          coneOuterGain: 0,
          occlusion: 0,
          lowpassFrequency: 22050,
          lowpassQ: 0.7,
          offsetSec: 0,
          loopStart: 0,
          loopEnd: 0,
          seed: 7,
          boundsCenter: [0, 1, 0],
          audibilityRadius: 40,
          audibility: "audible",
          muted: false,
          worldTransformOffset: 0,
          layerMask: 1,
        },
      ],
      audioListener: {
        listenerId: 4,
        entity: { index: 4, generation: 1 },
        worldTransformOffset: 0,
        masterGain: 0.9,
      },
      shadowRequests: [],
      bounds: [],
      quadBatches: [
        {
          batchId: 1,
          kind: "sprite",
          texture: createTextureHandle("atlas"),
          sampler: createSamplerHandle("linear"),
          materialKey: "quad:sprite",
          pipelineVariant: "sprite",
          coordinateMode: "world",
          billboardMode: "spherical",
          sizeMode: "world-units",
          blendMode: "alpha",
          firstInstance: 0,
          instanceCount: 1,
          layerMask: 1,
          sortKey: {
            queue: "transparent",
            viewId: 0,
            layer: 0,
            order: 0,
            pipelineKey: "quad-pipeline",
            materialKey: "quad:sprite",
            meshKey: "quad",
            depth: 1,
            stableId: 1,
          },
        },
      ],
    };
    const encoded = encodeSnapshotPackets(packetBundle, { registry });
    const sourceQuads = createQuadSnapshotBuffers({
      instanceFloats: new Float32Array(24).fill(2),
      instanceWords: new Uint32Array(8).fill(3),
    });

    transport.shared.writer.writeFrame({
      frame: 4,
      time: 99.5,
      transforms: new Float32Array(0),
      viewMatrices: new Float32Array(0),
      quadInstanceFloats: sourceQuads.instanceFloats,
      quadInstanceWords: sourceQuads.instanceWords,
      packetWords: encoded.words,
    });

    const snapshot = readWebGpuAppSharedSnapshot(transport, {
      transport: {
        mode: "shared-array-buffer",
        registry: registry.snapshot(),
        diagnostics: [],
      },
    });

    expect(snapshot?.frame).toBe(4);
    expect(snapshot?.time).toBe(99.5);
    expect(snapshot?.quads?.instanceFloats).toEqual(sourceQuads.instanceFloats);
    expect(snapshot?.quads?.instanceWords).toEqual(sourceQuads.instanceWords);
    expect(snapshot?.quadBatches).toEqual(packetBundle.quadBatches);
    expect(snapshot?.fogs).toEqual(packetBundle.fogs);
    expect(snapshot?.particleEmitters).toEqual(packetBundle.particleEmitters);
    expect(snapshot?.audioEmitters).toEqual(packetBundle.audioEmitters);
    expect(snapshot?.audioListener).toEqual(packetBundle.audioListener);
    expect(snapshot?.shadowCasterDraws).toEqual(packetBundle.shadowCasterDraws);
    expect(snapshot?.report).toMatchObject({
      fogs: 1,
      particleEmitters: 1,
      audioEmitters: 1,
      shadowCasterDraws: 1,
      quadInstances: 1,
      quadBatches: 1,
    });
  });

  it("reuses decoded shared packet arrays when only numeric buffers change", () => {
    const transport = createWebGpuAppSnapshotTransport({
      mode: "shared-array-buffer",
      sharedSnapshotTransport: {
        maxEntities: 1,
        maxViews: 1,
        maxPacketWords: 256,
        requireCrossOriginIsolated: false,
      },
    });

    expect(transport.mode).toBe("shared-array-buffer");

    if (transport.mode !== "shared-array-buffer") {
      return;
    }

    const registry = createSnapshotPacketRegistry();
    const mesh = createMeshHandle("car");
    const material = createMaterialHandle("paint");
    const encoded = encodeSnapshotPackets(
      {
        views: [],
        meshDraws: [
          {
            renderId: 1,
            entity: { index: 1, generation: 0 },
            mesh,
            material,
            submesh: 0,
            materialSlot: 0,
            worldTransformOffset: 0,
            boundsIndex: 0,
            layerMask: 1,
            sortKey: {
              queue: "opaque",
              viewId: 0,
              layer: 0,
              order: 0,
              pipelineKey: "standard|opaque|back|less|none",
              materialKey: "material:paint",
              meshKey: "mesh:car",
              depth: 0,
              stableId: 1,
            },
            batchKey: {
              pipelineKey: "standard|opaque|back|less|none",
              materialKey: "material:paint",
              meshLayoutKey: "POSITION",
              topology: "triangle-list",
              instanced: false,
              skinned: false,
              morphed: false,
            },
          },
        ],
        lights: [],
        environments: [],
        shadowRequests: [],
        bounds: [],
      },
      { registry },
    );
    const registrySnapshot = registry.snapshot();
    const message = {
      transport: {
        mode: "shared-array-buffer",
        registry: registrySnapshot,
        diagnostics: [],
      },
    };

    transport.shared.writer.writeFrame({
      frame: 1,
      transforms: translatedIdentity(1),
      viewMatrices: new Float32Array(0),
      packetWords: encoded.words,
    });
    const first = readWebGpuAppSharedSnapshot(transport, message);
    const firstTransformX = first?.transforms[12];

    transport.shared.writer.writeFrame({
      frame: 2,
      transforms: translatedIdentity(2),
      viewMatrices: new Float32Array(0),
      packetWords: encoded.words,
    });
    const second = readWebGpuAppSharedSnapshot(transport, message);
    const secondTransformX = second?.transforms[12];

    transport.shared.writer.writeFrame({
      frame: 3,
      transforms: translatedIdentity(3),
      viewMatrices: new Float32Array(0),
      packetWords: encoded.words,
    });
    const third = readWebGpuAppSharedSnapshot(transport, message);
    const thirdTransformX = third?.transforms[12];

    expect(first?.frame).toBe(1);
    expect(second?.frame).toBe(2);
    expect(third?.frame).toBe(3);
    expect(second?.meshDraws).not.toBe(first?.meshDraws);
    expect(third?.meshDraws).toBe(first?.meshDraws);
    expect(firstTransformX).toBe(1);
    expect(secondTransformX).toBe(2);
    expect(thirdTransformX).toBe(3);
  });

  it("skips frames that outpace the registry message and reports the lag once decoded", () => {
    const transport = createWebGpuAppSnapshotTransport({
      mode: "shared-array-buffer",
      sharedSnapshotTransport: {
        maxEntities: 4,
        maxViews: 1,
        maxPacketWords: 256,
        requireCrossOriginIsolated: false,
      },
    });

    expect(transport.mode).toBe("shared-array-buffer");

    if (transport.mode !== "shared-array-buffer") {
      return;
    }

    const registry = createSnapshotPacketRegistry();
    const meshDraw = (material: ReturnType<typeof createMaterialHandle>) => ({
      renderId: 1,
      entity: { index: 1, generation: 0 },
      mesh: createMeshHandle("car"),
      material,
      submesh: 0,
      materialSlot: 0,
      worldTransformOffset: 0,
      boundsIndex: 0,
      layerMask: 1,
      sortKey: {
        queue: "opaque" as const,
        viewId: 0,
        layer: 0,
        order: 0,
        pipelineKey: "standard|opaque|back|less|none",
        materialKey: "material:paint",
        meshKey: "mesh:car",
        depth: 0,
        stableId: 1,
      },
      batchKey: {
        pipelineKey: "standard|opaque|back|less|none",
        materialKey: "material:paint",
        meshLayoutKey: "POSITION",
        topology: "triangle-list" as const,
        instanced: false,
        skinned: false,
        morphed: false,
      },
    });
    const emptyFamilies = {
      views: [],
      lights: [],
      environments: [],
      shadowRequests: [],
      bounds: [],
    };

    // Frame 1: encoded against registry v1, message carries the v1 snapshot.
    const firstEncoded = encodeSnapshotPackets(
      {
        ...emptyFamilies,
        meshDraws: [meshDraw(createMaterialHandle("paint"))],
      },
      { registry },
    );
    const staleMessage = {
      transport: {
        mode: "shared-array-buffer",
        registry: registry.snapshot(),
        diagnostics: [],
      },
    };
    transport.shared.writer.writeFrame({
      frame: 1,
      transforms: new Float32Array(0),
      viewMatrices: new Float32Array(0),
      packetWords: firstEncoded.words,
    });
    expect(readWebGpuAppSharedSnapshot(transport, staleMessage)?.frame).toBe(1);

    // Frame 2 interns a NEW handle and is published to the SharedArrayBuffer
    // before its registry message is delivered (the worker posts the frame
    // first). Reading with the stale v1 registry must skip the frame instead
    // of throwing "Unknown snapshot packet handle id".
    const secondEncoded = encodeSnapshotPackets(
      {
        ...emptyFamilies,
        meshDraws: [meshDraw(createMaterialHandle("chrome"))],
      },
      { registry },
    );
    transport.shared.writer.writeFrame({
      frame: 2,
      transforms: new Float32Array(0),
      viewMatrices: new Float32Array(0),
      packetWords: secondEncoded.words,
    });
    expect(readWebGpuAppSharedSnapshot(transport, staleMessage)).toBeNull();

    // The registry message arrives (the worker always posts on registry
    // growth): the frame decodes and the skip surfaces as a diagnostic.
    const freshMessage = {
      transport: {
        mode: "shared-array-buffer",
        registry: registry.snapshot(),
        diagnostics: [],
      },
    };
    const decoded = readWebGpuAppSharedSnapshot(transport, freshMessage);
    expect(decoded?.frame).toBe(2);
    expect(decoded?.diagnostics).toEqual([
      expect.objectContaining({
        code: "webGpuApp.sharedSnapshotRegistryLag",
        severity: "info",
        message: expect.stringContaining("Skipped 1 shared snapshot frame(s)"),
      }),
    ]);

    // The lag report is one-shot: the next read carries no stale diagnostic.
    const followUp = readWebGpuAppSharedSnapshot(transport, freshMessage);
    expect(followUp?.diagnostics).toEqual([]);
  });

  it("resets the registry cache when a worker restart starts a fresh epoch", () => {
    const transport = createWebGpuAppSnapshotTransport({
      mode: "shared-array-buffer",
      sharedSnapshotTransport: {
        maxEntities: 4,
        maxViews: 1,
        maxPacketWords: 256,
        requireCrossOriginIsolated: false,
      },
    });

    expect(transport.mode).toBe("shared-array-buffer");

    if (transport.mode !== "shared-array-buffer") {
      return;
    }

    const emptyFamilies = {
      views: [],
      lights: [],
      environments: [],
      shadowRequests: [],
      bounds: [],
    };
    const meshDraw = (
      mesh: ReturnType<typeof createMeshHandle>,
      material: ReturnType<typeof createMaterialHandle>,
      renderId: number,
    ) => ({
      renderId,
      entity: { index: renderId, generation: 0 },
      mesh,
      material,
      submesh: 0,
      materialSlot: 0,
      worldTransformOffset: 0,
      boundsIndex: 0,
      layerMask: 1,
      sortKey: {
        queue: "opaque" as const,
        viewId: 0,
        layer: 0,
        order: 0,
        pipelineKey: "standard|opaque|back|less|none",
        materialKey: "material:m",
        meshKey: "mesh:m",
        depth: 0,
        stableId: renderId,
      },
      batchKey: {
        pipelineKey: "standard|opaque|back|less|none",
        materialKey: "material:m",
        meshLayoutKey: "POSITION",
        topology: "triangle-list" as const,
        instanced: false,
        skinned: false,
        morphed: false,
      },
    });

    // First worker epoch interns FOUR handles.
    const firstRegistry = createSnapshotPacketRegistry();
    const firstEncoded = encodeSnapshotPackets(
      {
        ...emptyFamilies,
        meshDraws: [
          meshDraw(createMeshHandle("car"), createMaterialHandle("paint"), 1),
          meshDraw(createMeshHandle("tree"), createMaterialHandle("leaf"), 2),
        ],
      },
      { registry: firstRegistry },
    );
    transport.shared.writer.writeFrame({
      frame: 1,
      transforms: new Float32Array(0),
      viewMatrices: new Float32Array(0),
      packetWords: firstEncoded.words,
    });
    const firstMessage = {
      transport: {
        mode: "shared-array-buffer",
        registry: firstRegistry.snapshot(),
        diagnostics: [],
      },
    };
    expect(readWebGpuAppSharedSnapshot(transport, firstMessage)?.frame).toBe(1);

    // Worker restart: a FRESH registry interns different assets whose ids
    // overlap the first epoch's. Its snapshot is SMALLER than the cached one,
    // so a newest-by-count heuristic would keep the stale registry and decode
    // these packets into the WRONG assets without any error.
    const restartRegistry = createSnapshotPacketRegistry();
    const restartEncoded = encodeSnapshotPackets(
      {
        ...emptyFamilies,
        meshDraws: [
          meshDraw(createMeshHandle("rock"), createMaterialHandle("chrome"), 9),
        ],
      },
      { registry: restartRegistry },
    );
    transport.shared.writer.writeFrame({
      frame: 2,
      transforms: new Float32Array(0),
      viewMatrices: new Float32Array(0),
      packetWords: restartEncoded.words,
    });
    const restartMessage = {
      transport: {
        mode: "shared-array-buffer",
        registry: restartRegistry.snapshot(),
        diagnostics: [],
      },
    };

    const decoded = readWebGpuAppSharedSnapshot(transport, restartMessage);
    expect(decoded?.frame).toBe(2);
    // The handles must resolve against the NEW epoch's registry.
    expect(decoded?.meshDraws[0]?.mesh.id).toBe("rock");
    expect(decoded?.meshDraws[0]?.material?.id).toBe("chrome");
  });

  it("surfaces packet-buffer corruption as an error instead of skipping it", () => {
    const transport = createWebGpuAppSnapshotTransport({
      mode: "shared-array-buffer",
      sharedSnapshotTransport: {
        maxEntities: 1,
        maxViews: 1,
        maxPacketWords: 64,
        requireCrossOriginIsolated: false,
      },
    });

    expect(transport.mode).toBe("shared-array-buffer");

    if (transport.mode !== "shared-array-buffer") {
      return;
    }

    const registry = createSnapshotPacketRegistry();
    const message = {
      transport: {
        mode: "shared-array-buffer",
        registry: registry.snapshot(),
        diagnostics: [],
      },
    };

    // A packet buffer without its header is corruption, not registry lag: the
    // read must throw so the caller reports workerSnapshotRenderFailed rather
    // than silently skipping frames forever.
    transport.shared.writer.writeFrame({
      frame: 1,
      transforms: new Float32Array(0),
      viewMatrices: new Float32Array(0),
      packetWords: new Uint32Array(2),
    });
    expect(() => readWebGpuAppSharedSnapshot(transport, message)).toThrow(
      /header/u,
    );
  });

  it("reports a shared payload without rendering before the first complete frame", () => {
    const transport = createWebGpuAppSnapshotTransport({
      mode: "shared-array-buffer",
      sharedSnapshotTransport: {
        maxEntities: 1,
        maxViews: 1,
        maxPacketWords: 32,
        requireCrossOriginIsolated: false,
      },
    });
    const registry = createSnapshotPacketRegistry();
    const message = {
      transport: {
        mode: "shared-array-buffer",
        registry: registry.snapshot(),
        diagnostics: [],
      },
    };

    expect(hasWebGpuAppSharedSnapshotPayload(message)).toBe(true);
    expect(readWebGpuAppSharedSnapshot(transport, message)).toBeNull();
  });

  it("skips stale shared messages when the readable buffer has a newer frame", () => {
    const transport = createWebGpuAppSnapshotTransport({
      mode: "shared-array-buffer",
      sharedSnapshotTransport: {
        maxEntities: 1,
        maxViews: 1,
        maxPacketWords: 32,
        requireCrossOriginIsolated: false,
      },
    });

    expect(transport.mode).toBe("shared-array-buffer");

    if (transport.mode !== "shared-array-buffer") {
      return;
    }

    const registry = createSnapshotPacketRegistry();
    const encoded = encodeSnapshotPackets(
      {
        views: [],
        meshDraws: [],
        lights: [],
        environments: [],
        shadowRequests: [],
        bounds: [],
      },
      { registry },
    );

    transport.shared.writer.writeFrame({
      frame: 4,
      transforms: new Float32Array(0),
      viewMatrices: new Float32Array(0),
      packetWords: encoded.words,
    });

    expect(
      readWebGpuAppSharedSnapshot(transport, {
        frame: 3,
        snapshot: { frame: 3 },
        transport: {
          mode: "shared-array-buffer",
          registry: registry.snapshot(),
          diagnostics: [],
        },
      }),
    ).toBeNull();
    expect(
      readWebGpuAppSharedSnapshot(
        transport,
        {
          frame: 3,
          snapshot: { frame: 3 },
          transport: {
            mode: "shared-array-buffer",
            registry: registry.snapshot(),
            diagnostics: [],
          },
        },
        { requireMessageFrame: false },
      )?.frame,
    ).toBe(4);
    expect(
      readWebGpuAppSharedSnapshot(transport, {
        frame: 4,
        snapshot: { frame: 4 },
        transport: {
          mode: "shared-array-buffer",
          registry: registry.snapshot(),
          diagnostics: [],
        },
      })?.frame,
    ).toBe(4);
  });
});

function translatedIdentity(x: number): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, 0, 1]);
}
