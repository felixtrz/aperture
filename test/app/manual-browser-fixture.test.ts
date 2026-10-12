import { describe, expect, it } from "vitest";
import { createApertureDevtoolsRequest } from "@aperture-engine/app/commands";
import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import {
  mirrorSourceAssetRegistryFromMessage,
  readMirroredSourceAssetVersions,
} from "@aperture-engine/app/asset-mirror";
import { AssetRegistry } from "@aperture-engine/simulation";
import { SIMULATION_WORKER_PROTOCOL } from "@aperture-engine/runtime";
import config from "../fixtures/manual-browser-control/config.js";
import Scene from "../fixtures/manual-browser-control/scene.system.js";
import { TestGeneratedWorkerPort } from "../helpers/generated-worker-port.js";

describe("native manual browser fixture CPU authoring", () => {
  it("boots its real browser config and publishes unchanged then revised source assets from the normal generated worker", async () => {
    const port = new TestGeneratedWorkerPort();
    startGeneratedSimulationWorker({
      config,
      systems: [{ default: Scene }],
      port,
    });
    port.dispatch({
      type: SIMULATION_WORKER_PROTOCOL.start,
      options: { simulationPaused: true, apertureManualFrameControl: true },
    });
    await port.nextPostedMessage(
      (message) =>
        (message as { type?: string }).type ===
        SIMULATION_WORKER_PROTOCOL.ready,
    );
    expect(port.posted).toHaveLength(1);
    const mirror = new AssetRegistry();
    for (const frame of [0, 1, 2]) {
      if (frame === 2)
        port.dispatch(
          createApertureDevtoolsRequest({
            requestId: "edit-source",
            tool: "resource_set",
            payload: {
              id: "validation.manual.revision",
              values: { revision: 1 },
            },
          }),
        );
      port.dispatch(
        createApertureDevtoolsRequest({
          requestId: `frame-${frame}`,
          tool: "ecs_step",
          payload: {
            delta: 0,
            time: 0,
            sourceAssetVersions: readMirroredSourceAssetVersions(mirror),
          },
        }),
      );
      const response = await port.nextPostedMessage(
        (message) =>
          (message as { requestId?: string }).requestId === `frame-${frame}`,
      );
      expect(response).toMatchObject({
        ok: true,
        result: { snapshotFrame: frame, frame: frame + 1 },
      });
      const snapshot = port.posted.find(
        (message) =>
          (message as { controlledFrameRequestId?: string })
            .controlledFrameRequestId === `frame-${frame}`,
      );
      expect(snapshot).toMatchObject({
        snapshot: { frame, report: { meshDraws: 2, views: 1 } },
      });
      if (frame === 1) expect(snapshot).not.toHaveProperty("sourceAssets");
      mirrorSourceAssetRegistryFromMessage(mirror, snapshot);
    }
    expect(readMirroredSourceAssetVersions(mirror)).toContainEqual([
      "mesh:prop.mesh",
      2,
    ]);
    expect(readMirroredSourceAssetVersions(mirror)).toContainEqual([
      "material:prop.material",
      2,
    ]);
  });
});
