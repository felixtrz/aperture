import {
  type AssetRegistry,
  assetHandleKey,
} from "@aperture-engine/simulation";
import {
  isRenderTargetAsset,
  type RenderSnapshot,
} from "@aperture-engine/render";
import type { FrameBoundaryViewRectangle } from "../render/frame/frame-boundary.js";
import { resolveNormalizedViewRectangle } from "../resources/views/view-rectangle.js";
import type { WebGpuCanvasLike } from "../gpu/initialize-webgpu.js";
import type { CurrentTextureLike } from "./presentation/current-texture-view.js";
import { webGpuAppCanvasDimensions } from "./canvas.js";
import {
  createWebGpuAppRenderTargetDiagnostic,
  isWebGpuAppRenderTargetAsset,
  type WebGpuAppRenderTargetAsset,
} from "./render-target.js";
import {
  realizeWebGpuAppRenderTarget,
  type WebGpuAppRenderTargetResourceState,
} from "./render-target-resources.js";

export type WebGpuAppFrameBoundaryTarget =
  | {
      readonly source: "swapchain";
      readonly view: RenderSnapshot["views"][number];
      readonly renderTargetKey: null;
      readonly width: number;
      readonly height: number;
      readonly format: string;
    }
  | {
      readonly source: "offscreen";
      readonly view: RenderSnapshot["views"][number];
      readonly renderTargetKey: string;
      readonly texture: CurrentTextureLike;
      readonly width: number;
      readonly height: number;
      readonly format: string;
    };

interface WebGpuAppFrameBoundaryTargetApp {
  readonly canvas: WebGpuCanvasLike;
  readonly initialization: {
    readonly format: string;
    readonly device?: unknown;
  };
  readonly msaa?: {
    readonly sampleCount: number;
  };
}

export function createWebGpuAppFrameBoundaryTargets(
  app: WebGpuAppFrameBoundaryTargetApp,
  assets: AssetRegistry,
  snapshot: RenderSnapshot,
  options: {
    /**
     * B1: realization state for renderer-independent `RenderTargetAsset`
     * sources. Without it, facade render-target assets cannot be realized
     * and surface `webGpuApp.renderTargetCreationFailed`.
     */
    readonly renderTargets?: WebGpuAppRenderTargetResourceState;
  } = {},
): {
  readonly targets: readonly WebGpuAppFrameBoundaryTarget[];
  readonly diagnostics: readonly unknown[];
} {
  const targets: WebGpuAppFrameBoundaryTarget[] = [];
  const diagnostics: unknown[] = [];
  const canvasDimensions = webGpuAppCanvasDimensions(app.canvas);
  const renderTargetState = options.renderTargets ?? null;

  if (renderTargetState !== null) {
    // Keep the realizer's swapchain-format and MSAA knowledge authoritative
    // for out-of-band consumers (the texture-binding sampling fallback).
    renderTargetState.appFormat = app.initialization.format;
    renderTargetState.appSampleCount =
      app.msaa?.sampleCount ?? renderTargetState.appSampleCount;
  }

  for (const view of snapshot.views) {
    if (view.renderTarget === null) {
      targets.push({
        source: "swapchain",
        view,
        renderTargetKey: null,
        ...canvasDimensions,
        format: app.initialization.format,
      });
      continue;
    }

    const renderTargetKey = assetHandleKey(view.renderTarget);
    const entry = assets.get<"render-target", WebGpuAppRenderTargetAsset>(
      view.renderTarget,
    );

    if (entry === undefined) {
      diagnostics.push(
        createWebGpuAppRenderTargetDiagnostic({
          code: "webGpuApp.renderTargetMissing",
          viewId: view.viewId,
          renderTarget: view.renderTarget,
          message: `View ${view.viewId} targets missing render target asset '${renderTargetKey}'.`,
        }),
      );
      continue;
    }

    if (entry.status !== "ready" || entry.asset === null) {
      diagnostics.push(
        createWebGpuAppRenderTargetDiagnostic({
          code: "webGpuApp.renderTargetNotReady",
          viewId: view.viewId,
          renderTarget: view.renderTarget,
          status: entry.status,
          message: `View ${view.viewId} targets render target '${renderTargetKey}' with status '${entry.status}', expected 'ready'.`,
        }),
      );
      continue;
    }

    const asset = entry.asset;

    // B1: renderer-independent render-target source assets are realized into
    // renderer-owned GPU textures here (keyed handle + version; version bumps
    // destroy and recreate). The low-level live-texture route below is
    // untouched.
    if (isRenderTargetAsset(asset)) {
      const appSampleCount =
        app.msaa?.sampleCount ?? renderTargetState?.appSampleCount ?? 1;

      if (asset.msaa === 4 && appSampleCount !== 4) {
        diagnostics.push(
          createWebGpuAppRenderTargetDiagnostic({
            code: "webGpuApp.renderTargetMsaaUnavailable",
            viewId: view.viewId,
            renderTarget: view.renderTarget,
            message: `View ${view.viewId} targets render target '${renderTargetKey}' declaring msaa 4, but the app renders at sample count ${String(appSampleCount)}. Create the app with { msaa: 4 } so the target resolves 4x MSAA, or drop the target's msaa declaration.`,
          }),
        );
        continue;
      }

      const resolvedFormat =
        asset.format === "swapchain" ? app.initialization.format : asset.format;

      if (resolvedFormat !== app.initialization.format) {
        diagnostics.push(
          createWebGpuAppRenderTargetDiagnostic({
            code: "webGpuApp.renderTargetFormatMismatch",
            viewId: view.viewId,
            renderTarget: view.renderTarget,
            message: `View ${view.viewId} targets render target '${renderTargetKey}' with format '${resolvedFormat}', but the app pipeline format is '${app.initialization.format}'. Declare format: "swapchain" (the default) to follow the canvas format.`,
          }),
        );
        continue;
      }

      if (renderTargetState === null) {
        diagnostics.push(
          createWebGpuAppRenderTargetDiagnostic({
            code: "webGpuApp.renderTargetCreationFailed",
            viewId: view.viewId,
            renderTarget: view.renderTarget,
            message: `View ${view.viewId} targets render target '${renderTargetKey}' but no render-target realization state was provided to the frame boundary.`,
          }),
        );
        continue;
      }

      const realizeResult = realizeWebGpuAppRenderTarget({
        device: app.initialization.device,
        state: renderTargetState,
        handle: view.renderTarget,
        asset,
        version: entry.version,
      });

      if (!realizeResult.ok) {
        diagnostics.push(
          createWebGpuAppRenderTargetDiagnostic({
            code:
              realizeResult.reason === "invalid-asset"
                ? "webGpuApp.renderTargetInvalid"
                : "webGpuApp.renderTargetCreationFailed",
            viewId: view.viewId,
            renderTarget: view.renderTarget,
            message: `View ${view.viewId} targets render target '${renderTargetKey}': ${realizeResult.message}`,
          }),
        );
        continue;
      }

      targets.push({
        source: "offscreen",
        view,
        renderTargetKey,
        texture: realizeResult.realized.texture,
        width: realizeResult.realized.width,
        height: realizeResult.realized.height,
        format: realizeResult.realized.format,
      });
      continue;
    }

    if (!isWebGpuAppRenderTargetAsset(asset)) {
      diagnostics.push(
        createWebGpuAppRenderTargetDiagnostic({
          code: "webGpuApp.renderTargetInvalid",
          viewId: view.viewId,
          renderTarget: view.renderTarget,
          message: `View ${view.viewId} targets render target '${renderTargetKey}' without a valid WebGPU texture and dimensions.`,
        }),
      );
      continue;
    }

    const assetFormat = asset.format ?? app.initialization.format;

    if (assetFormat !== app.initialization.format) {
      diagnostics.push(
        createWebGpuAppRenderTargetDiagnostic({
          code: "webGpuApp.renderTargetFormatMismatch",
          viewId: view.viewId,
          renderTarget: view.renderTarget,
          message: `View ${view.viewId} targets render target '${renderTargetKey}' with format '${assetFormat}', but the app pipeline format is '${app.initialization.format}'.`,
        }),
      );
      continue;
    }

    targets.push({
      source: "offscreen",
      view,
      renderTargetKey,
      texture: asset.texture,
      width: asset.width,
      height: asset.height,
      format: assetFormat,
    });
  }

  return { targets, diagnostics };
}

export function findLastSwapchainTargetIndex(
  targets: readonly WebGpuAppFrameBoundaryTarget[],
): number {
  for (let index = targets.length - 1; index >= 0; index -= 1) {
    if (targets[index]?.source === "swapchain") {
      return index;
    }
  }

  return -1;
}

export function countWebGpuAppFrameBoundaryTargetSubmissions(
  targets: readonly WebGpuAppFrameBoundaryTarget[],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const target of targets) {
    const key = webGpuAppFrameBoundaryTargetSubmissionKey(target);

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

export function webGpuAppFrameBoundaryTargetSubmissionKey(
  target: WebGpuAppFrameBoundaryTarget,
): string {
  return target.source === "swapchain"
    ? "swapchain"
    : `offscreen:${target.renderTargetKey}`;
}

export function resolveWebGpuAppTargetViewRectangles(
  target: WebGpuAppFrameBoundaryTarget,
): {
  readonly valid: boolean;
  readonly viewport: FrameBoundaryViewRectangle | null;
  readonly scissor: FrameBoundaryViewRectangle | null;
  readonly diagnostics: readonly unknown[];
} {
  const viewport = resolveNormalizedViewRectangle({
    rect: target.view.viewport,
    target,
    label: `view ${target.view.viewId} viewport`,
  });
  const scissor = resolveNormalizedViewRectangle({
    rect: target.view.scissor,
    target,
    label: `view ${target.view.viewId} scissor`,
  });

  return {
    valid: viewport.valid && scissor.valid,
    viewport: viewport.rect,
    scissor: scissor.rect,
    diagnostics: [...viewport.diagnostics, ...scissor.diagnostics],
  };
}
