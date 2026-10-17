import type { PortableRenderTimings } from "@aperture-engine/app/render-bundle";
import type {
  NodeDeviceMetadata,
  NodeDeviceOptions,
} from "@aperture-engine/adapter-node";

export interface ApertureRenderSessionOptions {
  readonly backend?: "dawn" | "browser";
  readonly adapter?: "auto" | "hardware" | "software";
  readonly native?: NodeDeviceOptions;
  readonly displayWidth?: number;
  readonly displayHeight?: number;
}

export interface RenderBundleResult {
  readonly png: Buffer;
  readonly frame: number | null;
  readonly metadata: RenderBundleMetadata;
}

interface RenderBundleCommonMetadata {
  readonly schemaVersion: 2;
  readonly diagnostics?: readonly unknown[];
  readonly shadow?: unknown;
  readonly shader?: unknown;
  readonly cpuTimings?: {
    readonly portable?: PortableRenderTimings;
    readonly prepareAndRenderMs: number;
    /** Wall time awaiting submitted GPU work; not GPU timestamps. */
    readonly gpuCompletionMs?: number;
    readonly readbackMs: number;
    readonly pngMs: number;
    readonly totalMs: number;
  };
  readonly processMemory?: {
    readonly rss: number;
    readonly heapUsed: number;
    readonly external: number;
  };
  readonly requestedDimensions: RenderBundleDimensions;
  readonly actualDimensions: RenderBundleDimensions;
  readonly bundleDigest: RenderBundleDigestMetadata | null;
  readonly webgpu: RenderBundleWebGpuMetadata | null;
  readonly lightingHealth: unknown | null;
}

export type RenderBundleMetadata = RenderBundleCommonMetadata &
  (
    | {
        readonly backend: "browser";
        readonly browser: RenderBundleBrowserMetadata;
        readonly dawn?: never;
      }
    | {
        readonly backend: "dawn";
        readonly dawn: NodeDeviceMetadata;
        readonly browser?: never;
      }
  );

export interface RenderBundleBrowserMetadata {
  readonly channel: string;
  readonly headless: boolean;
  readonly args: readonly string[];
}

export interface RenderBundleDimensions {
  readonly width: number;
  readonly height: number;
}

export interface RenderBundleDigestMetadata {
  readonly algorithm: string;
  readonly hash: string;
  readonly byteLength: number;
}

export interface RenderBundleWebGpuMetadata {
  readonly format: string | null;
  readonly displayColorSpace: string | null;
  readonly adapterInfo: Readonly<Record<string, string | number | boolean>>;
  readonly adapterFeatures: readonly string[];
  readonly deviceFeatures: readonly string[];
}

export interface HarnessStatus {
  readonly shader?: unknown;
  readonly shadow?: unknown;
  readonly ok?: boolean;
  readonly frame?: number | null;
  readonly error?: string;
  readonly diagnostics?: readonly unknown[];
  readonly metadata?: {
    readonly webgpu?: unknown;
    readonly lightingHealth?: unknown;
  } | null;
}

export interface ApertureRenderSessionRenderOptions {
  readonly bundle: unknown;
  readonly width: number;
  readonly height: number;
  readonly timeoutMs?: number;
  readonly allowPlaceholders?: boolean;
}

/** A serialized warm backend with isolated per-job state. Dawn owns a native
 * worker/device; the browser backend owns its verified runtime. Disposal drains
 * accepted work and releases backend resources before resolving. */
export interface ApertureRenderSession {
  readonly backend: "dawn" | "browser";
  readonly dawn?: NodeDeviceMetadata;
  readonly browser?: RenderBundleBrowserMetadata;
  render(
    options: ApertureRenderSessionRenderOptions,
  ): Promise<RenderBundleResult>;
  dispose(): Promise<void>;
}
