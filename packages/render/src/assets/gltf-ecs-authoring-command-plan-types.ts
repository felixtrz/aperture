import type { GltfSceneTraversalReport } from "./gltf-scene-traversal.js";
import type { GltfMeshSourceAssetRegistrationReport } from "./gltf-mesh-source-registration.js";
import type { GltfPrimitiveMaterialResolutionReport } from "./gltf-primitive-material-resolution.js";
import type { GltfSkinImportReport } from "./gltf-skin-import.js";

export type GltfEcsAuthoringComponentName =
  | "Name"
  | "LocalTransform"
  | "Parent"
  | "WorldTransform"
  | "Mesh"
  | "Material"
  | "Visibility"
  | "Skin";

export type GltfEcsAuthoringCommand =
  | {
      readonly type: "createEntity";
      readonly entityKey: string;
      readonly label: string;
    }
  | {
      readonly type: "addComponent";
      readonly entityKey: string;
      readonly component: GltfEcsAuthoringComponentName;
      readonly value: GltfEcsAuthoringComponentValue;
    };

export type GltfEcsAuthoringComponentValue =
  | GltfNameCommandValue
  | GltfLocalTransformCommandValue
  | GltfParentCommandValue
  | GltfWorldTransformCommandValue
  | GltfMeshCommandValue
  | GltfMaterialCommandValue
  | GltfVisibilityCommandValue
  | GltfSkinCommandValue;

export interface GltfNameCommandValue {
  readonly value: string;
}

export interface GltfLocalTransformCommandValue {
  readonly translation: readonly [number, number, number];
  readonly rotation: readonly [number, number, number, number];
  readonly scale: readonly [number, number, number];
}

export interface GltfParentCommandValue {
  readonly parentEntityKey: string | null;
}

export interface GltfWorldTransformCommandValue {
  readonly col0: readonly [number, number, number, number];
  readonly col1: readonly [number, number, number, number];
  readonly col2: readonly [number, number, number, number];
  readonly col3: readonly [number, number, number, number];
}

export interface GltfMeshCommandValue {
  readonly meshId: string;
  readonly handleKey: string;
}

export interface GltfMaterialCommandValue {
  readonly materialId: string;
  readonly handleKey: string;
}

export interface GltfVisibilityCommandValue {
  readonly visible: boolean;
}

export interface GltfSkinCommandValue {
  /** Entity keys (keyPrefix:node:N) of the joints, in skin.joints order. */
  readonly jointEntityKeys: readonly string[];
  /** Flat column-major inverse-bind matrices, length === jointCount * 16. */
  readonly inverseBindMatrices: readonly number[];
  /** Entity key of the common skeleton-root node, or null. */
  readonly skeletonEntityKey: string | null;
}

export type GltfEcsAuthoringDiagnosticCode =
  | "gltfEcsAuthoring.invalidTraversalReport"
  | "gltfEcsAuthoring.missingSceneRoot"
  | "gltfEcsAuthoring.nodeSkippedByAncestor"
  | "gltfEcsAuthoring.missingMeshRegistration"
  | "gltfEcsAuthoring.skippedMeshRegistration"
  | "gltfEcsAuthoring.unresolvedPrimitiveMaterial"
  | "gltfEcsAuthoring.missingPrimitiveMaterialResolution"
  | "gltfEcsAuthoring.duplicateEntityKey"
  | "gltfEcsAuthoring.skinJointNodeMissing";

export interface GltfEcsAuthoringDiagnostic {
  readonly code: GltfEcsAuthoringDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
  readonly sceneIndex?: number;
  readonly nodeIndex?: number;
  readonly entityKey?: string;
  readonly parentEntityKey?: string | null;
  readonly meshIndex?: number;
  readonly primitiveIndex?: number;
  readonly meshHandleKey?: string;
  readonly materialHandleKey?: string;
  readonly sourceReason?: string;
}

export interface GltfSkippedEcsAuthoringEntry {
  readonly entityKey: string;
  readonly reason: GltfEcsAuthoringDiagnosticCode;
  readonly nodeIndex?: number;
  readonly parentEntityKey?: string | null;
  readonly diagnostics: readonly GltfEcsAuthoringDiagnostic[];
}

export interface GltfEcsAuthoringCommandPlanOptions {
  readonly traversalReport: GltfSceneTraversalReport;
  readonly meshRegistrationReport?: GltfMeshSourceAssetRegistrationReport;
  readonly primitiveMaterialReport?: GltfPrimitiveMaterialResolutionReport;
  readonly availableMeshHandleKeys?: readonly string[];
  readonly skinReport?: GltfSkinImportReport;
}

export interface GltfEcsAuthoringCommandPlan {
  readonly valid: boolean;
  readonly sceneIndex: number | null;
  readonly rootEntityKeys: readonly string[];
  readonly commands: readonly GltfEcsAuthoringCommand[];
  readonly dependencies: readonly string[];
  readonly skipped: readonly GltfSkippedEcsAuthoringEntry[];
  readonly diagnostics: readonly GltfEcsAuthoringDiagnostic[];
}

export type GltfEcsAuthoringCommandPlanJsonValue = GltfEcsAuthoringCommandPlan;
