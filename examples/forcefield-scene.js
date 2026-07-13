// Shared scene for the forcefield example (B4): a transparent custom WGSL
// material samples the SCENE DEPTH (read-only, post-opaque) to draw a
// soft-edge intersection "forcefield" that glows where it meets nearby opaque
// geometry and fades to its faint base over the far background.
//
// The forcefield is a flat slab facing the camera at a CONSTANT depth, so the
// only variable across the screen is the depth of the geometry BEHIND it:
//   - left half  -> an opaque wall sits just behind the slab (small depth
//                   delta) -> strong green intersection glow;
//   - right half -> nothing behind the slab (far background, large delta) ->
//                   no glow, just the faint cyan base.
// That isolates the depth-fade: identical forcefield fragments, different
// scene depth, visibly different output.

export const clearColor = [0.02, 0.03, 0.06, 1];
export const forcefieldCanvasSize = { width: 320, height: 320 };
export const forcefieldFrameCount = 3;

// The wall and forcefield base are BLUE (low red); the intersection glow is
// RED-orange. So red in the final image comes ONLY from the depth-driven glow,
// which isolates the depth-fade from the underlying wall/background brightness.
export const wallColor = [0.14, 0.16, 0.5, 1];
export const forcefieldBaseColor = [0.08, 0.18, 0.6];
export const forcefieldGlowColor = [1.0, 0.4, 0.12];

// Normalized canvas sample points for the e2e screenshot. The forcefield slab
// covers the whole view at a constant depth; the ONLY variable is the depth of
// the geometry behind it:
//   - left-glow*: over the NEAR wall  -> strong red glow;
//   - right-base*: over the FAR background -> faint blue base, no red glow.
// Red(left) >> Red(right) proves the depth-dependent fade.
export const forcefieldSamplePoints = [
  { id: "left-glow", x: 0.28, y: 0.5 },
  { id: "left-glow-top", x: 0.28, y: 0.24 },
  { id: "right-base", x: 0.72, y: 0.5 },
  { id: "right-base-bottom", x: 0.72, y: 0.76 },
];

// The forcefield WGSL is parameterized by whether the scene depth is sampled as
// a multisampled attachment (MSAA path) or a single-sample one. Only the depth
// texture type + textureLoad sample index differ; everything else is shared.
function forcefieldWgsl(multisampled) {
  const depthTextureType = multisampled
    ? "texture_depth_multisampled_2d"
    : "texture_depth_2d";
  const loadDepth = multisampled
    ? "textureLoad(sceneDepth, coord, 0)"
    : "textureLoad(sceneDepth, coord, 0)";

  return `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
};

struct ForcefieldParams {
  // x = intersection thickness (window-depth units); yzw unused.
  thickness: vec4f,
  baseColor: vec4f,
  glowColor: vec4f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var sceneDepth: ${depthTextureType};
@group(2) @binding(1) var<uniform> params: ForcefieldParams;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let world = worldTransforms[input.instanceIndex];
  var output: VertexOutput;
  output.position = view.viewProjection * world * vec4f(input.position, 1.0);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  // Sample the stored scene depth at this fragment's pixel (read-only: the
  // opaque pass wrote it, this transparent draw only reads it).
  let coord = vec2i(i32(input.position.x), i32(input.position.y));
  let sceneDepth = ${loadDepth};
  let fragDepth = input.position.z;

  // delta > 0 => scene geometry sits BEHIND the forcefield. Small delta means
  // the forcefield is close to that geometry -> a bright intersection glow.
  let delta = sceneDepth - fragDepth;
  let glow = 1.0 - clamp(delta / max(params.thickness.x, 1e-6), 0.0, 1.0);

  let color = mix(params.baseColor.rgb, params.glowColor.rgb, glow);
  let alpha = clamp(0.2 + glow * 0.75, 0.0, 1.0);
  return vec4f(color, alpha);
}
`;
}

export function registerForcefieldScene(aperture, registry, options = {}) {
  const multisampled = options.multisampled === true;
  const assets = aperture.createRenderAssetCollections({ registry });

  // Opaque wall covering the LEFT half of the view, sitting just behind the
  // forcefield slab so the depth delta there is small.
  const wallMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "ForcefieldWall",
      width: 3.4,
      height: 6,
      depth: 0.4,
    }),
    { id: "forcefield-wall-mesh" },
  );
  const wallMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "ForcefieldWall",
      baseColorFactor: new Float32Array(wallColor),
    }),
    { id: "forcefield-wall-material" },
  );

  // The forcefield: a flat slab facing the camera at a constant depth. Its
  // custom material samples the scene depth (renderer-owned "scene-depth"
  // source) and MUST be transparent (alphaMode "blend") so it renders in the
  // post-opaque read-only-depth boundary.
  const forcefieldMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "ForcefieldSlab",
      width: 6,
      height: 6,
      depth: 0.05,
    }),
    { id: "forcefield-slab-mesh" },
  );
  const forcefieldMaterial = assets.materials.customWgsl.add(
    aperture.createCustomWgslMaterialAsset({
      familyKey: "example/forcefield",
      label: "Forcefield Depth Fade",
      shader: {
        kind: "inline-wgsl",
        code: forcefieldWgsl(multisampled),
        virtualPath: "forcefield.wgsl",
      },
      entryPoints: { vertex: "vs_main", fragment: "fs_main" },
      renderState: {
        alphaMode: "blend",
        blend: { preset: "alpha" },
        cullMode: "back",
        depth: { test: true, write: false, compare: "less-equal" },
      },
      bindings: [
        {
          name: "sceneDepth",
          binding: 0,
          kind: "texture",
          visibility: ["fragment"],
          source: "scene-depth",
          sampleType: "depth",
          ...(multisampled ? { multisampled: true } : {}),
        },
        {
          name: "params",
          binding: 1,
          kind: "uniform-buffer",
          visibility: ["fragment"],
          fields: {
            thickness: { type: "vec4" },
            baseColor: { type: "vec4" },
            glowColor: { type: "vec4" },
          },
          values: {
            thickness: [0.012, 0, 0, 0],
            baseColor: [...forcefieldBaseColor, 1],
            glowColor: [...forcefieldGlowColor, 1],
          },
        },
      ],
    }),
    { id: "forcefield-material" },
  );

  return {
    wallMesh,
    wallMaterial,
    forcefieldMesh,
    forcefieldMaterial,
    multisampled,
    forcefieldMaterialKey: aperture.assetHandleKey(forcefieldMaterial),
  };
}

// Spawn the wall + forcefield + cameras into an extraction app. Shared by the
// worker (extraction) so main and worker stay in lockstep.
//
// TWO swapchain cameras keep the opaque wall and the depth-sampling forcefield
// in SEPARATE frame submissions so the forcefield's submission can attach the
// depth READ-ONLY and sample it:
//   - camera A (priority 0, layer 1) renders the opaque wall + writes depth;
//   - camera B (priority 1, layer 2) renders ONLY the forcefield, loading
//     camera A's colour + depth (read-only) so the forcefield samples the
//     stored depth and depth-tests against the wall.
export function spawnForcefieldEntities(aperture, app, registered, canvasSize) {
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);
  const cameraTransform = { translation: [0, 0, 4] };
  const projection = { aspect, fovYDegrees: 55, near: 0.1, far: 100 };

  // Camera A: opaque geometry (layer 1), clears the swapchain.
  app.spawn(
    aperture.withTransform(cameraTransform),
    aperture.withCamera({
      ...projection,
      priority: 0,
      layerMask: 1,
      clearColor,
    }),
  );

  // Camera B: the forcefield overlay (layer 2), same view, drawn after A.
  app.spawn(
    aperture.withTransform(cameraTransform),
    aperture.withCamera({
      ...projection,
      priority: 1,
      layerMask: 2,
      clearColor,
    }),
  );

  // Opaque wall (layer 1), shifted left so it covers the left half of the view.
  app.spawn(
    aperture.withTransform({ translation: [-1.7, 0, -0.4] }),
    aperture.withMesh(registered.wallMesh),
    aperture.withMaterial(registered.wallMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  // Forcefield slab (layer 2) at the origin (constant depth, facing the camera).
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withMesh(registered.forcefieldMesh),
    aperture.withMaterial(registered.forcefieldMaterial),
    aperture.withRenderLayer(2),
    aperture.withVisibility(true),
  );
}
