import type { EcsWorld } from "@aperture-engine/simulation";
import { compareEntitySummaries, entityRefKey } from "./summary.js";
import { findApertureEntities, getApertureEntitySummary } from "./query.js";
import type {
  ApertureEntityLookupDiagnostic,
  ApertureEntityLookupSnapshot,
  ApertureEntityLookupSnapshotOptions,
  ApertureEntitySnapshotChange,
  ApertureEntitySnapshotDiff,
  ApertureEntitySummary,
} from "./types.js";

export function createApertureEntityLookupSnapshot(
  world: EcsWorld,
  options: ApertureEntityLookupSnapshotOptions = {},
): ApertureEntityLookupSnapshot {
  if (options.entities !== undefined) {
    return createApertureEntityReferenceSnapshot(world, options);
  }

  const report = findApertureEntities(world, {
    ...options,
    limit: options.limit ?? 50,
  });

  return {
    ...(options.label === undefined ? {} : { label: options.label }),
    summaries: report.summaries,
    total: report.total,
    truncated: report.truncated,
    diagnostics: report.diagnostics,
  };
}

export function diffApertureEntityLookupSnapshots(
  previous: ApertureEntityLookupSnapshot,
  next: ApertureEntityLookupSnapshot,
): ApertureEntitySnapshotDiff {
  const previousByRef = new Map(
    previous.summaries.map((summary) => [
      entityRefKey(summary.entity),
      summary,
    ]),
  );
  const nextByRef = new Map(
    next.summaries.map((summary) => [entityRefKey(summary.entity), summary]),
  );
  const added: ApertureEntitySummary[] = [];
  const removed: ApertureEntitySummary[] = [];
  const changed: ApertureEntitySnapshotChange[] = [];
  const unchanged: ApertureEntitySummary[] = [];

  for (const summary of next.summaries) {
    const before = previousByRef.get(entityRefKey(summary.entity));

    if (before === undefined) {
      added.push(summary);
      continue;
    }

    const fields = changedSummaryFields(before, summary);

    if (fields.length === 0) {
      unchanged.push(summary);
      continue;
    }

    changed.push({
      entity: summary.entity,
      fields,
      before,
      after: summary,
    });
  }

  for (const summary of previous.summaries) {
    if (!nextByRef.has(entityRefKey(summary.entity))) {
      removed.push(summary);
    }
  }

  return {
    ...(previous.label === undefined ? {} : { fromLabel: previous.label }),
    ...(next.label === undefined ? {} : { toLabel: next.label }),
    counts: {
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged: unchanged.length,
    },
    added,
    removed,
    changed,
    unchanged,
    diagnostics: [...previous.diagnostics, ...next.diagnostics],
  };
}

function createApertureEntityReferenceSnapshot(
  world: EcsWorld,
  options: ApertureEntityLookupSnapshotOptions,
): ApertureEntityLookupSnapshot {
  const summaries: ApertureEntitySummary[] = [];
  const diagnostics: ApertureEntityLookupDiagnostic[] = [];

  for (const ref of options.entities ?? []) {
    const report = getApertureEntitySummary(world, ref);

    if (report.ok) {
      summaries.push(report.summary);
    } else {
      diagnostics.push(report.diagnostic);
    }
  }

  summaries.sort(compareEntitySummaries);

  return {
    ...(options.label === undefined ? {} : { label: options.label }),
    summaries,
    total: options.entities?.length ?? 0,
    truncated: false,
    diagnostics,
  };
}

function changedSummaryFields(
  before: ApertureEntitySummary,
  after: ApertureEntitySummary,
): readonly string[] {
  const fields: string[] = [];

  for (const field of [
    "key",
    "name",
    "componentIds",
    "tags",
    "source",
    "parent",
    "localTransform",
    "worldTransform",
  ] as const) {
    if (stableJson(before[field]) !== stableJson(after[field])) {
      fields.push(field);
    }
  }

  return fields;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}
