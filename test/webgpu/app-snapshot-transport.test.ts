import { describe, expect, it } from "vitest";
import {
  createQuadSnapshotBuffers,
  createSnapshotPacketRegistry,
  encodeSnapshotPackets,
  FogMode,
  type SnapshotPacketBundle,
} from "@aperture-engine/render";
import {
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
        maxPacketWords: 192,
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
            count: 16,
            position: [1, 2, 3],
            positionJitterMin: [-0.5, 0, -0.5],
            positionJitterMax: [0.5, 1, 0.5],
            velocityMin: [0, 1, 0],
            velocityMax: [1, 2, 1],
          },
        },
      ],
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
    expect(snapshot?.quads?.instanceFloats).toEqual(sourceQuads.instanceFloats);
    expect(snapshot?.quads?.instanceWords).toEqual(sourceQuads.instanceWords);
    expect(snapshot?.quadBatches).toEqual(packetBundle.quadBatches);
    expect(snapshot?.fogs).toEqual(packetBundle.fogs);
    expect(snapshot?.particleEmitters).toEqual(packetBundle.particleEmitters);
    expect(snapshot?.shadowCasterDraws).toEqual(packetBundle.shadowCasterDraws);
    expect(snapshot?.report).toMatchObject({
      fogs: 1,
      particleEmitters: 1,
      shadowCasterDraws: 1,
      quadInstances: 1,
      quadBatches: 1,
    });
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
