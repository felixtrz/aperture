import type { CameraLocalJobSeed } from "@aperture-engine/app/systems";
import { ApertureCliError } from "../errors.js";
import type { CameraLandmarkJob } from "./landmarks.js";

export interface CameraFitLocalPlan {
  readonly selection: readonly {
    readonly subject: string;
    readonly point: string;
  }[];
  readonly fit: NonNullable<CameraLandmarkJob["fit"]>;
}

function invalid(message: string): never {
  throw new ApertureCliError("aperture.camera.invalidJob", message);
}

function object(
  value: unknown,
  label: string,
  keys: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return invalid(`${label} must be an object.`);
  for (const key of Object.keys(value))
    if (!keys.includes(key)) invalid(`${label}.${key} is not supported.`);
  return value as Record<string, unknown>;
}

/** Plan syntax only; the existing fitter validates settings against the fresh camera. */
export function parseCameraFitLocalPlan(input: unknown): CameraFitLocalPlan {
  const plan = object(input, "fit-plan", ["selection", "fit"]);
  const selection = plan["selection"];
  if (!Array.isArray(selection) || !selection.length || selection.length > 4096)
    return invalid(
      "fit-plan.selection must contain 1–4096 explicit point pairs.",
    );
  const names = new Set<string>();
  for (const item of selection) {
    const pair = object(item, "selection", ["subject", "point"]);
    for (const key of ["subject", "point"])
      if (typeof pair[key] !== "string" || pair[key].trim() === "")
        invalid(`selection.${key} must be a nonempty name.`);
    const name = JSON.stringify([pair["subject"], pair["point"]]);
    if (names.has(name)) invalid(`Duplicate selected landmark ${name}.`);
    names.add(name);
  }
  const fit = object(plan["fit"], "fit", [
    "parameters",
    "tolerancePixels",
    "maxIterations",
  ]);
  const tolerance = fit["tolerancePixels"];
  if (
    typeof tolerance !== "number" ||
    !Number.isFinite(tolerance) ||
    tolerance <= 0 ||
    tolerance > 1e12
  )
    invalid("fit.tolerancePixels must be explicit, positive and at most 1e12.");
  if (
    fit["parameters"] === null ||
    typeof fit["parameters"] !== "object" ||
    Array.isArray(fit["parameters"])
  )
    invalid("fit.parameters must be an explicit parameter map.");
  return input as CameraFitLocalPlan;
}

/** Select only after the complete source-owned request has passed job export. */
export function createLocalFitJob(
  seed: CameraLocalJobSeed,
  plan: CameraFitLocalPlan,
): CameraLandmarkJob {
  const landmarks = plan.selection.map(({ subject, point }) => {
    const name = JSON.stringify([subject, point]);
    const matches = seed.landmarks.filter((landmark) => landmark.name === name);
    if (matches.length !== 1)
      return invalid(
        `Selected landmark ${name} must exist exactly once in the fresh export.`,
      );
    const landmark = matches[0]!;
    if (
      landmark.target === undefined ||
      landmark.target.length !== 2 ||
      !landmark.target.every(Number.isFinite)
    )
      return invalid(
        `Selected landmark ${name} requires an explicit source-owned target.`,
      );
    // Preserve omitted weights: the existing fitter supplies its own unit default.
    return landmark;
  });
  return { ...seed, landmarks, fit: plan.fit };
}
