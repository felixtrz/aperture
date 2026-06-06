import { describe, expect, it } from "vitest";
import {
  createQuadSnapshotBuffers,
  createSnapshotPacketRegistry,
  encodeSnapshotPackets,
  type SnapshotPacketBundle,
} from "@aperture-engine/render";
import {
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";
import {
  createWebGpuAppSnapshotTransport,
  readWebGpuAppSharedSnapshot,
} from "@aperture-engine/webgpu/test-support";

describe("WebGPU app snapshot transport", () => {
  it("reconstructs shared quad buffers and quad batch packets", () => {
    const transport = createWebGpuAppSnapshotTransport({
      mode: "shared-array-buffer",
      sharedSnapshotTransport: {
        maxEntities: 1,
        maxViews: 1,
        maxQuadInstances: 1,
        maxPacketWords: 128,
        requireCrossOriginIsolated: false,
      },
    });

    expect(transport.mode).toBe("shared-array-buffer");

    if (transport.mode !== "shared-array-buffer") {
      return;
    }

    const registry = createSnapshotPacketRegistry();
    const packetBundle: SnapshotPacketBundle = {
      views: [],
      meshDraws: [],
      lights: [],
      environments: [],
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
    expect(snapshot?.report).toMatchObject({
      quadInstances: 1,
      quadBatches: 1,
    });
  });
});
