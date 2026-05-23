import { assetHandleKey } from "@aperture-engine/simulation";
import type { MaterialKind } from "../materials/index.js";
import type { MeshTopology } from "../mesh/index.js";
import type {
  MeshDrawPacket,
  RenderDiagnostic,
  RenderEntityRef,
  RenderQueue,
  RenderSnapshot,
} from "./snapshot.js";

export type MaterialQueueFamily = MaterialKind | (string & {});

export interface MaterialQueueResolverInput {
  readonly draw: MeshDrawPacket;
  readonly drawIndex: number;
  readonly meshKey: string;
  readonly materialKey: string;
  readonly materialFamily: MaterialQueueFamily;
}

export interface MaterialQueueResourceKeyResolvers {
  readonly meshResourceKey: (
    input: MaterialQueueResolverInput,
  ) => string | null;
  readonly materialResourceKey: (
    input: MaterialQueueResolverInput,
  ) => string | null;
}

export interface MaterialQueueItemSortKey {
  readonly renderPhase: RenderQueue;
  readonly viewId: number;
  readonly layer: number;
  readonly order: number;
  readonly pipelineKey: string;
  readonly materialResourceKey: string;
  readonly meshResourceKey: string;
  readonly depth: number;
  readonly stableId: number;
  readonly drawIndex: number;
}

export interface MaterialQueueItem {
  readonly renderId: number;
  readonly drawIndex: number;
  readonly entity: RenderEntityRef;
  readonly renderPhase: RenderQueue;
  readonly materialFamily: MaterialQueueFamily;
  readonly pipelineKey: string;
  readonly meshKey: string;
  readonly materialKey: string;
  readonly meshResourceKey: string;
  readonly materialResourceKey: string;
  readonly meshLayoutKey: string;
  readonly topology: MeshTopology;
  readonly depth: number;
  readonly sortKey: MaterialQueueItemSortKey;
}

export interface MaterialQueuePlan {
  readonly items: readonly MaterialQueueItem[];
  readonly diagnostics: readonly RenderDiagnostic[];
}

export interface MaterialQueuePhaseBucketSummary {
  readonly phase: RenderQueue;
  readonly itemCount: number;
}

export interface MaterialQueueFamilyBucketSummary {
  readonly family: MaterialQueueFamily;
  readonly itemCount: number;
}

export interface MaterialQueuePhaseFamilyBucketSummary {
  readonly phase: RenderQueue;
  readonly family: MaterialQueueFamily;
  readonly itemCount: number;
}

export interface MaterialQueuePhaseSummary {
  readonly itemCount: number;
  readonly byPhase: readonly MaterialQueuePhaseBucketSummary[];
  readonly byFamily: readonly MaterialQueueFamilyBucketSummary[];
  readonly byPhaseAndFamily: readonly MaterialQueuePhaseFamilyBucketSummary[];
}

export interface MaterialQueueScratch {
  readonly items: MaterialQueueItem[];
  readonly diagnostics: RenderDiagnostic[];
  readonly itemPool: MaterialQueueItem[];
  readonly plan: MaterialQueuePlan;
}

interface MutableMaterialQueueItem {
  renderId: number;
  drawIndex: number;
  entity: RenderEntityRef;
  renderPhase: RenderQueue;
  materialFamily: MaterialQueueFamily;
  pipelineKey: string;
  meshKey: string;
  materialKey: string;
  meshResourceKey: string;
  materialResourceKey: string;
  meshLayoutKey: string;
  topology: MeshTopology;
  depth: number;
  sortKey: MaterialQueueItemSortKey;
}

interface MutableMaterialQueueItemSortKey {
  renderPhase: RenderQueue;
  viewId: number;
  layer: number;
  order: number;
  pipelineKey: string;
  materialResourceKey: string;
  meshResourceKey: string;
  depth: number;
  stableId: number;
  drawIndex: number;
}

export function buildMaterialQueueFromSnapshot(
  snapshot: Pick<RenderSnapshot, "meshDraws" | "diagnostics">,
  resolvers: MaterialQueueResourceKeyResolvers,
): MaterialQueuePlan {
  const scratch = createMaterialQueueScratch();

  writeMaterialQueueFromSnapshot(snapshot, resolvers, scratch);

  return scratch.plan;
}

export function createMaterialQueueScratch(capacity = 0): MaterialQueueScratch {
  const itemPool: MaterialQueueItem[] = [];
  const items: MaterialQueueItem[] = [];
  const diagnostics: RenderDiagnostic[] = [];

  for (let i = 0; i < capacity; i += 1) {
    itemPool.push(createEmptyItem());
  }

  return {
    items,
    diagnostics,
    itemPool,
    plan: { items, diagnostics },
  };
}

export function writeMaterialQueueFromSnapshot(
  snapshot: Pick<RenderSnapshot, "meshDraws" | "diagnostics">,
  resolvers: MaterialQueueResourceKeyResolvers,
  scratch: MaterialQueueScratch,
): MaterialQueuePlan {
  scratch.items.length = 0;
  scratch.diagnostics.length = 0;

  for (const diagnostic of snapshot.diagnostics) {
    scratch.diagnostics.push(diagnostic);
  }

  for (
    let drawIndex = 0;
    drawIndex < snapshot.meshDraws.length;
    drawIndex += 1
  ) {
    const draw = snapshot.meshDraws[drawIndex];

    if (draw === undefined) {
      continue;
    }

    const materialFamily = materialQueueFamilyFromPipelineKey(
      draw.batchKey.pipelineKey,
    );

    if (materialFamily === null) {
      scratch.diagnostics.push({
        code: "materialQueue.unknownMaterialFamily",
        message: `Render object ${draw.renderId} uses unsupported material family in pipeline key '${draw.batchKey.pipelineKey}'.`,
        severity: "warning",
        entity: draw.entity,
      });
      continue;
    }

    const meshKey = assetHandleKey(draw.mesh);
    const materialKey = assetHandleKey(draw.material);
    const resolverInput: MaterialQueueResolverInput = {
      draw,
      drawIndex,
      meshKey,
      materialKey,
      materialFamily,
    };
    const meshResourceKey = resolvers.meshResourceKey(resolverInput);
    const materialResourceKey = resolvers.materialResourceKey(resolverInput);

    if (meshResourceKey === null || materialResourceKey === null) {
      scratch.diagnostics.push({
        code: "materialQueue.missingPreparedResource",
        message: missingPreparedResourceMessage({
          draw,
          meshKey,
          materialKey,
          meshResourceKey,
          materialResourceKey,
        }),
        severity: "warning",
        entity: draw.entity,
        assetKey: materialResourceKey === null ? materialKey : meshKey,
      });
      continue;
    }

    const item = itemAt(scratch, scratch.items.length);
    const sortKey = item.sortKey as MutableMaterialQueueItemSortKey;

    sortKey.renderPhase = draw.sortKey.queue;
    sortKey.viewId = draw.sortKey.viewId;
    sortKey.layer = draw.sortKey.layer;
    sortKey.order = draw.sortKey.order;
    sortKey.pipelineKey = draw.batchKey.pipelineKey;
    sortKey.materialResourceKey = materialResourceKey;
    sortKey.meshResourceKey = meshResourceKey;
    sortKey.depth = draw.sortKey.depth;
    sortKey.stableId = draw.sortKey.stableId;
    sortKey.drawIndex = drawIndex;

    item.renderId = draw.renderId;
    item.drawIndex = drawIndex;
    item.entity = draw.entity;
    item.renderPhase = draw.sortKey.queue;
    item.materialFamily = materialFamily;
    item.pipelineKey = draw.batchKey.pipelineKey;
    item.meshKey = meshKey;
    item.materialKey = materialKey;
    item.meshResourceKey = meshResourceKey;
    item.materialResourceKey = materialResourceKey;
    item.meshLayoutKey = draw.batchKey.meshLayoutKey;
    item.topology = draw.batchKey.topology;
    item.depth = draw.sortKey.depth;
    scratch.items.push(item);
  }

  sortMaterialQueueItems(scratch.items);

  return scratch.plan;
}

export function sortMaterialQueueItems(
  items: MaterialQueueItem[],
): MaterialQueueItem[] {
  items.sort(compareMaterialQueueItems);
  return items;
}

export function createMaterialQueuePhaseSummary(
  items: readonly MaterialQueueItem[],
): MaterialQueuePhaseSummary {
  const phaseCounts = new Map<RenderQueue, number>();
  const familyCounts = new Map<MaterialQueueFamily, number>();
  const phaseFamilyCounts = new Map<
    string,
    { phase: RenderQueue; family: MaterialQueueFamily; itemCount: number }
  >();

  for (const item of items) {
    phaseCounts.set(
      item.renderPhase,
      (phaseCounts.get(item.renderPhase) ?? 0) + 1,
    );
    familyCounts.set(
      item.materialFamily,
      (familyCounts.get(item.materialFamily) ?? 0) + 1,
    );

    const phaseFamilyKey = `${item.renderPhase}|${item.materialFamily}`;
    const phaseFamilyCount = phaseFamilyCounts.get(phaseFamilyKey);

    if (phaseFamilyCount === undefined) {
      phaseFamilyCounts.set(phaseFamilyKey, {
        phase: item.renderPhase,
        family: item.materialFamily,
        itemCount: 1,
      });
    } else {
      phaseFamilyCount.itemCount += 1;
    }
  }

  return {
    itemCount: items.length,
    byPhase: MATERIAL_QUEUE_PHASE_ORDER.flatMap((phase) => {
      const itemCount = phaseCounts.get(phase);

      return itemCount === undefined ? [] : [{ phase, itemCount }];
    }),
    byFamily: [...familyCounts.entries()]
      .sort(([a], [b]) => compareStrings(a, b))
      .map(([family, itemCount]) => ({ family, itemCount })),
    byPhaseAndFamily: [...phaseFamilyCounts.values()]
      .sort(
        (a, b) =>
          materialQueuePhaseRank(a.phase) - materialQueuePhaseRank(b.phase) ||
          compareStrings(a.family, b.family),
      )
      .map(({ phase, family, itemCount }) => ({ phase, family, itemCount })),
  };
}

export function materialQueueFamilyFromPipelineKey(
  pipelineKey: string,
): MaterialQueueFamily | null {
  const family = pipelineKey.split("|", 1)[0] ?? "";

  return isMaterialQueueFamilyKey(family) ? family : null;
}

function isMaterialQueueFamilyKey(
  family: string,
): family is MaterialQueueFamily {
  return /^[a-z][a-z0-9-]*$/.test(family);
}

function compareMaterialQueueItems(
  a: MaterialQueueItem,
  b: MaterialQueueItem,
): number {
  const phaseRankDelta =
    materialQueuePhaseRank(a.renderPhase) -
    materialQueuePhaseRank(b.renderPhase);

  if (phaseRankDelta !== 0) {
    return phaseRankDelta;
  }

  if (a.renderPhase === "transparent" || b.renderPhase === "transparent") {
    return (
      a.sortKey.viewId - b.sortKey.viewId ||
      a.sortKey.layer - b.sortKey.layer ||
      a.sortKey.order - b.sortKey.order ||
      b.depth - a.depth ||
      a.sortKey.stableId - b.sortKey.stableId ||
      a.drawIndex - b.drawIndex
    );
  }

  return (
    a.sortKey.viewId - b.sortKey.viewId ||
    a.sortKey.layer - b.sortKey.layer ||
    a.sortKey.order - b.sortKey.order ||
    compareStrings(a.pipelineKey, b.pipelineKey) ||
    compareStrings(a.materialResourceKey, b.materialResourceKey) ||
    compareStrings(a.meshLayoutKey, b.meshLayoutKey) ||
    compareStrings(a.meshResourceKey, b.meshResourceKey) ||
    a.depth - b.depth ||
    a.sortKey.stableId - b.sortKey.stableId ||
    a.drawIndex - b.drawIndex
  );
}

function materialQueuePhaseRank(phase: RenderQueue): number {
  switch (phase) {
    case "opaque":
      return 0;
    case "alpha-test":
      return 1;
    case "transparent":
      return 2;
  }
}

const MATERIAL_QUEUE_PHASE_ORDER: readonly RenderQueue[] = [
  "opaque",
  "alpha-test",
  "transparent",
];

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function missingPreparedResourceMessage(input: {
  readonly draw: MeshDrawPacket;
  readonly meshKey: string;
  readonly materialKey: string;
  readonly meshResourceKey: string | null;
  readonly materialResourceKey: string | null;
}): string {
  const missing: string[] = [];

  if (input.meshResourceKey === null) {
    missing.push(`mesh resource for '${input.meshKey}'`);
  }

  if (input.materialResourceKey === null) {
    missing.push(`material resource for '${input.materialKey}'`);
  }

  return `Render object ${input.draw.renderId} is missing prepared ${missing.join(
    " and ",
  )}.`;
}

function itemAt(
  scratch: MaterialQueueScratch,
  index: number,
): MutableMaterialQueueItem {
  const existing = scratch.itemPool[index] as
    | MutableMaterialQueueItem
    | undefined;

  if (existing !== undefined) {
    return existing;
  }

  const item = createEmptyItem();

  scratch.itemPool.push(item);
  return item;
}

function createEmptyItem(): MutableMaterialQueueItem {
  return {
    renderId: 0,
    drawIndex: 0,
    entity: { index: 0, generation: 0 },
    renderPhase: "opaque",
    materialFamily: "unlit",
    pipelineKey: "",
    meshKey: "",
    materialKey: "",
    meshResourceKey: "",
    materialResourceKey: "",
    meshLayoutKey: "",
    topology: "triangle-list",
    depth: 0,
    sortKey: {
      renderPhase: "opaque",
      viewId: 0,
      layer: 0,
      order: 0,
      pipelineKey: "",
      materialResourceKey: "",
      meshResourceKey: "",
      depth: 0,
      stableId: 0,
      drawIndex: 0,
    },
  };
}
