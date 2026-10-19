import type { EcsEntityRef } from "../config.js";

export type CameraLocalVec3 = readonly [number, number, number];
export type CameraLocalEntitySelector = EcsEntityRef | { readonly key: string };

export interface CameraLocalInspectionRequest {
  /** Full render dimensions, in pixels; no device-pixel-ratio conversion. */
  readonly viewport: { readonly width: number; readonly height: number };
  readonly subjects: readonly {
    readonly name: string;
    readonly entity: CameraLocalEntitySelector;
    readonly points?: readonly {
      readonly name: string;
      readonly local: CameraLocalVec3;
      readonly target?: readonly [number, number];
      readonly weight?: number;
    }[];
    readonly faces?: readonly {
      readonly name: string;
      readonly localTriangle: readonly [
        CameraLocalVec3,
        CameraLocalVec3,
        CameraLocalVec3,
      ];
    }[];
    readonly bounds?: {
      readonly source: "mesh-local-aabb";
      readonly includeDescendants: boolean;
    };
  }[];
  /** Explicit orbit gauge for the optional existing camera project/fit job. */
  readonly cameraJob?: { readonly referenceDistance: number };
}

export interface CameraLocalDiagnostic {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface CameraLocalProjection {
  readonly world: CameraLocalVec3;
  readonly pixel: readonly [number, number] | null;
  readonly ndc: CameraLocalVec3 | null;
  readonly clipW: number;
  readonly cameraDepth: number;
  readonly inFront: boolean;
  readonly inDepthRange: boolean;
  readonly inViewport: boolean;
  readonly inFrustum: boolean;
}

/** Structurally compatible with the CLI camera job; no optimizer lives here. */
export interface CameraLocalJobSeed {
  readonly viewport: CameraLocalInspectionRequest["viewport"];
  readonly camera: {
    readonly translation: CameraLocalVec3;
    readonly lookAt: CameraLocalVec3;
    readonly near: number;
    readonly far: number;
  } & (
    | { readonly projection: "perspective"; readonly fovYDegrees: number }
    | {
        readonly projection: "orthographic";
        readonly orthographicHeight: number;
      }
  );
  readonly landmarks: readonly {
    readonly name: string;
    readonly world: CameraLocalVec3;
    readonly target?: readonly [number, number];
    readonly weight?: number;
  }[];
}

export interface CameraLocalBoundsReport {
  readonly source: "mesh-local-aabb";
  readonly includeDescendants: boolean;
  readonly status: "complete" | "incomplete" | "empty";
  readonly meshes: readonly {
    readonly entity: EcsEntityRef;
    readonly meshId: string;
    readonly corners: readonly CameraLocalProjection[];
  }[];
  /** Unclamped projected source-box envelope. Null if incomplete or any corner crosses the near/eye plane. */
  readonly screenBounds: {
    readonly min: readonly [number, number];
    readonly max: readonly [number, number];
  } | null;
  readonly diagnostics: readonly CameraLocalDiagnostic[];
}

export interface CameraLocalInspectionReport {
  readonly source: "resolved-ecs";
  readonly viewport: CameraLocalInspectionRequest["viewport"];
  readonly camera: {
    readonly entity: EcsEntityRef;
    readonly projection: "perspective" | "orthographic";
    readonly aspect: number;
    readonly aspectSource: "viewport-auto-aspect" | "camera";
    readonly worldMatrix: readonly number[];
    readonly viewProjectionMatrix: readonly number[];
  };
  readonly subjects: readonly {
    readonly name: string;
    readonly entity: EcsEntityRef;
    readonly worldMatrix: readonly number[];
    readonly points: readonly (CameraLocalProjection & {
      readonly name: string;
      readonly local: CameraLocalVec3;
      readonly target?: readonly [number, number];
      readonly weight?: number;
      /** Projected pixel minus caller target; null without a target or defined projection. */
      readonly residual: readonly [number, number] | null;
      /** Null if no residual or its magnitude is outside the finite numeric range. */
      readonly errorPixels: number | null;
    })[];
    readonly faces: readonly {
      readonly name: string;
      readonly vertices: readonly CameraLocalProjection[];
      readonly centroid: CameraLocalVec3;
      readonly normal: CameraLocalVec3 | null;
      /** Positive means the ordered triangle normal points toward the camera. Not visibility or material culling. */
      readonly facingCosine: number | null;
      readonly status: "ok" | "degenerate" | "camera-at-centroid";
    }[];
    readonly bounds: CameraLocalBoundsReport | null;
  }[];
  readonly cameraJob: CameraLocalJobSeed | null;
  readonly cameraJobDiagnostics: readonly CameraLocalDiagnostic[];
  readonly diagnostics: readonly CameraLocalDiagnostic[];
  /** Unsupported render effects are explicit even for caller-authored points/faces. */
  readonly limitations: readonly string[];
}

export type CameraLocalInspectionResult =
  | { readonly ok: true; readonly result: CameraLocalInspectionReport }
  | {
      readonly ok: false;
      readonly diagnostics: readonly CameraLocalDiagnostic[];
    };
