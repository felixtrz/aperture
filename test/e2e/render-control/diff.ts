import { pixelDistance, readPngImage, readPngPixel } from "../png.js";

import type {
  ImageDiffReport,
  NamedPixelSample,
  PixelDiffReport,
  StatusDiffChange,
  StatusDiffReport,
} from "./types.js";

const defaultVolatilePathPatterns = [
  /^artifactPath$/,
  /^capturedAt$/,
  /(^|\.)elapsedMs$/,
  /(^|\.)artifactPath$/,
  /(^|\.)frame$/,
  /(^|\.)frameCount$/,
  /(^|\.)frames$/,
  /(^|\.)lastFrame$/,
  /(^|\.)runId$/,
  /(^|\.)runIndex$/,
  /(^|\.)startedAt$/,
  /(^|\.)timestamp$/,
  /(^|\.)timing/,
  /(^|\.)gpuTimingSamples$/,
  /(^|\.)gpuTimeMs$/,
  /(^|\.)gpuTimestamp$/,
  /(^|\.)profilerHistory$/,
  /(^|\.)profileSamples$/,
  /(^|\.)url$/,
  /(^|\.)warnings\.\d+\.capturedAt$/,
];

export interface StatusDiffOptions {
  readonly includeVolatile?: boolean;
  readonly ignoredPathPatterns?: readonly RegExp[];
}

export function diffStatusSnapshots(
  before: unknown,
  after: unknown,
  options: StatusDiffOptions = {},
): StatusDiffReport {
  const added: StatusDiffChange[] = [];
  const removed: StatusDiffChange[] = [];
  const changed: StatusDiffChange[] = [];
  const ignoredPaths: string[] = [];
  const normalizedBefore = normalizeStatusSnapshot(before);
  const normalizedAfter = normalizeStatusSnapshot(after);
  const ignoredPathPatterns =
    options.ignoredPathPatterns ?? defaultVolatilePathPatterns;

  walkDiff({
    before: normalizedBefore,
    after: normalizedAfter,
    path: "",
    added,
    removed,
    changed,
    ignoredPaths,
    ignoredPathPatterns,
    includeVolatile: options.includeVolatile === true,
  });

  return { added, removed, changed, ignoredPaths };
}

export function normalizeStatusSnapshot(value: unknown): unknown {
  return sortJsonValue(jsonRoundTrip(value));
}

export function diffPngSamples(
  before: Buffer,
  after: Buffer,
  samples: readonly NamedPixelSample[],
): PixelDiffReport {
  const sampleDiffs = samples.map((sample) => {
    const beforePixel = readPngPixel(before, sample.x, sample.y);
    const afterPixel = readPngPixel(after, sample.x, sample.y);

    return {
      id: sample.id,
      before: beforePixel,
      after: afterPixel,
      distance: pixelDistance(beforePixel, afterPixel),
    };
  });
  const image = diffPngImages(before, after);
  const sampleMaxDistance = sampleDiffs.reduce(
    (max, sample) => Math.max(max, sample.distance),
    0,
  );

  return {
    samples: sampleDiffs,
    image,
    maxDistance: Math.max(sampleMaxDistance, image.maxDistance),
  };
}

export function diffPngImages(before: Buffer, after: Buffer): ImageDiffReport {
  const beforeImage = readPngImage(before);
  const afterImage = readPngImage(after);
  const dimensionsMatch =
    beforeImage.width === afterImage.width &&
    beforeImage.height === afterImage.height;

  if (!dimensionsMatch) {
    return {
      dimensionsMatch,
      beforeWidth: beforeImage.width,
      beforeHeight: beforeImage.height,
      afterWidth: afterImage.width,
      afterHeight: afterImage.height,
      comparedPixels: 0,
      changedPixels: 0,
      maxDistance: Number.POSITIVE_INFINITY,
      meanDistance: Number.POSITIVE_INFINITY,
    };
  }

  let changedPixels = 0;
  let maxDistance = 0;
  let totalDistance = 0;
  const comparedPixels = beforeImage.width * beforeImage.height;

  for (let y = 0; y < beforeImage.height; y += 1) {
    for (let x = 0; x < beforeImage.width; x += 1) {
      const distance = pixelDistance(
        readImagePixel(beforeImage, x, y),
        readImagePixel(afterImage, x, y),
      );

      if (distance > 0) {
        changedPixels += 1;
      }

      maxDistance = Math.max(maxDistance, distance);
      totalDistance += distance;
    }
  }

  return {
    dimensionsMatch,
    beforeWidth: beforeImage.width,
    beforeHeight: beforeImage.height,
    afterWidth: afterImage.width,
    afterHeight: afterImage.height,
    comparedPixels,
    changedPixels,
    maxDistance,
    meanDistance: comparedPixels > 0 ? totalDistance / comparedPixels : 0,
  };
}

interface WalkDiffOptions {
  readonly before: unknown;
  readonly after: unknown;
  readonly path: string;
  readonly added: StatusDiffChange[];
  readonly removed: StatusDiffChange[];
  readonly changed: StatusDiffChange[];
  readonly ignoredPaths: string[];
  readonly ignoredPathPatterns: readonly RegExp[];
  readonly includeVolatile: boolean;
}

function walkDiff(options: WalkDiffOptions): void {
  const {
    before,
    after,
    path,
    added,
    removed,
    changed,
    ignoredPaths,
    ignoredPathPatterns,
    includeVolatile,
  } = options;

  if (
    !includeVolatile &&
    path.length > 0 &&
    ignoredPathPatterns.some((pattern) => pattern.test(path))
  ) {
    ignoredPaths.push(path);
    return;
  }

  if (Object.is(before, after)) {
    return;
  }

  if (before === undefined) {
    added.push({ path, before, after });
    return;
  }

  if (after === undefined) {
    removed.push({ path, before, after });
    return;
  }

  if (!isDiffRecord(before) || !isDiffRecord(after)) {
    changed.push({ path, before, after });
    return;
  }

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of [...keys].sort()) {
    walkDiff({
      before: before[key],
      after: after[key],
      path: path.length === 0 ? key : `${path}.${key}`,
      added,
      removed,
      changed,
      ignoredPaths,
      ignoredPathPatterns,
      includeVolatile,
    });
  }
}

function isDiffRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function jsonRoundTrip(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return {
      ok: false,
      reason: "status-snapshot-not-json-safe",
    };
  }
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (!isDiffRecord(value)) {
    return value;
  }

  const sorted: Record<string, unknown> = {};

  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortJsonValue(value[key]);
  }

  return sorted;
}

function readImagePixel(
  image: ReturnType<typeof readPngImage>,
  x: number,
  y: number,
) {
  const pixelOffset = (y * image.width + x) * image.bytesPerPixel;

  return {
    r: image.pixels[pixelOffset] ?? 0,
    g: image.pixels[pixelOffset + 1] ?? 0,
    b: image.pixels[pixelOffset + 2] ?? 0,
    a: image.bytesPerPixel === 4 ? (image.pixels[pixelOffset + 3] ?? 0) : 255,
  };
}
