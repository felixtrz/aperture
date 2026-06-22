/** Structured diagnostics for glTF animation import (M2-T4). */

export type GltfAnimationImportDiagnosticCode =
  | "gltfAnimation.malformedAnimations"
  | "gltfAnimation.malformedAnimation"
  | "gltfAnimation.malformedChannel"
  | "gltfAnimation.missingSampler"
  | "gltfAnimation.missingTargetNode"
  | "gltfAnimation.unsupportedTargetPath"
  | "gltfAnimation.unsupportedInterpolation"
  | "gltfAnimation.inputDecodeFailed"
  | "gltfAnimation.outputDecodeFailed"
  | "gltfAnimation.channelLengthMismatch"
  | "gltfAnimation.emptyClip";

export interface GltfAnimationImportDiagnostic {
  readonly code: GltfAnimationImportDiagnosticCode;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly animationIndex?: number;
  readonly channelIndex?: number;
  readonly nodeIndex?: number;
  readonly path?: string;
  readonly interpolation?: string;
}

export interface GltfAnimationImportReport {
  readonly valid: boolean;
  readonly animationCount: number;
  readonly clipCount: number;
  readonly channelCount: number;
  readonly diagnostics: readonly GltfAnimationImportDiagnostic[];
}

export function gltfAnimationImportReportToJsonValue(
  report: GltfAnimationImportReport,
): GltfAnimationImportReport {
  return report;
}
