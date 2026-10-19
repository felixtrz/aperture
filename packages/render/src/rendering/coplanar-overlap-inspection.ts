import type {
  CoplanarOverlapDiagnostic,
  CoplanarOverlapInput,
  CoplanarOverlapLimits,
  CoplanarOverlapOptions,
  CoplanarOverlapReport,
  CoplanarOverlapScope,
  CoplanarOverlapTolerances,
  CoplanarOverlapFinding,
} from "./coplanar-overlap-types.js";
import { boundsOverlap, triangleOverlap } from "./coplanar-overlap-geometry.js";
import {
  readInspectionDraw,
  type InspectionDraw,
} from "./coplanar-overlap-draw.js";

export type * from "./coplanar-overlap-types.js";

const defaultTolerances: Required<CoplanarOverlapTolerances> = {
  distance: 1e-6,
  relativeDistance: 1e-7,
  angleRadians: 1e-5,
  minArea: 0,
};
const defaultLimits: Required<CoplanarOverlapLimits> = {
  maxDraws: 64,
  maxTriangles: 50000,
  maxTrianglePairs: 1000000,
  maxFindings: 200,
};

/** On-demand CPU geometry evidence. Does not mutate or validate the scene for rendering. */
export function inspectCoplanarMeshOverlaps(
  input: CoplanarOverlapInput,
): CoplanarOverlapReport {
  const { scope, tolerances, limits, viewId } = resolveOptions(input);
  const snapshot = input.snapshot;
  if (
    !Array.isArray(snapshot.meshDraws) ||
    !(snapshot.transforms instanceof Float32Array) ||
    !Array.isArray(snapshot.views)
  )
    throw new TypeError(
      "Inspection requires meshDraws, views and Float32 transforms.",
    );
  const diagnostics: CoplanarOverlapDiagnostic[] = [];
  const findings: CoplanarOverlapFinding[] = [];
  const counts = {
    selectedDraws: 0,
    inspectedDraws: 0,
    triangles: 0,
    drawPairs: 0,
    trianglePairs: 0,
    aabbRejectedPairs: 0,
  };
  const view =
    viewId === null
      ? undefined
      : snapshot.views.find((v) => v.viewId === viewId);
  if (viewId !== null && !view)
    throw new TypeError(`Unknown inspection viewId ${viewId}.`);
  const entityKey = (ref: { index: number; generation: number }): string =>
    `${ref.index}:${ref.generation}`;
  const meshIds = new Set(scope.meshIds ?? []),
    entities = new Set((scope.entities ?? []).map(entityKey));
  const selected = snapshot.meshDraws
    .filter(
      (draw) =>
        scope.all === true ||
        meshIds.has(draw.mesh.id) ||
        entities.has(entityKey(draw.entity)),
    )
    .sort(
      (a, b) =>
        a.entity.index - b.entity.index ||
        a.entity.generation - b.entity.generation ||
        a.renderId - b.renderId ||
        a.submesh - b.submesh ||
        compare(a.mesh.id, b.mesh.id),
    );
  for (const id of meshIds)
    if (!selected.some((draw) => draw.mesh.id === id))
      diagnostics.push({
        code: "unmatched-selector",
        message: `No extracted draw uses mesh '${id}'.`,
      });
  for (const ref of entities)
    if (!selected.some((draw) => entityKey(draw.entity) === ref))
      diagnostics.push({
        code: "unmatched-selector",
        message: `No extracted draw belongs to entity ${ref}.`,
      });
  const eligible = selected.filter(
    (draw) => !view || (draw.layerMask & view.layerMask) !== 0,
  );
  counts.selectedDraws = eligible.length;
  if (eligible.length > limits.maxDraws)
    diagnostics.push({
      code: "draw-limit",
      message: `Selected ${eligible.length} draws; inspecting the first ${limits.maxDraws}.`,
    });
  const prepared: InspectionDraw[] = [];
  const triangleBudget = { remaining: limits.maxTriangles };
  for (const draw of eligible.slice(0, limits.maxDraws)) {
    try {
      const item = readInspectionDraw(input, draw, triangleBudget);
      if (item === "triangle-limit") {
        diagnostics.push({
          code: "triangle-limit",
          renderId: draw.renderId,
          message:
            "Selected draw exceeds the remaining triangle budget; remaining draws were not inspected.",
        });
        break;
      }
      counts.inspectedDraws++;
      if (item.degenerateCount > 0)
        diagnostics.push({
          code: "degenerate-triangles",
          renderId: draw.renderId,
          message: `Skipped ${item.degenerateCount} degenerate or numerically unresolved triangles.`,
        });
      prepared.push(item);
    } catch (error: unknown) {
      diagnostics.push({
        code: "unsupported-draw",
        renderId: draw.renderId,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      counts.triangles = limits.maxTriangles - triangleBudget.remaining;
    }
  }
  let precisionCount = 0;
  outer: for (let i = 0; i < prepared.length; i++)
    for (let j = i + 1; j < prepared.length; j++) {
      const a = prepared[i]!,
        b = prepared[j]!;
      counts.drawPairs++;
      const margin =
        Math.max(
          tolerances.distance,
          tolerances.relativeDistance * Math.max(a.extent, b.extent),
        ) +
        a.precision +
        b.precision;
      if (!boundsOverlap(a, b, margin)) continue;
      for (const ta of a.triangles)
        for (const tb of b.triangles) {
          if (counts.trianglePairs >= limits.maxTrianglePairs) {
            diagnostics.push({
              code: "pair-limit",
              message:
                "Triangle-pair budget exhausted; remaining pairs were not inspected.",
            });
            break outer;
          }
          counts.trianglePairs++;
          if (!boundsOverlap(ta, tb, margin)) {
            counts.aabbRejectedPairs++;
            continue;
          }
          const overlap = triangleOverlap(ta, tb, tolerances);
          if (overlap === "precision") {
            precisionCount++;
            continue;
          }
          if (!overlap) continue;
          if (findings.length >= limits.maxFindings) {
            diagnostics.push({
              code: "finding-limit",
              message:
                "Finding budget exhausted; additional overlap exists and remaining pairs were not inspected.",
            });
            break outer;
          }
          findings.push({
            a: { ...a.identity, triangleOffset: ta.offset },
            b: { ...b.identity, triangleOffset: tb.offset },
            offsetUnit: "index-or-vertex",
            ...overlap,
            visibility: "unknown",
          });
        }
    }
  if (precisionCount > 0)
    diagnostics.push({
      code: "numerical-precision",
      message: `${precisionCount} candidate pairs were numerically unresolved.`,
    });
  return {
    schema: "aperture.coplanar-overlaps.v1",
    frame: snapshot.frame,
    coverage:
      diagnostics.length > 0
        ? "partial"
        : eligible.length < 2
          ? "empty"
          : "complete",
    scope,
    viewId,
    tolerances,
    limits,
    counts,
    findings,
    diagnostics,
  };
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function onlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  name: string,
): void {
  for (const key of Object.keys(value))
    if (!keys.includes(key))
      throw new TypeError(`Unknown ${name} field '${key}'.`);
}
function resolveOptions(input: CoplanarOverlapOptions): {
  scope: CoplanarOverlapScope;
  tolerances: Required<CoplanarOverlapTolerances>;
  limits: Required<CoplanarOverlapLimits>;
  viewId: number | null;
} {
  const scope = input.scope;
  if (!record(scope))
    throw new TypeError("An explicit inspection scope is required.");
  onlyKeys(scope, ["all", "meshIds", "entities"], "scope");
  if (scope.all !== undefined && typeof scope.all !== "boolean")
    throw new TypeError("scope.all must be boolean.");
  if (
    scope.meshIds !== undefined &&
    (!Array.isArray(scope.meshIds) ||
      scope.meshIds.some((id) => typeof id !== "string" || id.length === 0))
  )
    throw new TypeError("scope.meshIds must contain nonempty strings.");
  if (
    scope.entities !== undefined &&
    (!Array.isArray(scope.entities) ||
      scope.entities.some(
        (ref) =>
          !record(ref) ||
          !Number.isSafeInteger(ref.index) ||
          (ref.index as number) < 0 ||
          !Number.isSafeInteger(ref.generation) ||
          (ref.generation as number) < 0,
      ))
  )
    throw new TypeError("scope.entities must contain index/generation refs.");
  const hasSelectors =
    (scope.meshIds?.length ?? 0) + (scope.entities?.length ?? 0) > 0;
  if (scope.all === true ? hasSelectors : !hasSelectors)
    throw new TypeError(
      "Use scope.all:true or nonempty mesh/entity selectors, without combining them.",
    );
  const tolerances = { ...defaultTolerances },
    limits = { ...defaultLimits };
  if (input.tolerances !== undefined) {
    if (!record(input.tolerances))
      throw new TypeError("tolerances must be an object.");
    onlyKeys(input.tolerances, Object.keys(defaultTolerances), "tolerances");
    for (const key of Object.keys(
      defaultTolerances,
    ) as (keyof typeof tolerances)[]) {
      const value = input.tolerances[key];
      if (value !== undefined) {
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
          throw new TypeError(`Invalid tolerance '${key}'.`);
        tolerances[key] = value;
      }
    }
  }
  if (tolerances.angleRadians > Math.PI / 2)
    throw new TypeError("angleRadians must not exceed pi/2.");
  if (input.limits !== undefined) {
    if (!record(input.limits)) throw new TypeError("limits must be an object.");
    onlyKeys(input.limits, Object.keys(defaultLimits), "limits");
    for (const key of Object.keys(defaultLimits) as (keyof typeof limits)[]) {
      const value = input.limits[key];
      if (value !== undefined) {
        if (
          typeof value !== "number" ||
          !Number.isSafeInteger(value) ||
          value < 1
        )
          throw new TypeError(
            `Limit '${key}' must be a positive safe integer.`,
          );
        limits[key] = value;
      }
    }
  }
  if (
    input.viewId !== undefined &&
    (typeof input.viewId !== "number" ||
      !Number.isSafeInteger(input.viewId) ||
      input.viewId < 0)
  )
    throw new TypeError("viewId must be a nonnegative integer.");
  const viewId = input.viewId ?? null;
  return {
    scope: {
      ...(scope.all === true ? { all: true } : {}),
      ...(scope.meshIds ? { meshIds: [...scope.meshIds] } : {}),
      ...(scope.entities
        ? { entities: scope.entities.map((ref) => ({ ...ref })) }
        : {}),
    },
    tolerances,
    limits,
    viewId,
  };
}
