import { Camera } from "@aperture-engine/render";
import { makeOrthographic, makePerspective, } from "@aperture-engine/simulation";
const projectionFields = [
    "projection",
    "fovYDegrees",
    "near",
    "far",
    "orthographicHeight",
];
const allowedFields = new Set([
    ...projectionFields,
    "key",
    "entity",
    // These select a host session, not the camera or its projection.
    "target",
    "appRoot",
]);
/** Validate the complete Float32 candidate before changing any authored field. */
export function setCameraProjection(camera, payload, viewportAspect) {
    const unknown = Object.keys(payload).filter((field) => !allowedFields.has(field));
    if (unknown.length > 0 ||
        !projectionFields.some((field) => Object.hasOwn(payload, field))) {
        return failure("aperture.camera.projection.invalidPayload", "camera_set_projection requires supported projection fields.", "Use projection, fovYDegrees, near, far or orthographicHeight; FOV values are degrees, not fovYRadians.", { unsupportedFields: unknown.slice(0, 8) });
    }
    const projection = Object.hasOwn(payload, "projection")
        ? payload["projection"]
        : camera.getValue(Camera, "projection");
    if (projection !== "perspective" && projection !== "orthographic") {
        return invalidValue("projection", "Use 'perspective' or 'orthographic'.");
    }
    const numbers = ["fovYDegrees", "near", "far", "orthographicHeight"];
    for (const field of numbers) {
        if (Object.hasOwn(payload, field) && !finite(payload[field])) {
            return invalidValue(field, "Pass a finite number, not a string, null or undefined.");
        }
    }
    if (Object.hasOwn(payload, "fovYDegrees") &&
        (!(payload["fovYDegrees"] > 0) ||
            !(payload["fovYDegrees"] < 180))) {
        return invalidValue("fovYDegrees", "Use degrees strictly between 0 and 180.");
    }
    const fovYRadians = Math.fround(Object.hasOwn(payload, "fovYDegrees")
        ? (payload["fovYDegrees"] * Math.PI) / 180
        : camera.getValue(Camera, "fovYRadians"));
    const near = Math.fround(payload["near"] ?? camera.getValue(Camera, "near"));
    const far = Math.fround(payload["far"] ?? camera.getValue(Camera, "far"));
    const orthographicHeight = Math.fround(payload["orthographicHeight"] ??
        camera.getValue(Camera, "orthographicHeight"));
    if (![fovYRadians, near, far, orthographicHeight].every(finite) ||
        fovYRadians <= 0 ||
        fovYRadians >= Math.PI ||
        near <= 0 ||
        far <= 0 ||
        orthographicHeight <= 0) {
        return failure("aperture.camera.projection.precisionLoss", "The requested projection fields are not valid positive Float32 values.", "Use practical positive near/far/orthographicHeight values and a FOV away from 0 and 180 degrees.");
    }
    if (near >= far) {
        return failure("aperture.camera.projection.invalidClipRange", "The Float32 near plane must be strictly less than the far plane.", "Set near and far together with enough separation to remain distinct after Float32 rounding.");
    }
    const viewport = camera.getVectorView(Camera, "viewport");
    const autoAspect = camera.getValue(Camera, "autoAspect") !== false &&
        (camera.getValue(Camera, "renderTargetId") ?? "").length === 0 &&
        viewportAspect !== undefined;
    const aspect = Math.fround(autoAspect
        ? viewportAspect * ((viewport[2] ?? 1) / (viewport[3] ?? 1))
        : camera.getValue(Camera, "aspect"));
    if (!finite(aspect) || aspect <= 0) {
        return failure("aperture.camera.projection.invalidAspect", "The camera's effective projection aspect is not finite and positive.", "Use a positive camera aspect and nonempty viewport, or restore automatic canvas aspect before setting projection.");
    }
    const matrix = projection === "perspective"
        ? makePerspective(fovYRadians, aspect, near, far)
        : makeOrthographic((-aspect * orthographicHeight) / 2, (aspect * orthographicHeight) / 2, -orthographicHeight / 2, orthographicHeight / 2, near, far);
    const depth = (distance) => (-distance * matrix[10] + matrix[14]) /
        (-distance * matrix[11] + matrix[15]);
    if (![...matrix].every(finite) ||
        matrix[0] === 0 ||
        matrix[5] === 0 ||
        !finite(depth(near)) ||
        !finite(depth(far)) ||
        Math.abs(depth(near)) > 0.00002 ||
        Math.abs(depth(far) - 1) > 0.00002) {
        return failure("aperture.camera.projection.precisionLoss", "The Float32 projection cannot preserve its near and far clip planes.", "Use less extreme FOV, aspect, height or clip distances and separate the near/far planes further.");
    }
    camera.setValue(Camera, "projection", projection);
    camera.setValue(Camera, "fovYRadians", fovYRadians);
    camera.setValue(Camera, "near", near);
    camera.setValue(Camera, "far", far);
    camera.setValue(Camera, "orthographicHeight", orthographicHeight);
    return { ok: true };
}
function finite(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function invalidValue(field, suggestedFix) {
    return failure("aperture.camera.projection.invalidValue", `Projection field '${field}' is invalid.`, suggestedFix, { field });
}
function failure(code, message, suggestedFix, data) {
    return {
        ok: false,
        diagnostics: [
            {
                code,
                severity: "error",
                message,
                suggestedFix,
                ...(data === undefined ? {} : { data }),
            },
        ],
    };
}
//# sourceMappingURL=camera-projection.js.map