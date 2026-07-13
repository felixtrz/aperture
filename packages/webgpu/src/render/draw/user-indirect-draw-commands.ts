// C2 (three.js parity plan): the headless core for USER-SURFACE indirect draws
// recorded through a custom render pass's `ctx.drawIndirect(...)` /
// `ctx.drawIndexedIndirect(...)`. Unlike the internal auto-indirect transform
// (`indirect-draw-commands.ts`), which the renderer applies to eligible built-in
// instanced draws using a CPU-authored argument buffer, here the ARGUMENT record
// is GPU-written — typically by a compute pass that culls instances and stores
// the surviving `instanceCount` into a writable `BufferAsset` the same frame.
//
// This module is pure and GPU-free: it validates the recorded commands (buffer
// resolved? offset 4-byte aligned?), drops any degraded draw with a structured
// `IndirectDrawFallbackReason` (so the executor never dispatches a device error),
// and assembles the report. The route feeds it the actual drawn instance count
// read back off the GPU argument buffer (see `finalizeUserIndirectDrawReport`);
// the readback itself is the app layer's job.

import type {
  IndirectDrawCommandDiagnostic,
  IndirectDrawFallbackReason,
} from "./indirect-draw-commands.js";
import type { RenderPassCommand } from "../passes/render-pass-commands.js";

export type UserIndirectDrawCommandStatus =
  | "inactive"
  | "recorded"
  | "fallback"
  | "readback";

/**
 * A validated user indirect draw the route can read back: the resolved GPU
 * argument buffer plus the byte offset of the argument record. The visible
 * instance count lives at `instanceCountByteOffset` (the 2nd u32 of the record,
 * identical for indexed and non-indexed layouts).
 */
export interface UserIndirectDrawTarget {
  readonly passName: string;
  readonly buffer: unknown;
  readonly byteOffset: number;
  readonly instanceCountByteOffset: number;
  readonly indexed: boolean;
}

export interface UserIndirectDrawCommandReport {
  readonly valid: boolean;
  readonly status: UserIndirectDrawCommandStatus;
  /** Valid indirect draws recorded (encoded to the pass). */
  readonly indirectDraws: number;
  readonly nonIndexedIndirectDraws: number;
  readonly indexedIndirectDraws: number;
  /** Recorded indirect draws dropped because the path degraded. */
  readonly skippedDraws: number;
  /**
   * Total instance count drawn across this pass's indirect draws, read back off
   * the GPU argument buffer. `null` when no readback ran (no device support, a
   * readback failure, or no valid draws) — the count is GPU-authoritative and
   * unknown to the CPU until read back.
   */
  readonly drawnInstanceCount: number | null;
  readonly fallbackReasons: readonly IndirectDrawFallbackReason[];
  readonly diagnostics: readonly IndirectDrawCommandDiagnostic[];
}

export interface ResolveUserIndirectDrawCommandsResult {
  /** Commands with degraded indirect draws removed; safe to execute. */
  readonly commands: readonly RenderPassCommand[];
  /** Valid indirect draws to read back for the drawn instance count. */
  readonly targets: readonly UserIndirectDrawTarget[];
  readonly report: UserIndirectDrawCommandReport;
}

// The visible instance count is the 2nd u32 of both argument layouts:
//   drawIndirect:        [vertexCount, instanceCount, firstVertex, firstInstance]
//   drawIndexedIndirect: [indexCount,  instanceCount, firstIndex, baseVertex, firstInstance]
const INSTANCE_COUNT_FIELD_BYTE_OFFSET = 4;

/**
 * Validate a user render pass's recorded commands, filtering out any degraded
 * indirect draw and reporting a structured fallback reason for it. Pure: no GPU,
 * no readback. `report.drawnInstanceCount` is always `null` here — the route
 * resolves it via `finalizeUserIndirectDrawReport` after reading the GPU buffer.
 */
export function resolveUserIndirectDrawCommands(options: {
  readonly commands: readonly RenderPassCommand[];
  readonly passName: string;
}): ResolveUserIndirectDrawCommandsResult {
  const commands: RenderPassCommand[] = [];
  const targets: UserIndirectDrawTarget[] = [];
  const diagnostics: IndirectDrawCommandDiagnostic[] = [];
  const fallbackReasons: IndirectDrawFallbackReason[] = [];

  let indexedIndirectDraws = 0;
  let nonIndexedIndirectDraws = 0;
  let skippedDraws = 0;

  for (const command of options.commands) {
    if (
      command.kind !== "drawIndirect" &&
      command.kind !== "drawIndexedIndirect"
    ) {
      commands.push(command);
      continue;
    }

    const indexed = command.kind === "drawIndexedIndirect";

    if (command.buffer === undefined || command.buffer === null) {
      skippedDraws += 1;
      pushFallback(fallbackReasons, diagnostics, {
        reason: "indirect-buffer-unresolved",
        code: "indirectDraw.bufferUnresolved",
        message: `User pass '${options.passName}' recorded ${command.kind} with an unresolved indirect buffer (ctx.buffer(id) returned undefined — the BufferAsset is missing or not ready). The draw was skipped.`,
      });
      continue;
    }

    if (!isAlignedOffset(command.offset)) {
      skippedDraws += 1;
      pushFallback(fallbackReasons, diagnostics, {
        reason: "indirect-offset-misaligned",
        code: "indirectDraw.offsetMisaligned",
        message: `User pass '${options.passName}' recorded ${command.kind} with indirect offset ${String(command.offset)}, which is not a non-negative multiple of 4 bytes (WebGPU requires 4-byte-aligned indirect offsets). The draw was skipped.`,
      });
      continue;
    }

    commands.push(command);
    targets.push({
      passName: options.passName,
      buffer: command.buffer,
      byteOffset: command.offset,
      instanceCountByteOffset:
        command.offset + INSTANCE_COUNT_FIELD_BYTE_OFFSET,
      indexed,
    });

    if (indexed) {
      indexedIndirectDraws += 1;
    } else {
      nonIndexedIndirectDraws += 1;
    }
  }

  const indirectDraws = indexedIndirectDraws + nonIndexedIndirectDraws;
  const status: UserIndirectDrawCommandStatus =
    indirectDraws === 0 && skippedDraws === 0
      ? "inactive"
      : skippedDraws > 0
        ? "fallback"
        : "recorded";

  return {
    commands,
    targets,
    report: {
      valid: diagnostics.length === 0,
      status,
      indirectDraws,
      nonIndexedIndirectDraws,
      indexedIndirectDraws,
      skippedDraws,
      drawnInstanceCount: null,
      fallbackReasons,
      diagnostics,
    },
  };
}

/**
 * Fold the GPU readback result into the report. `drawnInstanceCount` is the sum
 * of the visible instance counts read off the argument buffers (or `null` when
 * the readback could not run / failed — pass the matching fallback so the report
 * stays loud). Only flips `status` to `"readback"` when a count resolved; a
 * report that already degraded keeps `"fallback"`.
 */
export function finalizeUserIndirectDrawReport(
  report: UserIndirectDrawCommandReport,
  readback: {
    readonly drawnInstanceCount: number | null;
    readonly fallback?: {
      readonly reason: IndirectDrawFallbackReason;
      readonly code: IndirectDrawCommandDiagnostic["code"];
      readonly message: string;
    };
  },
): UserIndirectDrawCommandReport {
  if (report.indirectDraws === 0) {
    return report;
  }

  const fallbackReasons = [...report.fallbackReasons];
  const diagnostics = [...report.diagnostics];

  if (readback.fallback !== undefined) {
    pushFallback(fallbackReasons, diagnostics, readback.fallback);
  }

  const resolved = readback.drawnInstanceCount !== null;

  return {
    ...report,
    valid: diagnostics.length === 0,
    status: resolved
      ? report.skippedDraws > 0
        ? "fallback"
        : "readback"
      : report.status,
    drawnInstanceCount: readback.drawnInstanceCount,
    fallbackReasons,
    diagnostics,
  };
}

function pushFallback(
  fallbackReasons: IndirectDrawFallbackReason[],
  diagnostics: IndirectDrawCommandDiagnostic[],
  input: {
    readonly reason: IndirectDrawFallbackReason;
    readonly code: IndirectDrawCommandDiagnostic["code"];
    readonly message: string;
  },
): void {
  if (!fallbackReasons.includes(input.reason)) {
    fallbackReasons.push(input.reason);
  }
  diagnostics.push({
    code: input.code,
    reason: input.reason,
    message: input.message,
  });
}

function isAlignedOffset(offset: number): boolean {
  return Number.isInteger(offset) && offset >= 0 && offset % 4 === 0;
}
