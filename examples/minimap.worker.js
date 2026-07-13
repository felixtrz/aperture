import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { defineApertureConfig } from "@aperture-engine/app/config";
import {
  LocalTransform,
  RenderLayer,
  createSystem,
  material,
  mesh,
} from "@aperture-engine/app/systems";

// B1 (three.js parity plan): render-target authoring on the app facade. A
// small arena (ground + four colored corner boxes + a moving player box) is
// rendered twice each frame: an overhead orthographic camera renders the
// scene into a facade-registered render target
// (`this.renderTargets.register(...)` + `spawn.camera({ renderTarget })`),
// and the main perspective chase camera renders to the canvas with a
// screen-space HUD quad in the upper-left corner whose custom-WGSL material
// samples the target's color texture via
// `material.texture(..., { texture: this.renderTargets.colorTexture(id) })`.
// The minimap camera has the LOWER priority so its pass is ordered before
// the main pass and the HUD samples same-frame content. Render layers keep
// the HUD out of the minimap view (a pass may not sample its own target).

const clearColor = [0.02, 0.03, 0.05, 1];
const minimapClearColor = [0.05, 0.08, 0.2, 1];
const sceneLayer = 1;
const hudLayer = 2;
const playerOrbitRadius = 3;
const playerSpeed = 1.2; // radians per second
// Shallow chase angle: the horizon stays visible, so the upper part of the
// main view is background (dark clear color) behind the minimap HUD.
const cameraOffset = [0, 3, 8];

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor,
  },
});

// Screen-space HUD quad: the vertex stage ignores the view/world matrices and
// maps the unit plane onto a fixed NDC rectangle in the upper-left corner
// (the example status panel floats over the canvas's upper-right); the
// fragment stage reads the minimap render target with textureLoad (no
// sampler binding needed). NDC rect x [-0.95, -0.35], y [0.30, 0.94] =>
// normalized screen rect x [0.025, 0.325], y [0.03, 0.35] (sampled by the
// e2e spec).
const minimapHudWgsl = `
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
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var minimapTexture: texture_2d<f32>;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let corner = input.position.xy + vec2f(0.5, 0.5);
  let ndc = vec2f(-0.95, 0.30) + corner * vec2f(0.60, 0.64);
  // Reference the renderer-provided view/world bindings (weight 0) so the
  // pipeline keeps the shared group(0)/group(1) layouts; the quad itself is
  // screen-space and ignores their values.
  let anchor = view.viewProjection *
    worldTransforms[input.instanceIndex] *
    vec4f(0.0, 0.0, 0.0, 1.0);
  var output: VertexOutput;

  output.position = vec4f(ndc, 0.05, 1.0) + anchor * 0.0;
  output.uv = vec2f(input.uv.x, 1.0 - input.uv.y);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let dims = vec2f(textureDimensions(minimapTexture));
  let texel = vec2<i32>(clamp(input.uv, vec2f(0.0), vec2f(0.9999)) * dims);

  return textureLoad(minimapTexture, texel, 0);
}
`;

class MinimapSystem extends createSystem({ priority: 0 }) {
  #time = 0;
  #player = null;
  #hud = null;
  #camera = null;

  init() {
    // 1) The facade render target the overhead camera renders into and the
    // HUD samples. Handle-stable: renderTargets.resize(...) would republish
    // the same handle at a new size.
    const minimapTarget = this.renderTargets.register({
      id: "minimap.rt",
      width: 256,
      height: 256,
      label: "Minimap Target",
    });

    // 2) Overhead orthographic camera -> render target. Priority 0 renders
    // BEFORE the main camera (priority 1), so the HUD samples this frame's
    // minimap. Layer mask excludes the HUD quad from the minimap view.
    this.spawn.camera({
      key: "camera.minimap",
      name: "minimap-camera",
      renderTarget: minimapTarget,
      transform: {
        translation: [0, 20, 0],
        rotationEulerDegrees: [-90, 0, 0],
      },
      camera: {
        projection: "orthographic",
        orthographicHeight: 22,
        aspect: 1,
        near: 0.1,
        far: 50,
        priority: 0,
        layerMask: sceneLayer,
        clearColor: minimapClearColor,
      },
    });

    // 3) Main perspective chase camera (canvas). Sees scene + HUD layers.
    const playerStart = [playerOrbitRadius, 0.5, 0];

    this.#camera = this.spawn.camera({
      key: "camera.main",
      name: "chase-camera",
      transform: {
        translation: [
          playerStart[0] + cameraOffset[0],
          playerStart[1] + cameraOffset[1],
          playerStart[2] + cameraOffset[2],
        ],
        lookAt: playerStart,
      },
      fovYDegrees: 50,
      camera: {
        aspect: 960 / 540,
        priority: 1,
        layerMask: sceneLayer | hudLayer,
      },
    });

    this.spawn.light({
      name: "sun",
      kind: "directional",
      color: [1, 0.98, 0.92, 1],
      intensity: 2.2,
      transform: { translation: [4, 9, 3], lookAt: [0, 0, 0] },
    });
    this.spawn.light({
      name: "fill",
      kind: "ambient",
      color: [0.55, 0.62, 0.75, 1],
      intensity: 0.5,
    });

    // 4) Arena: green ground + four colored corner boxes + the player box.
    this.spawn.mesh({
      name: "ground",
      mesh: mesh.plane({ size: [20, 20] }),
      material: material.standard({
        baseColor: [0.25, 0.55, 0.28, 1],
        roughness: 0.95,
        metallic: 0,
      }),
      transform: { rotationEulerDegrees: [-90, 0, 0] },
    });

    const cornerBoxes = [
      { name: "box-red", position: [-6, 0.75, -6], color: [0.9, 0.2, 0.15, 1] },
      { name: "box-blue", position: [6, 0.75, -6], color: [0.2, 0.4, 0.95, 1] },
      { name: "box-gold", position: [-6, 0.75, 6], color: [0.95, 0.8, 0.2, 1] },
      { name: "box-violet", position: [6, 0.75, 6], color: [0.7, 0.3, 0.9, 1] },
    ];

    for (const box of cornerBoxes) {
      this.spawn.mesh({
        name: box.name,
        mesh: mesh.box({ size: [1.5, 1.5, 1.5] }),
        material: material.standard({
          baseColor: box.color,
          roughness: 0.7,
          metallic: 0,
        }),
        transform: { translation: box.position },
      });
    }

    this.#player = this.spawn.mesh({
      name: "player",
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard({
        baseColor: [0.98, 0.98, 0.98, 1],
        roughness: 0.4,
        metallic: 0,
      }),
      transform: { translation: playerStart },
    });

    // 5) HUD quad sampling the minimap target. Rendered only by the main
    // camera (hud layer); the entity tracks the player so it always stays in
    // the chase camera's frustum (the vertex stage is screen-space anyway).
    this.#hud = this.spawn.mesh({
      name: "minimap-hud",
      mesh: mesh.plane({ size: [1, 1] }),
      material: material.customWgsl({
        familyKey: "example/minimap-hud",
        label: "Minimap HUD",
        shader: {
          kind: "inline-wgsl",
          code: minimapHudWgsl,
          virtualPath: "minimap-hud.wgsl",
        },
        entryPoints: { vertex: "vs_main", fragment: "fs_main" },
        bindings: [
          material.texture("minimapTexture", {
            binding: 0,
            visibility: ["fragment"],
            texture: this.renderTargets.colorTexture(minimapTarget),
          }),
        ],
      }),
      transform: { translation: playerStart },
    });
    this.#hud.addComponent(RenderLayer, { mask: hudLayer });
  }

  update(delta) {
    const dt = Math.min(Math.max(delta, 0), 1 / 30);

    this.#time += dt;

    const angle = this.#time * playerSpeed;
    const x = Math.cos(angle) * playerOrbitRadius;
    const z = Math.sin(angle) * playerOrbitRadius;

    if (this.#player !== null) {
      this.#player
        .getVectorView(LocalTransform, "translation")
        .set([x, 0.5, z]);
    }

    if (this.#hud !== null) {
      this.#hud.getVectorView(LocalTransform, "translation").set([x, 0.5, z]);
    }

    // Chase: translate the camera with the player, keeping the spawn-time
    // look direction (constant offset => the player stays centered).
    if (this.#camera !== null) {
      this.#camera
        .getVectorView(LocalTransform, "translation")
        .set([x + cameraOffset[0], 0.5 + cameraOffset[1], z + cameraOffset[2]]);
    }
  }
}

startGeneratedSimulationWorker({
  config,
  systems: [{ default: MinimapSystem }],
});
