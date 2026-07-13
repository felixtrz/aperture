import {
  invertMat4,
  WorldTransform,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import { Lod, validateLodLevels } from "./index.js";
import type { LodSnapshotReport, RenderDiagnostic } from "./snapshot.js";
import type { ViewCullContext } from "./extraction-culling.js";
import { diagnostic } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";
import { readWorldMatrix } from "./extraction-matrices.js";
import {
  clampLevel,
  lodDistance,
  selectLodLevel,
  type LodResolvedLevel,
} from "./lod-selection.js";

export interface ExtractLodResult {
  /**
   * Per-frame LOD selection tally (E2). Present only when at least one valid
   * `Lod` entity selected a level, so a frame with no LOD entities omits it and
   * stays byte-identical to a pre-E2 snapshot/report.
   */
  readonly report?: LodSnapshotReport;
}

/**
 * The mesh handle id a LOD entity draws THIS frame: the mesh of its
 * currently-selected level. Returns null when the entity carries no (valid)
 * `Lod`, so mesh extraction falls back to the entity's base `Mesh` handle and a
 * non-LOD entity is byte-identical to today. Reads the deterministic
 * `currentLevel` state written by {@link extractLodSelection}, so the mesh draw
 * and its cache asset-signature agree on the selected level.
 */
export function resolveLodMeshId(entity: Entity): string | null {
  if (!entity.hasComponent(Lod)) {
    return null;
  }

  const levels = entity.getValue(Lod, "levels");
  const hysteresis = entity.getValue(Lod, "hysteresis") ?? 0;

  // A malformed LOD (empty/out-of-order/missing-mesh/negative-hysteresis) is
  // skipped by extractLodSelection with a diagnostic; keep the override
  // consistent so the entity draws its base `Mesh` handle exactly as if it had
  // no Lod, rather than silently drawing a level of an invalid ladder.
  if (validateLodLevels(levels, hysteresis).length > 0) {
    return null;
  }

  const resolved = levels as readonly LodResolvedLevel[];
  const level = clampLevel(
    entity.getValue(Lod, "currentLevel") ?? 0,
    resolved.length,
  );
  const meshId = resolved[level]?.meshId;

  return typeof meshId === "string" && meshId.length > 0 ? meshId : null;
}

/**
 * Deterministic mesh-LOD level selection (E2), run once per frame in extraction
 * against the PRIMARY camera (three.js `LOD.update(camera)` is per-camera; the
 * primary view is the lowest-priority/lowest-id view — a single-primary-camera
 * model, documented in the parity plan). For each `Lod` entity it computes the
 * camera→object world distance, applies the hysteresis band around the level's
 * stored `currentLevel`, and writes the new level back to the component (only on
 * a change, so idle frames neither churn the version nor perturb the cache).
 * The selected level then drives the drawn mesh handle via
 * {@link resolveLodMeshId} in mesh extraction.
 */
export function extractLodSelection(
  world: EcsWorld,
  viewCullContexts: readonly ViewCullContext[],
  diagnostics: RenderDiagnostic[],
): ExtractLodResult {
  const query = world.queryManager.registerQuery({ required: [Lod] });
  const entities = [...sortedEntities(query.entities)];

  if (entities.length === 0) {
    return {};
  }

  const cameraPosition = primaryCameraPosition(viewCullContexts);
  const perLevel: number[] = [];
  let maxLevelCount = 0;
  let selectedCount = 0;

  for (const entity of entities) {
    const levels = entity.getValue(Lod, "levels");
    const hysteresis = entity.getValue(Lod, "hysteresis") ?? 0;
    const levelDiagnostics = validateLodLevels(levels, hysteresis);

    if (levelDiagnostics.length > 0) {
      for (const levelDiagnostic of levelDiagnostics) {
        diagnostics.push(diagnostic(`render.${levelDiagnostic.code}`, entity));
      }
      continue;
    }

    if (!entity.hasComponent(WorldTransform)) {
      diagnostics.push(diagnostic("render.missingWorldTransform", entity));
      continue;
    }

    const resolvedLevels = levels as readonly LodResolvedLevel[];
    const thresholds = resolvedLevels.map((level) => level.distance);
    const currentLevel = entity.getValue(Lod, "currentLevel") ?? 0;
    const previousLevel = clampLevel(currentLevel, resolvedLevels.length);
    const nextLevel =
      cameraPosition === null
        ? previousLevel
        : selectLodLevel(
            lodDistance(cameraPosition, worldPosition(entity)),
            thresholds,
            previousLevel,
            hysteresis,
          );

    if (nextLevel !== currentLevel) {
      // Deterministic cross-frame hysteresis state lives on the ECS component,
      // NOT in renderer-side memory, so it survives record/replay. setValue
      // bumps the entity version, which invalidates this entity's mesh-draw
      // cache so the newly selected level mesh is re-resolved next.
      entity.setValue(Lod, "currentLevel", nextLevel);
    }

    perLevel[nextLevel] = (perLevel[nextLevel] ?? 0) + 1;
    maxLevelCount = Math.max(maxLevelCount, resolvedLevels.length);
    selectedCount += 1;
  }

  if (selectedCount === 0) {
    return {};
  }

  const levels: number[] = [];

  for (let index = 0; index < maxLevelCount; index += 1) {
    levels.push(perLevel[index] ?? 0);
  }

  return { report: { entities: selectedCount, levels } };
}

function worldPosition(entity: Entity): [number, number, number] {
  const matrix = readWorldMatrix(entity);

  return [matrix[12] ?? 0, matrix[13] ?? 0, matrix[14] ?? 0];
}

/**
 * World position of the primary camera (the first view after the
 * priority/view-id sort), recovered by inverting its view matrix. Null when
 * there is no view or the matrix is singular, so LOD selection is skipped and
 * every entity keeps its current level.
 */
function primaryCameraPosition(
  viewCullContexts: readonly ViewCullContext[],
): [number, number, number] | null {
  const primary = viewCullContexts[0];

  if (primary === undefined) {
    return null;
  }

  const worldMatrix = invertMat4(primary.viewMatrix);

  if (worldMatrix === null) {
    return null;
  }

  return [worldMatrix[12] ?? 0, worldMatrix[13] ?? 0, worldMatrix[14] ?? 0];
}
