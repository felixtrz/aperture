import { assetHandleKey, createMeshHandle, } from "@aperture-engine/simulation";
import { createSpatialTriangleMeshFromMeshAsset, } from "@aperture-engine/render";
import { createPhysicsTriangleMeshGeometryFromSpatialMesh, validatePhysicsHeightfieldGeometry, } from "@aperture-engine/physics";
export function createAssetBackedPhysicsColliderGeometryProvider(options) {
    const triangleMeshCache = new Map();
    return {
        triangleMesh(meshId) {
            const handle = createMeshHandleFromColliderMeshId(meshId);
            const handleKey = assetHandleKey(handle);
            const entry = options.assets.get(handle);
            if (entry === undefined) {
                return {
                    ok: false,
                    error: assetGeometryError({
                        code: "physics.collider.asset.missing",
                        feature: "collider.triangleMesh",
                        assetId: meshId,
                        message: `Physics collider mesh '${meshId}' is not registered as a source mesh asset.`,
                        suggestedFix: "Register the mesh asset in the app AssetRegistry before stepping physics.",
                    }),
                };
            }
            if (entry.status !== "ready") {
                return {
                    ok: false,
                    error: assetGeometryError({
                        code: "physics.collider.asset.notReady",
                        feature: "collider.triangleMesh",
                        assetId: meshId,
                        message: `Physics collider mesh '${handleKey}' is '${entry.status}', not ready.`,
                        suggestedFix: "Wait until the mesh source asset is ready before enabling the asset-backed collider.",
                        details: { status: entry.status, version: entry.version },
                    }),
                };
            }
            if (!isMeshAsset(entry.asset)) {
                return {
                    ok: false,
                    error: assetGeometryError({
                        code: "physics.collider.asset.invalid",
                        feature: "collider.triangleMesh",
                        assetId: meshId,
                        message: `Physics collider asset '${handleKey}' is not a MeshAsset.`,
                        suggestedFix: "Store a render MeshAsset under the mesh handle used by Collider.meshId.",
                        details: { version: entry.version },
                    }),
                };
            }
            const cacheKey = `${handleKey}@${entry.version}`;
            const cached = triangleMeshCache.get(cacheKey);
            if (cached !== undefined) {
                return cached;
            }
            const spatial = createSpatialTriangleMeshFromMeshAsset(entry.asset);
            if (spatial.mesh === null) {
                const result = {
                    ok: false,
                    error: assetGeometryError({
                        code: "physics.collider.asset.invalid",
                        feature: "collider.triangleMesh",
                        assetId: meshId,
                        message: `Physics collider mesh '${handleKey}' could not be adapted to triangle geometry.`,
                        suggestedFix: "Use triangle-list mesh data with float32x3 POSITION and uint16/uint32 indices.",
                        details: {
                            version: entry.version,
                            diagnostics: diagnosticsToDetails(spatial.diagnostics),
                        },
                    }),
                };
                triangleMeshCache.set(cacheKey, result);
                return result;
            }
            const result = createPhysicsTriangleMeshGeometryFromSpatialMesh({
                key: handleKey,
                sourceVersion: entry.version,
                mesh: spatial.mesh,
            });
            triangleMeshCache.set(cacheKey, result);
            return result;
        },
        heightfield(assetId) {
            const heightfield = readHeightfield(options.heightfields, assetId);
            if (heightfield === null) {
                return {
                    ok: false,
                    error: assetGeometryError({
                        code: "physics.collider.asset.missing",
                        feature: "collider.heightfield",
                        assetId,
                        message: `Physics heightfield '${assetId}' is not registered with the collider geometry provider.`,
                        suggestedFix: "Add a finite PhysicsHeightfieldGeometry entry to the provider heightfields map before stepping physics.",
                    }),
                };
            }
            return validatePhysicsHeightfieldGeometry(heightfield);
        },
    };
}
function createMeshHandleFromColliderMeshId(meshId) {
    return createMeshHandle(meshId.startsWith("mesh:") ? meshId.slice(5) : meshId);
}
function readHeightfield(heightfields, assetId) {
    if (heightfields === undefined) {
        return null;
    }
    if (isHeightfieldMap(heightfields)) {
        return heightfields.get(assetId) ?? null;
    }
    return heightfields[assetId] ?? null;
}
function isHeightfieldMap(value) {
    return typeof value.get === "function";
}
function isMeshAsset(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const asset = value;
    return (asset.kind === "mesh" &&
        typeof asset.label === "string" &&
        Array.isArray(asset.vertexStreams) &&
        Array.isArray(asset.submeshes) &&
        Array.isArray(asset.materialSlots));
}
function assetGeometryError(input) {
    return {
        code: input.code,
        feature: input.feature,
        message: input.message,
        suggestedFix: input.suggestedFix,
        details: {
            assetId: input.assetId,
            ...(input.details ?? {}),
        },
    };
}
function diagnosticsToDetails(diagnostics) {
    return diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message,
        suggestedFix: diagnostic.suggestedFix,
        data: diagnostic.data,
    }));
}
//# sourceMappingURL=physics-collider-geometry.js.map