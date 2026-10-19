import { compileShader } from "@aperture-engine/shader/compiler";
import { textTemplateFile } from "./files.js";
import type { TemplateFile } from "../types.js";

/** A portable starting point; scene content remains ordinary authored ECS. */
export function dioramaTemplateFiles(): readonly TemplateFile[] {
  const water = waterWgsl();
  const artifact = compileShader({
    entry: "water.wgsl",
    modules: { "water.wgsl": water },
  });
  return [
    textTemplateFile("aperture.config.ts", configTs()),
    textTemplateFile(
      "aperture.headless.config.ts",
      `import config from "./aperture.config.ts";
export default { ...config, mode: "headless" as const };
`,
    ),
    textTemplateFile(
      "src/palette.ts",
      `/** Display sRGB hex to the linear RGBA expected by materials and lights. */
export function color(hex: number): [number, number, number, number] {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return [channel((hex >> 16) & 255), channel((hex >> 8) & 255), channel(hex & 255), 1];
}
`,
    ),
    textTemplateFile("src/water.wgsl", water),
    textTemplateFile(
      "src/water.shader.json",
      JSON.stringify(artifact, null, 2) + "\n",
    ),
    textTemplateFile("src/systems/scene.system.ts", sceneTs()),
    textTemplateFile(
      "DIORAMA.md",
      `# Author a diorama

The starter runs unchanged through both browser and Node/Dawn. Edit
src/systems/scene.system.ts for the scene and aperture.config.ts for presentation.
Keep scene state in ECS. The starter geometry is disposable blockout content.

1. Measure the reference's main masses, footprint, camera elevation and negative
   space. Replace the starter boxes with those masses and capture immediately.
   Before detailing, compare named world anchors with target image pixels using
   aperture camera project or aperture camera fit (see aperture camera --help).
   These CPU commands report framing/residuals without spending a render. Choose
   projection explicitly; a low camera-fit error cannot repair wrong geometry.
2. Correct silhouette and proportions before adding small detail. Use
   mesh.polygons for fitted planar faces/holes and mesh.loft for corresponding
   sections; mesh.beveledBox adds fitted chamfers to masonry and box-like props.
   Positions are [x,y,z] tuples. A planar floor has a constant local Y;
   a raised rim may vary in Y and belongs in a separate loft strip.
   mesh.tube({path, radius}) makes connected ropes/branches, including varying
   radii. mesh.extrudeBetween({outline, start, end, up}) aligns a closed profile
   between endpoints without Euler-angle calculations. Keep roof tile courses
   short and parallel down each slope; do not fan every tile toward a hip apex.
   Reuse the same sampled curve for an arch opening and its surrounding stones.
   Place trim in front of the wall; overlapping coplanar interior faces create
   triangular depth artifacts even when each individual mesh is valid.
3. Refine lighting and contacts. Key light and environment fill are independent.
   Avoid long shadows obscuring the composition. Use small bevels/thickness on
   prominent edges. Match foliage granularity to the reference: broad chunky
   crowns can use asymmetric faceted masses; leafy olive trees need thin leaflets
   with outward normals, varied orientation and visible gaps. Do not replace
   every tree with separated balls, or use huge pale leaf shards.
   mesh.icosphere({ radius: 1, subdivisions: 1 }) supplies a closed faceted mass;
   0/1/2 subdivisions give 20/80/320 triangles. Use the foliage example for a
   seeded batched leaflet construction. Check silhouette before adding leaves.

4. Inspect front, side and final camera views. Keep real reflections subtle;
   painted ripples alone cannot replace reflected geometry. Reflection tint is
   a linear RGB multiplier, independent of the procedural water base color.
   distortionFrequency changes ripple spacing independently of amplitude;
   shorter ripples avoid broad glassy warps, but excessive amplitude looks jagged.
   Let a boat's lower hull cross the water plane. Keep wheel hubs in front of
   tire caps, not coplanar with them. Reserve the final preview for known
   corrections; avoid introducing new geometry in the last pass.

Preview (dependencies installed):

    pnpm exec aperture headless aperture.headless.config.ts --out scene.bundle.json --asset-mode strict --render-width 1200 --render-height 900
    pnpm exec aperture render scene.bundle.json --backend dawn --adapter software --out scene.png --json

Only render after CPU extraction succeeds. For repeated previews keep a warm
session with aperture render serve --backend dawn --adapter software.
The water shader artifact is already built. After editing src/water.wgsl run:

    pnpm exec aperture shader build src/water.wgsl --out src/water.shader.json

Water is the XY plane rotated -90 degrees about X, at world Y=0. The reflection
pass supports one full-output camera and one horizontal plane. Keep water at the
configured height and frustumCulling:false to retain offscreen reflected objects.
Other coplanar surfaces also receive reflections. Remove planarReflection and the
water entity for a dry scene. No application GPU objects cross the worker boundary.
`,
    ),
  ];
}

function configTs(): string {
  return `import { defineApertureConfig } from "@aperture-engine/app/config";
export default defineApertureConfig({
  mode: "browser", canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  render: {
    cadence: "demand", defaultCamera: false, defaultLight: false,
    defaultEnvironmentIntensity: 0.35,
    tonemap: "aces", exposure: 1, sampleCount: 4, maxPixelRatio: 1,
    planarReflection: { height: 0, strength: 0.22, resolutionScale: 0.6, distortion: 0.0015, distortionFrequency: 4, blurPixels: 1, tint: [0.28, 0.75, 0.78] },
    ssao: { radiusPixels: 8, intensity: 0.4, power: 1.1, sampleCount: 8 },
    bloom: { threshold: 1.2, intensity: 0.02, radiusPixels: 2 },
  },
});
`;
}

function sceneTs(): string {
  return `import { createSystem, material, mesh, type ShaderArtifact } from "@aperture-engine/app/systems";
import { color } from "../palette.ts";
import waterShader from "../water.shader.json" with { type: "json" };

export default class Diorama extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera", transform: { translation: [10, 10, 13], lookAt: [0, 0.6, 0] },
      camera: { projection: "orthographic", orthographicHeight: 10.5,
        near: 0.1, far: 100, frustumCulling: false, clearColor: color(0xf5efe3) },
    });
    this.spawn.light({
      key: "sun", kind: "directional", intensity: 3.3, color: [1, 0.94, 0.84, 1],
      transform: { rotationEulerDegrees: [-58, -35, 0] },
      shadow: { mapSize: 2048, cascadeCount: 1, shadowType: 2, strength: 0.85,
        filterRadius: 5, normalBias: 0.015, orthographicSize: 18,
        center: [0, 0, 0], lightDistance: 25, near: 0.1, far: 50 },
    });
    const box = (key: string, size: [number, number, number], position: [number, number, number], hex: number, castShadow = true): void => {
      const shape = key === "backdrop" || key === "water-volume"
        ? mesh.box({ size }) : mesh.beveledBox({ size, bevel: Math.min(...size) * 0.05 });
      this.spawn.mesh({ key, mesh: shape,
        material: material.standard({ baseColor: color(hex), roughness: 0.85 }),
        transform: { translation: position }, castShadow, receiveShadow: true });
    };
    box("backdrop", [100, 0.1, 100], [0, -0.65, 0], 0xf5efe3, false);
    box("water-volume", [8, 0.5, 7], [0, -0.3, 0], 0x438d91, false);
    this.spawn.mesh({ key: "water", mesh: mesh.plane({ size: [8, 7] }),
      material: material.standard({ baseColor: color(0x429ca0), roughness: 0.35,
        extension: { shader: waterShader as ShaderArtifact, surface: "waterSurface", parameters: [0, 0, 0, 0] } }),
      transform: { rotationEulerDegrees: [-90, 0, 0] }, receiveShadow: true });
    // Replace these three masses with the reference's layout before detailing.
    box("land", [4.5, 0.45, 3.8], [-1.5, 0.15, -1.2], 0xd9c59e);
    box("main-mass", [2.2, 2.6, 1.8], [-1.8, 1.65, -1.4], 0xd5a454);
    box("secondary-mass", [1.4, 0.7, 2.4], [1.7, 0.45, 1.2], 0xa85d37);
  }
}
`;
}

function waterWgsl(): string {
  return `struct ApertureSurface { baseColor: vec3f, normal: vec3f, metallic: f32, roughness: f32, emissive: vec3f };
fn waterSurface(surface: ApertureSurface, uv: vec2f, position: vec3f, parameters: vec4f) -> ApertureSurface {
  var result = surface;
  let p = position.xz;
  let cell = floor(p * 4.0);
  let facet = fract(sin(dot(cell, vec2f(127.1, 311.7))) * 43758.5453);
  result.baseColor *= 0.9 + facet * 0.2;
  result.normal = normalize(surface.normal + vec3f(cos(p.x * 9.0 + p.y * 5.0) * 0.035, 0.0, sin(p.y * 8.0 - p.x * 4.0) * 0.035));
  return result;
}
`;
}
