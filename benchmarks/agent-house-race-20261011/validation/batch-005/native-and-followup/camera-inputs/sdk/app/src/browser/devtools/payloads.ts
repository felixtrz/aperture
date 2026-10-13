export interface PixelSampleRequest {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly coordinateSpace: "auto" | "normalized" | "pixel";
}

export function pixelSampleRequestsFromPayload(
  payload: unknown,
): readonly PixelSampleRequest[] {
  const record = isRecord(payload) ? payload : {};
  const samples = Array.isArray(record["samples"]) ? record["samples"] : null;

  if (samples !== null && samples.length > 0) {
    return samples.map((sample, index) =>
      pixelSampleRequestFromValue(sample, index),
    );
  }

  return [pixelSampleRequestFromValue(record, 0)];
}

export function pixelFromSample(
  dimensions: { readonly width: number; readonly height: number },
  sample: PixelSampleRequest,
): { readonly x: number; readonly y: number } | null {
  const usePixelCoordinates =
    sample.coordinateSpace === "pixel" ||
    (sample.coordinateSpace === "auto" &&
      (Math.abs(sample.x) > 1 || Math.abs(sample.y) > 1));
  const x = usePixelCoordinates
    ? Math.floor(sample.x)
    : Math.round(clamp01(sample.x) * Math.max(0, dimensions.width - 1));
  const y = usePixelCoordinates
    ? Math.floor(sample.y)
    : Math.round(clamp01(sample.y) * Math.max(0, dimensions.height - 1));

  if (x < 0 || y < 0 || x >= dimensions.width || y >= dimensions.height) {
    return null;
  }

  return { x, y };
}

export function canvasDimensions(canvas: {
  readonly width: number;
  readonly height: number;
}): { readonly width: number; readonly height: number } {
  return {
    width: Math.max(1, Math.floor(canvas.width)),
    height: Math.max(1, Math.floor(canvas.height)),
  };
}

export function numberFromValue(value: unknown): number | undefined {
  return Number.isFinite(value) ? (value as number) : undefined;
}

function pixelSampleRequestFromValue(
  value: unknown,
  index: number,
): PixelSampleRequest {
  const record = isRecord(value) ? value : {};
  const coordinateSpace = stringFromValue(record["coordinateSpace"]);

  return {
    id: stringFromValue(record["id"]) ?? `sample-${index + 1}`,
    x: numberFromValue(record["x"]) ?? 0.5,
    y: numberFromValue(record["y"]) ?? 0.5,
    coordinateSpace:
      coordinateSpace === "pixel" || coordinateSpace === "normalized"
        ? coordinateSpace
        : "auto",
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function stringFromValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
