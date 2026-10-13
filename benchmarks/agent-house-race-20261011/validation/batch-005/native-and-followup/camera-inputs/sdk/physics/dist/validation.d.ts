import type { PhysicsCharacterMove } from "./backend.js";
import type { ApertureSceneDocument } from "@aperture-engine/simulation";
import type { ColliderInput, PhysicsCharacterControllerInput, PhysicsJointInput, RigidBodyInput } from "./components.js";
export interface PhysicsValidationDiagnostic {
    readonly code: string;
    readonly message: string;
    readonly data?: Readonly<Record<string, unknown>>;
}
export interface PhysicsSceneAssetReferenceValidationOptions {
    readonly meshExists?: (meshId: string) => boolean;
    readonly heightfieldExists?: (assetId: string) => boolean;
}
export declare function validateRigidBodyInput(input: RigidBodyInput): PhysicsValidationDiagnostic[];
export declare function validateColliderInput(input: ColliderInput): PhysicsValidationDiagnostic[];
export declare function validatePhysicsSceneAssetReferences(sceneDocument: ApertureSceneDocument, options?: PhysicsSceneAssetReferenceValidationOptions): PhysicsValidationDiagnostic[];
export declare function validatePhysicsJointInput(input: PhysicsJointInput): PhysicsValidationDiagnostic[];
export declare function validatePhysicsCharacterControllerInput(input: PhysicsCharacterControllerInput): PhysicsValidationDiagnostic[];
export declare function validatePhysicsCharacterMove(input: PhysicsCharacterMove): PhysicsValidationDiagnostic[];
//# sourceMappingURL=validation.d.ts.map