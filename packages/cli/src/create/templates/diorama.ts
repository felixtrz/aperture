import { compileShader } from "@aperture-engine/shader/compiler";
import { textTemplateFile } from "./files.js";
import { dioramaCameraTemplateFiles } from "./diorama-camera.js";
import type { TemplateFile } from "../types.js";

/** A portable starting point; scene content remains ordinary authored ECS. */
export function dioramaTemplateFiles(): readonly TemplateFile[] {
  const water = waterWgsl();
  const artifact = compileShader({
    entry: "water.wgsl",
    modules: { "water.wgsl": water },
  });
  return [
    ...dioramaCameraTemplateFiles(),
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

The starter runs through browser and Node/Dawn with shared configuration.
Keep scene state in ECS. The starter geometry is disposable blockout content.

## First useful image

1. Inspect the reference and note its main masses, image-space bounds, footprint,
   camera elevation and negative space. Choose projection explicitly.
2. Edit src/systems/scene.system.ts: replace the starter masses with 5–10 meaningful
   subject assemblies. Reuse the named spawn.group() roots and
   box(key, size, localPosition, hex, parent): moving/rotating/scaling a root moves
   its children together. Add parts in that root's local [x,y,z] coordinates.
   For rounded primitives use mesh.sphere({ radius: 1, segments: 8 }); sphere has
   one segments control. For a faceted crown use
   mesh.icosphere({ radius: 1, subdivisions: 1 }).
   Edit aperture.config.ts for presentation; aperture.headless.config.ts shares it.
3. Keep the default environment, ACES, 4x MSAA, sun/shadows, receiving ground and
   subtle bloom. Use src/palette.ts color(hex) for linear material colors. The
   procedural water artifact is already compiled. Water is the XY plane rotated
   -90 degrees about X, at Y=0; match planarReflection.height and retain
   frustumCulling:false for reflected objects. Remove water/reflection for a dry scene.
4. Capture now, before trim, tiles, windows, leaves or optional API research.
   The image must show the assigned subject's principal volumes and spatial
   relationships. Inspect it and record the three largest mismatches before detail.

Use the assigned capture harness when provided; preserve its resolution, seed,
time, attempts and failure records. Otherwise, preview from the app directory
with dependencies installed:

    pnpm exec aperture headless aperture.headless.config.ts --out scene.bundle.json --asset-mode strict --render-width 1200 --render-height 900
    pnpm exec aperture render scene.bundle.json --backend dawn --adapter software --out scene.png --json

Only render after CPU extraction succeeds. Inspect that first subject image
before continuing below. An unchanged starter is not a useful reference blockout.

## After the first image

Read the [refinement reference](https://github.com/felixtrz/aperture/blob/main/docs/AGENT_VISUAL_REFINEMENT.md)
only as needed for the next visible correction; its geometry, lighting and
inspection requirements still apply.

1. Correct camera/layout and silhouette before small detail. Optional local files
   CAMERA_WORKSHEET.md, camera-observations.json and camera-fit-plan.json provide
   a complete reference-measurement path; choose whether it helps your scene.
   The starter's authoring.cameraProbe measures actual land/main-mass top-face
   corners, the main mass's top, front-face orientation and source bounds. Run
   \`aperture camera inspect-local aperture.headless.config.ts --request-resource authoring.cameraProbe --seed 7 --out probe.report.json\`.
   Match the capture seed and explicit viewport; check the full report and diagnostics.
   The box helper returns features computed from its own dimensions. Update or
   remove those features when replacing its construction, and re-probe after edits;
   saved reports are snapshots. Points, ordered-face orientation and source bounds
   do not establish visible silhouette or occlusion. Measured sidecar pixels become
   targets; null entries stay unmeasured. Adapt selection and trusted dimensions
   before fitting. The source declares its camera-distance gauge. See the
   [local feature guide](https://github.com/felixtrz/aperture/blob/main/docs/CAMERA_LOCAL_INSPECTION.md#finite-cpu-probe-after-the-first-image).
   For uncertain projection, compare [camera jobs using the same landmarks and tolerance](https://github.com/felixtrz/aperture/blob/main/docs/CAMERA_LANDMARKS.md#compare-projection-families).
   Inspect bounds, residuals and conditioning; low error cannot choose a family or
   repair wrong geometry. Pixel-to-plane placement requires an explicit plane.
2. Use mesh.polygons for fitted planar faces/holes and mesh.loft for corresponding
   sections; mesh.beveledBox adds fitted chamfers to masonry and box-like props.
   A planar floor has a constant local Y; a raised rim belongs in a separate loft.
   mesh.tube({path, radius}) makes connected ropes/branches, including varying
   radii. mesh.extrudeBetween({outline, start, end, up}) aligns a closed profile
   between endpoints without Euler-angle calculations. Keep roof tile courses
   short and parallel down each slope; do not fan every tile toward a hip apex.
   Reuse the same sampled curve for an arch opening and its surrounding stones.
   Place trim in front of the wall; overlapping coplanar interior faces create
   triangular depth artifacts even when each individual mesh is valid.
3. Refine lighting and contacts. Key light and environment fill are independent.
   Compare bright/shaded planes and shadow direction before raising fill; keep
   geometry, camera, materials and exposure fixed for that lighting pass.
   Avoid long shadows obscuring the composition. Use small bevels/thickness on
   prominent edges. Match foliage granularity to the reference: broad chunky
   crowns can use asymmetric faceted masses; leafy olive trees need thin leaflets
   with outward normals, varied orientation and visible gaps. Do not replace
   every tree with separated balls, or use huge pale leaf shards.
   mesh.icosphere({ radius: 1, subdivisions: 1 }) supplies a closed faceted mass;
   0/1/2 subdivisions give 20/80/320 triangles. Use the foliage example for a
   seeded batched leaflet construction. Check silhouette before adding leaves.
4. Inspect front, side and final camera views, contacts, shadow diagnostics,
   shader/compiler errors and reflection alignment. Keep real reflections subtle;
   painted ripples alone cannot replace reflected geometry. Reflection tint is
   a linear RGB multiplier, independent of the procedural water base color.
   distortionFrequency changes ripple spacing independently of amplitude;
   shorter ripples avoid broad glassy warps, but excessive amplitude looks jagged.
   Let a boat's lower hull cross the water plane. Keep wheel hubs in front of
   tire caps, not coplanar with them. Reserve the final preview for known
   corrections; avoid introducing new geometry in the last pass. Stop optional
   detail when the principal forms read cleanly. Verify final browser compatibility
   through the project's permitted route; a PNG alone does not prove visual quality.

For repeated previews keep a warm session with
aperture render serve --backend dawn --adapter software.
After editing src/water.wgsl rebuild its artifact:

    pnpm exec aperture shader build src/water.wgsl --out src/water.shader.json

The reflection pass supports one full-output camera and one horizontal plane.
Other coplanar surfaces also receive reflections. No application GPU objects
cross the worker boundary.
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
  return `import { createSystem, defineResource, material, mesh, resource, type CameraLocalInspectionRequest, type Entity, type Vec3Tuple, type ShaderArtifact, type SpawnCameraOptions } from "@aperture-engine/app/systems";
import { color } from "../palette.ts";
import waterShader from "../water.shader.json" with { type: "json" };
import observations from "../../camera-observations.json" with { type: "json" };
import { referencePoints } from "../reference-observations.ts";

const CameraProbe = defineResource("authoring.cameraProbe", {
  request: resource.value<(CameraLocalInspectionRequest & { camera: { key: string } }) | null>(null),
});

interface BoxConstruction {
  readonly entity: Entity;
  readonly top: Vec3Tuple;
  readonly corners: Readonly<Record<string, Vec3Tuple>>;
  readonly front: readonly [Vec3Tuple, Vec3Tuple, Vec3Tuple];
}

export default class Diorama extends createSystem({ priority: 0 }) {
  override init(): void {
    const view = {
      transform: { translation: [10, 10, 13], lookAt: [0, 0.6, 0] },
      camera: { projection: "orthographic", orthographicHeight: 10.5,
        near: 0.1, far: 100, frustumCulling: false, clearColor: color(0xf5efe3) },
    } satisfies SpawnCameraOptions;
    this.spawn.camera({ key: "camera", ...view });
    const referenceDistance = Math.hypot(...view.transform.translation.map(
      (value, axis) => value - view.transform.lookAt[axis]!,
    ));
    this.spawn.light({
      key: "sun", kind: "directional", intensity: 3.3, color: [1, 0.94, 0.84, 1],
      transform: { rotationEulerDegrees: [-58, -35, 0] },
      shadow: { mapSize: 2048, cascadeCount: 1, shadowType: 2, strength: 0.85,
        filterRadius: 5, normalBias: 0.015, orthographicSize: 18,
        center: [0, 0, 0], lightDistance: 25, near: 0.1, far: 50 },
    });
    // Positions are local to parent; null means world coordinates.
    // Other primitives: mesh.torus({ majorRadius, tubeRadius, radialSegments, tubeSegments }) (XZ ring);
    // mesh.cylinder({ radius, depth, segments }) / mesh.cone({ radius, depth, segments }) (Y axis).
    // mesh.sphere({ radius: 1, segments: 8 }) uses one segments control.
    // mesh.icosphere({ radius: 1, subdivisions: 1 }) makes a faceted low-poly crown.
    const box = (key: string, size: Vec3Tuple, localPosition: Vec3Tuple, hex: number, parent: Entity | null = null, castShadow = true): BoxConstruction => {
      const plain = key === "backdrop" || key === "water-volume";
      const bevel = plain ? 0 : Math.min(...size) * 0.05;
      const shape = plain ? mesh.box({ size }) : mesh.beveledBox({ size, bevel });
      const entity = this.spawn.mesh({ key, mesh: shape,
        material: material.standard({ baseColor: color(hex), roughness: 0.85 }),
        transform: { parent, translation: localPosition }, castShadow, receiveShadow: true });
      // These are mesh-local surface features, shared with the construction above.
      // The ordered triangle lies inside the front planar face, including its bevel.
      const [width, height, depth] = size;
      const x = width / 2 - bevel, z = depth / 2 - bevel, y = height / 2;
      return { entity, top: [0, y, 0], corners: {
        "back-left": [-x, y, -z], "back-right": [x, y, -z],
        "front-right": [x, y, z], "front-left": [-x, y, z],
      }, front: [
        [-width / 2 + bevel, -height / 2 + bevel, depth / 2],
        [width / 2 - bevel, -height / 2 + bevel, depth / 2],
        [0, height / 2 - bevel, depth / 2],
      ] };
    };
    box("backdrop", [100, 0.1, 100], [0, -0.65, 0], 0xf5efe3, null, false);
    box("water-volume", [8, 0.5, 7], [0, -0.3, 0], 0x438d91, null, false);
    this.spawn.mesh({ key: "water", mesh: mesh.plane({ size: [8, 7] }),
      material: material.standard({ baseColor: color(0x429ca0), roughness: 0.35,
        extension: { shader: waterShader as ShaderArtifact, surface: "waterSurface", parameters: [0, 0, 0, 0] } }),
      transform: { rotationEulerDegrees: [-90, 0, 0] }, receiveShadow: true });
    // Replace these assemblies with the reference's layout before detailing.
    // Edit a root's translation/rotationEulerDegrees/scale to pose all its parts.
    const primary = this.spawn.group({ key: "assembly.primary",
      transform: { translation: [-1.5, 0, -1] } });
    const land = box("land", [4.5, 0.45, 3.8], [0, 0.15, -0.2], 0xd9c59e, primary);
    const main = box("main-mass", [2.2, 2.6, 1.8], [-0.3, 1.65, -0.4], 0xd5a454, primary);
    const secondary = this.spawn.group({ key: "assembly.secondary",
      transform: { translation: [1.7, 0, 1.2] } });
    box("secondary-mass", [1.4, 0.7, 2.4], [0, 0.45, 0], 0xa85d37, secondary);
    const points = referencePoints(observations, { ground: land.corners, "main-mass": main.corners });
    this.resources.set(CameraProbe, { request: {
      camera: { key: "camera" }, viewport: { width: 1200, height: 900 },
      cameraJob: { referenceDistance },
      subjects: [{
        name: "main-mass", entity: { index: main.entity.index, generation: main.entity.generation },
        points: [{ name: "top", local: main.top }, ...points["main-mass"]!],
        faces: [{ name: "front", localTriangle: main.front }],
        bounds: { source: "mesh-local-aabb", includeDescendants: false },
      }, {
        name: "ground", entity: { index: land.entity.index, generation: land.entity.generation },
        points: points.ground!,
        bounds: { source: "mesh-local-aabb", includeDescendants: false },
      }],
    } });
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
