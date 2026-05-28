import type { InstanceAttributeLayout } from "../materials/index.js";
import type { RenderDiagnostic } from "./snapshot.js";

export interface PackedTransformOffset {
  readonly renderId: number;
  readonly sourceOffset: number;
  readonly packedOffset: number;
}

export interface PackedSnapshotTransforms {
  readonly data: Float32Array;
  readonly floatCount?: number;
  readonly offsets: readonly PackedTransformOffset[];
  readonly diagnostics: readonly RenderDiagnostic[];
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
  readonly sourceToPackedOffset: Map<number, number>;
  readonly result: PackedSnapshotTransforms;
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
