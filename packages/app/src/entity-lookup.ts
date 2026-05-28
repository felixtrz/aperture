import type { EcsWorld, Entity } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "./config.js";
import type {
  ApertureEntityFindQuery,
  ApertureEntityFindReport,
  ApertureEntityGetReport,
  ApertureEntityHierarchyNode,
  ApertureEntityHierarchyReport,
  ApertureEntityLookup,
  ApertureEntityLookupDiagnostic,
  ApertureEntityLookupSnapshot,
  ApertureEntityLookupSnapshotOptions,
  ApertureEntityLookupSourceFilter,
  ApertureEntitySetComponentFieldReport,
  ApertureEntitySetComponentFieldRequest,
  ApertureEntitySnapshotChange,
  ApertureEntitySnapshotDiff,
  ApertureEntitySourceSummary,
  ApertureEntitySummary,
  ApertureLocalTransformSummary,
  ApertureWorldTransformSummary,
} from "./entity-lookup-types.js";
import {
  AppEntityKey,
  AppEntitySource,
  AppEntityTags,
  DebugMetadata,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
} from "./systems.js";

interface MutableHierarchyNode {
  readonly entity: EcsEntityRef;
  readonly key?: string;
  readonly name: string;
  readonly parent?: EcsEntityRef;
  readonly children: MutableHierarchyNode[];
}

export type {
  ApertureEntityFindQuery,
  ApertureEntityFindReport,
  ApertureEntityGetReport,
  ApertureEntityHierarchyNode,
  ApertureEntityHierarchyReport,
  ApertureEntityLookup,
  ApertureEntityLookupDiagnostic,
  ApertureEntityLookupSnapshot,
  ApertureEntityLookupSnapshotOptions,
  ApertureEntityLookupSourceFilter,
  ApertureEntitySetComponentFieldReport,
  ApertureEntitySetComponentFieldRequest,
  ApertureEntitySnapshotChange,
  ApertureEntitySnapshotDiff,
  ApertureEntitySnapshotDiffCounts,
  ApertureEntitySourceSummary,
  ApertureEntitySummary,
  ApertureLocalTransformSummary,
  ApertureWorldTransformSummary,
} from "./entity-lookup-types.js";

export function createApertureEntityLookup(
  world: EcsWorld,
): ApertureEntityLookup {
  return {
    find(query = {}) {
      return findApertureEntities(world, query);
    },
    get(entity) {
      return getApertureEntitySummary(world, entity);
    },
    snapshot(options = {}) {
      return createApertureEntityLookupSnapshot(world, options);
    },
    diff(previous, next) {
      return diffApertureEntityLookupSnapshots(previous, next);
    },
    setComponentField(request) {
      return setApertureEntityComponentField(world, request);
    },
    hierarchy() {
      return createApertureEntityHierarchy(world);
    },
  };
}

export function createApertureEntityHierarchy(
  world: EcsWorld,
): ApertureEntityHierarchyReport {
  const summaries = collectActiveEntities(world)
    .map(entitySummary)
    .sort(compareEntitySummaries);
  const nodes = new Map<string, MutableHierarchyNode>();
  const diagnostics: ApertureEntityLookupDiagnostic[] = [];

  for (const summary of summaries) {
    nodes.set(entityRefKey(summary.entity), {
      entity: summary.entity,
      ...(summary.key === undefined ? {} : { key: summary.key }),
      name: summary.name,
      ...(summary.parent === undefined ? {} : { parent: summary.parent }),
      children: [],
    });
  }

  const roots: MutableHierarchyNode[] = [];

  for (const node of nodes.values()) {
    if (node.parent === undefined) {
      roots.push(node);
      continue;
    }

    const parent = nodes.get(entityRefKey(node.parent));
    if (parent === undefined) {
      diagnostics.push({
        code: "aperture.entityHierarchy.staleParent",
        severity: "warning",
        message: `Entity ${node.entity.index} references a parent that is not active in the hierarchy snapshot.`,
        data: {
          entity: node.entity,
          parent: node.parent,
        },
        suggestedFix:
          "Resolve transforms and remove stale Parent references from app systems.",
      });
      roots.push(node);
      continue;
    }

    parent.children.push(node);
  }

  return {
    roots: sortHierarchyNodes(roots),
    total: summaries.length,
    diagnostics,
  };
}

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

export function setApertureEntityComponentField(
  world: EcsWorld,
  request: ApertureEntitySetComponentFieldRequest,
): ApertureEntitySetComponentFieldReport {
  const resolved = resolveActiveEntity(world, request.entity);

  if (!resolved.ok) {
    return resolved;
  }

  const mutation = componentFieldMutations[request.component];

  if (mutation === undefined) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.entityLookup.componentMutationUnsupported",
        severity: "error",
        message: `Component '${request.component}' is not mutable through the developer entity helper.`,
        data: { component: request.component, entity: request.entity },
        suggestedFix:
          "Use an explicit app system or add a narrow whitelist entry for this component field before mutating it from tooling.",
      },
    };
  }

  const setField = mutation[request.field];

  if (setField === undefined) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.entityLookup.componentFieldUnsupported",
        severity: "error",
        message: `Field '${request.field}' on component '${request.component}' is not mutable through the developer entity helper.`,
        data: {
          component: request.component,
          field: request.field,
          entity: request.entity,
        },
        suggestedFix:
          "Use one of the whitelisted fields or add a focused mutation helper for this component field.",
      },
    };
  }

  const diagnostic = setField(resolved.entity, request);

  if (diagnostic !== null) {
    return { ok: false, diagnostic };
  }

  return {
    ok: true,
    component: request.component,
    field: request.field,
    value: jsonSafeValue(request.value),
    summary: entitySummary(resolved.entity),
  };
}

type ComponentFieldMutation = (
  entity: Entity,
  request: ApertureEntitySetComponentFieldRequest,
) => ApertureEntityLookupDiagnostic | null;

const componentFieldMutations: Readonly<
  Record<string, Readonly<Record<string, ComponentFieldMutation>>>
> = {
  [DebugMetadata.id]: {
    tag: setDebugMetadataStringField("tag"),
    note: setDebugMetadataStringField("note"),
  },
};

function setDebugMetadataStringField(
  field: "tag" | "note",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(DebugMetadata)) {
      return {
        code: "aperture.entityLookup.componentMissing",
        severity: "error",
        message: `Entity ${entity.index} does not have component '${DebugMetadata.id}'.`,
        data: {
          entity: request.entity,
          component: DebugMetadata.id,
          field,
        },
        suggestedFix:
          "Find an entity with the requested component, or add the component from an app system before mutating its field.",
      };
    }

    if (typeof request.value !== "string") {
      return {
        code: "aperture.entityLookup.invalidComponentFieldValue",
        severity: "error",
        message: `Field '${field}' on component '${DebugMetadata.id}' requires a string value.`,
        data: {
          entity: request.entity,
          component: DebugMetadata.id,
          field,
          valueType: typeof request.value,
        },
        suggestedFix: "Pass a string value for this component field.",
      };
    }

    entity.setValue(DebugMetadata, field, request.value);
    return null;
  };
}

function resolveActiveEntity(
  world: EcsWorld,
  ref: EcsEntityRef,
):
  | { readonly ok: true; readonly entity: Entity }
  | {
      readonly ok: false;
      readonly diagnostic: ApertureEntityLookupDiagnostic;
    } {
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

  return { ok: true, entity };
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

function entityRefKey(ref: EcsEntityRef): string {
  return `${ref.index}:${ref.generation}`;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function jsonSafeValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return String(value);
  }
}

function entitySummary(entity: Entity): ApertureEntitySummary {
  const key = entity.hasComponent(AppEntityKey)
    ? entity.getValue(AppEntityKey, "value")
    : null;
  const name = entity.hasComponent(Name)
    ? entity.getValue(Name, "value")
    : null;
  const tags = entity.hasComponent(AppEntityTags)
    ? parseTags(entity.getValue(AppEntityTags, "valuesJson"))
    : [];
  const source = entity.hasComponent(AppEntitySource)
    ? sourceSummary(entity)
    : null;
  const parent = entity.hasComponent(Parent)
    ? entityRefFromEntity(entity.getValue(Parent, "entity"))
    : null;
  const localTransform = entity.hasComponent(LocalTransform)
    ? localTransformSummary(entity)
    : null;
  const worldTransform = entity.hasComponent(WorldTransform)
    ? worldTransformSummary(entity)
    : null;

  return {
    entity: {
      index: entity.index,
      generation: entity.generation,
    },
    ...(typeof key === "string" && key.length > 0 ? { key } : {}),
    name:
      typeof name === "string" && name.length > 0
        ? name
        : `Entity ${entity.index}`,
    componentIds: entity
      .getComponents()
      .map((component) => component.id)
      .sort((a, b) => a.localeCompare(b)),
    ...(tags.length === 0 ? {} : { tags }),
    ...(source === null ? {} : { source }),
    ...(parent === null ? {} : { parent }),
    ...(localTransform === null ? {} : { localTransform }),
    ...(worldTransform === null ? {} : { worldTransform }),
  };
}

function localTransformSummary(entity: Entity): ApertureLocalTransformSummary {
  return {
    translation: tuple3FromView(
      entity.getVectorView(LocalTransform, "translation"),
    ),
    rotation: tuple4FromView(entity.getVectorView(LocalTransform, "rotation")),
    scale: tuple3FromView(entity.getVectorView(LocalTransform, "scale")),
  };
}

function worldTransformSummary(entity: Entity): ApertureWorldTransformSummary {
  return {
    matrix: [
      ...tuple4FromView(entity.getVectorView(WorldTransform, "col0")),
      ...tuple4FromView(entity.getVectorView(WorldTransform, "col1")),
      ...tuple4FromView(entity.getVectorView(WorldTransform, "col2")),
      ...tuple4FromView(entity.getVectorView(WorldTransform, "col3")),
    ],
  };
}

function entityRefFromEntity(entity: Entity | null): EcsEntityRef | null {
  return entity === null
    ? null
    : { index: entity.index, generation: entity.generation };
}

function tuple3FromView(
  view: ArrayLike<number>,
): readonly [number, number, number] {
  return [view[0] ?? 0, view[1] ?? 0, view[2] ?? 0];
}

function tuple4FromView(
  view: ArrayLike<number>,
): readonly [number, number, number, number] {
  return [view[0] ?? 0, view[1] ?? 0, view[2] ?? 0, view[3] ?? 0];
}

function sourceSummary(entity: Entity): ApertureEntitySourceSummary | null {
  const kind = entity.getValue(AppEntitySource, "kind");
  const assetId = entity.getValue(AppEntitySource, "assetId");
  const gltfNodeIndex = entity.getValue(AppEntitySource, "gltfNodeIndex");
  const gltfNodePath = entity.getValue(AppEntitySource, "gltfNodePath");

  if (kind !== "gltf") {
    return null;
  }

  return {
    ...(typeof assetId === "string" && assetId.length > 0 ? { assetId } : {}),
    ...(typeof gltfNodeIndex === "number" && gltfNodeIndex >= 0
      ? { gltfNodeIndex }
      : {}),
    ...(typeof gltfNodePath === "string" && gltfNodePath.length > 0
      ? { gltfNodePath }
      : {}),
  };
}

function collectActiveEntities(world: EcsWorld): Entity[] {
  const entityManager = world.entityManager as unknown as {
    readonly indexLookup?: readonly (Entity | null | undefined)[];
  };

  if (Array.isArray(entityManager.indexLookup)) {
    return entityManager.indexLookup.filter(
      (entity): entity is Entity => entity !== null && entity?.active === true,
    );
  }

  return [
    ...world.queryManager.registerQuery({ required: [] }).entities,
  ].filter((entity) => entity.active);
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

function parseTags(value: string | null): readonly string[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
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

function validEntityRef(ref: EcsEntityRef): boolean {
  return (
    Number.isInteger(ref.index) &&
    Number.isInteger(ref.generation) &&
    ref.index >= 0 &&
    ref.generation >= 0
  );
}

function compareEntitySummaries(
  a: ApertureEntitySummary,
  b: ApertureEntitySummary,
): number {
  return (
    a.entity.index - b.entity.index || a.entity.generation - b.entity.generation
  );
}

function sortHierarchyNodes(
  nodes: readonly MutableHierarchyNode[],
): readonly ApertureEntityHierarchyNode[] {
  return [...nodes]
    .sort(
      (a, b) =>
        a.entity.index - b.entity.index ||
        a.entity.generation - b.entity.generation,
    )
    .map((node) => ({
      entity: node.entity,
      ...(node.key === undefined ? {} : { key: node.key }),
      name: node.name,
      ...(node.parent === undefined ? {} : { parent: node.parent }),
      children: sortHierarchyNodes(node.children),
    }));
}
