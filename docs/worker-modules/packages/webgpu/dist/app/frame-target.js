import { assetHandleKey, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { resolveNormalizedViewRectangle } from "../resources/views/view-rectangle.js";
import { webGpuAppCanvasDimensions } from "./canvas.js";
import { createWebGpuAppRenderTargetDiagnostic, isWebGpuAppRenderTargetAsset, } from "./render-target.js";
export function createWebGpuAppFrameBoundaryTargets(app, assets, snapshot) {
    const targets = [];
    const diagnostics = [];
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
        const entry = assets.get(view.renderTarget);
        if (entry === undefined) {
            diagnostics.push(createWebGpuAppRenderTargetDiagnostic({
                code: "webGpuApp.renderTargetMissing",
                viewId: view.viewId,
                renderTarget: view.renderTarget,
                message: `View ${view.viewId} targets missing render target asset '${renderTargetKey}'.`,
            }));
            continue;
        }
        if (entry.status !== "ready" || entry.asset === null) {
            diagnostics.push(createWebGpuAppRenderTargetDiagnostic({
                code: "webGpuApp.renderTargetNotReady",
                viewId: view.viewId,
                renderTarget: view.renderTarget,
                status: entry.status,
                message: `View ${view.viewId} targets render target '${renderTargetKey}' with status '${entry.status}', expected 'ready'.`,
            }));
            continue;
        }
        const asset = entry.asset;
        if (!isWebGpuAppRenderTargetAsset(asset)) {
            diagnostics.push(createWebGpuAppRenderTargetDiagnostic({
                code: "webGpuApp.renderTargetInvalid",
                viewId: view.viewId,
                renderTarget: view.renderTarget,
                message: `View ${view.viewId} targets render target '${renderTargetKey}' without a valid WebGPU texture and dimensions.`,
            }));
            continue;
        }
        const assetFormat = asset.format ?? app.initialization.format;
        if (assetFormat !== app.initialization.format) {
            diagnostics.push(createWebGpuAppRenderTargetDiagnostic({
                code: "webGpuApp.renderTargetFormatMismatch",
                viewId: view.viewId,
                renderTarget: view.renderTarget,
                message: `View ${view.viewId} targets render target '${renderTargetKey}' with format '${assetFormat}', but the app pipeline format is '${app.initialization.format}'.`,
            }));
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
export function findLastSwapchainTargetIndex(targets) {
    for (let index = targets.length - 1; index >= 0; index -= 1) {
        if (targets[index]?.source === "swapchain") {
            return index;
        }
    }
    return -1;
}
export function countWebGpuAppFrameBoundaryTargetSubmissions(targets) {
    const counts = new Map();
    for (const target of targets) {
        const key = webGpuAppFrameBoundaryTargetSubmissionKey(target);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}
export function webGpuAppFrameBoundaryTargetSubmissionKey(target) {
    return target.source === "swapchain"
        ? "swapchain"
        : `offscreen:${target.renderTargetKey}`;
}
export function resolveWebGpuAppTargetViewRectangles(target) {
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
//# sourceMappingURL=frame-target.js.map