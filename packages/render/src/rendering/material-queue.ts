import { assetHandleKey } from "@aperture-engine/simulation";
import type { MeshDrawPacket, RenderSnapshot } from "./snapshot.js";
import { materialQueueItemAt } from "./material-queue-scratch.js";
import {
  materialQueueFamilyFromPipelineKey,
  sortMaterialQueueItems,
} from "./material-queue-ordering.js";
import type {
  MaterialQueuePlan,
  MaterialQueueResolverInput,
  MaterialQueueResourceKeyResolvers,
  MaterialQueueScratch,
  MutableMaterialQueueItemSortKey,
} from "./material-queue-types.js";

export { createMaterialQueueScratch } from "./material-queue-scratch.js";
export {
  MATERIAL_QUEUE_PHASE_ORDER,
  compareStrings,
  materialQueueFamilyFromPipelineKey,
  materialQueuePhaseRank,
  sortMaterialQueueItems,
} from "./material-queue-ordering.js";
export { createMaterialQueuePhaseSummary } from "./material-queue-summary.js";
export type {
  MaterialQueueFamily,
  MaterialQueueFamilyBucketSummary,
  MaterialQueueItem,
  MaterialQueueItemSortKey,
  MaterialQueuePhaseBucketSummary,
  MaterialQueuePhaseFamilyBucketSummary,
  MaterialQueuePhaseSummary,
  MaterialQueuePlan,
  MaterialQueueResolverInput,
  MaterialQueueResourceKeyResolvers,
  MaterialQueueScratch,
} from "./material-queue-types.js";

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

    const item = materialQueueItemAt(scratch, scratch.items.length);
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
    item.submesh = draw.submesh;
    item.materialSlot = draw.materialSlot;
    assignOptionalNumber(item, "vertexStart", draw.vertexStart);
    assignOptionalNumber(item, "vertexCount", draw.vertexCount);
    assignOptionalNumber(item, "indexStart", draw.indexStart);
    assignOptionalNumber(item, "indexCount", draw.indexCount);
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

function assignOptionalNumber<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: number | undefined,
): void {
  if (value === undefined) {
    delete target[key];
    return;
  }

  target[key] = value as T[K];
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
