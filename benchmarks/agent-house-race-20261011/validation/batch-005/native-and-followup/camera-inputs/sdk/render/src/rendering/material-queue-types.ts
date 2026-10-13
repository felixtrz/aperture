import type { MaterialKind } from "../materials/index.js";
import type { MeshTopology } from "../mesh/index.js";
import type {
  MeshDrawPacket,
  RenderDiagnostic,
  RenderEntityRef,
  RenderQueue,
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
  readonly submesh?: number;
  readonly materialSlot?: number;
  readonly vertexStart?: number;
  readonly vertexCount?: number;
  readonly indexStart?: number;
  readonly indexCount?: number;
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

export interface MutableMaterialQueueItem {
  renderId: number;
  drawIndex: number;
  entity: RenderEntityRef;
  submesh?: number;
  materialSlot?: number;
  vertexStart?: number;
  vertexCount?: number;
  indexStart?: number;
  indexCount?: number;
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

export interface MutableMaterialQueueItemSortKey {
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
