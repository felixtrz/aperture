import { LocalTransform, expSmoothingAlpha, lerp, vec3Dot, vec3Normalize, } from "/aperture/worker-modules/packages/simulation/dist/index.js";
import { RenderInterpolation } from "../systems/components.js";
import { quatLookAt } from "../systems/spawn/transforms.js";
export function createFollowCameraController(options) {
    const offset = readVec3(options.offset);
    const basis = createFollowBasis(options);
    const leadFactor = options.leadFactor ?? 0;
    const deadzoneRadius = Math.max(0, options.deadzoneRadius ?? 0);
    const smoothing = Math.max(0, options.smoothing ?? 0);
    const screenShiftUp = options.screenShiftUp ?? 0;
    const enableRenderInterpolation = options.enableRenderInterpolation ?? true;
    let smoothedTarget = readVec3(options.initialTarget ?? [0, 0, 0]);
    let initialized = false;
    const update = (input) => {
        const target = readVec3(input.target);
        const leadVelocity = readVec3(input.leadVelocity ?? [0, 0, 0]);
        const radiusSq = deadzoneRadius * deadzoneRadius;
        let leadX = vec3Dot(leadVelocity, basis.rightAxis) * leadFactor;
        let leadY = vec3Dot(leadVelocity, basis.forwardAxis) * leadFactor;
        const leadLenSq = leadX * leadX + leadY * leadY;
        if (leadLenSq > radiusSq) {
            const k = deadzoneRadius / Math.sqrt(leadLenSq);
            leadX *= k;
            leadY *= k;
        }
        const desiredTarget = [
            target[0] + basis.rightAxis[0] * leadX + basis.forwardAxis[0] * leadY,
            target[1] + basis.rightAxis[1] * leadX + basis.forwardAxis[1] * leadY,
            target[2] + basis.rightAxis[2] * leadX + basis.forwardAxis[2] * leadY,
        ];
        const alpha = initialized && smoothing > 0
            ? expSmoothingAlpha(input.delta, smoothing)
            : 1;
        smoothedTarget = [
            lerp(smoothedTarget[0], desiredTarget[0], alpha),
            lerp(smoothedTarget[1], desiredTarget[1], alpha),
            lerp(smoothedTarget[2], desiredTarget[2], alpha),
        ];
        initialized = true;
        const dx = target[0] - smoothedTarget[0];
        const dy = target[1] - smoothedTarget[1];
        const dz = target[2] - smoothedTarget[2];
        const delta3 = [dx, dy, dz];
        const offX = vec3Dot(delta3, basis.rightAxis);
        const offY = vec3Dot(delta3, basis.forwardAxis);
        const offLenSq = offX * offX + offY * offY;
        if (offLenSq > radiusSq) {
            const offLen = Math.sqrt(offLenSq);
            const k = (offLen - deadzoneRadius) / offLen;
            smoothedTarget = [
                smoothedTarget[0] +
                    basis.rightAxis[0] * offX * k +
                    basis.forwardAxis[0] * offY * k,
                smoothedTarget[1] +
                    basis.rightAxis[1] * offX * k +
                    basis.forwardAxis[1] * offY * k,
                smoothedTarget[2] +
                    basis.rightAxis[2] * offX * k +
                    basis.forwardAxis[2] * offY * k,
            ];
        }
        const lookPoint = [
            smoothedTarget[0] - basis.forwardAxis[0] * screenShiftUp,
            smoothedTarget[1] - basis.forwardAxis[1] * screenShiftUp,
            smoothedTarget[2] - basis.forwardAxis[2] * screenShiftUp,
        ];
        const eye = [
            lookPoint[0] + offset[0],
            lookPoint[1] + offset[1],
            lookPoint[2] + offset[2],
        ];
        const rotation = [...quatLookAt(eye, lookPoint)];
        return {
            target,
            desiredTarget,
            smoothedTarget: copyVec3(smoothedTarget),
            lookPoint,
            eye,
            rotation,
            lead: [leadX, leadY],
        };
    };
    return {
        get smoothedTarget() {
            return copyVec3(smoothedTarget);
        },
        get rightAxis() {
            return copyVec3(basis.rightAxis);
        },
        get forwardAxis() {
            return copyVec3(basis.forwardAxis);
        },
        reset(target = options.initialTarget ?? [0, 0, 0]) {
            smoothedTarget = readVec3(target);
            initialized = false;
        },
        update,
        writeTo(camera, input) {
            const pose = update(input);
            writeFollowCameraPose(camera, pose, { enableRenderInterpolation });
            return pose;
        },
    };
}
export function writeFollowCameraPose(camera, pose, options = {}) {
    if (camera.hasComponent(LocalTransform)) {
        camera.getVectorView(LocalTransform, "translation").set(pose.eye);
        camera.getVectorView(LocalTransform, "rotation").set(pose.rotation);
    }
    else {
        camera.addComponent(LocalTransform, {
            translation: pose.eye,
            rotation: pose.rotation,
            scale: [1, 1, 1],
        });
    }
    if (options.enableRenderInterpolation !== false &&
        !camera.hasComponent(RenderInterpolation)) {
        camera.addComponent(RenderInterpolation);
    }
}
function createFollowBasis(options) {
    const offset = readVec3(options.offset);
    const right = options.rightAxis ?? [offset[2], 0, -offset[0]];
    const forward = options.forwardAxis ?? [-offset[0], 0, -offset[2]];
    return {
        rightAxis: normalizeOr(readVec3(right), [1, 0, 0]),
        forwardAxis: normalizeOr(readVec3(forward), [0, 0, -1]),
    };
}
function normalizeOr(value, fallback) {
    const sourceLength = Math.hypot(value[0], value[1], value[2]);
    if (sourceLength <= 1e-6) {
        return fallback;
    }
    const normalized = vec3Normalize(value);
    const length = Math.hypot(normalized[0], normalized[1], normalized[2]);
    if (length <= 1e-6) {
        return fallback;
    }
    return copyVec3(normalized);
}
function readVec3(value) {
    return [read(value, 0), read(value, 1), read(value, 2)];
}
function copyVec3(value) {
    return [read(value, 0), read(value, 1), read(value, 2)];
}
function read(value, index) {
    const item = value[index];
    if (item === undefined) {
        throw new RangeError(`Expected numeric value at index ${index}.`);
    }
    return item;
}
//# sourceMappingURL=follow-camera.js.map