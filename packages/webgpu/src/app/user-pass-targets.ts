// B3 (three.js parity plan): user-pass writes to facade render targets and
// custom-material MRT attachment planning.
//
// User render passes (app.addRenderPass) may now write their declared
// targets: a write handle that names a facade `RenderTargetAsset` id is
// realized (renderer-owned, handle-stable — the B1 lifecycle) and attached
// as that pass's color target, replacing the former "scene-color only"
// coercion. Ping-pong between two persistent user targets works across
// frames because realization reuses the same textures until a version bump.
//
// Custom materials declaring `colorTargets` (MRT) pair each extra target
// with a facade render-target handle; `resolveWebGpuAppCustomMaterialColorTargets`
// realizes those handles into the `additionalColorTargets` attachment inputs
// the frame boundary attaches at @location(1..N-1). All failures are
// structured diagnostics produced BEFORE any encoding — never device errors.

import {
  assetHandleKey,
  createRenderTargetHandle,
  type AssetRegistry,
} from "@aperture-engine/simulation";
import {
  isRenderTargetAsset,
  type PreparedCustomWgslMaterial,
} from "@aperture-engine/render";
import { resolveCustomWgslColorTargetFormat } from "@aperture-engine/render";
import type { RenderPassColorAttachmentInput } from "../render/passes/render-pass-attachments.js";
import type { PassWrite } from "../render/graph/frame-graph.js";
import {
  realizeWebGpuAppRenderTarget,
  type WebGpuAppRealizedRenderTarget,
  type WebGpuAppRenderTargetResourceState,
} from "./render-target-resources.js";

export interface WebGpuAppUserPassTargetContext {
  readonly assets: AssetRegistry;
  readonly device: unknown;
  readonly state: WebGpuAppRenderTargetResourceState;
}

export type WebGpuAppUserPassRenderTargetResolution =
  | { readonly ok: true; readonly realized: WebGpuAppRealizedRenderTarget }
  | {
      readonly ok: false;
      readonly reason:
        | "unknown"
        | "not-ready"
        | "not-2d"
        | "msaa-unsupported"
        | "creation-failed";
      readonly message: string;
    };

/**
 * Resolve a string handle to a realized facade render target (2d,
 * single-sample). Used for user-pass writes (attachments) and reads
 * (sampleable views). The id is the facade registration id — the same id
 * `renderTargets.register({ id })` and `Camera.renderTargetId` use.
 */
export function resolveWebGpuAppUserPassRenderTarget(
  context: WebGpuAppUserPassTargetContext,
  handleId: string,
): WebGpuAppUserPassRenderTargetResolution {
  const handle = createRenderTargetHandle(handleId);
  const entry = context.assets.get<"render-target", unknown>(handle);

  if (entry === undefined) {
    return {
      ok: false,
      reason: "unknown",
      message: `No render target asset is registered under id '${handleId}'. Register a facade render target with that id (or write "scene-color").`,
    };
  }

  if (entry.status !== "ready" || !isRenderTargetAsset(entry.asset)) {
    if (entry.status === "ready") {
      return {
        ok: false,
        reason: "unknown",
        message: `Render target '${handleId}' is not a facade render-target source asset; user passes can only write facade-registered targets.`,
      };
    }

    return {
      ok: false,
      reason: "not-ready",
      message: `Render target '${handleId}' has status '${entry.status}', expected 'ready'.`,
    };
  }

  if (entry.asset.dimension !== "2d") {
    return {
      ok: false,
      reason: "not-2d",
      message: `Render target '${handleId}' is a '${entry.asset.dimension}' target; user passes can only write 2d targets.`,
    };
  }

  if (entry.asset.msaa !== 1) {
    return {
      ok: false,
      reason: "msaa-unsupported",
      message: `Render target '${handleId}' declares msaa ${String(entry.asset.msaa)}; user passes write single-sample targets only.`,
    };
  }

  const realized = realizeWebGpuAppRenderTarget({
    device: context.device,
    state: context.state,
    handle,
    asset: entry.asset,
    version: entry.version,
  });

  if (!realized.ok) {
    return { ok: false, reason: "creation-failed", message: realized.message };
  }

  return { ok: true, realized: realized.realized };
}

export interface WebGpuAppUserPassResolvedWrite {
  readonly write: PassWrite;
  /** Null for the "scene-color" write; the realized facade target otherwise. */
  readonly realized: WebGpuAppRealizedRenderTarget | null;
}

export interface WebGpuAppUserPassColorWritePlan {
  /** Resolved writes in declaration order (attachment order). */
  readonly writes: readonly WebGpuAppUserPassResolvedWrite[];
  /** True when any write targets scene-color (host depth stays attached). */
  readonly usesSceneColor: boolean;
}

/**
 * Resolve a user render pass's declared writes into an attachment plan.
 * Returns null (with structured diagnostics) when the pass cannot run:
 * unknown/unavailable write targets, scene-color mixed with target writes,
 * or attachment size mismatches. A pass with no writes (or only
 * "scene-color" writes) keeps the scene-color overlay behavior.
 */
export function planWebGpuAppUserPassColorWrites(options: {
  readonly context: WebGpuAppUserPassTargetContext;
  readonly passName: string;
  readonly writes: readonly PassWrite[];
  readonly diagnostics: unknown[];
}): WebGpuAppUserPassColorWritePlan | null {
  const resolved: WebGpuAppUserPassResolvedWrite[] = [];
  let usesSceneColor = options.writes.length === 0;
  let usesTargets = false;

  for (const write of options.writes) {
    if (write.handle === "scene-color") {
      resolved.push({ write, realized: null });
      usesSceneColor = true;
      continue;
    }

    const resolution = resolveWebGpuAppUserPassRenderTarget(
      options.context,
      write.handle,
    );

    if (!resolution.ok) {
      options.diagnostics.push({
        code: "webgpu.userPass.renderWriteTargetUnavailable",
        severity: "warning",
        message: `User render pass '${options.passName}' declared write target '${write.handle}' that cannot be attached (${resolution.reason}): ${resolution.message} The pass was skipped.`,
        data: {
          pass: options.passName,
          handle: write.handle,
          reason: resolution.reason,
        },
      });
      return null;
    }

    resolved.push({ write, realized: resolution.realized });
    usesTargets = true;
  }

  // A pass writes EITHER scene-color (the depth-tested host overlay) OR its
  // own render targets — mixing them in one pass would force the host and
  // the targets to share dimensions and depth semantics.
  if (usesSceneColor && usesTargets) {
    options.diagnostics.push({
      code: "webgpu.userPass.renderWriteMixedSceneAndTargets",
      severity: "warning",
      message: `User render pass '${options.passName}' declares both "scene-color" and render-target writes; a render pass writes either scene-color or its own targets. Split it into two passes. The pass was skipped.`,
      data: { pass: options.passName },
    });
    return null;
  }

  // WebGPU requires every attachment of a pass to share dimensions.
  const first = resolved[0]?.realized;

  if (
    usesTargets &&
    first !== undefined &&
    first !== null &&
    resolved.some(
      (entry) =>
        entry.realized !== null &&
        (entry.realized.width !== first.width ||
          entry.realized.height !== first.height),
    )
  ) {
    options.diagnostics.push({
      code: "webgpu.userPass.renderWriteSizeMismatch",
      severity: "warning",
      message: `User render pass '${options.passName}' declared write targets with mismatched sizes (${resolved
        .map((entry) =>
          entry.realized === null
            ? "scene-color"
            : `${String(entry.realized.width)}x${String(entry.realized.height)}`,
        )
        .join(
          ", ",
        )}); every attachment of a render pass must share dimensions. The pass was skipped.`,
      data: { pass: options.passName },
    });
    return null;
  }

  return { writes: resolved, usesSceneColor };
}

/** RenderPassColorAttachmentInput for a resolved non-scene user-pass write. */
export function userPassWriteAttachmentInput(
  entry: WebGpuAppUserPassResolvedWrite,
): RenderPassColorAttachmentInput {
  const realized = entry.realized;

  return {
    view: realized?.view ?? null,
    loadOp: entry.write.attachment,
    storeOp: "store",
    ...(entry.write.attachment === "clear"
      ? { clearColor: entry.write.clearColor ?? [0, 0, 0, 0] }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Custom-material MRT (colorTargets) attachment planning
// ---------------------------------------------------------------------------

export interface WebGpuAppCustomColorTargetsPlan {
  /** Pipeline cache key that identifies this material's draws in a pass. */
  readonly pipelineKey: string;
  /** Attachment dimensions every hosting pass must match. */
  readonly width: number;
  readonly height: number;
  /** Attachment inputs for @location(1..N-1), in declaration order. */
  readonly attachments: readonly RenderPassColorAttachmentInput[];
  /** Stable handle keys (`render-target:<id>`) of the extra targets. */
  readonly handles: readonly string[];
  /** Plain facade ids of the extra targets (user-pass read mapping). */
  readonly targetIds: readonly string[];
}

export interface ResolveWebGpuAppCustomMaterialColorTargetsResult {
  readonly valid: boolean;
  /** Null when the material declares no extra targets (single target). */
  readonly plan: WebGpuAppCustomColorTargetsPlan | null;
  readonly diagnostics: readonly unknown[];
}

/**
 * Realize the facade render targets a custom material's colorTargets
 * declaration pairs with @location(1..N-1) and build their attachment
 * inputs. Extra targets clear to transparent black at the start of each MRT
 * pass and always store (they exist to be read later).
 */
export function resolveWebGpuAppCustomMaterialColorTargets(options: {
  readonly assets: AssetRegistry;
  readonly device: unknown;
  readonly state: WebGpuAppRenderTargetResourceState;
  readonly material: PreparedCustomWgslMaterial;
  readonly pipelineCacheKey: string;
  /** The pass color format target 0 renders into (the "swapchain" sentinel). */
  readonly passColorFormat: string;
  readonly appFormat: string;
  readonly sampleCount: number;
}): ResolveWebGpuAppCustomMaterialColorTargetsResult {
  const colorTargets = options.material.pipeline.colorTargets;

  if (colorTargets === undefined || colorTargets.length <= 1) {
    return { valid: true, plan: null, diagnostics: [] };
  }

  const materialKey = options.material.sourceMaterialKey;
  const diagnostics: unknown[] = [];

  if (options.sampleCount > 1) {
    diagnostics.push({
      code: "webGpuApp.customWgslColorTargetsMsaaUnsupported",
      message: `Custom material '${materialKey}' declares ${String(colorTargets.length)} color targets, but the app renders at sample count ${String(options.sampleCount)}; MRT custom materials require a single-sample app (extra attachments have no MSAA resolve). Create the app without { msaa: 4 } or drop the colorTargets declaration.`,
      data: { material: materialKey, sampleCount: options.sampleCount },
    });
    return { valid: false, plan: null, diagnostics };
  }

  // Realization resolves `format: "swapchain"` against the app format; keep
  // the realizer's knowledge authoritative even before the first frame-target
  // resolution ran this frame.
  options.state.appFormat ??= options.appFormat;

  const attachments: RenderPassColorAttachmentInput[] = [];
  const handles: string[] = [];
  const targetIds: string[] = [];
  let width: number | null = null;
  let height: number | null = null;

  for (let index = 1; index < colorTargets.length; index += 1) {
    const declaration = colorTargets[index];
    const handle = declaration?.renderTarget;

    if (declaration === undefined || handle === undefined) {
      // Validation rejects this at prepare time; guard against hand-built
      // prepared materials.
      diagnostics.push({
        code: "webGpuApp.customWgslColorTargetUnavailable",
        message: `Custom material '${materialKey}' colorTargets[${String(index)}] pairs no render-target handle.`,
        data: { material: materialKey, index },
      });
      return { valid: false, plan: null, diagnostics };
    }

    const resolution = resolveWebGpuAppUserPassRenderTarget(
      { assets: options.assets, device: options.device, state: options.state },
      handle.id,
    );

    if (!resolution.ok) {
      diagnostics.push({
        code: "webGpuApp.customWgslColorTargetUnavailable",
        message: `Custom material '${materialKey}' colorTargets[${String(index)}] render target '${handle.id}' cannot be attached (${resolution.reason}): ${resolution.message}`,
        data: {
          material: materialKey,
          index,
          renderTargetKey: assetHandleKey(handle),
          reason: resolution.reason,
        },
      });
      return { valid: false, plan: null, diagnostics };
    }

    const realized = resolution.realized;
    const declaredFormat = resolveCustomWgslColorTargetFormat(
      declaration.format,
      options.passColorFormat,
    );

    if (declaredFormat !== realized.format) {
      diagnostics.push({
        code: "webGpuApp.customWgslColorTargetFormatMismatch",
        message: `Custom material '${materialKey}' colorTargets[${String(index)}] declares format '${declaredFormat}' but render target '${handle.id}' realized as '${realized.format}'. Align the declaration with the target's format.`,
        data: {
          material: materialKey,
          index,
          renderTargetKey: realized.renderTargetKey,
          declaredFormat,
          realizedFormat: realized.format,
        },
      });
      return { valid: false, plan: null, diagnostics };
    }

    if (width === null || height === null) {
      width = realized.width;
      height = realized.height;
    } else if (width !== realized.width || height !== realized.height) {
      diagnostics.push({
        code: "webGpuApp.customWgslColorTargetSizeMismatch",
        message: `Custom material '${materialKey}' colorTargets pair render targets with mismatched sizes; every attachment of the MRT pass must share dimensions (target '${handle.id}' is ${String(realized.width)}x${String(realized.height)}, expected ${String(width)}x${String(height)}).`,
        data: {
          material: materialKey,
          renderTargetKey: realized.renderTargetKey,
        },
      });
      return { valid: false, plan: null, diagnostics };
    }

    attachments.push({
      view: realized.view,
      loadOp: "clear",
      clearColor: [0, 0, 0, 0],
      storeOp: "store",
    });
    handles.push(realized.renderTargetKey);
    targetIds.push(handle.id);
  }

  return {
    valid: true,
    plan: {
      pipelineKey: options.pipelineCacheKey,
      width: width ?? 0,
      height: height ?? 0,
      attachments,
      handles,
      targetIds,
    },
    diagnostics,
  };
}
