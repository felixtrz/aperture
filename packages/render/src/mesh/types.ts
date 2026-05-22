import type { Aabb, BoundingSphere } from "@aperture-engine/simulation";

export type MeshTopology =
  | "triangle-list"
  | "triangle-strip"
  | "line-list"
  | "line-strip"
  | "point-list";

export type MeshVertexFormat =
  | "float32x2"
  | "float32x3"
  | "float32x4"
  | "unorm8x4"
  | "unorm16x4"
  | "uint16x4"
  | "uint8x4";

export type MeshVertexSemantic =
  | "POSITION"
  | "NORMAL"
  | "TANGENT"
  | "TEXCOORD_0"
  | "TEXCOORD_1"
  | "COLOR_0"
  | "JOINTS_0"
  | "WEIGHTS_0"
  | "JOINTS_1"
  | "WEIGHTS_1"
  | "MORPH_POSITION_0"
  | "MORPH_NORMAL_0"
  | "MORPH_POSITION_1"
  | "MORPH_NORMAL_1";

export type MeshIndexFormat = "uint16" | "uint32";

export interface MeshVertexAttributeDescriptor {
  readonly semantic: MeshVertexSemantic;
  readonly format: MeshVertexFormat;
  readonly offset: number;
}

export interface MeshVertexStreamDescriptor {
  readonly id: string;
  readonly arrayStride: number;
  readonly vertexCount: number;
  readonly attributes: readonly MeshVertexAttributeDescriptor[];
  readonly data: Float32Array | Uint16Array | Uint8Array;
}

export interface MeshIndexBufferDescriptor {
  readonly format: MeshIndexFormat;
  readonly data: Uint16Array | Uint32Array;
  readonly indexCount?: number;
}

export interface MeshSubmeshDescriptor {
  readonly label: string;
  readonly topology: MeshTopology;
  readonly materialSlot: number;
  readonly vertexStart: number;
  readonly vertexCount: number;
  readonly indexStart: number;
  readonly indexCount: number;
}

export interface MeshMaterialSlot {
  readonly index: number;
  readonly label: string;
}

export interface MeshSkinningSchema {
  readonly joints0?: MeshVertexSemantic;
  readonly weights0?: MeshVertexSemantic;
  readonly joints1?: MeshVertexSemantic;
  readonly weights1?: MeshVertexSemantic;
}

export interface MeshMorphTargetDescriptor {
  readonly label: string;
  readonly positionSemantic?: MeshVertexSemantic;
  readonly normalSemantic?: MeshVertexSemantic;
  readonly tangentSemantic?: MeshVertexSemantic;
}

export interface MeshAsset {
  readonly kind: "mesh";
  readonly label: string;
  readonly vertexStreams: readonly MeshVertexStreamDescriptor[];
  readonly indexBuffer?: MeshIndexBufferDescriptor;
  readonly submeshes: readonly MeshSubmeshDescriptor[];
  readonly materialSlots: readonly MeshMaterialSlot[];
  readonly localAabb?: Aabb;
  readonly localSphere?: BoundingSphere;
  readonly skinning?: MeshSkinningSchema;
  readonly morphTargets?: readonly MeshMorphTargetDescriptor[];
}

export type MeshDiagnosticCode =
  | "mesh.missingPosition"
  | "mesh.missingBounds"
  | "mesh.invalidSubmeshRange"
  | "mesh.unsupportedTopology"
  | "mesh.missingMaterialSlot";

export interface MeshValidationDiagnostic {
  readonly code: MeshDiagnosticCode;
  readonly message: string;
  readonly submesh?: number;
}

export interface MeshValidationReport {
  readonly valid: boolean;
  readonly diagnostics: readonly MeshValidationDiagnostic[];
}

export interface BoxMeshOptions {
  readonly label?: string;
  readonly width?: number;
  readonly height?: number;
  readonly depth?: number;
}

export interface PlaneMeshOptions {
  readonly label?: string;
  readonly width?: number;
  readonly height?: number;
}

export interface SphereMeshOptions {
  readonly label?: string;
  readonly radius?: number;
  readonly widthSegments?: number;
  readonly heightSegments?: number;
}

export interface CylinderMeshOptions {
  readonly label?: string;
  readonly radius?: number;
  readonly radiusTop?: number;
  readonly radiusBottom?: number;
  readonly height?: number;
  readonly radialSegments?: number;
  readonly heightSegments?: number;
}

export interface ConeMeshOptions {
  readonly label?: string;
  readonly radius?: number;
  readonly height?: number;
  readonly radialSegments?: number;
  readonly heightSegments?: number;
}

export interface CapsuleMeshOptions {
  readonly label?: string;
  readonly radius?: number;
  readonly height?: number;
  readonly radialSegments?: number;
  readonly capSegments?: number;
}

export interface TorusMeshOptions {
  readonly label?: string;
  readonly majorRadius?: number;
  readonly tubeRadius?: number;
  readonly radialSegments?: number;
  readonly tubeSegments?: number;
}
