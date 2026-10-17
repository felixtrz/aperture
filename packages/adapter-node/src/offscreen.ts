import type {} from "webgpu";
import { NodeGpuError } from "./device.js";

export interface OffscreenOutputOptions {
  readonly width: number;
  readonly height: number;
  readonly format?: "rgba8unorm" | "bgra8unorm";
  readonly alphaMode?: "opaque" | "premultiplied";
  /** Bounds the output texture plus one padded readback buffer. */
  readonly maxBytes?: number;
}

export interface OffscreenOutput {
  readonly width: number;
  readonly height: number;
  readonly format: "rgba8unorm" | "bgra8unorm";
  readonly colorSpace: "srgb";
  readonly alphaMode: "opaque" | "premultiplied";
  readonly sampleCount: 1;
  acquire(): GPUTexture;
  resize(width: number, height: number): void;
  /** Top-left RGBA8, straight alpha, with no second color conversion. */
  readRgba(): Promise<Uint8Array<ArrayBuffer>>;
  dispose(): Promise<void>;
}

export function createOffscreenOutput(
  device: GPUDevice,
  options: OffscreenOutputOptions,
): OffscreenOutput {
  const format = options.format ?? "rgba8unorm";
  if (format !== "rgba8unorm" && format !== "bgra8unorm")
    throw new NodeGpuError(
      "aperture.dawn.invalidOutputFormat",
      "PNG output requires rgba8unorm or bgra8unorm.",
    );
  const alphaMode = options.alphaMode ?? "opaque";
  const budget = options.maxBytes ?? 256 * 1024 * 1024;
  if (!Number.isSafeInteger(budget) || budget <= 0)
    throw new NodeGpuError(
      "aperture.dawn.invalidOutputBudget",
      "Output memory budget must be a positive safe integer.",
    );
  let width = options.width;
  let height = options.height;
  let disposed = false;
  let reading: Promise<Uint8Array<ArrayBuffer>> | null = null;
  let disposal: Promise<void> | null = null;
  const checkDimensions = (w: number, h: number): void => {
    if (
      ![w, h].every(
        (v) =>
          Number.isSafeInteger(v) &&
          v > 0 &&
          v <= device.limits.maxTextureDimension2D,
      )
    ) {
      throw new NodeGpuError(
        "aperture.dawn.invalidDimensions",
        `Output dimensions must be integers from 1 to ${device.limits.maxTextureDimension2D}.`,
      );
    }
    if ((w * 4 + Math.ceil((w * 4) / 256) * 256) * h > budget)
      throw new NodeGpuError(
        "aperture.dawn.outputBudgetExceeded",
        `Output and staging allocation exceed the ${budget}-byte memory budget.`,
      );
  };
  const allocate = (w = width, h = height): GPUTexture =>
    device.createTexture({
      label: "aperture:output",
      size: [w, h],
      format,
      usage: 0x10 | 0x01 | 0x04, // RENDER_ATTACHMENT | COPY_SRC | TEXTURE_BINDING
    });
  const assertOpen = (): void => {
    if (disposed)
      throw new NodeGpuError(
        "aperture.dawn.outputDisposed",
        "Offscreen output is disposed.",
      );
  };
  checkDimensions(width, height);
  let texture = allocate();
  return {
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    format,
    alphaMode,
    colorSpace: "srgb",
    sampleCount: 1,
    acquire() {
      assertOpen();
      return texture;
    },
    resize(w, h) {
      assertOpen();
      if (reading !== null)
        throw new NodeGpuError(
          "aperture.dawn.outputBusy",
          "Await readback before resizing output.",
        );
      checkDimensions(w, h);
      if (width === w && height === h) return;
      // Allocation can throw. Keep the current output usable until it succeeds.
      const replacement = allocate(w, h);
      const previous = texture;
      width = w;
      height = h;
      texture = replacement;
      previous.destroy();
    },
    readRgba() {
      assertOpen();
      if (reading !== null)
        return Promise.reject(
          new NodeGpuError(
            "aperture.dawn.outputBusy",
            "Only one output readback may be in flight.",
          ),
        );
      reading = readTextureRgba(
        device,
        texture,
        width,
        height,
        format,
        alphaMode,
      ).finally(() => {
        reading = null;
      });
      return reading;
    },
    dispose() {
      if (disposal !== null) return disposal;
      disposed = true;
      disposal = (async () => {
        try {
          await reading?.catch(() => undefined);
        } finally {
          texture.destroy();
        }
      })();
      return disposal;
    },
  };
}

async function readTextureRgba(
  device: GPUDevice,
  texture: GPUTexture,
  width: number,
  height: number,
  format: string,
  alphaMode: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const bytesPerRow = Math.ceil((width * 4) / 256) * 256;
  const buffer = device.createBuffer({
    label: "aperture:readback",
    size: bytesPerRow * height,
    usage: 0x01 | 0x08,
  });
  device.pushErrorScope("validation");
  let data: Uint8Array<ArrayBuffer> | null = null;
  let failure: unknown;
  try {
    const encoder = device.createCommandEncoder({ label: "aperture:readback" });
    encoder.copyTextureToBuffer(
      { texture },
      { buffer, bytesPerRow, rowsPerImage: height },
      [width, height],
    );
    device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(0x01);
    const mapped = new Uint8Array(buffer.getMappedRange());
    data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      data.set(
        mapped.subarray(y * bytesPerRow, y * bytesPerRow + width * 4),
        y * width * 4,
      );
    }
    for (let offset = 0; offset < data.length; offset += 4) {
      if (format === "bgra8unorm") {
        const blue = data[offset]!;
        data[offset] = data[offset + 2]!;
        data[offset + 2] = blue;
      }
      if (alphaMode === "opaque") data[offset + 3] = 255;
      else {
        const alpha = data[offset + 3]!;
        for (let channel = 0; channel < 3; channel++)
          data[offset + channel] =
            alpha === 0
              ? 0
              : Math.min(
                  255,
                  Math.round((data[offset + channel]! * 255) / alpha),
                );
      }
    }
  } catch (error) {
    failure = error;
  } finally {
    if (buffer.mapState === "mapped") buffer.unmap();
    buffer.destroy();
  }
  const validation = await device.popErrorScope();
  if (validation !== null)
    throw new NodeGpuError(
      "aperture.dawn.readbackFailed",
      validation.message,
      failure === undefined ? undefined : { cause: failure },
    );
  if (failure !== undefined) throw failure;
  return data!;
}
