import { MAX_CLIP_PLANES, type RenderSnapshot } from "@aperture-engine/render";
import type { BuiltInShaderSourceModule } from "../unlit/unlit-shader.js";

/**
 * D2 (clipping planes). The pipeline-key feature token that marks a mesh draw as
 * clip-enabled. Injected frame-wide (into EVERY mesh-draw pipeline key) by
 * {@link withClipPlanePipelineKeys} whenever any view in the frame has clip
 * planes, and absent otherwise — so a frame with no clipping keeps byte-identical
 * pipeline keys, shader source, and pipelines.
 */
export const CLIP_PLANE_PIPELINE_FEATURE = "clip";

/**
 * True when a mesh-draw pipeline key declares the clip feature. The token is a
 * standalone `|`-delimited segment so a substring like `clipboard` never
 * false-matches.
 */
export function pipelineKeyIncludesClip(
  pipelineKey: string | undefined,
): boolean {
  return (
    pipelineKey !== undefined &&
    pipelineKey.split("|").includes(CLIP_PLANE_PIPELINE_FEATURE)
  );
}

/**
 * Frame-level rewrite (mirrors `withStandardShadowPipelineKeys`): when ANY view
 * in the frame carries clip planes, append the `clip` feature token to EVERY
 * mesh-draw pipeline key so all built-in materials compile the discard path.
 * Per-camera semantics still hold because the plane DATA lives in the per-view
 * uniform: a draw rendered into a non-clipping view reads `clipPlaneCount == 0`
 * and discards nothing. When no view clips, the snapshot is returned untouched
 * so pipeline keys / shaders / pipelines stay byte-identical.
 */
export function withClipPlanePipelineKeys(
  snapshot: RenderSnapshot,
): RenderSnapshot {
  const anyViewClips = snapshot.views.some(
    (view) => (view.clipPlanes?.length ?? 0) > 0,
  );

  if (!anyViewClips) {
    return snapshot;
  }

  let changed = false;
  const meshDraws = snapshot.meshDraws.map((draw) => {
    const pipelineKey = draw.batchKey.pipelineKey;

    if (pipelineKeyIncludesClip(pipelineKey)) {
      return draw;
    }

    changed = true;
    const clippedKey = injectClipFeatureToken(pipelineKey);

    return {
      ...draw,
      batchKey: { ...draw.batchKey, pipelineKey: clippedKey },
      sortKey: { ...draw.sortKey, pipelineKey: clippedKey },
    };
  });

  return changed ? { ...snapshot, meshDraws } : snapshot;
}

// Insert the clip token as the first feature segment (right after the shader
// family), matching the shadow/ibl rewrites' prepend style; the trailing four
// render-state segments the backend parses as `parts.length - 4` are untouched.
function injectClipFeatureToken(pipelineKey: string): string {
  const familyEnd = pipelineKey.indexOf("|");

  if (familyEnd < 0) {
    return `${pipelineKey}|${CLIP_PLANE_PIPELINE_FEATURE}`;
  }

  return `${pipelineKey.slice(0, familyEnd)}|${CLIP_PLANE_PIPELINE_FEATURE}${pipelineKey.slice(familyEnd)}`;
}

// The canonical clip-enabled view uniform struct. Every built-in shader declares
// `struct ViewProjectionUniform`; the clip variant replaces it with this fuller
// layout so unlit/matcap/debug-normal (which normally declare only
// viewProjection + cameraPosition) reach the clip block at its packed offset.
// `clipPlaneCount.x` carries the active count as an f32 (matching the fog `mode`
// convention); `clipPlanes` is the fixed-capacity array the fragment loop walks.
const EXTENDED_VIEW_STRUCT = `struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
  previousViewProjection: mat4x4f,
  fogColor: vec4f,
  fogParams: vec4f,
  clipPlaneCount: vec4f,
  clipPlanes: array<vec4f, ${MAX_CLIP_PLANES}>,
};`;

// The per-fragment discard test. WebGPU core WGSL has no `clip_distances`
// builtin (it is an optional feature absent on SwiftShader), so the discard path
// is the universal implementation: for each active world-space plane, keep the
// fragment where `dot(worldPos, plane.xyz) + plane.w >= 0` and `discard`
// otherwise. `view.clipPlaneCount.x` is uniform across the draw, so the loop is
// uniform control flow.
const CLIP_TEST_BLOCK = `  {
    let apertureClipPlaneCount = u32(view.clipPlaneCount.x);
    for (
      var apertureClipPlaneIndex = 0u;
      apertureClipPlaneIndex < apertureClipPlaneCount;
      apertureClipPlaneIndex = apertureClipPlaneIndex + 1u
    ) {
      let apertureClipPlane = view.clipPlanes[apertureClipPlaneIndex];
      if (dot(input.worldPosition, apertureClipPlane.xyz) + apertureClipPlane.w < 0.0) {
        discard;
      }
    }
  }`;

const VIEW_STRUCT_PATTERN = /struct ViewProjectionUniform \{[\s\S]*?\};/;
const VERTEX_OUTPUT_PATTERN = /struct VertexOutput \{([\s\S]*?)\};/;
const FRAGMENT_ENTRY_PATTERN =
  /fn fs_main\([^{]*->\s*@location\(0\)\s*vec4f\s*\{/;
const WORLD_TRANSFORM_LOOKUP =
  "let world = worldTransforms[input.instanceIndex];";

/**
 * Rewrite a built-in mesh shader so its fragment entry discards fragments
 * outside the view's active clip planes. Applied ONLY to clip-enabled pipelines
 * (gated on {@link pipelineKeyIncludesClip}); a non-clip pipeline keeps the
 * original source byte-for-byte. The transform is source-agnostic across
 * standard/unlit/matcap/debug-normal: it (1) extends the view uniform struct,
 * (2) ensures a `worldPosition` fragment varying exists (adding it to unlit and
 * debug-normal, which lack one; standard and matcap already carry it), and
 * (3) injects the discard loop at the top of `fs_main`.
 */
export function injectCameraClipPlanesWgsl(code: string): string {
  let out = code.replace(VIEW_STRUCT_PATTERN, EXTENDED_VIEW_STRUCT);

  out = ensureWorldPositionVarying(out);
  out = out.replace(
    FRAGMENT_ENTRY_PATTERN,
    (match) => `${match}\n${CLIP_TEST_BLOCK}`,
  );

  return out;
}

/**
 * Return a clip-enabled copy of a built-in shader module (new label + injected
 * code), or the original module unchanged when clipping is not requested.
 */
export function withInjectedClipPlanes(
  shader: BuiltInShaderSourceModule,
  clipEnabled: boolean,
): BuiltInShaderSourceModule {
  if (!clipEnabled) {
    return shader;
  }

  return {
    ...shader,
    label: `${shader.label}-clip`,
    code: injectCameraClipPlanesWgsl(shader.code),
  };
}

function ensureWorldPositionVarying(code: string): string {
  const vertexOutput = code.match(VERTEX_OUTPUT_PATTERN);

  if (vertexOutput === null) {
    return code;
  }

  const body = vertexOutput[1] ?? "";

  if (body.includes("worldPosition")) {
    // standard/matcap already interpolate a world position varying.
    return code;
  }

  const locations = [...body.matchAll(/@location\((\d+)\)/g)].map((match) =>
    Number(match[1]),
  );
  const nextLocation = locations.length === 0 ? 0 : Math.max(...locations) + 1;
  const withVarying = code.replace(
    vertexOutput[0],
    `struct VertexOutput {${body}  @location(${nextLocation}) worldPosition: vec3f,\n};`,
  );

  // Every built-in vertex entry resolves the instance world matrix with this
  // exact line before writing clip position, so anchor the varying write there.
  return withVarying.replace(
    WORLD_TRANSFORM_LOOKUP,
    `${WORLD_TRANSFORM_LOOKUP}\n  output.worldPosition = (world * vec4f(input.position, 1.0)).xyz;`,
  );
}
