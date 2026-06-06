import type {
  Aabb,
  BoundingSphere,
  EnvironmentMapHandle,
  MaterialHandle,
  MeshHandle,
  ParticleEffectHandle,
  RenderTargetHandle,
  SamplerHandle,
  TextureHandle,
  Vec4Like,
} from "@aperture-engine/simulation";
import type { MeshTopology } from "../mesh/index.js";
import type {
  QuadBatchKind,
  QuadBillboardMode,
  QuadBlendMode,
  QuadCoordinateMode,
  QuadPipelineVariant,
  QuadSizeMode,
} from "./quad-snapshot.js";
import type { AreaLightShape, FogMode, LightKind } from "./authoring.js";

export type RenderQueue = "opaque" | "alpha-test" | "transparent";

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
  /** Float offset into `snapshot.morphTargetDeltas` for this draw's mesh. */
  readonly morphDeltaOffset?: number;
  /** Number of morph targets blended for this draw (N, not capped). */
  readonly morphTargetCount?: number;
  /** Float offset into `snapshot.morphTargetWeights` for this draw's weights. */
  readonly morphWeightOffset?: number;
  /** Vertex count of the morphed mesh (delta indexing stride). */
  readonly morphVertexCount?: number;
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

export interface QuadBatchPacket {
  readonly batchId: number;
  readonly kind: QuadBatchKind;
  readonly texture?: TextureHandle | null;
  readonly sampler?: SamplerHandle | null;
  readonly materialKey: string;
  readonly pipelineVariant: QuadPipelineVariant;
  readonly coordinateMode: QuadCoordinateMode;
  readonly billboardMode: QuadBillboardMode;
  readonly sizeMode: QuadSizeMode;
  readonly blendMode: QuadBlendMode;
  readonly firstInstance: number;
  readonly instanceCount: number;
  readonly layerMask: number;
  readonly sortKey: RenderSortKey;
}

export type ParticleSimulationSpacePacket = "world" | "local";

export interface ParticleEmitterPacket {
  readonly emitterId: number;
  readonly entity: RenderEntityRef;
  readonly effect: ParticleEffectHandle;
  readonly effectVersion: number;
  readonly capacity: number;
  readonly seed: number;
  readonly resetEpoch: number;
  readonly timeScale: number;
  readonly simulationSpace: ParticleSimulationSpacePacket;
  readonly worldTransformOffset: number;
  readonly boundsIndex: number;
  readonly layerMask: number;
  readonly sortKey: RenderSortKey;
}

export type UiNodeKind = "screen" | "node" | "panel" | "image" | "text";
export type UiLayoutModePacket = "absolute" | "row" | "column";
export type UiTextAlignPacket = "left" | "center" | "right";

export interface UiRectPacket {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface UiNodePacket {
  readonly uiId: number;
  readonly screenId: number;
  readonly entity: RenderEntityRef;
  readonly parentUiId: number | null;
  readonly kind: UiNodeKind;
  readonly rect: UiRectPacket;
  readonly clip: UiRectPacket;
  readonly layoutMode: UiLayoutModePacket;
  readonly stackIndex: number;
  readonly zIndex: number;
  readonly layerMask: number;
  readonly opacity: number;
  readonly clipsChildren: boolean;
  readonly scrollOffset: readonly [number, number];
  readonly color?: Vec4Like;
  readonly texture?: TextureHandle | null;
  readonly sampler?: SamplerHandle | null;
  readonly uvRect?: Vec4Like;
  readonly text?: string;
  readonly fontAtlasId?: string;
  readonly fontSize?: number;
  readonly lineHeight?: number;
  readonly maxWidth?: number;
  readonly textAlign?: UiTextAlignPacket;
  readonly glyphCount?: number;
}

export interface UiHitRegionPacket {
  readonly uiId: number;
  readonly screenId: number;
  readonly entity: RenderEntityRef;
  readonly rect: UiRectPacket;
  readonly clip: UiRectPacket;
  readonly stackIndex: number;
  readonly layerMask: number;
  readonly blocksInput: boolean;
  readonly cursor: string;
  readonly priority: number;
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
  /** Filtering mode: 0 = hard, 1 = PCF, 2 = PCSS (M4-T3). */
  readonly shadowType?: number;
  /** Authored shadow opacity in [0,1]; 1 = fully dark capable (M4-T3). */
  readonly strength?: number;
  /** PCF/PCSS filter radius in texels (M4-T3). */
  readonly filterRadius?: number;
  /** Slope-scaled depth bias for the caster pipeline (M4-T3). */
  readonly slopeBias?: number;
  /** Authored receiver depth bias (LightShadowSettings.bias) (M4-T5). */
  readonly depthBias?: number;
  /** Authored normal-offset bias (LightShadowSettings.normalBias) (M4-T5). */
  readonly normalBias?: number;
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
