import {
  SIMULATION_WORKER_PROTOCOL,
  createSharedSnapshotTransportViews,
  renderSnapshotTransferList,
  type SimulationMessagePort,
  type SharedSnapshotTransport,
  type SharedSnapshotTransportBuffers,
} from "@aperture-engine/runtime";
import {
  createSnapshotPacketRegistry,
  encodeSnapshotPackets,
  type RenderSnapshot,
  type SnapshotPacketEncodingRegistry,
} from "@aperture-engine/render";
import {
  serializeSourceAssetRegistry,
  type SourceAssetSerializationState,
} from "../asset-mirror.js";
import type { ApertureConfig } from "../config.js";
import { createApertureEntityLookupSnapshot } from "../entity-lookup.js";
import {
  advanceGeneratedInputFrame,
  createInputSummary,
  type ApertureGeneratedInputEventMessage,
} from "../input.js";
import { createSignalSummary } from "../systems.js";
import type { ApertureApp } from "../advanced.js";
import { createAssetSummary } from "./assets.js";
import type { GeneratedEntityToolBridge } from "./devtools/entities.js";

export interface GeneratedWorkerSnapshotPublishReport {
  readonly nextFrame: number;
  readonly step: ReturnType<ApertureApp["step"]>;
}

export type GeneratedWorkerSnapshotTransport =
  | {
      readonly mode: "transferable";
    }
  | {
      readonly mode: "shared-array-buffer";
      readonly shared: SharedSnapshotTransport;
      readonly registry: SnapshotPacketEncodingRegistry;
    };

export function createGeneratedWorkerSnapshotTransport(
  start: Record<string, unknown>,
): GeneratedWorkerSnapshotTransport {
  const transport = readSharedSnapshotTransportBuffers(start["transport"]);

  if (transport === null) {
    return { mode: "transferable" };
  }

  return {
    mode: "shared-array-buffer",
    shared: createSharedSnapshotTransportViews(transport),
    registry: createSnapshotPacketRegistry(),
  };
}

export function publishGeneratedWorkerSnapshot(options: {
  readonly app: ApertureApp;
  readonly config: ApertureConfig;
  readonly port: SimulationMessagePort;
  readonly transport: GeneratedWorkerSnapshotTransport;
  readonly pendingInput: ApertureGeneratedInputEventMessage[];
  readonly sourceAssetState: SourceAssetSerializationState;
  readonly entityTools: GeneratedEntityToolBridge;
  readonly delta: number;
  readonly time: number;
  readonly frame: number;
}): GeneratedWorkerSnapshotPublishReport {
  advanceGeneratedInputFrame({
    signals: options.app.context.input,
    config: options.config,
    events: options.pendingInput.splice(0).map((message) => message.event),
  });
  const step = options.app.step(options.delta, options.time);
  const snapshot = options.app.extract(options.frame);
  const sourceAssets = serializeSourceAssetRegistry(
    options.app.lowLevel.assets,
    {
      state: options.sourceAssetState,
    },
  );
  // The source-asset registry is version-gated, so steady-state frames produce
  // zero entries. Only attach the field when something actually changed —
  // mirrorSourceAssetRegistryFromMessage treats an absent field as a no-op, so
  // this drops a per-frame postMessage payload on both transport paths (AI-70).
  const sourceAssetsMessage =
    sourceAssets.entries.length > 0 ? { sourceAssets } : {};
  const workerSummary = {
    signals: createSignalSummary(options.app.context.signals),
    input: createInputSummary(options.app.context.input),
    assets: createAssetSummary(options.app.context.assets.list()),
    commands: options.app.context.commands.summary(),
    diagnostics: options.app.context.diagnostics.list(),
    physics: options.app.context.physics.summary(),
    entities: createApertureEntityLookupSnapshot(options.app.lowLevel.world, {
      label: "generated-worker",
    }),
    entityTools: options.entityTools.summary(),
  };
  const sharedSnapshot = createSharedSnapshotMessage(
    options.transport,
    snapshot,
  );

  if (sharedSnapshot !== null) {
    options.port.postMessage({
      type: SIMULATION_WORKER_PROTOCOL.snapshot,
      snapshot: createSharedSnapshotPlaceholder(snapshot.frame),
      ...sourceAssetsMessage,
      workerSummary,
      frame: options.frame,
      transport: sharedSnapshot,
    });
  } else {
    options.port.postMessage(
      {
        type: SIMULATION_WORKER_PROTOCOL.snapshot,
        snapshot,
        ...sourceAssetsMessage,
        workerSummary,
        frame: options.frame,
      },
      renderSnapshotTransferList(snapshot),
    );
  }

  return {
    nextFrame: options.frame + 1,
    step,
  };
}

function createSharedSnapshotMessage(
  transport: GeneratedWorkerSnapshotTransport,
  snapshot: RenderSnapshot,
): {
  readonly mode: "shared-array-buffer";
  readonly registry: ReturnType<SnapshotPacketEncodingRegistry["snapshot"]>;
  readonly diagnostics: RenderSnapshot["diagnostics"];
} | null {
  if (
    transport.mode !== "shared-array-buffer" ||
    hasUnsupportedSharedSnapshotPayload(snapshot)
  ) {
    return null;
  }

  try {
    const encoded = encodeSnapshotPackets(snapshot, {
      registry: transport.registry,
    });

    transport.shared.writer.writeFrame({
      frame: snapshot.frame,
      transforms: snapshot.transforms,
      ...(snapshot.instanceTints === undefined
        ? {}
        : { instanceTints: snapshot.instanceTints }),
      viewMatrices: snapshot.viewMatrices,
      ...(snapshot.quads === undefined
        ? {}
        : {
            quadInstanceFloats: snapshot.quads.instanceFloats,
            quadInstanceWords: snapshot.quads.instanceWords,
          }),
      packetWords: encoded.words,
    });

    return {
      mode: "shared-array-buffer",
      registry: transport.registry.snapshot(),
      diagnostics: snapshot.diagnostics,
    };
  } catch (error) {
    if (error instanceof RangeError) {
      return null;
    }

    throw error;
  }
}

function hasUnsupportedSharedSnapshotPayload(
  snapshot: RenderSnapshot,
): boolean {
  return (
    hasItems(snapshot.spriteDraws) ||
    hasItems(snapshot.particleEmitters) ||
    hasItems(snapshot.uiNodes) ||
    hasItems(snapshot.uiHitRegions) ||
    hasItems(snapshot.skyboxes) ||
    hasItems(snapshot.fogs) ||
    hasItems(snapshot.instanceAttributePackets) ||
    hasBytes(snapshot.bones) ||
    hasBytes(snapshot.morphTargetWeights) ||
    hasBytes(snapshot.morphTargetDeltas) ||
    hasBytes(snapshot.morphInstanceDescriptors) ||
    hasBytes(snapshot.instanceAttributes)
  );
}

function createSharedSnapshotPlaceholder(frame: number): RenderSnapshot {
  return {
    frame,
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
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
  };
}

function readSharedSnapshotTransportBuffers(
  value: unknown,
):
  | (SharedSnapshotTransportBuffers & { readonly mode: "shared-array-buffer" })
  | null {
  if (!isRecord(value) || value["mode"] !== "shared-array-buffer") {
    return null;
  }

  return value as unknown as SharedSnapshotTransportBuffers & {
    readonly mode: "shared-array-buffer";
  };
}

function hasItems(value: readonly unknown[] | undefined): boolean {
  return value !== undefined && value.length > 0;
}

function hasBytes(value: ArrayBufferView | undefined): boolean {
  return value !== undefined && value.byteLength > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
