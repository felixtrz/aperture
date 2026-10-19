import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { ApertureCliError } from "../errors.js";
import {
  fitCameraLandmarks,
  projectCameraLandmarks,
} from "../camera/landmarks.js";

export async function runCameraCommand(options: {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly stdout: (text: string) => void;
}): Promise<number> {
  if (options.argv.some((arg) => arg === "--help" || arg === "-h")) {
    options.stdout(cameraHelp());
    return 0;
  }
  const [command, ...args] = options.argv;
  if (command !== "project" && command !== "fit")
    throw new ApertureCliError(
      "aperture.camera.usage",
      "Use 'aperture camera project <job.json>' or 'aperture camera fit <job.json>' (optional --out <report.json>). Run 'aperture camera --help'.",
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
  try {
    source = await readFile(input, "utf8");
  } catch (error) {
    throw new ApertureCliError(
      "aperture.camera.readFailed",
      `Cannot read '${input}': ${String(error)}`,
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
  const result = fitted ?? projectCameraLandmarks(job);
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
  return fitted !== null && !fitted.fit.accepted ? 2 : 0;
}

function cameraHelp(): string {
  return `Usage:
  aperture camera project <job.json> [--out <report.json>]
  aperture camera fit <job.json> [--out <report.json>]

Project named world landmarks or fit a bounded camera on the CPU. No browser,
GPU, screenshots, scene evaluation, or geometry changes are involved.
JSON reports always go to stdout; --out also writes the report atomically.

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
Exit 0: projection report or accepted fit. Exit 2: fit report needs review
(not converged or residual tolerance exceeded). Exit 1: invalid input/I/O.

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
`;
}
