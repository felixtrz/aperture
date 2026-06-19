import {
  EcsType,
  createSystem,
  material,
  mesh,
  shader,
} from "@aperture-engine/app/systems";

// A large sky dome: an inverted sphere drawn with a custom-WGSL vertical
// gradient. It sits well inside the camera's far plane and is centered at the
// origin, so the orbiting camera always stays inside it. The gradient colors
// are material uniforms (topColor / bottomColor), which a day/night system can
// drive over time to move the sky from morning through night.
const SKY_RADIUS = 120;

const SKY_WGSL = /* wgsl */ `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct SkyUniform {
  topColor: vec4f,
  bottomColor: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) localPosition: vec3f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> sky: SkyUniform;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  output.position = view.viewProjection * world * vec4f(input.position, 1.0);
  output.localPosition = input.position;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let dir = normalize(input.localPosition);
  let t = smoothstep(-0.05, 0.55, dir.y);
  let color = mix(sky.bottomColor.rgb, sky.topColor.rgb, t);
  return vec4f(color, 1.0);
}
`;

export default class SkySystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.mesh({
      key: "sky.dome",
      name: "Sky Dome",
      tags: ["sky"],
      mesh: mesh.sphere({ radius: SKY_RADIUS, segments: 32 }),
      material: material.customWgsl({
        familyKey: "hero/sky-gradient",
        label: "Sky Gradient",
        shader: shader.inlineWgsl(SKY_WGSL, { virtualPath: "hero-sky.wgsl" }),
        entryPoints: { vertex: "vs_main", fragment: "fs_main" },
        // Double-sided so we always see the inside of the dome; the dome is
        // opaque and far, so normal depth testing keeps the town in front.
        renderState: {
          cullMode: "none",
          depth: { test: true, write: true, compare: "less" },
        },
        bindings: [
          material.uniform("sky", {
            binding: 0,
            visibility: ["fragment"],
            fields: {
              // Morning sky: blue zenith fading to a pale horizon.
              topColor: { type: EcsType.Vec4, default: [0.27, 0.46, 0.8, 1] },
              bottomColor: {
                type: EcsType.Vec4,
                default: [0.82, 0.87, 0.94, 1],
              },
            },
          }),
        ],
      }),
      castShadow: false,
      receiveShadow: false,
    });
  }
}
