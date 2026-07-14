import type { Aabb, BoundingSphere, Curve } from "@aperture-engine/simulation";

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

export interface MeshBufferUpdateRange {
  readonly byteOffset: number;
  readonly byteLength: number;
}

export interface MeshVertexStreamDescriptor {
  readonly id: string;
  readonly arrayStride: number;
  readonly vertexCount: number;
  readonly attributes: readonly MeshVertexAttributeDescriptor[];
  readonly data: Float32Array | Uint16Array | Uint8Array;
  readonly updateRanges?: readonly MeshBufferUpdateRange[];
}

export interface MeshIndexBufferDescriptor {
  readonly format: MeshIndexFormat;
  readonly data: Uint16Array | Uint32Array;
  readonly indexCount?: number;
  readonly updateRanges?: readonly MeshBufferUpdateRange[];
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

/**
 * Engine-owned morph-target delta payload for the N-target GPU render path.
 *
 * Unlike {@link MeshMorphTargetDescriptor} (which names per-target vertex-stream
 * semantics and is structurally capped by the number of named slots), this
 * carries every target's deltas in a single target-major typed buffer so an
 * arbitrary target count (e.g. the 52 ARKit blendshapes) renders through a
 * storage buffer indexed by `(target, vertex)` rather than fixed vertex
 * attributes. For target `t`, vertex `v`, the position delta is at
 * `positionDeltas[(t * vertexCount + v) * 3 ..]` (likewise `normalDeltas`,
 * zero-filled where a target lacks NORMAL).
 */
export interface MeshMorphTargetData {
  readonly targetCount: number;
  readonly vertexCount: number;
  readonly hasNormals: boolean;
  readonly positionDeltas: Float32Array;
  readonly normalDeltas: Float32Array;
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
  /**
   * All-N morph-target deltas for the storage-buffer GPU render path. When
   * present, the renderer morphs via this payload (indexed by target+vertex),
   * lifting the structural 2-target vertex-attribute cap.
   */
  readonly morphTargetData?: MeshMorphTargetData;
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

export type LineListPosition = readonly [number, number, number];

export interface LineListMeshSubmeshOptions {
  readonly label?: string;
  readonly materialSlot?: number;
  readonly vertexStart?: number;
  readonly vertexCount?: number;
  readonly indexStart?: number;
  readonly indexCount?: number;
}

export interface LineListMeshOptions {
  readonly label?: string;
  readonly positions: readonly LineListPosition[];
  readonly indices?: readonly number[] | Uint16Array | Uint32Array;
  readonly materialSlots?: readonly string[];
  readonly submeshes?: readonly LineListMeshSubmeshOptions[];
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

/**
 * Flat disc (three.js `CircleGeometry` convention): a triangle fan in the XY
 * plane facing +Z, matching the existing plane primitive's orientation.
 */
export interface CircleMeshOptions {
  readonly label?: string;
  readonly radius?: number;
  readonly segments?: number;
}

/**
 * Annulus (three.js `RingGeometry` convention) in the XY plane facing +Z.
 * `thetaSegments` is the angular resolution; `phiSegments` is the number of
 * concentric radial bands between the inner and outer radius.
 */
export interface RingMeshOptions {
  readonly label?: string;
  readonly innerRadius?: number;
  readonly outerRadius?: number;
  readonly thetaSegments?: number;
  readonly phiSegments?: number;
}

/**
 * Torus knot (three.js `TorusKnotGeometry` convention): a `(p, q)` knot swept
 * with a circular tube of `tube` radius around a curve of `radius`.
 */
export interface TorusKnotMeshOptions {
  readonly label?: string;
  readonly radius?: number;
  readonly tube?: number;
  readonly tubularSegments?: number;
  readonly radialSegments?: number;
  readonly p?: number;
  readonly q?: number;
}

/**
 * Generic polyhedron builder (three.js `PolyhedronGeometry` convention): the
 * `vertices`/`indices` describe a base solid whose faces are subdivided
 * `detail` times and projected onto a sphere of `radius`. `detail: 0` keeps the
 * raw faces (flat-shaded); `detail > 0` yields smooth radial normals.
 */
export interface PolyhedronMeshOptions {
  readonly label?: string;
  /** Flat `[x, y, z, ...]` base vertex positions. */
  readonly vertices: readonly number[];
  /** Triangle indices into {@link PolyhedronMeshOptions.vertices}. */
  readonly indices: readonly number[];
  readonly radius?: number;
  readonly detail?: number;
}

/**
 * Shared options for the platonic-solid wrappers
 * (tetra/octa/icosa/dodecahedron) over {@link PolyhedronMeshOptions}.
 */
export interface PlatonicSolidMeshOptions {
  readonly label?: string;
  readonly radius?: number;
  readonly detail?: number;
}

/**
 * Rounded box (three.js community `RoundedBoxGeometry` convention): a box with
 * rounded edges and corners. `segments` controls the tessellation per face edge
 * and `radius` the corner radius (clamped to the shortest half-dimension).
 */
export interface RoundedBoxMeshOptions {
  readonly label?: string;
  readonly width?: number;
  readonly height?: number;
  readonly depth?: number;
  readonly segments?: number;
  readonly radius?: number;
}

/** A 2D outline point `[x, y]` for shape/profile inputs. */
export type ShapeOutlinePoint = readonly [number, number];

/**
 * Straight-depth extrude (three.js `ExtrudeGeometry` convention, sans bevel): a
 * closed 2D `shape` outline (with optional `holes`) is triangulated in-house
 * (ear clipping) into front/back caps at `±depth/2` on `Z` and joined by a side
 * wall around every contour. `shape`/`holes` points are `[x, y]`; the shape
 * lies in the XY plane and extrudes along `+Z`. Bevels and curve-based
 * `Shape`/`ShapePath` inputs are out of scope.
 */
export interface ExtrudeMeshOptions {
  readonly label?: string;
  readonly shape: readonly ShapeOutlinePoint[];
  readonly holes?: readonly (readonly ShapeOutlinePoint[])[];
  /** Extrusion length along `Z` (centered on the origin). Default 1. */
  readonly depth?: number;
}

/**
 * Lathe (three.js `LatheGeometry` convention): revolve a 2D `profile` (points
 * `[x, y]` with `x` = radius from the Y axis, `y` = height) around the Y axis
 * over `segments` angular steps from `startAngle` to `endAngle`. Surface
 * normals come from the profile tangents; `u` = angle fraction, `v` = profile
 * index fraction.
 */
export interface LatheMeshOptions {
  readonly label?: string;
  readonly profile: readonly ShapeOutlinePoint[];
  readonly segments?: number;
  readonly startAngle?: number;
  readonly endAngle?: number;
}

/**
 * Tube (three.js `TubeGeometry` convention): sweep a circle of `radius` along a
 * math {@link Curve} using a stable parallel-transport (rotation-minimizing)
 * frame, over `tubularSegments` rings of `radialSegments` each. Normals point
 * radially out from the curve; `u` = length fraction, `v` = angle fraction.
 * `closed` applies the frame's twist correction so the seam ring aligns.
 */
export interface TubeMeshOptions {
  readonly label?: string;
  readonly curve: Curve;
  readonly radius?: number;
  readonly tubularSegments?: number;
  readonly radialSegments?: number;
  readonly closed?: boolean;
}
