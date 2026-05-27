import {
  BOUNDS_PACKET_WORDS,
  ENVIRONMENT_PACKET_WORDS,
  LIGHT_PACKET_WORDS,
  MESH_DRAW_PACKET_WORDS,
  SHADOW_REQUEST_PACKET_WORDS,
  SNAPSHOT_PACKET_HEADER_WORDS,
  VIEW_PACKET_WORDS,
  createSnapshotPacketRegistry,
  decodeSnapshotPackets,
  type RenderDiagnostic,
  type RenderSnapshot,
  type RenderSnapshotChangeSet,
  type RenderSnapshotFamilyChangeCounts,
  type SnapshotPacketRegistrySnapshot,
} from "@aperture-engine/render";
import {
  SharedSnapshotTransportUnsupportedError,
  createSharedSnapshotTransport,
  type CreateSharedSnapshotTransportOptions,
  type SharedSnapshotTransport,
  type SharedSnapshotTransportLayout,
  type SharedSnapshotTransportUnsupportedReason,
} from "@aperture-engine/runtime";

export type WebGpuAppSnapshotTransportMode =
  | "transferable"
  | "shared-array-buffer";

export interface WebGpuAppSharedSnapshotTransportOptions extends Partial<CreateSharedSnapshotTransportOptions> {
  readonly maxEntities?: number;
  readonly maxViews?: number;
}

export interface WebGpuAppSnapshotTransportUnsupportedDiagnostic {
  readonly code: "webGpuApp.sharedSnapshotTransportUnsupported";
  readonly reason: SharedSnapshotTransportUnsupportedReason;
  readonly message: string;
}

export interface WebGpuAppSnapshotTransportDiagnostics {
  readonly requested: WebGpuAppSnapshotTransportMode;
  readonly active: WebGpuAppSnapshotTransportMode;
  readonly fallback: "transferable" | null;
  readonly sharedArrayBuffer:
    | {
        readonly supported: true;
        readonly layout: SharedSnapshotTransportLayout;
      }
    | {
        readonly supported: false;
        readonly diagnostic: WebGpuAppSnapshotTransportUnsupportedDiagnostic;
      }
    | null;
}

export type WebGpuAppSnapshotTransport =
  | {
      readonly mode: "transferable";
      readonly diagnostics: WebGpuAppSnapshotTransportDiagnostics;
    }
  | {
      readonly mode: "shared-array-buffer";
      readonly shared: SharedSnapshotTransport;
      readonly diagnostics: WebGpuAppSnapshotTransportDiagnostics;
    };

export interface WebGpuAppSnapshotTransportStartPayload {
  readonly mode: "shared-array-buffer";
  readonly layout: SharedSnapshotTransportLayout;
  readonly headerBuffer: SharedArrayBuffer;
  readonly transformBuffer: SharedArrayBuffer;
  readonly instanceTintBuffer: SharedArrayBuffer;
  readonly viewMatrixBuffer: SharedArrayBuffer;
  readonly packetBuffer: SharedArrayBuffer;
}

export interface WebGpuAppSharedSnapshotFramePayload {
  readonly mode: "shared-array-buffer";
  readonly registry: SnapshotPacketRegistrySnapshot;
  readonly diagnostics?: readonly RenderDiagnostic[];
}

export function createWebGpuAppSnapshotTransport(options: {
  readonly mode?: WebGpuAppSnapshotTransportMode;
  readonly sharedSnapshotTransport?: WebGpuAppSharedSnapshotTransportOptions;
}): WebGpuAppSnapshotTransport {
  const requested = options.mode ?? "transferable";

  if (requested !== "shared-array-buffer") {
    return {
      mode: "transferable",
      diagnostics: {
        requested,
        active: "transferable",
        fallback: null,
        sharedArrayBuffer: null,
      },
    };
  }

  try {
    const shared = createSharedSnapshotTransport(
      createSharedSnapshotTransportOptions(options.sharedSnapshotTransport),
    );

    return {
      mode: "shared-array-buffer",
      shared,
      diagnostics: {
        requested,
        active: "shared-array-buffer",
        fallback: null,
        sharedArrayBuffer: {
          supported: true,
          layout: shared.layout,
        },
      },
    };
  } catch (error) {
    if (error instanceof SharedSnapshotTransportUnsupportedError) {
      return {
        mode: "transferable",
        diagnostics: {
          requested,
          active: "transferable",
          fallback: "transferable",
          sharedArrayBuffer: {
            supported: false,
            diagnostic: {
              code: "webGpuApp.sharedSnapshotTransportUnsupported",
              reason: error.reason,
              message: error.message,
            },
          },
        },
      };
    }

    throw error;
  }
}

export function createWebGpuAppSnapshotTransportStartPayload(
  transport: WebGpuAppSnapshotTransport,
): WebGpuAppSnapshotTransportStartPayload | null {
  if (transport.mode !== "shared-array-buffer") {
    return null;
  }

  return {
    mode: "shared-array-buffer",
    layout: transport.shared.layout,
    headerBuffer: transport.shared.headerBuffer,
    transformBuffer: transport.shared.transformBuffer,
    instanceTintBuffer: transport.shared.instanceTintBuffer,
    viewMatrixBuffer: transport.shared.viewMatrixBuffer,
    packetBuffer: transport.shared.packetBuffer,
  };
}

export function readWebGpuAppSharedSnapshot(
  transport: WebGpuAppSnapshotTransport,
  message: unknown,
): RenderSnapshot | null {
  if (transport.mode !== "shared-array-buffer") {
    return null;
  }

  const payload = readSharedSnapshotFramePayload(message);

  if (payload === null) {
    return null;
  }

  const frame = transport.shared.reader.readLatestFrame();

  if (frame === null) {
    throw new Error(
      "SharedArrayBuffer snapshot event arrived before a complete frame was published.",
    );
  }

  const registry = createSnapshotPacketRegistry(payload.registry);
  const packets = decodeSnapshotPackets(frame.packetWords, registry);
  const diagnostics = payload.diagnostics ?? [];

  return {
    frame: frame.frame,
    views: packets.views,
    meshDraws: packets.meshDraws,
    lights: packets.lights,
    environments: packets.environments,
    shadowRequests: packets.shadowRequests,
    bounds: packets.bounds,
    transforms: frame.transforms,
    ...(frame.instanceTints.length === 0
      ? {}
      : { instanceTints: frame.instanceTints }),
    viewMatrices: frame.viewMatrices,
    diagnostics,
    report: {
      views: packets.views.length,
      meshDraws: packets.meshDraws.length,
      lights: packets.lights.length,
      environments: packets.environments.length,
      shadowRequests: packets.shadowRequests.length,
      bounds: packets.bounds.length,
      diagnostics: diagnostics.length,
    },
  };
}

export function readWebGpuAppSnapshotChangeSet(
  message: unknown,
): RenderSnapshotChangeSet | null {
  if (!isRecord(message)) {
    return null;
  }

  const topLevel = message.changeSet;

  if (isRenderSnapshotChangeSet(topLevel)) {
    return topLevel;
  }

  const transport = message.transport;
  const transportChangeSet = isRecord(transport)
    ? transport.changeSet
    : undefined;

  return isRenderSnapshotChangeSet(transportChangeSet)
    ? transportChangeSet
    : null;
}

export function estimateSharedSnapshotTransportReduction(input: {
  readonly snapshot: Pick<
    RenderSnapshot,
    "transforms" | "viewMatrices" | "bones" | "instanceTints"
  >;
  readonly packetByteLength: number;
}): {
  readonly transferableBytes: number;
  readonly sharedArrayBufferPerFrameBytes: number;
  readonly reductionRatio: number;
} {
  const transferableBytes =
    input.snapshot.transforms.byteLength +
    input.snapshot.viewMatrices.byteLength +
    (input.snapshot.bones?.byteLength ?? 0) +
    (input.snapshot.instanceTints?.byteLength ?? 0) +
    input.packetByteLength;

  return {
    transferableBytes,
    sharedArrayBufferPerFrameBytes: 0,
    reductionRatio: transferableBytes === 0 ? 0 : 1,
  };
}

function createSharedSnapshotTransportOptions(
  options: WebGpuAppSharedSnapshotTransportOptions = {},
): CreateSharedSnapshotTransportOptions {
  const maxEntities = options.maxEntities ?? 16_384;
  const maxViews = options.maxViews ?? 8;
  const maxInstanceTints = options.maxInstanceTints ?? maxEntities;
  const maxPacketWords =
    options.maxPacketWords ??
    defaultSharedSnapshotPacketWords({
      maxEntities,
      maxViews,
    });

  return {
    maxEntities,
    maxViews,
    maxInstanceTints,
    maxPacketWords,
    ...(options.requireCrossOriginIsolated === undefined
      ? {}
      : { requireCrossOriginIsolated: options.requireCrossOriginIsolated }),
    ...(options.crossOriginIsolated === undefined
      ? {}
      : { crossOriginIsolated: options.crossOriginIsolated }),
    ...(options.sharedArrayBufferConstructor === undefined
      ? {}
      : {
          sharedArrayBufferConstructor:
            options.sharedArrayBufferConstructor ?? null,
        }),
  };
}

function defaultSharedSnapshotPacketWords(input: {
  readonly maxEntities: number;
  readonly maxViews: number;
}): number {
  const maxLights = 64;
  const maxEnvironments = 16;
  const maxShadowRequests = 64;

  return (
    SNAPSHOT_PACKET_HEADER_WORDS +
    input.maxViews * VIEW_PACKET_WORDS +
    input.maxEntities * MESH_DRAW_PACKET_WORDS +
    maxLights * LIGHT_PACKET_WORDS +
    maxEnvironments * ENVIRONMENT_PACKET_WORDS +
    maxShadowRequests * SHADOW_REQUEST_PACKET_WORDS +
    input.maxEntities * BOUNDS_PACKET_WORDS
  );
}

function readSharedSnapshotFramePayload(
  message: unknown,
): WebGpuAppSharedSnapshotFramePayload | null {
  if (!isRecord(message)) {
    return null;
  }

  const transport = message.transport;

  if (!isRecord(transport) || transport.mode !== "shared-array-buffer") {
    return null;
  }

  if (!isRegistrySnapshot(transport.registry)) {
    throw new Error(
      "SharedArrayBuffer snapshot event is missing a packet registry snapshot.",
    );
  }

  return {
    mode: "shared-array-buffer",
    registry: transport.registry,
    ...(Array.isArray(transport.diagnostics)
      ? { diagnostics: transport.diagnostics as readonly RenderDiagnostic[] }
      : {}),
  };
}

function isRegistrySnapshot(
  value: unknown,
): value is SnapshotPacketRegistrySnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return Array.isArray(value.strings) && Array.isArray(value.handles);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRenderSnapshotChangeSet(
  value: unknown,
): value is RenderSnapshotChangeSet {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.previousFrame === null || Number.isInteger(value.previousFrame)) &&
    Number.isInteger(value.frame) &&
    isFamilyCounts(value.views) &&
    isFamilyCounts(value.meshDraws) &&
    isFamilyCounts(value.lights) &&
    isFamilyCounts(value.environments) &&
    isFamilyCounts(value.shadowRequests) &&
    isFamilyCounts(value.bounds) &&
    isFamilyCounts(value.total)
  );
}

function isFamilyCounts(
  value: unknown,
): value is RenderSnapshotFamilyChangeCounts {
  return (
    isRecord(value) &&
    Number.isInteger(value.changed) &&
    Number.isInteger(value.unchanged) &&
    Number.isInteger(value.removed)
  );
}
