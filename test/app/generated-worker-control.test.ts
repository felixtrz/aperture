import { describe, expect, it } from "vitest";
import { createApertureDevtoolsRequest } from "@aperture-engine/app/commands";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem } from "@aperture-engine/app/systems";
import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import {
  mirrorSourceAssetRegistryFromMessage,
  readMirroredSourceAssetVersions,
} from "@aperture-engine/app/asset-mirror";
import { createPlaneMeshAsset } from "@aperture-engine/render";
import { AssetRegistry, createMeshHandle } from "@aperture-engine/simulation";
import {
  SIMULATION_WORKER_PROTOCOL,
  createSharedSnapshotTransport,
} from "@aperture-engine/runtime";
import { TestGeneratedWorkerPort } from "../helpers/generated-worker-port.js";

const Base = createSystem();
class ControlAssetSystem extends Base {
  override init(): void {
    const mesh = createMeshHandle("controlled.worker.source");
    this.assetsRegistry.register(mesh);
    this.assetsRegistry.markReady(
      mesh,
      createPlaneMeshAsset({ label: "Worker source" }),
    );
  }
}

class CloningPort extends TestGeneratedWorkerPort {
  override postMessage(message: unknown): void {
    super.postMessage(structuredClone(message));
  }
}

const hasType =
  (type: string) =>
  (message: unknown): boolean =>
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === type;
const hasRequest =
  (id: string) =>
  (message: unknown): boolean =>
    typeof message === "object" &&
    message !== null &&
    (message as { requestId?: unknown }).requestId === id;

describe("controlled generated worker protocol", () => {
  it.each(["transferable", "shared-array-buffer"] as const)(
    "publishes actual frame identity and accepted-version deltas over %s",
    async (mode) => {
      const port = new CloningPort();
      const shared = createSharedSnapshotTransport({
        maxEntities: 4,
        maxViews: 1,
        maxPacketWords: 128,
        requireCrossOriginIsolated: false,
      });
      startGeneratedSimulationWorker({
        config: defineApertureConfig({ mode: "headless", systems: [] }),
        systems: [{ default: ControlAssetSystem }],
        port,
      });
      port.dispatch({
        type: SIMULATION_WORKER_PROTOCOL.start,
        options: {
          simulationPaused: true,
          apertureManualFrameControl: true,
          ...(mode === "transferable"
            ? {}
            : {
                transport: {
                  mode,
                  layout: shared.layout,
                  headerBuffer: shared.headerBuffer,
                  transformBuffer: shared.transformBuffer,
                  instanceTintBuffer: shared.instanceTintBuffer,
                  viewMatrixBuffer: shared.viewMatrixBuffer,
                  quadInstanceFloatBuffer: shared.quadInstanceFloatBuffer,
                  quadInstanceWordBuffer: shared.quadInstanceWordBuffer,
                  packetBuffer: shared.packetBuffer,
                },
              }),
        },
      });
      await port.nextPostedMessage(hasType(SIMULATION_WORKER_PROTOCOL.ready));
      expect(
        port.posted.filter(hasType(SIMULATION_WORKER_PROTOCOL.snapshot)),
      ).toEqual([]);
      const mirror = new AssetRegistry();
      for (const frame of [0, 1]) {
        const requestId = `frame-${frame}`;
        port.dispatch(
          createApertureDevtoolsRequest({
            requestId,
            tool: "ecs_step",
            payload: {
              delta: 0,
              time: 0,
              sourceAssetVersions: readMirroredSourceAssetVersions(mirror),
            },
          }),
        );
        const response = await port.nextPostedMessage(hasRequest(requestId));
        expect(response).toMatchObject({
          ok: true,
          result: { snapshotFrame: frame, frame: frame + 1 },
        });
        const publication = port.posted.find(
          (message) =>
            (message as { controlledFrameRequestId?: unknown })
              .controlledFrameRequestId === requestId,
        );
        expect(publication).toMatchObject({ frame, snapshot: { frame } });
        if (mode === "shared-array-buffer") {
          expect(publication).toMatchObject({
            transport: { sequence: shared.reader.readLatestFrame()!.sequence },
          });
        }
        if (frame === 0) {
          expect(publication).toMatchObject({
            sourceAssets: {
              entries: expect.arrayContaining([
                expect.objectContaining({
                  version: 1,
                  asset: expect.objectContaining({ label: "Worker source" }),
                }),
              ]),
            },
          });
          expect(
            mirrorSourceAssetRegistryFromMessage(mirror, publication).mirrored,
          ).toBeGreaterThanOrEqual(1);
        } else {
          expect(publication).not.toHaveProperty("sourceAssets");
        }
      }
      port.dispatch(
        createApertureDevtoolsRequest({
          requestId: "bad-ack",
          tool: "ecs_step",
          payload: { sourceAssetVersions: [["mesh:invalid", Number.NaN]] },
        }),
      );
      expect(await port.nextPostedMessage(hasRequest("bad-ack"))).toMatchObject(
        {
          ok: false,
          diagnostics: [
            {
              message:
                "Controlled source asset acknowledgements must be bounded handle/version pairs.",
            },
          ],
        },
      );
    },
  );
});
