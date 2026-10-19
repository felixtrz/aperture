import { invertMat4 } from "@aperture-engine/simulation";
import { readStaticInspectionDraw } from "./static-inspection-draw.js";
import {
  projectInspectionVertex,
  projectedBoundsPrecisionPixels,
} from "./projected-bounds-projection.js";
import type { MeshDrawPacket, ViewPacket } from "./snapshot-packet-types.js";
import type {
  ProjectedBoundsInput,
  ProjectedBoundsOptions,
  ProjectedBoundsScope,
  ProjectedBoundsReport,
  ProjectedBoundsDrawReport,
  ProjectedBoundsDiagnostic,
  ProjectedBoundsWitness,
  ProjectedVertexBounds,
} from "./projected-bounds-types.js";

export type * from "./projected-bounds-types.js";

/** Pure inspection of selected retained static vertices; no ECS or GPU work. */
export function inspectProjectedMeshBounds(
  input: ProjectedBoundsInput,
): ProjectedBoundsReport {
  const { scope, target, limits, viewId } = options(input);
  const { snapshot } = input;
  if (
    !Array.isArray(snapshot.meshDraws) ||
    !Array.isArray(snapshot.views) ||
    !(snapshot.transforms instanceof Float32Array) ||
    !(snapshot.viewMatrices instanceof Float32Array) ||
    !Number.isSafeInteger(snapshot.frame) ||
    snapshot.frame < 0
  )
    throw new TypeError(
      "Inspection requires a valid snapshot frame, meshDraws, views and Float32 matrices.",
    );
  const views = snapshot.views.filter((v) => v.viewId === viewId);
  if (views.length !== 1)
    throw new TypeError(
      `Expected exactly one retained viewId ${viewId}; available IDs: ${snapshot.views.map((v) => v.viewId).join(", ")}.`,
    );
  const view = views[0]!;
  for (const draw of snapshot.meshDraws) {
    if (
      ![
        draw.entity.index,
        draw.entity.generation,
        draw.submesh,
        draw.materialSlot,
      ].every((n) => Number.isSafeInteger(n) && n >= 0) ||
      !Number.isSafeInteger(draw.renderId) ||
      !validLayerMask(draw.layerMask) ||
      typeof draw.mesh.id !== "string" ||
      !draw.mesh.id ||
      typeof draw.material.id !== "string" ||
      !draw.material.id
    )
      throw new TypeError("Invalid retained draw identity or layer mask.");
  }
  if (!validLayerMask(view.layerMask))
    throw new TypeError("Invalid retained view layer mask.");
  const diagnostics: ProjectedBoundsDiagnostic[] = [];
  const entityKey = (e: { index: number; generation: number }) =>
    `${e.index}:${e.generation}`;
  const meshes = new Set(scope.meshIds ?? []),
    entities = new Set((scope.entities ?? []).map(entityKey));
  const matched = snapshot.meshDraws
    .filter(
      (d) =>
        scope.all === true ||
        meshes.has(d.mesh.id) ||
        entities.has(entityKey(d.entity)),
    )
    .sort(
      (a, b) =>
        a.entity.index - b.entity.index ||
        a.entity.generation - b.entity.generation ||
        a.renderId - b.renderId ||
        a.submesh - b.submesh ||
        compare(a.mesh.id, b.mesh.id),
    );
  for (const id of meshes)
    if (!matched.some((d) => d.mesh.id === id))
      diagnostics.push({
        code: "unmatched-selector",
        message: `No extracted draw uses mesh '${id}'.`,
      });
  for (const ref of entities)
    if (!matched.some((d) => entityKey(d.entity) === ref))
      diagnostics.push({
        code: "unmatched-selector",
        message: `No extracted draw belongs to entity ${ref}.`,
      });
  const selected = matched.filter((d) => (d.layerMask & view.layerMask) !== 0);
  const counts = {
    matchedDraws: matched.length,
    layerExcludedDraws: matched.length - selected.length,
    selectedDraws: selected.length,
    inspectedDraws: 0,
    attemptedReferences: 0,
    projectedReferences: 0,
  };
  let vp: readonly number[] | null = null;
  try {
    vp = projectionMatrix(input, view);
  } catch (error: unknown) {
    diagnostics.push({ code: "unsupported-view", message: message(error) });
  }
  if (selected.length > limits.maxDraws)
    diagnostics.push({
      code: "draw-limit",
      message: `Selected ${selected.length} draws; only the first ${limits.maxDraws} can be inspected.`,
    });
  const budget = { remaining: limits.maxVertices };
  const draws: ProjectedBoundsDrawReport[] = [];
  let aggregate: ProjectedVertexBounds | null = null;
  if (vp !== null)
    for (const draw of selected.slice(0, limits.maxDraws)) {
      const identity = drawIdentity(draw);
      const drawDiagnostics: ProjectedBoundsDiagnostic[] = [];
      let range: ProjectedBoundsDrawReport["range"] = null;
      let bounds: ProjectedVertexBounds | null = null;
      let projectedReferences = 0,
        outsideViewportReferences = 0,
        beyondFarReferences = 0;
      let maxPixelUncertainty: number | null = null;
      let failureCode = "unsupported-draw";
      try {
        const prepared = readStaticInspectionDraw(input, draw, budget);
        if (prepared === "reference-limit") {
          failureCode = "vertex-limit";
          throw new Error(
            "Selected draw exceeds the remaining vertex-reference budget.",
          );
        }
        range = {
          unit: prepared.indexed ? "index" : "vertex",
          start: prepared.start,
          count: prepared.count,
        };
        if (prepared.matrix.some(subnormal))
          throw new Error(
            "Subnormal model coefficients are unsupported for Float32 sensitivity analysis.",
          );
        for (
          let at = prepared.start;
          at < prepared.start + prepared.count;
          at++
        ) {
          const vertex = prepared.read(at);
          const projected = projectInspectionVertex(vertex, vp, target);
          const witness: ProjectedBoundsWitness = {
            ...identity,
            offset: at,
            vertexIndex: vertex.vertexIndex,
            local: vertex.local,
            world: vertex.world,
            ndc: projected.ndc,
            pixel: projected.pixel,
          };
          bounds = include(bounds, witness);
          maxPixelUncertainty = Math.max(
            maxPixelUncertainty ?? 0,
            projected.maxPixelUncertainty,
          );
          projectedReferences++;
          if (projected.outsideViewport) outsideViewportReferences++;
          if (projected.beyondFar) beyondFarReferences++;
        }
        counts.inspectedDraws++;
      } catch (error: unknown) {
        drawDiagnostics.push({
          code: failureCode,
          renderId: draw.renderId,
          message: message(error),
        });
        bounds = null;
      }
      counts.attemptedReferences = limits.maxVertices - budget.remaining;
      counts.projectedReferences += projectedReferences;
      const coverage = drawDiagnostics.length
        ? "partial"
        : projectedReferences
          ? "complete"
          : "empty";
      draws.push({
        ...identity,
        materialSlot: draw.materialSlot,
        coverage,
        range,
        projectedReferences,
        outsideViewportReferences,
        beyondFarReferences,
        maxPixelUncertainty,
        bounds,
        diagnostics: drawDiagnostics,
      });
      diagnostics.push(...drawDiagnostics);
      if (bounds) aggregate = mergeBounds(aggregate, bounds.witnesses);
    }
  return {
    schema: "aperture.projected-bounds.v1",
    frame: snapshot.frame,
    coverage: diagnostics.length ? "partial" : aggregate ? "complete" : "empty",
    scope,
    viewId,
    target,
    limits,
    precisionTolerancePixels: projectedBoundsPrecisionPixels,
    semantics: "unclipped-static-draw-vertex-envelope",
    visibility: "unknown",
    counts,
    bounds: diagnostics.length ? null : aggregate,
    draws,
    diagnostics,
  };
}

function drawIdentity(draw: MeshDrawPacket) {
  return {
    renderId: draw.renderId,
    entity: { ...draw.entity },
    meshId: draw.mesh.id,
    materialId: draw.material.id,
    submesh: draw.submesh,
  };
}
function include(
  bounds: ProjectedVertexBounds | null,
  point: ProjectedBoundsWitness,
): ProjectedVertexBounds {
  return mergeBounds(bounds, {
    minX: point,
    minY: point,
    maxX: point,
    maxY: point,
  });
}
function mergeBounds(
  bounds: ProjectedVertexBounds | null,
  incoming: ProjectedVertexBounds["witnesses"],
): ProjectedVertexBounds {
  // Each axis already retains its first source reference. Replaying all four
  // extrema as points would instead make object iteration order break ties.
  const w = bounds?.witnesses ?? incoming;
  const witnesses = {
    minX: incoming.minX.pixel[0] < w.minX.pixel[0] ? incoming.minX : w.minX,
    minY: incoming.minY.pixel[1] < w.minY.pixel[1] ? incoming.minY : w.minY,
    maxX: incoming.maxX.pixel[0] > w.maxX.pixel[0] ? incoming.maxX : w.maxX,
    maxY: incoming.maxY.pixel[1] > w.maxY.pixel[1] ? incoming.maxY : w.maxY,
  };
  return {
    min: [witnesses.minX.pixel[0], witnesses.minY.pixel[1]],
    max: [witnesses.maxX.pixel[0], witnesses.maxY.pixel[1]],
    witnesses,
  };
}
function projectionMatrix(
  input: ProjectedBoundsInput,
  view: ViewPacket,
): readonly number[] {
  if (
    view.renderTarget !== null ||
    ["viewport", "scissor"].some(
      (field) =>
        view[field as "viewport" | "scissor"].length !== 4 ||
        Array.from(view[field as "viewport" | "scissor"]).some(
          (n, i) => n !== [0, 0, 1, 1][i],
        ),
    )
  )
    throw new Error(
      "Only full viewport/scissor views targeting the recorded main output are supported.",
    );
  for (const offset of [
    view.viewMatrixOffset,
    view.projectionMatrixOffset,
    view.viewProjectionMatrixOffset,
  ]) {
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset + 16 > input.snapshot.viewMatrices.length
    )
      throw new Error("Invalid retained view matrix offset.");
    const matrix = input.snapshot.viewMatrices.slice(offset, offset + 16);
    const inverse = invertMat4(matrix);
    if (
      !matrix.every(Number.isFinite) ||
      matrix.some(subnormal) ||
      inverse === null ||
      !inverse.every(Number.isFinite)
    )
      throw new Error(
        "Retained camera matrices must be finite, invertible and free of subnormal coefficients.",
      );
  }
  return Array.from(
    input.snapshot.viewMatrices.subarray(
      view.viewProjectionMatrixOffset,
      view.viewProjectionMatrixOffset + 16,
    ),
  );
}
function subnormal(n: number): boolean {
  return n !== 0 && Math.abs(n) < 2 ** -126;
}
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
function validLayerMask(n: number): boolean {
  return Number.isSafeInteger(n) && n >= -0x80000000 && n <= 0xffffffff;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function onlyKeys(
  value: object,
  allowed: readonly string[],
  name: string,
): void {
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      throw new TypeError(`Unknown ${name} field '${key}'.`);
}
function options(input: ProjectedBoundsOptions) {
  onlyKeys(
    input,
    [
      "scope",
      "viewId",
      "target",
      "limits",
      "snapshot",
      "resolveMesh",
      "resolveMaterial",
    ],
    "inspection",
  );
  const scope = input.scope;
  if (!record(scope))
    throw new TypeError("An explicit inspection scope is required.");
  onlyKeys(scope, ["all", "meshIds", "entities"], "scope");
  if (scope.all !== undefined && typeof scope.all !== "boolean")
    throw new TypeError("scope.all must be boolean.");
  if (
    scope.meshIds !== undefined &&
    (!Array.isArray(scope.meshIds) ||
      scope.meshIds.some((id) => typeof id !== "string" || !id))
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
  if (!Number.isSafeInteger(input.viewId))
    throw new TypeError(
      "An explicit safe integer retained viewId is required.",
    );
  if (!record(input.target))
    throw new TypeError("Recorded target width/height are required.");
  onlyKeys(input.target, ["width", "height"], "target");
  if (
    ![input.target.width, input.target.height].every(
      (n) => Number.isSafeInteger(n) && n > 0 && n <= 1_000_000,
    )
  )
    throw new TypeError(
      "Target dimensions must be integers from 1 to 1000000.",
    );
  const limits = { maxDraws: 64, maxVertices: 150_000 };
  if (input.limits !== undefined) {
    if (!record(input.limits)) throw new TypeError("limits must be an object.");
    onlyKeys(input.limits, Object.keys(limits), "limits");
    for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
      const n = input.limits[key];
      if (n !== undefined) {
        if (!Number.isSafeInteger(n) || n < 1)
          throw new TypeError(
            `Limit '${key}' must be a positive safe integer.`,
          );
        limits[key] = n;
      }
    }
  }
  const copy: ProjectedBoundsScope = {
    ...(scope.all === true ? { all: true } : {}),
    ...(scope.meshIds ? { meshIds: [...scope.meshIds] } : {}),
    ...(scope.entities
      ? {
          entities: scope.entities.map((e) => ({
            index: e.index,
            generation: e.generation,
          })),
        }
      : {}),
  };
  return {
    scope: copy,
    target: { ...input.target },
    limits,
    viewId: input.viewId,
  };
}
