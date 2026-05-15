export const RENDER_RESOURCE_LIFECYCLE_KINDS = [
  "mesh",
  "material",
  "view",
  "shader",
  "pipeline",
] as const;

export type RenderResourceLifecycleKind =
  (typeof RENDER_RESOURCE_LIFECYCLE_KINDS)[number];

export interface RenderResourceLifecycleKeySets {
  readonly mesh: ReadonlySet<string>;
  readonly material: ReadonlySet<string>;
  readonly view: ReadonlySet<string>;
  readonly shader: ReadonlySet<string>;
  readonly pipeline: ReadonlySet<string>;
}

export interface RenderResourceLifecycleInput {
  readonly previous: RenderResourceLifecycleKeySets;
  readonly next: RenderResourceLifecycleKeySets;
}

export interface RenderResourceLifecycleChangeSet {
  readonly retained: readonly string[];
  readonly created: readonly string[];
  readonly removed: readonly string[];
}

export type RenderResourceLifecycleChangesByKind = {
  readonly [Kind in RenderResourceLifecycleKind]: RenderResourceLifecycleChangeSet;
};

export interface RenderResourceLifecycleCounts {
  readonly retained: number;
  readonly created: number;
  readonly removed: number;
}

export interface RenderResourceLifecycleReport {
  readonly byKind: RenderResourceLifecycleChangesByKind;
  readonly totals: RenderResourceLifecycleCounts;
  readonly hasChanges: boolean;
}

export function createRenderResourceLifecycleReport(
  input: RenderResourceLifecycleInput,
): RenderResourceLifecycleReport {
  const byKind = Object.fromEntries(
    RENDER_RESOURCE_LIFECYCLE_KINDS.map((kind) => [
      kind,
      diffResourceKeys(input.previous[kind], input.next[kind]),
    ]),
  ) as RenderResourceLifecycleChangesByKind;
  const totals = totalLifecycleCounts(byKind);

  return {
    byKind,
    totals,
    hasChanges: totals.created > 0 || totals.removed > 0,
  };
}

function diffResourceKeys(
  previous: ReadonlySet<string>,
  next: ReadonlySet<string>,
): RenderResourceLifecycleChangeSet {
  return {
    retained: sortedKeys(next, (key) => previous.has(key)),
    created: sortedKeys(next, (key) => !previous.has(key)),
    removed: sortedKeys(previous, (key) => !next.has(key)),
  };
}

function sortedKeys(
  keys: ReadonlySet<string>,
  include: (key: string) => boolean,
): readonly string[] {
  return [...keys].filter(include).sort();
}

function totalLifecycleCounts(
  byKind: RenderResourceLifecycleChangesByKind,
): RenderResourceLifecycleCounts {
  return RENDER_RESOURCE_LIFECYCLE_KINDS.reduce<RenderResourceLifecycleCounts>(
    (totals, kind) => ({
      retained: totals.retained + byKind[kind].retained.length,
      created: totals.created + byKind[kind].created.length,
      removed: totals.removed + byKind[kind].removed.length,
    }),
    { retained: 0, created: 0, removed: 0 },
  );
}
