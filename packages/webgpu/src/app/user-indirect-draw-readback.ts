// C2 (three.js parity plan): read the GPU-authoritative drawn instance count for
// user-surface indirect draws back off the argument buffer. A compute pass wrote
// the surviving `instanceCount` into a writable `BufferAsset` (realized with
// COPY_SRC + INDIRECT); after the frame's submit we copy just that u32 (per draw)
// into a MAP_READ buffer, map it, and sum. The result surfaces in the frame
// report so an e2e can assert that occluding/culling instances reduces the drawn
// count — the CPU never authored it. Device is injected (typed structurally) so
// the mechanism is unit-testable with a fake and degrades to a fallback reason
// when the route runs without a readback-capable device.

import type {
  IndirectDrawCommandDiagnostic,
  IndirectDrawFallbackReason,
} from "../render/draw/indirect-draw-commands.js";
import type { UserIndirectDrawTarget } from "../render/draw/user-indirect-draw-commands.js";

interface CommandEncoderLike {
  copyBufferToBuffer: (
    source: unknown,
    sourceOffset: number,
    destination: unknown,
    destinationOffset: number,
    size: number,
  ) => void;
  finish: () => unknown;
}

interface MappableBufferLike {
  mapAsync: (mode: number) => Promise<void>;
  getMappedRange: () => ArrayBuffer;
  unmap: () => void;
  destroy?: () => void;
}

export interface UserIndirectDrawReadbackDeviceLike {
  createBuffer?: (descriptor: {
    label?: string;
    size: number;
    usage: number;
  }) => MappableBufferLike;
  createCommandEncoder?: (descriptor?: {
    label?: string;
  }) => CommandEncoderLike;
  queue?: { submit?: (commandBuffers: readonly unknown[]) => void };
}

export interface UserIndirectDrawReadbackResult {
  readonly drawnInstanceCount: number | null;
  readonly fallback?: {
    readonly reason: IndirectDrawFallbackReason;
    readonly code: IndirectDrawCommandDiagnostic["code"];
    readonly message: string;
  };
}

const MAP_READ = 0x1;
const COPY_DST = 0x8;
const INSTANCE_COUNT_BYTES = 4;

/**
 * Copy each target's visible instance count (one u32) into a MAP_READ buffer,
 * map it, and sum. Returns `{ drawnInstanceCount }` on success, or
 * `{ drawnInstanceCount: null, fallback }` when the device cannot read back or
 * the readback throws. Must be awaited AFTER the frame's submit so the copy is
 * queue-ordered behind the compute pass that wrote the argument buffer.
 */
export async function readUserIndirectDrawInstanceCounts(options: {
  readonly device: unknown;
  readonly targets: readonly UserIndirectDrawTarget[];
  readonly label: string;
}): Promise<UserIndirectDrawReadbackResult> {
  if (options.targets.length === 0) {
    return { drawnInstanceCount: null };
  }

  const device = options.device as UserIndirectDrawReadbackDeviceLike;
  const mapMode =
    (globalThis as { GPUMapMode?: { READ: number } }).GPUMapMode?.READ ??
    MAP_READ;
  const usageFlags = (
    globalThis as {
      GPUBufferUsage?: { MAP_READ: number; COPY_DST: number };
    }
  ).GPUBufferUsage ?? { MAP_READ, COPY_DST };

  if (
    device.createBuffer === undefined ||
    device.createCommandEncoder === undefined ||
    device.queue?.submit === undefined
  ) {
    return {
      drawnInstanceCount: null,
      fallback: {
        reason: "indirect-readback-unavailable",
        code: "indirectDraw.readbackUnavailable",
        message:
          "WebGPU device cannot read back the indirect-draw argument buffer (createBuffer/createCommandEncoder/queue.submit required); the GPU-driven drawn instance count is unavailable in the frame report.",
      },
    };
  }

  const byteLength = options.targets.length * INSTANCE_COUNT_BYTES;
  let readback: MappableBufferLike | null = null;

  try {
    readback = device.createBuffer({
      label: `${options.label}/indirect-drawn-count/readback`,
      size: byteLength,
      usage: usageFlags.MAP_READ | usageFlags.COPY_DST,
    });

    const encoder = device.createCommandEncoder({
      label: `${options.label}/indirect-drawn-count`,
    });
    for (let index = 0; index < options.targets.length; index += 1) {
      const target = options.targets[index];
      if (target === undefined) {
        continue;
      }
      encoder.copyBufferToBuffer(
        target.buffer,
        target.instanceCountByteOffset,
        readback,
        index * INSTANCE_COUNT_BYTES,
        INSTANCE_COUNT_BYTES,
      );
    }
    device.queue.submit([encoder.finish()]);

    await readback.mapAsync(mapMode);
    const counts = new Uint32Array(readback.getMappedRange().slice(0));
    readback.unmap();

    let drawnInstanceCount = 0;
    for (const count of counts) {
      drawnInstanceCount += count;
    }
    return { drawnInstanceCount };
  } catch (error) {
    return {
      drawnInstanceCount: null,
      fallback: {
        reason: "indirect-readback-failed",
        code: "indirectDraw.readbackFailed",
        message: `Reading back the indirect-draw argument buffer failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    };
  } finally {
    readback?.destroy?.();
  }
}
