import {
  type AssetRegistry,
  assetHandleKey,
} from "@aperture-engine/simulation";
import type { RenderSnapshot } from "@aperture-engine/render";
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
  };
}

export function createWebGpuAppFrameBoundaryTargets(
  app: WebGpuAppFrameBoundaryTargetApp,
  assets: AssetRegistry,
  snapshot: RenderSnapshot,
): {
  readonly targets: readonly WebGpuAppFrameBoundaryTarget[];
  readonly diagnostics: readonly unknown[];
} {
  const targets: WebGpuAppFrameBoundaryTarget[] = [];
  const diagnostics: unknown[] = [];
  const canvasDimensions = webGpuAppCanvasDimensions(app.canvas);

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
