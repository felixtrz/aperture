import { readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { ApertureCliError } from "../errors.js";
import {
  fitCameraLandmarks,
  projectCameraLandmarks,
} from "../camera/landmarks.js";
import { unprojectCameraPixels } from "../camera/unproject.js";
import {
  cameraInspectLocalHelp,
  runCameraInspectLocalCommand,
} from "./camera-inspect-local.js";

export async function runCameraCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdout: (text: string) => void;
  readonly stderr?: (text: string) => void;
}): Promise<number> {
  if (options.argv[0] === "inspect-local")
    return runCameraInspectLocalCommand({
      ...options,
      argv: options.argv.slice(1),
    });
  if (options.argv.some((arg) => arg === "--help" || arg === "-h")) {
    options.stdout(cameraHelp());
    return 0;
  }
  const [command, ...args] = options.argv;
  if (command !== "project" && command !== "fit" && command !== "unproject")
    throw new ApertureCliError(
      "aperture.camera.usage",
      "Use 'aperture camera project|fit|unproject <job.json>' or 'aperture camera inspect-local <headless-config>'. Run 'aperture camera --help'.",
    );
  let input: string | undefined, output: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--out") {
      const value = args[++index];
      if (output !== undefined || value === undefined || value.startsWith("-"))
        throw new ApertureCliError(
          "aperture.camera.usage",
          "--out requires one report path and may only be supplied once.",
        );
      output = path.resolve(options.cwd, value);
    } else if (arg.startsWith("-") || input !== undefined) {
      throw new ApertureCliError(
        "aperture.camera.usage",
        `Unexpected camera argument '${arg}'. Run 'aperture camera --help'.`,
      );
    } else input = path.resolve(options.cwd, arg);
  }
  if (input === undefined)
    throw new ApertureCliError(
      "aperture.camera.usage",
      "Provide a camera landmark job JSON path.",
    );
  if (input === output)
    throw new ApertureCliError(
      "aperture.camera.usage",
      "The output report path must differ from the input job path.",
    );
  let source: string;
  let inputTarget: string | undefined, inputEntry: string | undefined;
  try {
    source = await readFile(input, "utf8");
    if (output !== undefined) {
      inputTarget = await realpath(input);
      inputEntry = path.join(
        await realpath(path.dirname(input)),
        path.basename(input),
      );
    }
  } catch (error) {
    throw new ApertureCliError(
      "aperture.camera.readFailed",
      `Cannot read '${input}': ${String(error)}`,
    );
  }
  if (output !== undefined) {
    try {
      // Atomic rename replaces the output directory entry, not a leaf
      // symlink's target. Resolve its parent only, then use that same path
      // for writing so directory aliases cannot bypass the input guard.
      output = path.join(
        await realpath(path.dirname(output)),
        path.basename(output),
      );
    } catch (error) {
      throw new ApertureCliError(
        "aperture.camera.writeFailed",
        `Cannot resolve report parent '${output}': ${String(error)}`,
      );
    }
    if (output === inputTarget || output === inputEntry)
      throw new ApertureCliError(
        "aperture.camera.usage",
        "The output report path must differ from the input job path, including filesystem aliases.",
      );
  }
  let job: unknown;
  try {
    job = JSON.parse(source);
  } catch {
    throw new ApertureCliError(
      "aperture.camera.invalidJson",
      `Camera job '${input}' is not valid JSON.`,
    );
  }
  const fitted = command === "fit" ? fitCameraLandmarks(job) : null;
  const unprojected =
    command === "unproject" ? unprojectCameraPixels(job) : null;
  const result = fitted ?? unprojected ?? projectCameraLandmarks(job);
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (output !== undefined) {
    const temporary = `${output}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, serialized, { flag: "wx" });
      await rename(temporary, output);
    } catch (error) {
      throw new ApertureCliError(
        "aperture.camera.writeFailed",
        `Cannot write '${output}': ${String(error)}`,
      );
    } finally {
      await rm(temporary, { force: true });
    }
  }
  options.stdout(serialized);
  return (fitted !== null && !fitted.fit.accepted) ||
    (unprojected !== null && !unprojected.accepted)
    ? 2
    : 0;
}

function cameraHelp(): string {
  return `Usage:
  aperture camera project <job.json> [--out <report.json>]
  aperture camera fit <job.json> [--out <report.json>]
  aperture camera unproject <job.json> [--out <report.json>]
  aperture camera inspect-local <headless-config> (--request <args.json> | --request-resource <id>) [--out <report.json>]

For project/fit/unproject: project world landmarks, fit a bounded camera, or intersect pixel rays with an
explicit world plane on the CPU. No browser,
GPU, screenshots, scene evaluation, or geometry changes are involved.
JSON reports always go to stdout; --out also writes the report atomically.
The report path must differ from the input job, including filesystem aliases.

Job fields:
  viewport: { width, height } (integer pixels; origin top-left)
  camera: { projection, translation: [x,y,z], lookAt: [x,y,z], near, far,
            fovYDegrees (perspective) OR orthographicHeight (orthographic) }
  landmarks: [{ name, world: [x,y,z], target?: [pixelX,pixelY], weight?: 1 }]
  fit: { parameters: { azimuthDegrees, elevationDegrees, distance, panX, panY,
                      fovYDegrees OR orthographicHeight },
         maxIterations?: 100, tolerancePixels?: 1 }

Every fit parameter must be "fixed" or { "min": number, "max": number }.
Initial angles/distance come from camera; pans start at zero. Pan is in the
rotated camera plane around the original lookAt. Orthographic distance must
be fixed. World up is +Y, roll zero, principal point is the viewport center.
Angles use degrees. Fits are local approximations; inspect signed residuals,
bound hits, and conditioning before applying report.spawnCamera to spawn.camera.
tolerancePixels bounds the largest unweighted Euclidean point residual.
Exit 0: projection report, accepted fit or all accepted unproject intersections.
Exit 2: fit or intersection report needs review. Exit 1: invalid input/I/O.

Unproject uses the same viewport/camera plus these fields (no landmarks/fit):
  pixels: [{ name, pixel: [pixelX,pixelY] }]
  plane: { normal: [nx,ny,nz], constant: c }  // dot(normal, world) + c = 0
Normal and constant are normalized together; nonzero finite normals are required.
Rays have unit world directions. Perspective origins are the engine camera eye;
orthographic origins are on the camera-depth-zero plane. Signed distances and
intersections use your world units. Offscreen pixels extrapolate; behind-camera,
outside-near/far, parallel, ill-conditioned or inaccurate results are unaccepted.
Each point reports rays, intersection, clip/frustum flags and reprojection error.

Save as plane-job.json and run 'aperture camera unproject plane-job.json':
{"viewport":{"width":800,"height":600},
 "camera":{"projection":"orthographic","translation":[0,0,10],
 "lookAt":[0,0,0],"near":1,"far":20,"orthographicHeight":6},
 "plane":{"normal":[0,0,1],"constant":0},
 "pixels":[{"name":"corner","pixel":[200,200]}]}
Expected world intersection: [-2,1,0]. No depth is inferred and no scene is edited.

Full runnable examples and metric definitions: docs/CAMERA_LANDMARKS.md

Save this runnable example as job.json, then run 'aperture camera fit job.json':
{
  "viewport": { "width": 800, "height": 600 },
  "camera": { "projection": "orthographic", "translation": [0,0,10],
              "lookAt": [0,0,0], "near": 0.1, "far": 100,
              "orthographicHeight": 6 },
  "landmarks": [{ "name": "corner", "world": [-1,1,0],
                  "target": [200,200] }],
  "fit": { "parameters": { "azimuthDegrees": "fixed",
             "elevationDegrees": "fixed", "distance": "fixed",
             "panX": { "min": -2, "max": 2 }, "panY": "fixed",
             "orthographicHeight": "fixed" } }
}
Expected fitted panX is approximately 1. report.spawnCamera includes an explicit
checked quaternion; remove transform.rotation if editing lookAt by hand later.

${cameraInspectLocalHelp()}
`;
}
