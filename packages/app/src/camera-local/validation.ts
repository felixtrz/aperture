import type {
  CameraLocalInspectionRequest,
  CameraLocalEntitySelector,
} from "./types.js";

export class CameraLocalInputError extends Error {}
export function requireLocal(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new CameraLocalInputError(message);
}
export function record(
  value: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  requireLocal(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object.`,
  );
  requireLocal(
    Object.keys(value).every((key) => keys.includes(key)),
    `${label} has unsupported fields.`,
  );
  return value as Record<string, unknown>;
}
export function finite(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= 1e12
  );
}
function tuple(value: unknown, size: number, label: string): void {
  requireLocal(
    Array.isArray(value) && value.length === size && value.every(finite),
    `${label} must contain ${size} finite numbers within ±1e12.`,
  );
}
export function selector(value: unknown): CameraLocalEntitySelector {
  const item = record(value, ["key", "index", "generation"], "Entity selector");
  if (Object.hasOwn(item, "key")) {
    requireLocal(
      Object.keys(item).length === 1 &&
        typeof item["key"] === "string" &&
        item["key"].length > 0,
      "Use either one nonempty key or an index/generation reference.",
    );
  } else {
    requireLocal(
      [item["index"], item["generation"]].every(
        (n) => finite(n) && Number.isSafeInteger(n) && n >= 0,
      ),
      "Use a nonnegative integer index/generation reference.",
    );
  }
  return item as unknown as CameraLocalEntitySelector;
}
export function parseRequest(input: unknown): CameraLocalInspectionRequest {
  const request = record(
    input,
    ["viewport", "subjects", "cameraJob"],
    "Inspection request",
  );
  const viewport = record(request["viewport"], ["width", "height"], "viewport");
  requireLocal(
    [viewport["width"], viewport["height"]].every(
      (n) => finite(n) && Number.isInteger(n) && n > 0 && n <= 1e6,
    ),
    "viewport width/height must be integers from 1 to 1000000.",
  );
  const subjects = request["subjects"];
  requireLocal(
    Array.isArray(subjects) && subjects.length > 0 && subjects.length <= 256,
    "Pass 1–256 named subjects.",
  );
  const subjectNames = new Set<string>();
  let count = 0;
  for (const value of subjects) {
    const subject = record(
      value,
      ["name", "entity", "points", "faces", "bounds"],
      "Subject",
    );
    name(subject["name"], subjectNames);
    selector(subject["entity"]);
    for (const kind of ["points", "faces"] as const) {
      const entries = subject[kind] === undefined ? [] : subject[kind];
      requireLocal(Array.isArray(entries), `${kind} must be an array.`);
      count += entries.length;
      requireLocal(count <= 4096, "Pass at most 4096 total points and faces.");
      const names = new Set<string>();
      for (const value of entries) {
        const entry = record(
          value,
          kind === "points"
            ? ["name", "local", "target", "weight"]
            : ["name", "localTriangle"],
          kind,
        );
        name(entry["name"], names);
        if (kind === "points") {
          tuple(entry["local"], 3, "local");
          if (entry["target"] !== undefined)
            tuple(entry["target"], 2, "target");
          if (entry["weight"] !== undefined)
            requireLocal(
              finite(entry["weight"]) &&
                entry["weight"] > 0 &&
                entry["target"] !== undefined,
              "weight requires a target and must be positive and finite within 1e12.",
            );
        } else {
          const triangle = entry["localTriangle"];
          requireLocal(
            Array.isArray(triangle) && triangle.length === 3,
            "localTriangle must contain three ordered vertices.",
          );
          triangle.forEach((vertex) =>
            tuple(vertex, 3, "localTriangle vertex"),
          );
        }
      }
    }
    if (subject["bounds"] !== undefined) {
      const bounds = record(
        subject["bounds"],
        ["source", "includeDescendants"],
        "bounds",
      );
      requireLocal(
        bounds["source"] === "mesh-local-aabb" &&
          typeof bounds["includeDescendants"] === "boolean",
        "bounds requires source: 'mesh-local-aabb' and boolean includeDescendants.",
      );
    }
    requireLocal(
      subject["bounds"] !== undefined ||
        (subject["points"] as unknown[] | undefined)?.length ||
        (subject["faces"] as unknown[] | undefined)?.length,
      "Each subject needs points, faces, or bounds.",
    );
  }
  if (request["cameraJob"] !== undefined) {
    const job = record(
      request["cameraJob"],
      ["referenceDistance"],
      "cameraJob",
    );
    requireLocal(
      finite(job["referenceDistance"]) && job["referenceDistance"] > 1e-6,
      "cameraJob.referenceDistance must be explicit, greater than 1e-6 and at most 1e12.",
    );
  }
  return request as unknown as CameraLocalInspectionRequest;
}
function name(value: unknown, names: Set<string>): void {
  requireLocal(
    typeof value === "string" &&
      value.length > 0 &&
      value.length <= 256 &&
      !names.has(value),
    "Names must be nonempty, unique within their list, and at most 256 characters.",
  );
  names.add(value);
}
