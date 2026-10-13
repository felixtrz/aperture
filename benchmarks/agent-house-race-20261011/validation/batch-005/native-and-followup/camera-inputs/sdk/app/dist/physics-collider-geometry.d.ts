import { type AssetRegistry } from "@aperture-engine/simulation";
import { type PhysicsColliderGeometryProvider, type PhysicsHeightfieldGeometry } from "@aperture-engine/physics";
export interface AssetBackedPhysicsColliderGeometryProviderOptions {
    readonly assets: AssetRegistry;
    readonly heightfields?: ReadonlyMap<string, PhysicsHeightfieldGeometry> | Readonly<Record<string, PhysicsHeightfieldGeometry>>;
}
export declare function createAssetBackedPhysicsColliderGeometryProvider(options: AssetBackedPhysicsColliderGeometryProviderOptions): PhysicsColliderGeometryProvider;
//# sourceMappingURL=physics-collider-geometry.d.ts.map