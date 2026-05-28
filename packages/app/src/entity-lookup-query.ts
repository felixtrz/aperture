import type { EcsWorld } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "./config.js";
import {
  collectActiveEntities,
  compareEntitySummaries,
  entitySummary,
  validEntityRef,
} from "./entity-lookup-summary.js";
import type {
  ApertureEntityFindQuery,
  ApertureEntityFindReport,
  ApertureEntityGetReport,
  ApertureEntityLookupDiagnostic,
  ApertureEntityLookupSourceFilter,
  ApertureEntitySummary,
} from "./entity-lookup-types.js";

export function findApertureEntities(
  world: EcsWorld,
  query: ApertureEntityFindQuery = {},
): ApertureEntityFindReport {
  const diagnostics: ApertureEntityLookupDiagnostic[] = [];
  const nameRegex = compileNamePattern(query.namePattern, diagnostics);

  if (nameRegex === null) {
    return {
      summaries: [],
      total: 0,
      truncated: false,
      diagnostics,
    };
  }

  const matches = collectActiveEntities(world)
    .map(entitySummary)
    .filter((summary) => matchesEntityQuery(summary, query, nameRegex))
    .sort(compareEntitySummaries);
  const limit = normalizeLimit(query.limit);
  const summaries = matches.slice(0, limit);

  if (query.key !== undefined && matches.length > 1) {
    diagnostics.push({
      code: "aperture.entityLookup.duplicateKey",
      severity: "warning",
      message: `Entity key '${query.key}' matched ${matches.length} active entities.`,
      data: { key: query.key, matches: matches.length },
      suggestedFix:
        "Keep app-authored keys globally unique, or use the returned { index, generation } pair for follow-up calls.",
    });
  }

  return {
    summaries,
    total: matches.length,
    truncated: summaries.length < matches.length,
    diagnostics,
  };
}

export function getApertureEntitySummary(
  world: EcsWorld,
  ref: EcsEntityRef,
): ApertureEntityGetReport {
  if (!validEntityRef(ref)) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.entityLookup.invalidRef",
        severity: "error",
        message:
          "Entity lookup requires a finite integer { index, generation } reference.",
        data: { entity: ref },
        suggestedFix:
          "Re-run aperture_entity_find and pass the full returned { index, generation } pair.",
      },
    };
  }

  const entity = world.entityManager.getEntityByIndex(ref.index);

  if (entity === null || !entity.active) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.entityLookup.notFound",
        severity: "error",
        message: `No active entity exists at index ${ref.index}.`,
        data: { entity: ref },
        suggestedFix:
          "The entity may have been destroyed. Re-run aperture_entity_find before issuing a follow-up operation.",
      },
    };
  }

  if (entity.generation !== ref.generation) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.entityLookup.generationMismatch",
        severity: "error",
        message: `Entity index ${ref.index} is active with generation ${entity.generation}, not requested generation ${ref.generation}.`,
        data: {
          requested: ref,
          active: { index: entity.index, generation: entity.generation },
        },
        suggestedFix:
          "Re-run aperture_entity_find and use the current { index, generation } pair before mutating ECS state.",
      },
    };
  }

  return {
    ok: true,
    summary: entitySummary(entity),
  };
}

function matchesEntityQuery(
  summary: ApertureEntitySummary,
  query: ApertureEntityFindQuery,
  nameRegex: RegExp | undefined,
): boolean {
  if (query.key !== undefined && summary.key !== query.key) {
    return false;
  }

  if (nameRegex !== undefined && !nameRegex.test(summary.name)) {
    return false;
  }

  if (
    query.withComponents !== undefined &&
    !query.withComponents.every((componentId) =>
      summary.componentIds.includes(componentId),
    )
  ) {
    return false;
  }

  if (
    query.tags !== undefined &&
    !query.tags.every((tag) => summary.tags?.includes(tag) === true)
  ) {
    return false;
  }

  if (query.source !== undefined && !matchesSource(summary, query.source)) {
    return false;
  }

  return true;
}

function matchesSource(
  summary: ApertureEntitySummary,
  source: ApertureEntityLookupSourceFilter,
): boolean {
  const candidate = summary.source;

  if (candidate === undefined) {
    return false;
  }

  if (source.assetId !== undefined && candidate.assetId !== source.assetId) {
    return false;
  }

  if (
    source.gltfNodeIndex !== undefined &&
    candidate.gltfNodeIndex !== source.gltfNodeIndex
  ) {
    return false;
  }

  if (
    source.gltfNodePath !== undefined &&
    candidate.gltfNodePath !== source.gltfNodePath
  ) {
    return false;
  }

  return true;
}

function compileNamePattern(
  pattern: string | undefined,
  diagnostics: ApertureEntityLookupDiagnostic[],
): RegExp | undefined | null {
  if (pattern === undefined) {
    return undefined;
  }

  try {
    return new RegExp(pattern, "u");
  } catch (error: unknown) {
    diagnostics.push({
      code: "aperture.entityLookup.invalidNamePattern",
      severity: "error",
      message: `Entity namePattern '${pattern}' is not a valid regular expression.`,
      data: {
        namePattern: pattern,
        reason: error instanceof Error ? error.message : String(error),
      },
      suggestedFix:
        "Pass a valid JavaScript regular expression string, or search by exact key.",
    });
    return null;
  }
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    return 0;
  }

  return Math.floor(limit);
}
