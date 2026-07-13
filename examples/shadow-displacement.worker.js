import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import {
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";

// A4 (three.js parity plan): custom shadow-caster displacement — the analog of
// three.js customDepthMaterial / castShadowPositionNode. A flag built from
// vertical strips is displaced by a sine wave in the custom material's MAIN
// vertex entry, and the SAME displacement runs in the material's shadowVertex
// entry, so the shadow silhouette on the ground waves in lockstep with the
// mesh instead of staying a static rectangle. Time flows through a runtime
// uniform (queue.writeBuffer renderer-side, zero pipeline rebuilds).

const clearColor = [0.02, 0.03, 0.05, 1];
const stripCount = 12;
const stripWidth = 0.25;
const flagHeight = 1.5;
const flagCenterY = 1.75;

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor,
  },
});

// The wave displaces vertices in WORLD space as a function of world x and
// time, so adjacent strips stay continuous. `flagWave` is shared verbatim by
// the main vertex entry (vs_main) and the shadow caster entry (shadow_vs).
const flagWgsl = `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct FlagParams {
  time: f32,
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
  @location(1) wave: f32,
};

// Main-pass contract: group(0) view uniform + group(1) world transforms.
@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
// Material bindings live in group(2) for BOTH passes.
@group(2) @binding(0) var<uniform> flagParams: FlagParams;

// Shadow caster contract (same layout as the built-in position-only caster):
// group(0) binding(0) is the active shadow pass's light view-projection and
// group(0) binding(1) holds caster world transforms indexed by instance_index.
// These share binding points with the main-pass declarations above, which is
// valid WGSL because no single entry point uses both sets.
struct ShadowPassMatrix {
  viewProjection: mat4x4f,
};

@group(0) @binding(0) var<uniform> shadowPassMatrix: ShadowPassMatrix;
@group(0) @binding(1) var<storage, read> shadowWorldTransforms: array<mat4x4f>;

fn flagWave(world: vec3f, time: f32) -> vec3f {
  // Amplitude grows toward the flag's free end (world x) so the pole edge
  // stays pinned; the ground and pole (standard materials) are unaffected.
  let reach = clamp(world.x / 3.0, 0.0, 1.0);
  let phase = time * 2.6 + world.x * 2.2;
  let bend = sin(phase) * 0.55 * reach;
  let lift = cos(phase * 0.7) * 0.18 * reach;

  return vec3f(world.x, world.y + lift, world.z + bend);
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let world = worldTransforms[input.instanceIndex] * vec4f(input.position, 1.0);
  let displaced = flagWave(world.xyz, flagParams.time);
  var output: VertexOutput;

  output.position = view.viewProjection * vec4f(displaced, 1.0);
  output.uv = input.uv;
  output.wave = clamp(abs(displaced.z - world.z) * 2.0, 0.0, 1.0);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let base = vec3f(0.82, 0.16, 0.12);
  let stripe = vec3f(0.95, 0.85, 0.35);
  let banded = mix(base, stripe, step(0.5, fract(input.uv.y * 3.0)));

  return vec4f(mix(banded, vec3f(1.0, 0.95, 0.8), input.wave * 0.35), 1.0);
}

// Shadow caster vertex entry: SAME displacement, light view-projection.
@vertex
fn shadow_vs(
  @location(0) position: vec3f,
  @builtin(instance_index) instanceIndex: u32,
) -> @builtin(position) vec4f {
  let world = shadowWorldTransforms[instanceIndex] * vec4f(position, 1.0);
  let displaced = flagWave(world.xyz, flagParams.time);

  return shadowPassMatrix.viewProjection * vec4f(displaced, 1.0);
}
`;

class ShadowDisplacementSystem extends createSystem({ priority: 0 }) {
  init() {
    this.spawn.camera({
      key: "camera.main",
      name: "flag-camera",
      transform: {
        translation: [1.4, 3.6, 7.4],
        lookAt: [1.2, 1.1, 0],
      },
      fovYDegrees: 50,
      camera: { aspect: 960 / 540 },
    });

    // Key light: directional sun behind the flag so its shadow lands on the
    // ground IN FRONT of the flag (between flag and camera), with a crisp map.
    this.spawn.light({
      name: "sun",
      kind: "directional",
      color: [1, 0.98, 0.92, 1],
      intensity: 2.6,
      transform: {
        translation: [-3.5, 7.5, -4.5],
        lookAt: [1.2, 0, 0],
      },
      shadow: {
        mapSize: 1024,
        normalBias: 0.02,
      },
    });
    this.spawn.light({
      name: "fill",
      kind: "ambient",
      color: [0.55, 0.62, 0.75, 1],
      intensity: 0.35,
    });

    // Receiver ground (standard material, receives the directional shadow).
    this.spawn.mesh({
      name: "ground",
      mesh: mesh.plane({ size: [16, 16] }),
      material: material.standard({
        baseColor: [0.72, 0.72, 0.68, 1],
        roughness: 0.95,
        metallic: 0,
      }),
      transform: {
        translation: [0, 0, 0],
        rotationEulerDegrees: [-90, 0, 0],
      },
      castShadow: false,
      receiveShadow: true,
    });

    // Static pole (standard material) — a control caster whose shadow must
    // NOT move while the flag's displaced shadow waves next to it.
    this.spawn.mesh({
      name: "pole",
      mesh: mesh.box({ size: [0.12, 3.2, 0.12] }),
      material: material.standard({
        baseColor: [0.35, 0.33, 0.3, 1],
        roughness: 0.6,
        metallic: 0.2,
      }),
      transform: { translation: [-0.06, 1.6, 0] },
      castShadow: true,
      receiveShadow: false,
    });

    const flagMaterial = material.customWgsl({
      familyKey: "example/flag",
      label: "Wind Flag",
      shader: {
        kind: "inline-wgsl",
        code: flagWgsl,
        virtualPath: "shadow-displacement.wgsl",
      },
      entryPoints: {
        vertex: "vs_main",
        fragment: "fs_main",
        shadowVertex: "shadow_vs",
      },
      renderState: { cullMode: "none" },
      bindings: [
        material.uniform("flagParams", {
          binding: 0,
          visibility: ["vertex"],
          fields: { time: { type: "float32" } },
          runtimeUniformKey: "flag.time",
        }),
      ],
    });

    // The flag: vertical strips sharing one custom material; strip 0 registers
    // the shared mesh + material assets, the rest reuse the handles.
    this.spawn.mesh({
      key: "flag",
      name: "flag-strip-0",
      mesh: mesh.plane({ size: [stripWidth, flagHeight] }),
      material: flagMaterial,
      transform: { translation: stripTranslation(0) },
      castShadow: true,
      receiveShadow: false,
    });

    const meshHandle = createMeshHandle("flag.mesh");
    const materialHandle = createMaterialHandle("flag.material");

    for (let index = 1; index < stripCount; index += 1) {
      this.spawn.mesh({
        name: `flag-strip-${index}`,
        mesh: meshHandle,
        material: materialHandle,
        transform: { translation: stripTranslation(index) },
        castShadow: true,
        receiveShadow: false,
      });
    }
  }

  update(_delta, time) {
    this.spawn.runtimeUniform({
      uniformKey: "flag.time",
      values: { time },
    });
  }
}

function stripTranslation(index) {
  return [stripWidth * 0.5 + index * stripWidth, flagCenterY, 0];
}

startGeneratedSimulationWorker({
  config,
  systems: [{ default: ShadowDisplacementSystem }],
});
