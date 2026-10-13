import type { MeshDrawPacket, RenderDiagnostic } from "./snapshot.js";
import type { RenderSnapshotChangeSet } from "./snapshot-change-set.js";

export type RenderWorldObjectStatus = "active";

export interface RenderWorldGpuPlaceholders {
  readonly meshResourceKey: string | null;
  readonly materialResourceKey: string | null;
}

export interface RenderWorldObject {
  readonly renderId: number;
  readonly status: RenderWorldObjectStatus;
  readonly packet: MeshDrawPacket;
  readonly gpu: RenderWorldGpuPlaceholders;
}

export interface RenderWorldResourceBindingUpdate {
  readonly meshResourceKey?: string | null;
  readonly materialResourceKey?: string | null;
}

export type RenderWorldDrawBlockReason =
  | "missing-mesh-resource"
  | "missing-material-resource";

export interface RenderWorldReadyDraw {
  readonly renderId: number;
  readonly packet: MeshDrawPacket;
  readonly meshResourceKey: string;
  readonly materialResourceKey: string;
  readonly batchKey: MeshDrawPacket["batchKey"];
}

export interface RenderWorldBlockedDraw {
  readonly renderId: number;
  readonly packet: MeshDrawPacket;
  readonly missing: readonly RenderWorldDrawBlockReason[];
}

export interface RenderWorldDrawReadinessReport {
  readonly ready: readonly RenderWorldReadyDraw[];
  readonly blocked: readonly RenderWorldBlockedDraw[];
  readonly diagnostics: readonly RenderDiagnostic[];
}

export interface RenderWorldResourceBindingSuccess {
  readonly ok: true;
  readonly object: RenderWorldObject;
}

export interface RenderWorldResourceBindingFailure {
  readonly ok: false;
  readonly reason: "missing-render-id";
  readonly diagnostics: readonly RenderDiagnostic[];
}

export type RenderWorldResourceBindingResult =
  | RenderWorldResourceBindingSuccess
  | RenderWorldResourceBindingFailure;

export interface RenderWorldApplyReport {
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly removed: number;
  readonly active: number;
  readonly diagnostics: readonly RenderDiagnostic[];
}

export interface RenderWorldApplyOptions {
  readonly changeSet?: RenderSnapshotChangeSet;
}
