import { ApertureCliError } from "../errors.js";
import type { ApertureGeneratedDiagnostic } from "@aperture-engine/app/diagnostics";
import type { ApertureSessionSnapshot } from "@aperture-engine/app/headless";
import type { HeadlessSessionControllerFromConfigOptions } from "./session-controller.js";

export const HEADLESS_REALM_PROTOCOL = "aperture.headless-realm.v1";
export const DEFAULT_REALM_REQUEST_TIMEOUT_MS = 60_000;
export const DEFAULT_REALM_BOOT_TIMEOUT_MS = 120_000;
export const DEFAULT_REALM_DISPOSE_TIMEOUT_MS = 30_000;
export const DEFAULT_REALM_MAX_PENDING = 128;
export const DEFAULT_REALM_MAX_QUEUED_BYTES = 16 * 1024 * 1024;
export const DEFAULT_REALM_MAX_REPLY_BYTES = 128 * 1024 * 1024;

export type RealmAppOptions = Omit<
  HeadlessSessionControllerFromConfigOptions,
  "log" | "initialSnapshot" | "validateSnapshot"
>;
export interface RealmLimits {
  readonly requestTimeoutMs?: number;
  readonly bootTimeoutMs?: number;
  readonly disposeTimeoutMs?: number;
  readonly maxPending?: number;
  readonly maxQueuedBytes?: number;
  readonly maxReplyBytes?: number;
}
export interface RealmSourceManifest {
  readonly scope: "native-file-modules-outside-node_modules";
  readonly appAnchor: string | null;
  readonly bindings: readonly {
    readonly specifier: string;
    readonly url: string;
    readonly provenance: "app-anchor" | "tooling-caller";
  }[];
  readonly files: readonly {
    readonly url: string;
    readonly sha256: string;
    readonly bytes: number;
  }[];
  readonly revision: string;
}
export interface RealmCompatibility {
  readonly schema: "aperture.headless-source-compatibility.v1";
  readonly components: readonly {
    readonly id: string;
    readonly definition: unknown;
  }[];
  readonly resources: readonly {
    readonly id: string;
    readonly fields: readonly {
      readonly name: string;
      readonly kind: string;
    }[];
  }[];
  readonly systems: readonly {
    readonly index: number;
    readonly name: string;
    readonly priority: number | null;
    readonly snapshot: boolean;
    readonly restore: boolean;
    readonly afterRestore: boolean;
  }[];
}
export interface RealmSnapshot extends ApertureSessionSnapshot {
  readonly headlessExecution?: {
    readonly schema: "aperture.headless-execution.v1";
    readonly executionRevision: string;
    readonly source: RealmSourceManifest;
    readonly compatibility: RealmCompatibility;
  };
}
export interface RealmMetadata {
  readonly executionRevision: string;
  readonly sourceRevision: string;
  readonly sourceManifest: RealmSourceManifest;
  readonly status: unknown;
  readonly compactStatus: unknown;
}
export interface RealmCleanup {
  readonly graceful: boolean;
  readonly cleanupFailures: readonly ApertureGeneratedDiagnostic[];
}
export interface RealmExit extends RealmCleanup {
  readonly exitCode: number | null;
  readonly forcedTermination: boolean;
  readonly exitObserved: boolean;
}
export const REALM_METHODS = [
  "prepare",
  "boot",
  "status",
  "step",
  "extract",
  "inject",
  "pick",
  "dispatchCommand",
  "callTool",
  "createBundle",
  "saveSessionSnapshot",
  "determinismReport",
  "dispose",
  "oneShot",
] as const;
export type RealmMethod = (typeof REALM_METHODS)[number];
export interface RealmRequest {
  readonly protocol: typeof HEADLESS_REALM_PROTOCOL;
  readonly executionRevision: string;
  readonly id: number;
  readonly method: RealmMethod;
  readonly input: unknown;
}
export interface RealmReply {
  readonly protocol: typeof HEADLESS_REALM_PROTOCOL;
  readonly executionRevision: string;
  readonly id: number;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly diagnostic?: ApertureGeneratedDiagnostic;
  readonly cleanup?: RealmCleanup;
  readonly metadata?: RealmMetadata;
}
export interface RealmEvent {
  readonly protocol: typeof HEADLESS_REALM_PROTOCOL;
  readonly executionRevision: string;
  readonly event: "log" | "command-output";
  readonly value: unknown;
}

/** The wire contains JSON DTOs only, never live entity/registry/typed-buffer objects. */
export function cloneRealmValue<T>(
  value: T,
  maxBytes = DEFAULT_REALM_MAX_REPLY_BYTES,
): T {
  const ancestors = new Set<object>();
  function validate(item: unknown): void {
    if (
      typeof item === "function" ||
      typeof item === "symbol" ||
      typeof item === "bigint"
    )
      throw new ApertureCliError(
        "aperture.headless.nonSerializable",
        "Headless realm values must contain JSON-safe data, not functions, symbols or bigint.",
      );
    if (typeof item === "number" && !Number.isFinite(item))
      throw new ApertureCliError(
        "aperture.headless.nonSerializable",
        "Headless realm values must contain finite numbers.",
      );
    if (item === null || typeof item !== "object") return;
    const prototype: unknown = Object.getPrototypeOf(item);
    if (
      !Array.isArray(item) &&
      prototype !== null &&
      prototype !== Object.prototype
    )
      throw new ApertureCliError(
        "aperture.headless.nonSerializable",
        "Headless realm values must contain plain objects. Encode typed arrays using the existing RenderBundle or SessionSnapshot codec.",
      );
    if (ancestors.has(item))
      throw new ApertureCliError(
        "aperture.headless.nonSerializable",
        "Headless realm values cannot contain cycles.",
      );
    ancestors.add(item);
    for (const entry of Object.values(item)) validate(entry);
    ancestors.delete(item);
  }
  // Validate before JSON's toJSON hooks can disguise Buffer/Date/live objects.
  validate(value);
  const encoded = JSON.stringify(value);
  if (encoded === undefined || Buffer.byteLength(encoded) > maxBytes)
    throw new ApertureCliError(
      "aperture.headless.messageLimit",
      "Headless realm value exceeds the configured JSON message budget.",
    );
  return JSON.parse(encoded) as T;
}
export function positiveRealmLimit(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1)
    throw new ApertureCliError(
      "aperture.headless.invalidRealmLimit",
      "Headless realm limits must be positive safe integers.",
    );
  return value;
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Preserve both primary and cleanup attribution through JSON diagnostics. */
export function combineRealmFailures(
  primary: unknown,
  cleanup: unknown,
  message: string,
): AggregateError {
  const error = new AggregateError([primary, cleanup], message, {
    cause: cleanup,
  });
  const detail = (value: unknown) =>
    isRecord(value) && isRecord(value["diagnostic"])
      ? value["diagnostic"]
      : {
          message: (value instanceof Error
            ? value.message
            : String(value)
          ).slice(0, 4096),
          ...(value instanceof Error && value.stack !== undefined
            ? { stack: value.stack.slice(0, 8192) }
            : {}),
        };
  Object.assign(error, {
    detail: { primaryError: detail(primary), cleanupError: detail(cleanup) },
  });
  return error;
}
