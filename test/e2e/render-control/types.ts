import type { RgbaPixel } from "../png.js";

export interface ExampleControlCapabilities {
  readonly status: boolean;
  readonly warnings: boolean;
  readonly screenshot: boolean;
  readonly pause: boolean;
  readonly resume: boolean;
  readonly step: boolean;
  readonly scenario: boolean;
  readonly snapshot: boolean;
  readonly readback: boolean;
  readonly [key: string]: boolean;
}

export interface ExampleControlSnapshot {
  readonly label: string;
  readonly artifactPath?: string;
  readonly capturedAt?: string;
  readonly url?: string;
  readonly status?: unknown;
  readonly frameState?: unknown;
  readonly warnings?: readonly unknown[];
  readonly [key: string]: unknown;
}

export interface RenderControlWarning {
  readonly type: string;
  readonly text: string;
  readonly capturedAt?: string;
}

export interface NamedPixelSample {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface CapturedPixelSample extends NamedPixelSample {
  readonly pixel: RgbaPixel;
}

export interface RenderControlWaitReadyOptions {
  readonly phase?: string;
  readonly timeoutMs?: number;
}

export interface RenderControlScreenshot {
  readonly label: string;
  readonly png: Buffer;
  readonly artifactPath?: string;
}

export interface StatusDiffChange {
  readonly path: string;
  readonly before: unknown;
  readonly after: unknown;
}

export interface StatusDiffReport {
  readonly added: readonly StatusDiffChange[];
  readonly removed: readonly StatusDiffChange[];
  readonly changed: readonly StatusDiffChange[];
  readonly ignoredPaths: readonly string[];
}

export interface PixelDiffSample {
  readonly id: string;
  readonly before: RgbaPixel;
  readonly after: RgbaPixel;
  readonly distance: number;
}

export interface ImageDiffReport {
  readonly dimensionsMatch: boolean;
  readonly beforeWidth: number;
  readonly beforeHeight: number;
  readonly afterWidth: number;
  readonly afterHeight: number;
  readonly comparedPixels: number;
  readonly changedPixels: number;
  readonly maxDistance: number;
  readonly meanDistance: number;
}

export interface PixelDiffReport {
  readonly samples: readonly PixelDiffSample[];
  readonly image: ImageDiffReport;
  readonly maxDistance: number;
}
