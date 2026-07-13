import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";

// A1 (three.js parity plan): the opt-in lit contract for custom WGSL
// materials. Two identical spheres sit side by side under the SAME rig
// (ambient + shadow-casting directional sun + a point light on the x=0
// symmetry plane): the LEFT sphere uses a custom lit WGSL material
// (`lighting: "lit"`) whose fragment loops the packed lights through
// apertureEvaluateLightSurface, applies apertureDirectionalShadow, samples
// the IBL helpers, and encodes with apertureLinearToSrgb — reproducing the
// StandardMaterial Lambert+GGX response; the RIGHT sphere is the
// StandardMaterial reference with the same albedo/metallic/roughness. A
// procedural stripe band makes the custom surface unmistakably custom while
// leaving most of the sphere on the shared albedo for A/B parity sampling.
// Both spheres cast onto a standard-material ground plane.

const clearColor = [0.02, 0.03, 0.05, 1];
const sphereRadius = 0.75;
const sphereY = 1.05;
const sphereX = 1.15;
// Shared surface parameters (linear): the reference sphere's factors and the
// custom sphere's non-striped albedo are identical by construction.
const albedo = [0.74, 0.24, 0.2];
const stripeAlbedo = [0.95, 0.82, 0.36];
const roughness = 0.6;
const metallic = 0;

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor,
  },
});

// The lit contract header (group(3) declarations + aperture* helpers) is
// prepended by the renderer because the material declares lighting: "lit";
// user code must NOT declare @group(3) itself.
const litSphereWgsl = `
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
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
  @location(2) uv: vec2f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let world = worldTransforms[input.instanceIndex];
  let worldPosition = world * vec4f(input.position, 1.0);
  var output: VertexOutput;

  output.position = view.viewProjection * worldPosition;
  output.worldPosition = worldPosition.xyz;
  // Match the StandardMaterial vertex normal transform.
  output.worldNormal = normalize((world * vec4f(input.normal, 0.0)).xyz);
  output.uv = input.uv;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let normal = normalize(input.worldNormal);
  let viewDir = normalize(view.cameraPosition.xyz - input.worldPosition);
  // Procedural latitude stripes: clearly a custom surface. Most of the
  // sphere stays on the reference albedo so median-matched pixels reproduce
  // the StandardMaterial response exactly.
  let stripe = step(0.72, fract(input.uv.y * 5.0));
  let baseColor = mix(
    vec3f(${albedo[0]}, ${albedo[1]}, ${albedo[2]}),
    vec3f(${stripeAlbedo[0]}, ${stripeAlbedo[1]}, ${stripeAlbedo[2]}),
    stripe,
  );
  let metallic = ${metallic.toFixed(2)};
  let roughness = ${roughness.toFixed(2)};
  let shadow = apertureDirectionalShadow(input.worldPosition, normal);
  var color = vec3f(0.0);

  for (var lightIndex = 0u; lightIndex < apertureCountLights(); lightIndex = lightIndex + 1u) {
    var term = apertureEvaluateLightSurface(
      lightIndex,
      input.worldPosition,
      normal,
      viewDir,
      baseColor,
      metallic,
      roughness,
    );

    // Mirror the StandardMaterial shadow variant: the directional term is
    // attenuated by the receiver's shadow factor.
    if (apertureLightKind(lightIndex) == APERTURE_LIT_LIGHT_KIND_DIRECTIONAL) {
      term = term * shadow;
    }

    color = color + term;
  }

  // Environment terms (black without an environment map; the helpers sample
  // renderer-owned fallbacks so the same shader works either way).
  color = color + apertureSampleIblIrradiance(normal) * baseColor * (1.0 - metallic);

  let reflectDir = reflect(-viewDir, normal);
  let nDotV = max(dot(normal, viewDir), 0.0);
  let envBrdf = apertureEnvironmentBrdf(roughness, nDotV);
  let f0 = mix(vec3f(0.04), baseColor, vec3f(metallic));

  color = color + apertureSampleIblSpecular(reflectDir, roughness) *
    (f0 * envBrdf.x + envBrdf.y);
  color = apertureApplyFog(color, input.worldPosition, view.cameraPosition.xyz);

  // Match the StandardMaterial output stage (tonemap "none" + sRGB encode).
  return vec4f(apertureLinearToSrgb(color), 1.0);
}
`;

class LitCustomMaterialSystem extends createSystem({ priority: 0 }) {
  init() {
    // Camera on the x=0 symmetry plane so mirrored sphere pixels see
    // mirrored view directions.
    this.spawn.camera({
      key: "camera.main",
      name: "lit-camera",
      transform: {
        translation: [0, 2.3, 5.6],
        lookAt: [0, 1.0, 0],
      },
      fovYDegrees: 50,
      camera: { aspect: 960 / 540 },
    });

    // Sun behind the spheres in the x=0 plane, so both spheres receive
    // mirror-symmetric direct light and their shadows land toward the camera.
    this.spawn.light({
      name: "sun",
      kind: "directional",
      color: [1, 0.98, 0.92, 1],
      intensity: 2.4,
      transform: {
        translation: [0, 7.5, -5],
        lookAt: [0, 0.6, 0],
      },
      shadow: {
        mapSize: 1024,
        normalBias: 0.02,
      },
    });
    this.spawn.light({
      name: "fill",
      kind: "ambient",
      color: [0.5, 0.58, 0.72, 1],
      intensity: 0.35,
    });
    // Point light on the symmetry plane between the spheres.
    this.spawn.light({
      name: "bounce",
      kind: "point",
      color: [1, 0.72, 0.45, 1],
      intensity: 7,
      transform: { translation: [0, 2.4, 2.2] },
      light: { range: 12 },
    });

    // Receiver ground (standard material, receives both sphere shadows).
    this.spawn.mesh({
      name: "ground",
      mesh: mesh.plane({ size: [18, 18] }),
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

    // (a) The custom LIT sphere: opt-in group(3) contract, striped surface.
    this.spawn.mesh({
      name: "lit-custom-sphere",
      mesh: mesh.sphere({ radius: sphereRadius, segments: 48 }),
      material: material.customWgsl({
        familyKey: "example/lit-sphere",
        label: "Lit Custom Sphere",
        lighting: "lit",
        shader: {
          kind: "inline-wgsl",
          code: litSphereWgsl,
          virtualPath: "lit-custom-material.wgsl",
        },
        entryPoints: { vertex: "vs_main", fragment: "fs_main" },
      }),
      transform: { translation: [-sphereX, sphereY, 0] },
      castShadow: true,
      receiveShadow: false,
    });

    // (b) The StandardMaterial reference sphere with the same parameters.
    this.spawn.mesh({
      name: "reference-sphere",
      mesh: mesh.sphere({ radius: sphereRadius, segments: 48 }),
      material: material.standard({
        baseColor: [albedo[0], albedo[1], albedo[2], 1],
        roughness,
        metallic,
      }),
      transform: { translation: [sphereX, sphereY, 0] },
      castShadow: true,
      receiveShadow: true,
    });
  }
}

startGeneratedSimulationWorker({
  config,
  systems: [{ default: LitCustomMaterialSystem }],
});
