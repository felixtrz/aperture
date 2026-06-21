import { LocalTransform } from "@aperture-engine/simulation";
import { resolveActiveEntity } from "../entities/lookup/resolve.js";
import { quatLookAt } from "../systems/spawn/transforms.js";
// M7-T9: a reusable, ECS-authoritative orbit camera controller. It holds the
// orbit state (target + azimuth/elevation/distance in spherical coordinates) and
// writes the camera's LocalTransform each frame via the normal component path —
// it NEVER caches a renderer scene-graph node (no public mutable scene graph).
// Pointer drag maps to azimuth/elevation; wheel maps to distance. Elevation is
// clamped just inside the poles so the look-at basis never degenerates (gimbal
// flip when the camera looks straight down the world-up axis). Headless/worker-
// safe: pure math + ECS writes, no DOM.
const DEFAULT_ROTATE_SPEED = Math.PI; // radians per 1.0 of normalized pointer travel
const DEFAULT_ZOOM_SPEED = 1; // distance units per 1.0 of wheel travel
const POLE_EPSILON = 1e-3; // keep elevation strictly inside ±90°
export function createOrbitCameraController(options) {
    const cameraRef = options.camera;
    const target = [
        options.target?.[0] ?? 0,
        options.target?.[1] ?? 0,
        options.target?.[2] ?? 0,
    ];
    const rotateSpeed = options.rotateSpeed ?? DEFAULT_ROTATE_SPEED;
    const zoomSpeed = options.zoomSpeed ?? DEFAULT_ZOOM_SPEED;
    // Clamp the elevation bounds (caller-supplied OR default) strictly inside the
    // poles so the look-at basis never degenerates — a caller passing exactly ±π/2
    // would otherwise place the eye on the target's vertical axis (gimbal flip).
    const poleLimit = Math.PI / 2 - POLE_EPSILON;
    const minElevation = clamp(options.minElevation ?? -poleLimit, -poleLimit, poleLimit);
    const maxElevation = clamp(options.maxElevation ?? poleLimit, -poleLimit, poleLimit);
    const minDistance = options.minDistance ?? 0.01;
    const maxDistance = options.maxDistance ?? Number.POSITIVE_INFINITY;
    let azimuth = options.azimuth ?? 0;
    let elevation = clamp(options.elevation ?? 0, minElevation, maxElevation);
    let distance = clamp(options.distance ?? 5, minDistance, maxDistance);
    const eyePosition = () => {
        const cosEl = Math.cos(elevation);
        const sinEl = Math.sin(elevation);
        const sinAz = Math.sin(azimuth);
        const cosAz = Math.cos(azimuth);
        return [
            target[0] + distance * cosEl * sinAz,
            target[1] + distance * sinEl,
            target[2] + distance * cosEl * cosAz,
        ];
    };
    return {
        get azimuth() {
            return azimuth;
        },
        get elevation() {
            return elevation;
        },
        get distance() {
            return distance;
        },
        get target() {
            return target;
        },
        rotate(deltaAzimuth, deltaElevation) {
            azimuth += deltaAzimuth;
            elevation = clamp(elevation + deltaElevation, minElevation, maxElevation);
        },
        zoom(deltaDistance) {
            distance = clamp(distance + deltaDistance, minDistance, maxDistance);
        },
        orbitFromDrag(deltaX, deltaY) {
            azimuth += deltaX * rotateSpeed;
            elevation = clamp(elevation - deltaY * rotateSpeed, minElevation, maxElevation);
        },
        zoomFromWheel(delta) {
            distance = clamp(distance + delta * zoomSpeed, minDistance, maxDistance);
        },
        eyePosition,
        applyTo(world) {
            const resolved = resolveActiveEntity(world, cameraRef);
            if (!resolved.ok) {
                return false;
            }
            const entity = resolved.entity;
            const eye = eyePosition();
            const rotation = [
                ...quatLookAt(eye, target),
            ];
            if (entity.hasComponent(LocalTransform)) {
                entity.getVectorView(LocalTransform, "translation").set(eye);
                entity.getVectorView(LocalTransform, "rotation").set(rotation);
            }
            else {
                entity.addComponent(LocalTransform, {
                    translation: eye,
                    rotation,
                    scale: [1, 1, 1],
                });
            }
            return true;
        },
    };
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
//# sourceMappingURL=orbit-camera.js.map