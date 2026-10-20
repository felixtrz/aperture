import { textTemplateFile } from "./files.js";
import type { TemplateFile } from "../types.js";

/** Optional reference observations; generated source remains authoritative. */
export function dioramaCameraTemplateFiles(): readonly TemplateFile[] {
  const corners = ["back-left", "back-right", "front-right", "front-left"];
  const points = (role: string) =>
    Object.fromEntries(
      corners.map((name) => [
        name,
        { pixel: null, role, uncertaintyPixels: null, visibleFeature: null },
      ]),
    );
  return [
    textTemplateFile(
      "camera-observations.json",
      JSON.stringify(
        {
          image: {
            path: null,
            originalWidth: 1200,
            originalHeight: 900,
            crop: null,
            targetPixelSpace: "Full render pixels, top-left origin",
            measurementMethod: null,
          },
          assumptions: {
            projection: "orthographic",
            trustedFixedGeometry: null,
            uncertainties: null,
          },
          points: {
            ground: points("calibration-candidate"),
            "main-mass": points("camera-independent-check-candidate"),
          },
        },
        null,
        2,
      ) + "\n",
    ),
    textTemplateFile(
      "camera-fit-plan.json",
      JSON.stringify(
        {
          selection: corners.map((point) => ({ subject: "ground", point })),
          fit: {
            parameters: {
              azimuthDegrees: { min: 15, max: 65 },
              elevationDegrees: { min: 12, max: 65 },
              distance: "fixed",
              panX: { min: -5, max: 5 },
              panY: { min: -5, max: 5 },
              orthographicHeight: { min: 6, max: 16 },
            },
            tolerancePixels: 2,
            maxIterations: 150,
          },
        },
        null,
        2,
      ) + "\n",
    ),
    textTemplateFile(
      "src/reference-observations.ts",
      referenceObservationsTs(),
    ),
    textTemplateFile("CAMERA_WORKSHEET.md", cameraWorksheetMd()),
  ];
}

function referenceObservationsTs(): string {
  return `import type { Vec3Tuple } from "@aperture-engine/app/systems";

type Features = Readonly<Record<string, Readonly<Record<string, Vec3Tuple>>>>;
interface Point {
  readonly name: string;
  readonly local: Vec3Tuple;
  readonly target?: [number, number];
  readonly weight?: number;
}
function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(label + " must be an object");
  }
  return value as Record<string, unknown>;
}

/** Metadata stays in the sidecar. Null/absent pixels never become zero targets. */
export function referencePoints(value: unknown, features: Features): Record<string, Point[]> {
  const file = "camera-observations.json";
  const observations = object(value, file);
  const points = observations.points === undefined ? {} : object(observations.points, file + ".points");
  const targets = new Map<string, Map<string, [number, number]>>();
  for (const [subject, rawPoints] of Object.entries(points)) {
    const subjectPath = file + ".points[" + JSON.stringify(subject) + "]";
    if (!Object.hasOwn(features, subject)) throw new Error(subjectPath + " names an unknown construction subject");
    const measured = new Map<string, [number, number]>();
    for (const [name, rawPoint] of Object.entries(object(rawPoints, subjectPath))) {
      const pointPath = subjectPath + "[" + JSON.stringify(name) + "]";
      if (!Object.hasOwn(features[subject]!, name)) throw new Error(pointPath + " names an unknown construction feature");
      const pixel = object(rawPoint, pointPath).pixel;
      if (pixel === null || pixel === undefined) continue;
      if (!Array.isArray(pixel) || pixel.length !== 2 || !pixel.every(v => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e12)) {
        throw new Error(pointPath + ".pixel must be null or two finite render-pixel numbers within +/-1e12");
      }
      measured.set(name, [pixel[0] as number, pixel[1] as number]);
    }
    targets.set(subject, measured);
  }
  return Object.fromEntries(Object.entries(features).map(([subject, localPoints]) => [
    subject, Object.entries(localPoints).map(([name, local]) => {
      const target = targets.get(subject)?.get(name);
      return target === undefined ? { name, local } : { name, local, target, weight: 1 };
    }),
  ]));
}
`;
}

function cameraWorksheetMd(): string {
  return `# Optional camera worksheet

Use this after a useful blockout when matching visible features whose dimensions
you trust. Manual correction remains available. This is a worksheet for the
existing camera tools, not automatic image detection or geometry recovery.

## Record real correspondences

The starter's authoring.cameraProbe already reads camera-observations.json.
Its ground subject is the land mesh, not the water or backdrop. Its main-mass
subject supplies separate upper checks. The box helper derives corners from the
same dimensions and bevel as the actual mesh. Top corners are at
[±(width/2-bevel), height/2, ±(depth/2-bevel)]; back means local -Z, front +Z,
left -X, right +X. They are inset top-face vertices, not outer AABB corners or
necessarily screen-left/right after posing. The old top point is a top-center
inspection point, not an identifiable image corner.

1. Inspect the reference at original resolution. Match the probe viewport and
   actual capture dimensions/seed; examples below use 1200×900 and seed 7.
   Convert displayed/cropped coordinates explicitly to full render pixels with
   top-left origin, and record original size, crop/scale and measurement method.
   Sidecar metadata records provenance; it never rescales pixels or changes the
   rendering viewport for you.
2. Identify actual visible features in the construction. The land is disposable
   starter geometry: its shape/dimensions must be credible in your reference
   before it can calibrate the camera. Changing an assembly's pose or geometry
   changes the assumptions. Replace its source-derived features and sidecar
   names when replacing the construction. Bounds do not prove visibility or
   silhouette; even an unoccluded vertex may have too little contrast to measure.
3. In camera-observations.json replace only measured null pixels with [x,y].
   Record physical identity, uncertainty and calibration/check role. Leave
   ambiguous/hidden points null or omit them. Unknown names and malformed pairs
   fail clearly. Never invent a hidden corner or copy a projected source pixel
   as a measured reference coordinate.
4. Review camera-fit-plan.json. Its four ground corners are only a possible
   selection. Remove an unmeasured point from selection if justified, preserve
   your reasoning, and check rank/conditioning rather than assuming enough
   points. Adapt the bounded angles, pan, height and tolerance before fitting.
   Distance is fixed to the source's explicit eye/lookAt gauge: orthographic
   images cannot determine it. The export requires an unparented, unit-scale,
   no-roll, world-Y-up camera with matching aspect; read all export diagnostics.
   A fit cannot choose the correct projection family or repair wrong geometry.

## Inspect, fit, deliberately apply

Use unique output names per attempt and the capture's actual seed:

    aperture camera inspect-local aperture.headless.config.ts --request-resource authoring.cameraProbe --seed 7 --out composition-before.json
    aperture camera fit-local aperture.headless.config.ts --request-resource authoring.cameraProbe --fit-plan camera-fit-plan.json --seed 7 --out camera-fit.report.json

Check each current command exit before reading an output file. For fit-local,
exit 0 completes an accepted fit; still inspect result.fit.accepted, conditioning/rank, bound hits,
point residuals/clipping and engine precision. Exit 2 retains a completed
rejection/inspection for review. Exit 1 means invalid input or execution failure
and may leave an old output file untouched: it is not a fresh result. An unfilled
selection fails with exit 1; normal extraction/inspection still works. Retain
failed plans/reports. Do not relax tolerance or discard a difficult observation
merely to obtain acceptance. Convergence alone is insufficient.

The fit-local report's inspection is the current camera before application;
result.spawnCamera is a proposal, and cameraApplied remains false. If accepted
and credible, explicitly edit the source camera. Replace its whole transform,
including emitted rotation, and overlay the proposal's complete camera fields
on preserved presentation settings. In src/systems/scene.system.ts:

1. Replace the existing view.transform value with the complete
   result.spawnCamera.transform object, including rotation, translation and lookAt.
2. Replace the geometry/projection fields in view.camera with every field of
   result.spawnCamera.camera. Keep the existing frustumCulling:false and clearColor
   presentation values. The proposal's fixed aspect, autoAspect, clipping and
   height/FOV must all be retained; do not cherry-pick fields.
3. Keep the view declaration's satisfies SpawnCameraOptions check. Keep the
   following this.spawn.camera({ key: "camera", ...view }) call and the
   referenceDistance calculation reading this same edited view. Do not edit only
   the spawn call while leaving the gauge attached to an old view descriptor.

This is a deliberate source edit: copy values only after reviewing the current
accepted report. No report is automatically loaded and the tools never edit the
source. Do not merge stale parent/scale/orientation into the new transform or
leave outer FOV overrides. Explicit rotation takes precedence over lookAt.

Run inspect-local again with a new output name, such as composition-calibrated.json.
Verify the actual current camera, current observations and fixed-base residuals.
Then correct proportions while holding the credible camera fixed. The main-mass
features are excluded from the ground camera fit, but a point used to tune a
dimension is not an independent geometry holdout. Reserve another actual feature
if claiming an independent shape check. Reinspect after changing dimensions or
observations: old reports are snapshots. Finally capture and compare the actual
image, including negative space, silhouette and contacts. A small fit residual
alone proves neither correct correspondences nor visual quality.

General contracts and examples:
[local fitting](https://github.com/felixtrz/aperture/blob/main/docs/CAMERA_LOCAL_FITTING.md),
[composition workflow](https://github.com/felixtrz/aperture/blob/main/docs/CAMERA_COMPOSITION_WORKFLOW.md).
`;
}
