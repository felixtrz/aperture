import { Camera } from "/aperture/worker-modules/packages/render/dist/index.js";
import { AppEntityKey, LocalTransform, Name, WorldTransform, } from "../../systems.js";
import { entityRefFromValue } from "./entities.js";
import { degreesToRadians, isRecord, jsonSafeRecord, numberFromValue, stringFromValue, tuple3FromValue, tuple3FromView, tuple4FromValue, tuple4FromView, } from "../payload.js";
export function callCameraTool(app, request, savedCameraStates) {
    const payload = isRecord(request.payload) ? request.payload : {};
    if (request.tool === "camera_list") {
        return {
            ok: true,
            result: cameraEntities(app.lowLevel.world).map(cameraSummary),
        };
    }
    if (request.tool === "camera_create_agent") {
        const key = stringFromValue(payload["key"]) ?? "camera.agent";
        const existing = cameraEntityByKey(app.lowLevel.world, key);
        const entity = existing ??
            app.context.spawn.camera({
                key,
                name: "Agent Camera",
                transform: {
                    translation: tuple3FromValue(payload["translation"]) ?? [0, 1.5, 5],
                    lookAt: tuple3FromValue(payload["lookAt"]) ?? [0, 0, 0],
                },
                camera: {
                    priority: 10_000,
                    clearColor: [0.03, 0.035, 0.04, 1],
                },
            });
        return { ok: true, result: cameraSummary(entity) };
    }
    const entity = resolveCameraEntity(app.lowLevel.world, payload);
    if (entity === null) {
        return {
            ok: false,
            diagnostics: [
                {
                    code: "aperture.camera.notFound",
                    severity: "error",
                    message: "No matching camera entity was found.",
                    data: jsonSafeRecord(payload),
                    suggestedFix: "Pass a camera key/entity reference, or call camera_create_agent first.",
                },
            ],
        };
    }
    if (request.tool === "camera_get") {
        return { ok: true, result: cameraSummary(entity) };
    }
    if (request.tool === "camera_save") {
        const slot = stringFromValue(payload["slot"]) ?? "default";
        const state = cameraState(entity);
        savedCameraStates.set(slot, state);
        return { ok: true, result: { slot, state } };
    }
    if (request.tool === "camera_restore") {
        const slot = stringFromValue(payload["slot"]) ?? "default";
        const state = savedCameraStates.get(slot);
        if (state === undefined) {
            return {
                ok: false,
                diagnostics: [
                    {
                        code: "aperture.camera.savedStateMissing",
                        severity: "error",
                        message: `No saved camera state exists in slot '${slot}'.`,
                        data: { slot },
                        suggestedFix: "Call camera_save before camera_restore.",
                    },
                ],
            };
        }
        restoreCameraState(entity, state);
        return { ok: true, result: cameraSummary(entity) };
    }
    if (request.tool === "camera_set_transform") {
        setCameraTransform(entity, payload);
        return { ok: true, result: cameraSummary(entity) };
    }
    if (request.tool === "camera_look_at") {
        const translation = tuple3FromValue(payload["translation"]) ??
            cameraState(entity).localTransform?.translation ?? [0, 1.5, 5];
        const target = tuple3FromValue(payload["target"]) ?? [0, 0, 0];
        setCameraTransform(entity, {
            translation,
            rotation: quatLookAt(translation, target),
        });
        return { ok: true, result: cameraSummary(entity) };
    }
    if (request.tool === "camera_orbit" || request.tool === "camera_fit_entity") {
        const targetReport = request.tool === "camera_fit_entity"
            ? cameraFitTarget(app.lowLevel.world, payload)
            : {
                ok: true,
                target: cameraOrbitTarget(app.lowLevel.world, payload),
            };
        if (!targetReport.ok) {
            return targetReport;
        }
        const target = targetReport.target;
        const radius = numberFromValue(payload["radius"]) ?? 5;
        const yaw = degreesToRadians(numberFromValue(payload["yawDegrees"]) ?? 35);
        const pitch = degreesToRadians(numberFromValue(payload["pitchDegrees"]) ?? 20);
        const translation = orbitPosition(target, radius, yaw, pitch);
        setCameraTransform(entity, {
            translation,
            rotation: quatLookAt(translation, target),
        });
        return { ok: true, result: cameraSummary(entity) };
    }
    if (request.tool === "camera_use_agent_view") {
        entity.setValue(Camera, "priority", 10_000);
        entity.setValue(Camera, "renderTargetId", "");
        entity.getVectorView(Camera, "viewport").set([0, 0, 1, 1]);
        entity.getVectorView(Camera, "scissor").set([0, 0, 1, 1]);
        return { ok: true, result: cameraSummary(entity) };
    }
    return {
        ok: false,
        diagnostics: [
            {
                code: "aperture.camera.unsupportedTool",
                severity: "error",
                message: `Unsupported camera tool '${request.tool}'.`,
                data: { tool: request.tool },
                suggestedFix: "Use one of the registered Aperture camera tools.",
            },
        ],
    };
}
function cameraEntities(world) {
    return [...world.queryManager.registerQuery({ required: [Camera] }).entities]
        .filter((entity) => entity.active)
        .sort((a, b) => a.index - b.index || a.generation - b.generation);
}
function cameraEntityByKey(world, key) {
    return (cameraEntities(world).find((entity) => entity.hasComponent(AppEntityKey) &&
        entity.getValue(AppEntityKey, "value") === key) ?? null);
}
function resolveCameraEntity(world, payload) {
    const key = stringFromValue(payload["key"]);
    if (key !== undefined) {
        return cameraEntityByKey(world, key);
    }
    const ref = entityRefFromValue(payload["entity"] ?? payload);
    if (ref !== null) {
        const entity = world.entityManager.getEntityByIndex(ref.index);
        return entity !== null &&
            entity.active &&
            entity.generation === ref.generation &&
            entity.hasComponent(Camera)
            ? entity
            : null;
    }
    return cameraEntities(world)[0] ?? null;
}
function cameraSummary(entity) {
    return {
        entity: { index: entity.index, generation: entity.generation },
        key: entity.hasComponent(AppEntityKey)
            ? entity.getValue(AppEntityKey, "value")
            : null,
        name: entity.hasComponent(Name)
            ? entity.getValue(Name, "value")
            : `Camera ${entity.index}`,
        camera: cameraComponentState(entity),
        localTransform: entity.hasComponent(LocalTransform)
            ? {
                translation: tuple3FromView(entity.getVectorView(LocalTransform, "translation")),
                rotation: tuple4FromView(entity.getVectorView(LocalTransform, "rotation")),
                scale: tuple3FromView(entity.getVectorView(LocalTransform, "scale")),
            }
            : null,
        worldTransform: entity.hasComponent(WorldTransform)
            ? {
                col0: tuple4FromView(entity.getVectorView(WorldTransform, "col0")),
                col1: tuple4FromView(entity.getVectorView(WorldTransform, "col1")),
                col2: tuple4FromView(entity.getVectorView(WorldTransform, "col2")),
                col3: tuple4FromView(entity.getVectorView(WorldTransform, "col3")),
            }
            : null,
    };
}
function cameraState(entity) {
    return {
        entity: { index: entity.index, generation: entity.generation },
        camera: cameraComponentState(entity),
        localTransform: entity.hasComponent(LocalTransform)
            ? {
                translation: tuple3FromView(entity.getVectorView(LocalTransform, "translation")),
                rotation: tuple4FromView(entity.getVectorView(LocalTransform, "rotation")),
                scale: tuple3FromView(entity.getVectorView(LocalTransform, "scale")),
            }
            : null,
    };
}
function cameraComponentState(entity) {
    const fields = {};
    for (const field of Object.keys(Camera.schema)) {
        if (field === "viewport" || field === "scissor" || field === "clearColor") {
            fields[field] = tuple4FromView(entity.getVectorView(Camera, field));
            continue;
        }
        fields[field] = entity.getValue(Camera, field);
    }
    return fields;
}
function restoreCameraState(entity, state) {
    for (const [field, value] of Object.entries(state.camera)) {
        if (field === "viewport" || field === "scissor" || field === "clearColor") {
            if (Array.isArray(value)) {
                entity.getVectorView(Camera, field).set(value);
            }
            continue;
        }
        entity.setValue(Camera, field, value);
    }
    if (state.localTransform !== null) {
        setCameraTransform(entity, state.localTransform);
    }
}
function setCameraTransform(entity, payload) {
    if (!entity.hasComponent(LocalTransform)) {
        entity.addComponent(LocalTransform);
    }
    const translation = tuple3FromValue(payload["translation"]);
    const rotation = tuple4FromValue(payload["rotation"]);
    const scale = tuple3FromValue(payload["scale"]);
    if (translation !== null) {
        entity.getVectorView(LocalTransform, "translation").set(translation);
    }
    if (rotation !== null) {
        entity.getVectorView(LocalTransform, "rotation").set(rotation);
    }
    if (scale !== null) {
        entity.getVectorView(LocalTransform, "scale").set(scale);
    }
}
function cameraOrbitTarget(world, payload) {
    const explicit = tuple3FromValue(payload["target"]);
    if (explicit !== null) {
        return explicit;
    }
    const entity = entityRefFromValue(payload["entity"]);
    if (entity !== null) {
        const target = world.entityManager.getEntityByIndex(entity.index);
        if (target !== null &&
            target.active &&
            target.generation === entity.generation &&
            target.hasComponent(WorldTransform)) {
            const col3 = target.getVectorView(WorldTransform, "col3");
            return [col3[0] ?? 0, col3[1] ?? 0, col3[2] ?? 0];
        }
    }
    return [0, 0, 0];
}
function cameraFitTarget(world, payload) {
    const explicit = tuple3FromValue(payload["target"]);
    if (explicit !== null) {
        return { ok: true, target: explicit };
    }
    const ref = entityRefFromValue(payload["entity"]);
    if (ref === null) {
        return { ok: true, target: [0, 0, 0] };
    }
    const entity = world.entityManager.getEntityByIndex(ref.index);
    if (entity === null ||
        !entity.active ||
        entity.generation !== ref.generation) {
        return {
            ok: false,
            diagnostics: [
                {
                    code: "aperture.camera.targetNotFound",
                    severity: "error",
                    message: "The requested camera fit target entity was not found.",
                    data: { entity: ref },
                    suggestedFix: "Call ecs_find_entities first, then pass a current entity reference to camera_fit_entity.",
                },
            ],
        };
    }
    if (!entity.hasComponent(WorldTransform)) {
        return {
            ok: false,
            diagnostics: [
                {
                    code: "aperture.camera.targetMissingWorldTransform",
                    severity: "error",
                    message: "The requested camera fit target does not have a WorldTransform component.",
                    data: { entity: ref },
                    suggestedFix: "Fit an entity with transform data, or pass an explicit target vector.",
                },
            ],
        };
    }
    const col3 = entity.getVectorView(WorldTransform, "col3");
    return { ok: true, target: [col3[0] ?? 0, col3[1] ?? 0, col3[2] ?? 0] };
}
function orbitPosition(target, radius, yaw, pitch) {
    const clampedRadius = Math.max(0.1, radius);
    const x = target[0] + clampedRadius * Math.cos(pitch) * Math.sin(yaw);
    const y = target[1] + clampedRadius * Math.sin(pitch);
    const z = target[2] + clampedRadius * Math.cos(pitch) * Math.cos(yaw);
    return [x, y, z];
}
function quatLookAt(eye, target) {
    const dx = target[0] - eye[0];
    const dy = target[1] - eye[1];
    const dz = target[2] - eye[2];
    const yaw = Math.atan2(dx, dz);
    const distance = Math.max(0.0001, Math.hypot(dx, dz));
    const pitch = -Math.atan2(dy, distance);
    return quatFromEuler(pitch, yaw, 0);
}
function quatFromEuler(x, y, z) {
    const sx = Math.sin(x / 2);
    const cx = Math.cos(x / 2);
    const sy = Math.sin(y / 2);
    const cy = Math.cos(y / 2);
    const sz = Math.sin(z / 2);
    const cz = Math.cos(z / 2);
    return [
        sx * cy * cz + cx * sy * sz,
        cx * sy * cz - sx * cy * sz,
        cx * cy * sz + sx * sy * cz,
        cx * cy * cz - sx * sy * sz,
    ];
}
//# sourceMappingURL=camera.js.map