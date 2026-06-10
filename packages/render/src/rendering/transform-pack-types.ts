import type { InstanceAttributeLayout } from "../materials/index.js";
import type { RenderDiagnostic } from "./snapshot.js";

export interface PackedTransformOffset {
  readonly renderId: number;
  readonly sourceOffset: number;
  readonly packedOffset: number;
}

/**
 * Contiguous float window of the packed transform data that changed since the
 * previous frame written through the same persistent scratch (AI-64). `full`
 * marks the dirty-fraction fallback: most of the buffer moved, so consumers
 * should issue one whole-buffer write instead of a sub-range.
 */
export interface PackedTransformDirtyRange {
  readonly floatOffset: number;
  readonly floatCount: number;
  readonly full: boolean;
}

export interface PackedSnapshotTransforms {
  readonly data: Float32Array;
  readonly floatCount?: number;
  readonly offsets: readonly PackedTransformOffset[];
  readonly diagnostics: readonly RenderDiagnostic[];
  /**
   * Monotonic content version of the persistent pack scratch; bumps whenever
   * the packed bytes changed. Consumers stamp their GPU buffer with the
   * version they last uploaded: equal version ⇒ skip, exactly one behind with
   * a non-full dirtyRange ⇒ sub-range upload, otherwise full upload.
   * Undefined on the allocating `packSnapshotTransforms` path (no history).
   */
  readonly contentVersion?: number;
  /**
   * Delta from contentVersion-1 to contentVersion. `null` means the packed
   * bytes are identical to the previous frame (zero-byte upload); undefined
   * means unknown (treat as full).
   */
  readonly dirtyRange?: PackedTransformDirtyRange | null;
}

export interface PackedPreviousSnapshotTransformHistoryReport {
  readonly total: number;
  readonly used: number;
  readonly fallback: number;
  readonly missing: readonly number[];
}

export interface PackedSnapshotPreviousTransforms extends PackedSnapshotTransforms {
  readonly history: PackedPreviousSnapshotTransformHistoryReport;
}

export interface PackedSnapshotTransformHistoryUpdateReport {
  readonly stored: number;
  readonly staleRemoved: number;
}

export interface PackedInstanceTintOffset {
  readonly renderId: number;
  readonly sourceOffset: number;
  readonly packedOffset: number;
}

export interface PackedSnapshotInstanceTints {
  readonly data: Float32Array;
  readonly floatCount: number;
  readonly offsets: readonly PackedInstanceTintOffset[];
  readonly diagnostics: readonly RenderDiagnostic[];
}

export interface PackedInstanceAttributeOffset {
  readonly renderId: number;
  readonly sourcePacketIndex: number;
  readonly packedOffset: number;
}

export interface PackedSnapshotInstanceAttributes {
  readonly layout: InstanceAttributeLayout;
  readonly data: Float32Array;
  readonly floatCount: number;
  readonly offsets: readonly PackedInstanceAttributeOffset[];
  readonly diagnostics: readonly RenderDiagnostic[];
}

export interface PackedSnapshotTransformsScratch {
  data: Float32Array;
  readonly offsets: PackedTransformOffset[];
  readonly diagnostics: RenderDiagnostic[];
  readonly offsetPool: PackedTransformOffset[];
  readonly result: PackedSnapshotTransforms;
  /** Float count written on the previous frame (-1 before the first write). */
  lastFloatCount: number;
  /** Monotonic version of the scratch content; bumps on every byte change. */
  contentVersion: number;
}

export interface PackedSnapshotPreviousTransformsScratch {
  data: Float32Array;
  readonly offsets: PackedTransformOffset[];
  readonly diagnostics: RenderDiagnostic[];
  readonly offsetPool: PackedTransformOffset[];
  readonly missing: number[];
  readonly history: MutablePackedPreviousSnapshotTransformHistoryReport;
  readonly result: PackedSnapshotPreviousTransforms;
}

export interface PackedSnapshotInstanceTintsScratch {
  data: Float32Array;
  readonly offsets: PackedInstanceTintOffset[];
  readonly diagnostics: RenderDiagnostic[];
  readonly offsetPool: PackedInstanceTintOffset[];
  readonly result: PackedSnapshotInstanceTints;
}

export interface PackedSnapshotInstanceAttributesScratch {
  data: Float32Array;
  readonly offsets: PackedInstanceAttributeOffset[];
  readonly diagnostics: RenderDiagnostic[];
  readonly offsetPool: PackedInstanceAttributeOffset[];
  readonly result: PackedSnapshotInstanceAttributes;
}

export interface MutablePackedTransformOffset {
  renderId: number;
  sourceOffset: number;
  packedOffset: number;
}

export interface MutablePackedInstanceTintOffset {
  renderId: number;
  sourceOffset: number;
  packedOffset: number;
}

export interface MutablePackedSnapshotTransforms {
  data: Float32Array;
  floatCount: number;
  offsets: readonly PackedTransformOffset[];
  diagnostics: readonly RenderDiagnostic[];
  contentVersion: number | undefined;
  dirtyRange: PackedTransformDirtyRange | null | undefined;
}

export interface MutablePackedSnapshotPreviousTransforms extends MutablePackedSnapshotTransforms {
  history: PackedPreviousSnapshotTransformHistoryReport;
}

export interface MutablePackedPreviousSnapshotTransformHistoryReport {
  total: number;
  used: number;
  fallback: number;
  missing: readonly number[];
}

export interface MutablePackedSnapshotInstanceTints {
  data: Float32Array;
  floatCount: number;
  offsets: readonly PackedInstanceTintOffset[];
  diagnostics: readonly RenderDiagnostic[];
}

export interface MutablePackedInstanceAttributeOffset {
  renderId: number;
  sourcePacketIndex: number;
  packedOffset: number;
}

export interface MutablePackedSnapshotInstanceAttributes {
  layout: InstanceAttributeLayout;
  data: Float32Array;
  floatCount: number;
  offsets: readonly PackedInstanceAttributeOffset[];
  diagnostics: readonly RenderDiagnostic[];
}
