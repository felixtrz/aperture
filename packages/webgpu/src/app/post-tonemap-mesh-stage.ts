import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { RenderSnapshot } from "@aperture-engine/render";
import {
  webGpuAppUsesPostTonemapMeshStage,
  type WebGpuAppPostTonemapStageContext,
} from "./render-color-format.js";

const NO_POST_TONEMAP_RENDER_IDS: ReadonlySet<number> = new Set<number>();

/**
 * Render ids of the frame's `renderStage: "post-tonemap"` mesh draws.
 *
 * Returned empty — with no allocation and no snapshot scan — whenever the app
 * has no post stack to render after (see
 * `webGpuAppUsesPostTonemapMeshStage`), so scene-stage frames pay nothing and
 * a post-tonemap material degrades to an ordinary scene draw instead of
 * addressing a pass that will not be encoded.
 */
export function webGpuAppPostTonemapMeshRenderIds(
  app: WebGpuAppPostTonemapStageContext,
  snapshot: RenderSnapshot,
): ReadonlySet<number> {
  if (!webGpuAppUsesPostTonemapMeshStage(app)) {
    return NO_POST_TONEMAP_RENDER_IDS;
  }

  let renderIds: Set<number> | null = null;

  for (const draw of snapshot.meshDraws) {
    if (draw.renderStage !== "post-tonemap") {
      continue;
    }

    renderIds ??= new Set<number>();
    renderIds.add(draw.renderId);
  }

  return renderIds ?? NO_POST_TONEMAP_RENDER_IDS;
}

/**
 * Overlay command stream for a frame boundary: post-tonemap MESH draws first,
 * then the feature realizers' overlay commands (particles at ordinal 1000, UI
 * at 2000). Mesh overlays are world geometry that belongs under both — a board
 * decal must not paint over the sparks or the HUD above it.
 */
export function webGpuAppOverlayCommandsWithPostTonemapMeshDraws(
  postTonemapMeshCommands: readonly RenderPassCommand[],
  featureOverlayCommands: readonly RenderPassCommand[],
): readonly RenderPassCommand[] {
  if (postTonemapMeshCommands.length === 0) {
    return featureOverlayCommands;
  }

  return [...postTonemapMeshCommands, ...featureOverlayCommands];
}
