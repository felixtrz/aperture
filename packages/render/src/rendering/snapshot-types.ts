import type {
  Aabb,
  BoundingSphere,
  EnvironmentMapHandle,
  MaterialHandle,
  MeshHandle,
  RenderTargetHandle,
  SamplerHandle,
  TextureHandle,
  Vec4Like,
} from "@aperture-engine/simulation";
import type {
  MaterialTextureTransform,
  TextureColorSpace,
  TextureSemantic,
} from "../materials/index.js";
import type { MeshTopology } from "../mesh/index.js";
import type { AreaLightShape, FogMode, LightKind } from "./authoring.js";

export type RenderQueue = "opaque" | "alpha-test" | "transparent";
export type RenderDiagnosticSeverity = "info" | "warning" | "error";

export interface RenderEntityRef {
  readonly index: number;
  readonly generation: number;
}

export interface ViewPacket {
  readonly viewId: number;
  readonly camera: RenderEntityRef;
  readonly priority: number;
  readonly layerMask: number;
  readonly viewMatrixOffset: number;
  readonly projectionMatrixOffset: number;
  readonly viewProjectionMatrixOffset: number;
  readonly viewport: Vec4Like;
  readonly scissor: Vec4Like;
  readonly clearColor: Vec4Like;
  readonly clearDepth: number;
  readonly clearStencil: number;
  readonly renderTarget: RenderTargetHandle | null;
}

export interface MeshDrawPacket {
  readonly renderId: number;
  readonly entity: RenderEntityRef;
  readonly mesh: MeshHandle;
  readonly material: MaterialHandle;
  readonly submesh: number;
  readonly materialSlot: number;
  readonly vertexStart?: number;
  readonly vertexCount?: number;
  readonly indexStart?: number;
  readonly indexCount?: number;
  readonly worldTransformOffset: number;
  readonly instanceTintOffset?: number;
  readonly instanceAttributePacketIndex?: number;
  readonly boneMatrixOffset?: number;
  readonly boneMatrixCount?: number;
  readonly boundsIndex: number;
  readonly layerMask: number;
  readonly castsShadow?: boolean;
  readonly receivesShadow?: boolean;
  readonly occlusionQuery?: boolean;
  readonly sortKey: RenderSortKey;
  readonly batchKey: BatchCompatibilityKey;
}

export interface SpriteDrawPacket {
  readonly renderId: number;
  readonly entity: RenderEntityRef;
  readonly texture: TextureHandle;
  readonly sampler?: SamplerHandle | null;
  readonly color: Vec4Like;
  readonly width: number;
  readonly height: number;
  readonly worldTransformOffset: number;
  readonly boundsIndex: number;
  readonly layerMask: number;
  readonly sortKey: RenderSortKey;
}

export interface SkyboxPacket {
  readonly skyboxId: number;
  readonly entity: RenderEntityRef;
  readonly texture: TextureHandle;
  readonly sampler?: SamplerHandle | null;
  readonly intensity: number;
  readonly layerMask: number;
}

export interface FogPacket {
  readonly fogId: number;
  readonly entity: RenderEntityRef;
  readonly mode: FogMode;
  readonly color: Vec4Like;
  readonly density: number;
  readonly start: number;
  readonly end: number;
  readonly layerMask: number;
}

export interface LightPacket {
  readonly lightId: number;
  readonly entity: RenderEntityRef;
  readonly kind: LightKind;
  readonly shape?: AreaLightShape;
  readonly color: Vec4Like;
  readonly intensity: number;
  readonly range: number;
  readonly innerConeAngle: number;
  readonly outerConeAngle: number;
  readonly width?: number;
  readonly height?: number;
  readonly cookieTexture?: TextureHandle | null;
  readonly cookieSampler?: SamplerHandle | null;
  readonly cookieIntensity?: number;
  readonly worldTransformOffset: number;
  readonly layerMask: number;
}

export interface EnvironmentPacket {
  readonly environmentId: number;
  readonly handle: EnvironmentMapHandle | null;
  readonly color: Vec4Like;
  readonly intensity: number;
  readonly layerMask: number;
}

export interface ShadowRequestPacket {
  readonly shadowId: number;
  readonly lightId: number;
  readonly lightKind?: LightKind;
  readonly cascadeCount?: number;
  readonly casterLayerMask: number;
  readonly receiverLayerMask: number;
}

export interface BoundsPacket {
  readonly boundsId: number;
  readonly entity: RenderEntityRef;
  readonly localAabb: Aabb;
  readonly worldAabb: Aabb;
  readonly localSphere: BoundingSphere;
  readonly worldSphere: BoundingSphere;
}

export interface InstanceAttributeFieldPacket {
  readonly name: string;
  readonly offset: number;
  readonly components: number;
}

export interface InstanceAttributePacket {
  readonly packetIndex: number;
  readonly entity: RenderEntityRef;
  readonly materialKind: string;
  readonly fields: readonly InstanceAttributeFieldPacket[];
}

export interface RenderSortKey {
  readonly queue: RenderQueue;
  readonly viewId: number;
  readonly layer: number;
  readonly order: number;
  readonly pipelineKey: string;
  readonly materialKey: string;
  readonly meshKey: string;
  readonly depth: number;
  readonly stableId: number;
}

export interface BatchCompatibilityKey {
  readonly pipelineKey: string;
  readonly materialKey: string;
  readonly meshLayoutKey: string;
  readonly topology: MeshTopology;
  readonly instanced: boolean;
  readonly skinned: boolean;
  readonly morphed: boolean;
}

export interface RenderDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: RenderDiagnosticSeverity;
  readonly entity?: RenderEntityRef;
  readonly assetKey?: string;
  readonly materialKey?: string;
  readonly meshKey?: string;
  readonly textureKey?: string;
  readonly samplerKey?: string;
  readonly dependencyKind?: string;
  readonly status?: string;
  readonly field?: string;
  readonly expectedSemantic?: TextureSemantic;
  readonly actualSemantic?: TextureSemantic;
  readonly expectedColorSpaces?: readonly TextureColorSpace[];
  readonly actualColorSpace?: TextureColorSpace;
  readonly texCoord?: number;
  readonly supportedTexCoords?: readonly number[];
  readonly textureTransform?: MaterialTextureTransform;
}

export interface RenderSnapshotReport {
  readonly views: number;
  readonly meshDraws: number;
  readonly spriteDraws?: number;
  readonly skyboxes?: number;
  readonly fogs?: number;
  readonly lights: number;
  readonly environments: number;
  readonly shadowRequests: number;
  readonly bounds: number;
  readonly diagnostics: number;
  readonly cullStats?: readonly ViewCullStats[];
}

export interface ViewCullStats {
  readonly viewId: number;
  readonly camera: RenderEntityRef;
  readonly tested: number;
  readonly culled: number;
  readonly included: number;
}

// RenderSnapshot is intentionally made of structured-clone-friendly packet arrays
// and packed numeric buffers so the same shape can cross a future Worker boundary.
export interface RenderSnapshot {
  readonly frame: number;
  readonly views: readonly ViewPacket[];
  readonly meshDraws: readonly MeshDrawPacket[];
  readonly spriteDraws?: readonly SpriteDrawPacket[];
  readonly skyboxes?: readonly SkyboxPacket[];
  readonly fogs?: readonly FogPacket[];
  readonly lights: readonly LightPacket[];
  readonly environments: readonly EnvironmentPacket[];
  readonly shadowRequests: readonly ShadowRequestPacket[];
  readonly bounds: readonly BoundsPacket[];
  readonly transforms: Float32Array;
  readonly bones?: Float32Array;
  readonly morphTargetWeights?: Float32Array;
  readonly instanceTints?: Float32Array;
  readonly instanceAttributes?: Float32Array;
  readonly instanceAttributePackets?: readonly InstanceAttributePacket[];
  readonly viewMatrices: Float32Array;
  readonly diagnostics: readonly RenderDiagnostic[];
  readonly report: RenderSnapshotReport;
}

export interface RenderSortKeyInput {
  readonly queue?: RenderQueue;
  readonly viewId?: number;
  readonly layer?: number;
  readonly order?: number;
  readonly pipelineKey?: string;
  readonly materialKey?: string;
  readonly meshKey?: string;
  readonly depth?: number;
  readonly stableId: number;
}
