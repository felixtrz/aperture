import { Camera, CameraProjection } from "/aperture/worker-modules/packages/render/dist/index.js";
import { WorldTransform, identityMat4, invertMat4, makeOrthographic, makePerspective, multiplyMat4, toVec3Tuple, transformPoint, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { AppEntityKey } from "./components.js";
import { ApertureSystemError } from "./errors.js";
export function createCameraAccess(world, options = {}) {
    function handles() {
        if (options.contextKey !== undefined) {
            const systemsContext = world.globals[options.contextKey];
            void systemsContext;
        }
        const entities = collectCameraEntities(world);
        return entities.map(cameraHandle);
    }
    const access = {
        get main() {
            return access.byKey("camera.main") ?? handles()[0] ?? fallbackCamera();
        },
        get active() {
            return handles();
        },
        byKey(key) {
            for (const entity of collectCameraEntities(world)) {
                if (entity.hasComponent(AppEntityKey) &&
                    entity.getValue(AppEntityKey, "value") === key) {
                    return cameraHandle(entity);
                }
            }
            return null;
        },
    };
    return access;
}
function collectCameraEntities(world) {
    return world
        .getSystems()
        .flatMap(() => [])
        .concat(collectEntitiesByComponents(world));
}
function collectEntitiesByComponents(world) {
    const query = world.queryManager.registerQuery({ required: [Camera] });
    return [...query.entities];
}
function cameraHandle(entity) {
    return {
        entity,
        ref: entityRef(entity),
        rayFromPointer(position) {
            return rayFromCamera(entity, position);
        },
    };
}
function rayFromCamera(entity, position) {
    if (!entity.hasComponent(WorldTransform)) {
        throw new ApertureSystemError("aperture.camera.missingTransform", "Camera ray construction requires a WorldTransform component.", "Add a transform to the camera entity before calling rayFromPointer().");
    }
    const worldMatrix = readWorldMatrix(entity);
    const viewMatrix = invertMat4(worldMatrix);
    if (viewMatrix === null) {
        throw new ApertureSystemError("aperture.camera.invalidTransform", "Camera ray construction requires an invertible world transform.", "Use a camera transform with non-zero scale before calling rayFromPointer().");
    }
    const projection = entity.getValue(Camera, "projection");
    // Validate the projection parameters before building the matrix so an invalid
    // camera surfaces the structured camera error rather than a raw RangeError from
    // makeOrthographic/makePerspective (which the inverse-matrix guard below would
    // never reach).
    const near = readCameraNumber(entity, "near");
    const far = readCameraNumber(entity, "far");
    const aspect = readCameraNumber(entity, "aspect");
    const projectionValid = near > 0 &&
        far > near &&
        aspect > 0 &&
        (projection === CameraProjection.Orthographic
            ? readCameraNumber(entity, "orthographicHeight") > 0
            : readCameraNumber(entity, "fovYRadians") > 0 &&
                readCameraNumber(entity, "fovYRadians") < Math.PI);
    if (!projectionValid) {
        throw new ApertureSystemError("aperture.camera.invalidProjection", "Camera ray construction requires a valid projection (near > 0, far > near, positive aspect, and a valid fov / orthographic height).", "Set the camera's near/far/aspect (and fovYDegrees or orthographicHeight) to valid positive values before calling rayFromPointer().");
    }
    const projectionMatrix = projection === CameraProjection.Orthographic
        ? makeOrthographic(-readCameraNumber(entity, "aspect") *
            readCameraNumber(entity, "orthographicHeight") *
            0.5, readCameraNumber(entity, "aspect") *
            readCameraNumber(entity, "orthographicHeight") *
            0.5, -readCameraNumber(entity, "orthographicHeight") * 0.5, readCameraNumber(entity, "orthographicHeight") * 0.5, readCameraNumber(entity, "near"), readCameraNumber(entity, "far"))
        : makePerspective(readCameraNumber(entity, "fovYRadians"), readCameraNumber(entity, "aspect"), readCameraNumber(entity, "near"), readCameraNumber(entity, "far"));
    const viewProjectionMatrix = multiplyMat4(projectionMatrix, viewMatrix);
    const inverseViewProjectionMatrix = invertMat4(viewProjectionMatrix);
    if (inverseViewProjectionMatrix === null) {
        throw new ApertureSystemError("aperture.camera.invalidProjection", "Camera ray construction requires an invertible view-projection matrix.", "Use a valid camera projection with near > 0, far > near, and non-zero aspect/orthographic height.");
    }
    const ndcX = position[0] * 2 - 1;
    const ndcY = 1 - position[1] * 2;
    const nearPoint = transformPoint(inverseViewProjectionMatrix, [
        ndcX,
        ndcY,
        0,
    ]);
    const farPoint = transformPoint(inverseViewProjectionMatrix, [ndcX, ndcY, 1]);
    // Both perspective and orthographic rays start at the near-plane point under
    // the pointer and travel toward the far plane. Anchoring the perspective ray on
    // the near plane (rather than the eye) keeps picking inside the view frustum and
    // unifies the two projection paths — `projection` only selects the matrix above.
    return {
        origin: toVec3Tuple(nearPoint),
        direction: normalize3([
            readVec3(farPoint, 0) - readVec3(nearPoint, 0),
            readVec3(farPoint, 1) - readVec3(nearPoint, 1),
            readVec3(farPoint, 2) - readVec3(nearPoint, 2),
        ]),
    };
}
function readWorldMatrix(entity) {
    const matrix = identityMat4();
    matrix.set(entity.getVectorView(WorldTransform, "col0"), 0);
    matrix.set(entity.getVectorView(WorldTransform, "col1"), 4);
    matrix.set(entity.getVectorView(WorldTransform, "col2"), 8);
    matrix.set(entity.getVectorView(WorldTransform, "col3"), 12);
    return matrix;
}
function readCameraNumber(entity, key) {
    const value = entity.getValue(Camera, key);
    return typeof value === "number" ? value : 0;
}
function normalize3(value) {
    const x = readVec3(value, 0);
    const y = readVec3(value, 1);
    const z = readVec3(value, 2);
    const length = Math.hypot(x, y, z);
    if (length <= Number.EPSILON) {
        throw new ApertureSystemError("aperture.camera.invalidRay", "Camera ray construction produced a zero-length direction.", "Use a valid camera projection and transform before calling rayFromPointer().");
    }
    return [x / length, y / length, z / length];
}
function readVec3(value, index) {
    const next = value[index];
    if (next === undefined) {
        throw new RangeError(`Expected Vec3Like value at index ${index}.`);
    }
    return next;
}
function fallbackCamera() {
    throw new ApertureSystemError("aperture.camera.missing", "No camera entity is available.", "Spawn a camera in a setup system or enable render.defaultCamera in aperture.config.ts.");
}
function entityRef(entity) {
    return { index: entity.index, generation: entity.generation };
}
//# sourceMappingURL=cameras.js.map