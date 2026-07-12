import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import {
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";

// A2 (three.js parity plan): instanced grass whose per-blade bend parameters
// live in a renderer-independent storage-buffer asset registered by this
// worker system. A custom WGSL vertex shader reads the buffer indexed by
// instance_index; the wind system streams new bend values every frame through
// this.spawn.runtimeBuffer(...) — queue.writeBuffer renderer-side, zero
// pipeline rebuilds.

const clearColor = [0.012, 0.02, 0.03, 1];
const columns = 8;
const rows = 8;
const bladeCount = columns * rows;

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor,
  },
});

const grassWgsl = `
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
  @location(1) sway: f32,
};

// Built-in contract: group(0) view uniform + group(1) world transforms.
@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
// Custom group(2) storage binding: one vec4f per blade
// (x = bend along x, y = bend along z, z = blade amplitude, w = unused).
@group(2) @binding(0) var<storage, read> bendParams: array<vec4f>;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let bend = bendParams[input.instanceIndex];
  // Blade planes are 0.9 tall and centered: weight 0 at the root, 1 at the
  // tip, squared so the root stays planted while the tip sways.
  let tip = clamp((input.position.y + 0.45) / 0.9, 0.0, 1.0);
  let weight = tip * tip;
  let displaced = vec3f(
    input.position.x + bend.x * weight,
    input.position.y,
    input.position.z + bend.y * weight,
  );
  let world = worldTransforms[input.instanceIndex];

  output.position = view.viewProjection * world * vec4f(displaced, 1.0);
  output.uv = vec2f(input.uv.x, tip);
  output.sway = clamp(abs(bend.x) * 3.0, 0.0, 1.0);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let root = vec3f(0.03, 0.14, 0.045);
  let tip = vec3f(0.28, 0.68, 0.22);
  let base = mix(root, tip, input.uv.y);
  let highlight = vec3f(0.5, 0.86, 0.4);

  return vec4f(mix(base, highlight, input.sway * input.uv.y * 0.45), 1.0);
}
`;

class GrassFieldSystem extends createSystem({ priority: 0 }) {
  init() {
    // Deterministic per-blade wind phase/amplitude, reused every update.
    this.phases = Array.from(
      { length: bladeCount },
      (_, index) => (index * 2.399963) % (Math.PI * 2),
    );
    this.amplitudes = Array.from(
      { length: bladeCount },
      (_, index) => 0.1 + (0.08 * ((index * 7919) % 13)) / 13,
    );
    this.values = new Array(bladeCount * 4).fill(0);

    const buffer = this.buffers.register({
      id: "grass.bend",
      elementType: "vec4f",
      elementCount: bladeCount,
      data: new Float32Array(bladeCount * 4),
      label: "Grass Bend Params",
    });

    this.spawn.camera({
      key: "camera.main",
      name: "grass-camera",
      transform: {
        translation: [0, 0.9, 4.6],
        lookAt: [0, 0.1, 0],
      },
      fovYDegrees: 50,
      camera: { aspect: 960 / 540 },
    });

    // Blade 0 registers the shared mesh + custom WGSL material under the
    // "grass.*" asset ids; every other blade reuses those handles, so the
    // renderer batches the whole field into one instanced draw.
    const bladeMaterial = material.customWgsl({
      familyKey: "example/grass",
      label: "Grass Blades",
      shader: {
        kind: "inline-wgsl",
        code: grassWgsl,
        virtualPath: "storage-buffer-grass.wgsl",
      },
      entryPoints: { vertex: "vs_main", fragment: "fs_main" },
      renderState: {
        cullMode: "none",
      },
      bindings: [
        material.storage("bendParams", {
          binding: 0,
          visibility: ["vertex"],
          buffer,
          runtimeBufferKey: "grass.bend",
        }),
      ],
    });

    this.spawn.mesh({
      key: "grass",
      name: "grass-blade-0",
      mesh: mesh.plane({ size: [0.09, 0.9] }),
      material: bladeMaterial,
      transform: { translation: bladeTranslation(0) },
    });

    const meshHandle = createMeshHandle("grass.mesh");
    const materialHandle = createMaterialHandle("grass.material");

    for (let index = 1; index < bladeCount; index += 1) {
      this.spawn.mesh({
        name: `grass-blade-${index}`,
        mesh: meshHandle,
        material: materialHandle,
        transform: { translation: bladeTranslation(index) },
      });
    }
  }

  update(_delta, time) {
    for (let index = 0; index < bladeCount; index += 1) {
      const gust = Math.sin(time * 1.7 + this.phases[index]);
      const cross = Math.cos(time * 1.1 + this.phases[index] * 0.5);
      const amplitude = this.amplitudes[index];
      const offset = index * 4;

      this.values[offset] = gust * amplitude;
      this.values[offset + 1] = cross * amplitude * 0.35;
      this.values[offset + 2] = amplitude;
      this.values[offset + 3] = 0;
    }

    this.spawn.runtimeBuffer({
      bufferKey: "grass.bend",
      values: this.values,
      version: 0,
    });
  }
}

function bladeTranslation(index) {
  const column = index % columns;
  const row = Math.floor(index / columns);

  return [
    (column - (columns - 1) / 2) * 0.34 + (row % 2) * 0.1,
    0,
    (row - (rows - 1) / 2) * 0.32,
  ];
}

startGeneratedSimulationWorker({
  config,
  systems: [{ default: GrassFieldSystem }],
});
