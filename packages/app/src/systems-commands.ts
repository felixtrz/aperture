import type {
  SystemAssetAccess,
  SystemAssetHandle,
  SystemAssetKind,
} from "./systems.js";
import { jsonSafeValue } from "./systems-json.js";

export interface CommandAccess {
  requestAsset(
    idOrHandle: string | SystemAssetHandle<SystemAssetKind>,
  ): Promise<void>;
  queue<TCommand>(channel: string, payload: TCommand): void;
  drain<TCommand = unknown>(channel: string): TCommand[];
  summary(): CommandAccessSummary;
}

export interface CommandAccessSummary {
  readonly enqueued: number;
  readonly drained: number;
  readonly queuedByChannel: Readonly<Record<string, number>>;
  readonly lastQueued: CommandChannelEntry | null;
  readonly lastDrained: CommandChannelEntry | null;
  readonly requestedAssets: readonly CommandAssetRequestSummary[];
}

export interface CommandChannelEntry {
  readonly channel: string;
  readonly payload: unknown;
}

export interface CommandAssetRequestSummary {
  readonly id: string;
  readonly status: "pending" | "ready" | "error";
  readonly ready: boolean;
  readonly errorCode?: string;
  readonly message?: string;
}

export function createCommandAccess(assets: SystemAssetAccess): CommandAccess {
  const queues = new Map<string, unknown[]>();
  const assetRequests = new Map<string, CommandAssetRequestSummary>();
  let enqueued = 0;
  let drained = 0;
  let lastQueued: CommandChannelEntry | null = null;
  let lastDrained: CommandChannelEntry | null = null;

  return {
    async requestAsset(idOrHandle) {
      const id = typeof idOrHandle === "string" ? idOrHandle : idOrHandle.id;

      assetRequests.set(id, {
        id,
        status: "pending",
        ready: readinessValue(assets, id),
      });

      try {
        await assets.request(idOrHandle);
        assetRequests.set(id, {
          id,
          status: "ready",
          ready: readinessValue(assets, id),
        });
      } catch (error: unknown) {
        assetRequests.set(id, {
          id,
          status: "error",
          ready: readinessValue(assets, id),
          message: error instanceof Error ? error.message : String(error),
          ...errorCode(error),
        });
        throw error;
      }
    },
    queue(channel, payload) {
      const current = queues.get(channel) ?? [];
      current.push(payload);
      queues.set(channel, current);
      enqueued += 1;
      lastQueued = {
        channel,
        payload: jsonSafeValue(payload),
      };
    },
    drain<TCommand = unknown>(channel: string): TCommand[] {
      const current = queues.get(channel) ?? [];
      queues.set(channel, []);
      drained += current.length;
      if (current.length > 0) {
        lastDrained = {
          channel,
          payload: jsonSafeValue(current[current.length - 1]),
        };
      }
      return current as TCommand[];
    },
    summary() {
      return {
        enqueued,
        drained,
        queuedByChannel: Object.fromEntries(
          [...queues.entries()].map(([channel, values]) => [
            channel,
            values.length,
          ]),
        ),
        lastQueued,
        lastDrained,
        requestedAssets: [...assetRequests.values()],
      };
    },
  };
}

function readinessValue(assets: SystemAssetAccess, id: string): boolean {
  try {
    return assets.readiness(id).value;
  } catch {
    return false;
  }
}

function errorCode(error: unknown): { readonly errorCode?: string } {
  return typeof error === "object" &&
    error !== null &&
    typeof (error as { readonly code?: unknown }).code === "string"
    ? { errorCode: (error as { readonly code: string }).code }
    : {};
}
