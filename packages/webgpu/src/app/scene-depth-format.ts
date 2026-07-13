import type { RenderSnapshot } from "@aperture-engine/render";
import {
  WEBGPU_APP_DEPTH_FORMAT,
  WEBGPU_APP_STENCIL_DEPTH_FORMAT,
} from "../resources/textures/depth-texture-resource.js";
import { pipelineKeyDeclaresStencil } from "../materials/core/material-render-state.js";

/**
 * D1 (stencil support): select the frame's scene depth attachment format. When
 * ANY mesh draw's material enables stencil (its pipeline key carries a
 * `stencil:…` token), the whole frame's scene depth becomes the stencil-capable
 * `depth24plus-stencil8` so every pipeline drawing into the pass agrees on the
 * depth-stencil format (WebGPU requires the render pipeline's `depthStencil`
 * format to match the pass's depth attachment). Otherwise the depth-only
 * `depth24plus` is kept, so non-stencil frames stay byte-identical.
 *
 * Custom-WGSL material draws ride `meshDraws` too (with their own pipeline
 * key), so this one scan covers built-in AND custom materials.
 */
export function webGpuAppSceneDepthFormat(snapshot: RenderSnapshot): string {
  for (const draw of snapshot.meshDraws) {
    if (pipelineKeyDeclaresStencil(draw.batchKey.pipelineKey)) {
      return WEBGPU_APP_STENCIL_DEPTH_FORMAT;
    }
  }

  return WEBGPU_APP_DEPTH_FORMAT;
}
