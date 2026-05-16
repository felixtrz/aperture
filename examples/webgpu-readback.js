const bytesPerRow = 256;

export async function initializeWebGpuWithOptionalReadbackUsage({
  aperture,
  canvas,
}) {
  const readbackUsage = aperture.createReadbackCanvasTextureUsage();

  if (!readbackUsage.ok) {
    return {
      initialized: await aperture.initializeWebGpu({ canvas }),
      readbackUsage,
    };
  }

  const initialized = await aperture.initializeWebGpu({
    canvas,
    textureUsage: readbackUsage.usage,
  });

  if (initialized.ok || initialized.reason !== "context-configure-failed") {
    return { initialized, readbackUsage };
  }

  return {
    initialized: await aperture.initializeWebGpu({ canvas }),
    readbackUsage: {
      ok: false,
      reason: "texture-usage-unavailable",
      message: `WebGPU canvas COPY_SRC configuration failed: ${initialized.message}`,
    },
  };
}

export function createCurrentTextureColorTargetWithTexture({
  context,
  clearColor,
}) {
  const texture = context.getCurrentTexture?.() ?? null;

  if (texture === null) {
    return readbackStepFailure(
      "current-texture-unavailable",
      "The WebGPU context did not provide a current texture.",
    );
  }

  const view = texture.createView?.();

  if (view === undefined) {
    return readbackStepFailure(
      "texture-view-unavailable",
      "The WebGPU current texture did not provide a texture view.",
    );
  }

  return {
    ok: true,
    valid: true,
    texture,
    target: {
      view,
      clearColor,
      loadOp: "clear",
      storeOp: "store",
    },
  };
}

export function copyCurrentTextureReadbackSamples({
  device,
  encoder,
  texture,
  format,
  width,
  height,
  samples,
}) {
  const byteOrder = textureByteOrder(format);

  if (byteOrder === null) {
    return readbackFailure(
      "unsupported-texture-format",
      `WebGPU readback does not know how to decode '${format}' texture bytes.`,
      false,
    );
  }

  const usage = resolveBufferUsage();

  if (!usage.ok) {
    return usage;
  }

  const mapMode = resolveMapModeRead();

  if (!mapMode.ok) {
    return mapMode;
  }

  if (typeof device.createBuffer !== "function") {
    return readbackFailure(
      "create-buffer-unavailable",
      "WebGPU device cannot create readback buffers.",
      false,
    );
  }

  if (typeof encoder.copyTextureToBuffer !== "function") {
    return readbackFailure(
      "copy-texture-to-buffer-unavailable",
      "WebGPU command encoder cannot copy the current texture into readback buffers.",
      false,
    );
  }

  const plannedSamples = [];

  for (const sample of samples) {
    const origin = sampleOrigin(sample, width, height);

    if (origin === null) {
      return readbackFailure(
        "texture-size-invalid",
        `WebGPU readback sample '${sample.id}' is outside the ${width}x${height} texture.`,
        false,
      );
    }

    let buffer;

    try {
      buffer = device.createBuffer({
        label: `aperture-${sample.id}-readback`,
        size: bytesPerRow,
        usage: usage.value,
      });
    } catch (error) {
      return readbackFailure(
        "create-buffer-unavailable",
        `WebGPU readback buffer creation failed: ${messageFromError(error)}`,
        false,
      );
    }

    try {
      encoder.copyTextureToBuffer(
        {
          texture,
          origin: { x: origin.x, y: origin.y, z: 0 },
        },
        {
          buffer,
          bytesPerRow,
          rowsPerImage: 1,
        },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      );
    } catch (error) {
      return readbackFailure(
        "copy-texture-to-buffer-unavailable",
        `WebGPU current-texture copy failed: ${messageFromError(error)}`,
        false,
      );
    }

    plannedSamples.push({
      id: sample.id,
      origin,
      buffer,
    });
  }

  return {
    ok: true,
    source: "current-texture",
    format,
    byteOrder,
    bytesPerRow,
    mapModeRead: mapMode.value,
    samples: plannedSamples,
  };
}

export async function mapCurrentTextureReadbackSamples(plan) {
  if (!plan.ok) {
    return plan;
  }

  const samples = [];

  for (const sample of plan.samples) {
    const buffer = sample.buffer;

    if (typeof buffer.mapAsync !== "function") {
      return readbackFailure(
        "map-read-unavailable",
        `WebGPU readback buffer for '${sample.id}' cannot be mapped for reading.`,
        true,
      );
    }

    if (typeof buffer.getMappedRange !== "function") {
      return readbackFailure(
        "mapped-range-unavailable",
        `WebGPU readback buffer for '${sample.id}' cannot expose a mapped range.`,
        true,
      );
    }

    try {
      await buffer.mapAsync(plan.mapModeRead);
    } catch (error) {
      return readbackFailure(
        "readback-map-failed",
        `WebGPU readback buffer mapping failed for '${sample.id}': ${messageFromError(
          error,
        )}`,
        true,
      );
    }

    try {
      samples.push({
        id: sample.id,
        origin: sample.origin,
        pixel: decodeTexturePixel(
          plan.byteOrder,
          mappedRangeBytes(buffer.getMappedRange()),
        ),
      });
    } catch (error) {
      return readbackFailure(
        "mapped-range-unavailable",
        `WebGPU readback mapped range could not be read for '${sample.id}': ${messageFromError(
          error,
        )}`,
        true,
      );
    } finally {
      try {
        buffer.unmap?.();
      } catch {
        // Best effort cleanup for browser diagnostics.
      }
    }
  }

  return {
    ok: true,
    source: plan.source,
    format: plan.format,
    bytesPerRow: plan.bytesPerRow,
    samples,
  };
}

export function markReadbackClearOk(readback, clearOk) {
  return readback.ok ? readback : { ...readback, clearOk };
}

function resolveBufferUsage() {
  const mapRead = globalThis.GPUBufferUsage?.MAP_READ;
  const copyDst = globalThis.GPUBufferUsage?.COPY_DST;

  if (typeof mapRead !== "number" || typeof copyDst !== "number") {
    return readbackFailure(
      "buffer-usage-unavailable",
      "WebGPU buffer usage flags are unavailable; readback requires MAP_READ and COPY_DST.",
      false,
    );
  }

  return { ok: true, value: mapRead | copyDst };
}

function resolveMapModeRead() {
  const read = globalThis.GPUMapMode?.READ;

  if (typeof read !== "number") {
    return readbackFailure(
      "map-mode-unavailable",
      "WebGPU map mode flags are unavailable; readback requires GPUMapMode.READ.",
      false,
    );
  }

  return { ok: true, value: read };
}

function textureByteOrder(format) {
  switch (format) {
    case "rgba8unorm":
    case "rgba8unorm-srgb":
      return "rgba";
    case "bgra8unorm":
    case "bgra8unorm-srgb":
      return "bgra";
    default:
      return null;
  }
}

function decodeTexturePixel(format, bytes) {
  if (format === "bgra") {
    return {
      r: bytes[2] ?? 0,
      g: bytes[1] ?? 0,
      b: bytes[0] ?? 0,
      a: bytes[3] ?? 0,
    };
  }

  return {
    r: bytes[0] ?? 0,
    g: bytes[1] ?? 0,
    b: bytes[2] ?? 0,
    a: bytes[3] ?? 0,
  };
}

function mappedRangeBytes(range) {
  if (ArrayBuffer.isView(range)) {
    return new Uint8Array(range.buffer, range.byteOffset, range.byteLength);
  }

  return new Uint8Array(range);
}

function sampleOrigin(sample, width, height) {
  const x = Math.floor(width * sample.x);
  const y = Math.floor(height * sample.y);

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    x < 0 ||
    y < 0 ||
    x >= width ||
    y >= height
  ) {
    return null;
  }

  return { x, y };
}

function readbackStepFailure(reason, message) {
  return {
    ok: false,
    valid: false,
    target: null,
    reason,
    message,
    diagnostics: [],
  };
}

function readbackFailure(reason, message, clearOk) {
  return { ok: false, reason, message, clearOk };
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
