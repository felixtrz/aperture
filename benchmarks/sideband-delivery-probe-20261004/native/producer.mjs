import {
  createSharedSnapshotTransportViews,
  SIMULATION_WORKER_PROTOCOL,
} from "/worker-modules/packages/runtime/dist/index.js";
import {
  createSnapshotPacketRegistry,
  encodeSnapshotPackets,
} from "/worker-modules/packages/render/dist/index.js";
import {
  createSourceAssetSerializationState,
  serializeSourceAssetRegistry,
  commitSerializedSourceAssets,
} from "/worker-modules/packages/app/dist/asset-mirror.js";
import { createProbeScene } from "./scene.mjs";
import { requireValue, jsonValue, meshBytes } from "./contract.mjs";
const empty = (frame) => ({
  frame,
  views: [],
  meshDraws: [],
  lights: [],
  environments: [],
  shadowRequests: [],
  bounds: [],
  transforms: new Float32Array(),
  viewMatrices: new Float32Array(),
  diagnostics: [],
  report: {
    views: 0,
    meshDraws: 0,
    lights: 0,
    environments: 0,
    shadowRequests: 0,
    bounds: 0,
    diagnostics: 0,
  },
});
export function createProducer(port, options) {
  const scene = createProbeScene(options.probeSession === "cold-changed");
  const shared = createSharedSnapshotTransportViews(options.transport);
  const registry = createSnapshotPacketRegistry();
  const serial = createSourceAssetSerializationState();
  let frame = 0,
    changed = options.probeSession === "cold-changed";
  const state = () => ({
    frame,
    sourceVersion: scene.app.assets.get(scene.mesh).version,
    mesh: jsonValue(scene.mesh),
    asset: meshBytes(scene.app.assets.get(scene.mesh).asset),
    expected: { baseline: scene.baseline, changed: scene.changed },
  });
  function command(message) {
    requireValue(
      message.type === "sideband.probe.command",
      "Unexpected producer command",
    );
    if (message.operation === "publish") {
      requireValue(
        Number.isInteger(message.frame) &&
          message.frame > frame &&
          message.frame <= 3,
        "Nonmonotonic/out-of-bounds frame",
      );
      if (message.change) {
        requireValue(!changed, "Repeated change");
        scene.change();
        changed = true;
      }
      frame = message.frame;
      const snapshot = scene.app.stepAndExtract(1 / 60, frame, frame);
      requireValue(snapshot.meshDraws.length === 1, "Expected one mesh");
      const encoded = encodeSnapshotPackets(snapshot, { registry });
      shared.writer.writeFrame({
        frame,
        transforms: snapshot.transforms,
        viewMatrices: snapshot.viewMatrices,
        packetWords: encoded.words,
      });
    } else if (message.operation === "notify") {
      requireValue(
        frame > 0 && ["snapshot", "sourceAssets"].includes(message.kind),
        "Unexpected notification",
      );
      const sourceAssets = serializeSourceAssetRegistry(scene.app.assets, {
        state: serial,
      });
      const outgoing = {
        type: SIMULATION_WORKER_PROTOCOL[message.kind],
        frame,
        sourceAssets,
        ...(message.kind === "snapshot"
          ? {
              snapshot: empty(frame),
              transport: {
                mode: "shared-array-buffer",
                registry: registry.snapshot(),
              },
            }
          : {}),
        postMessageDecision: {
          postedMessage: message.kind,
          postMessageReasons: ["sourceAssetsChanged"],
        },
      };
      port.postMessage(outgoing);
      commitSerializedSourceAssets(serial, sourceAssets);
    } else throw Error("Unknown operation");
    port.postMessage({
      type: "sideband.probe.ack",
      requestId: message.requestId,
      operation: message.operation,
      state: state(),
    });
  }
  return { command, state };
}
