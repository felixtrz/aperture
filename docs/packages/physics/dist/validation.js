import { PhysicsRigidBodyType } from "./components.js";
export function validateRigidBodyInput(input) {
    const diagnostics = [];
    if (input.type !== undefined && !isRigidBodyType(input.type)) {
        diagnostics.push({
            code: "aperture.physics.rigidBody.invalidType",
            message: `RigidBody type '${input.type}' is not supported.`,
            data: { type: input.type },
        });
    }
    validateFinite("gravityScale", input.gravityScale, diagnostics);
    validateNonNegative("linearDamping", input.linearDamping, diagnostics);
    validateNonNegative("angularDamping", input.angularDamping, diagnostics);
    return diagnostics;
}
export function validateColliderInput(input) {
    const diagnostics = [];
    validateShape(input.shape, diagnostics);
    validateNonNegative("density", input.density, diagnostics);
    validateNonNegative("friction", input.friction, diagnostics);
    validateNonNegative("restitution", input.restitution, diagnostics);
    validateInt32("collisionGroups", input.collisionGroups, diagnostics);
    validateInt32("solverGroups", input.solverGroups, diagnostics);
    return diagnostics;
}
export function validatePhysicsSceneAssetReferences(document, options = {}) {
    const diagnostics = [];
    for (const entity of document.entities) {
        for (const component of entity.components) {
            if (component.id !== "aperture.physics.collider") {
                continue;
            }
            validateSerializedColliderAssetReferences(entity.id, component.fields, options, diagnostics);
        }
    }
    return diagnostics;
}
export function validatePhysicsJointInput(input) {
    const diagnostics = [];
    validateVector("anchorA", input.anchorA, 3, diagnostics);
    validateVector("anchorB", input.anchorB, 3, diagnostics);
    validateVector("axis", input.axis, 3, diagnostics);
    validateJointFrame("frameA", input.frameA, diagnostics);
    validateJointFrame("frameB", input.frameB, diagnostics);
    validateFinite("minLimit", input.minLimit, diagnostics);
    validateFinite("maxLimit", input.maxLimit, diagnostics);
    validateFinite("motorTarget", input.motorTarget, diagnostics);
    validateFinite("motorVelocity", input.motorVelocity, diagnostics);
    validateNonNegative("motorStiffness", input.motorStiffness, diagnostics);
    validateNonNegative("motorDamping", input.motorDamping, diagnostics);
    validateNonNegative("motorFactor", input.motorFactor, diagnostics);
    validateNonNegative("motorMaxForce", input.motorMaxForce, diagnostics);
    validateNonNegative("breakForce", input.breakForce, diagnostics);
    if (input.minLimit !== undefined &&
        input.maxLimit !== undefined &&
        Number.isFinite(input.minLimit) &&
        Number.isFinite(input.maxLimit) &&
        input.maxLimit < input.minLimit) {
        diagnostics.push({
            code: "aperture.physics.joint.invalidLimitRange",
            message: "Joint maxLimit must be greater than or equal to minLimit.",
            data: { minLimit: input.minLimit, maxLimit: input.maxLimit },
        });
    }
    return diagnostics;
}
export function validatePhysicsCharacterControllerInput(input) {
    const diagnostics = [];
    validateCharacterControllerSettingsInto(input, diagnostics);
    return diagnostics;
}
export function validatePhysicsCharacterMove(input) {
    const diagnostics = [];
    validateNonEmptyString("entity", input.entity, diagnostics);
    validateVector("desiredTranslation", input.desiredTranslation, 3, diagnostics);
    validateCharacterControllerSettingsInto(input.settings, diagnostics);
    return diagnostics;
}
function validateCharacterControllerSettingsInto(input, diagnostics) {
    if (input === undefined) {
        return;
    }
    validatePositiveOptional("offset", input.offset, diagnostics);
    validateVector("up", input.up, 3, diagnostics);
    validateFinite("maxSlopeClimbAngle", input.maxSlopeClimbAngle, diagnostics);
    validateFinite("minSlopeSlideAngle", input.minSlopeSlideAngle, diagnostics);
    validateNonNegative("snapToGroundDistance", input.snapToGroundDistance, diagnostics);
    if (input.characterMass !== null) {
        validateNonNegative("characterMass", input.characterMass, diagnostics);
    }
    if (input.autostep !== undefined && input.autostep !== false) {
        validatePositive("autostep.maxHeight", input.autostep.maxHeight, diagnostics);
        validatePositive("autostep.minWidth", input.autostep.minWidth, diagnostics);
    }
}
function validateShape(shape, diagnostics) {
    if (shape === undefined) {
        return;
    }
    switch (shape.kind) {
        case "box":
            for (const [index, value] of shape.halfExtents.entries()) {
                if (!isPositive(value)) {
                    diagnostics.push({
                        code: "aperture.physics.collider.invalidHalfExtent",
                        message: "Box collider half extents must all be positive finite numbers.",
                        data: { index, value },
                    });
                }
            }
            break;
        case "sphere":
            validatePositive("radius", shape.radius, diagnostics);
            break;
        case "capsule":
        case "cylinder":
        case "cone":
            validatePositive("radius", shape.radius, diagnostics);
            validatePositive("halfHeight", shape.halfHeight, diagnostics);
            break;
        case "convexHull":
        case "trimesh":
            validateNonEmptyString("meshId", shape.meshId, diagnostics);
            break;
        case "heightfield":
            validateNonEmptyString("assetId", shape.assetId, diagnostics);
            break;
        default:
            diagnostics.push({
                code: "aperture.physics.collider.unsupportedShape",
                message: "Collider shape kind is not supported.",
                data: { shape },
            });
    }
}
function validateSerializedColliderAssetReferences(entityId, fields, options, diagnostics) {
    const shapeKind = fields["shapeKind"];
    if (shapeKind === "convexHull" || shapeKind === "trimesh") {
        const meshId = stringField(fields["meshId"]);
        if (meshId === "") {
            diagnostics.push({
                code: "aperture.physics.scene.collider.missingMeshId",
                message: `Serialized ${String(shapeKind)} collider on entity '${entityId}' is missing a meshId.`,
                data: {
                    entityId,
                    component: "aperture.physics.collider",
                    field: "meshId",
                    shapeKind,
                },
            });
            return;
        }
        if (options.meshExists !== undefined && !options.meshExists(meshId)) {
            diagnostics.push({
                code: "aperture.physics.scene.collider.staleMeshId",
                message: `Serialized ${String(shapeKind)} collider on entity '${entityId}' references missing mesh '${meshId}'.`,
                data: {
                    entityId,
                    component: "aperture.physics.collider",
                    field: "meshId",
                    shapeKind,
                    meshId,
                },
            });
        }
    }
    if (shapeKind === "heightfield") {
        const assetId = stringField(fields["heightfieldAssetId"]);
        if (assetId === "") {
            diagnostics.push({
                code: "aperture.physics.scene.collider.missingHeightfieldAssetId",
                message: `Serialized heightfield collider on entity '${entityId}' is missing a heightfieldAssetId.`,
                data: {
                    entityId,
                    component: "aperture.physics.collider",
                    field: "heightfieldAssetId",
                    shapeKind,
                },
            });
            return;
        }
        if (options.heightfieldExists !== undefined &&
            !options.heightfieldExists(assetId)) {
            diagnostics.push({
                code: "aperture.physics.scene.collider.staleHeightfieldAssetId",
                message: `Serialized heightfield collider on entity '${entityId}' references missing heightfield asset '${assetId}'.`,
                data: {
                    entityId,
                    component: "aperture.physics.collider",
                    field: "heightfieldAssetId",
                    shapeKind,
                    assetId,
                },
            });
        }
    }
}
function stringField(value) {
    return typeof value === "string" ? value : "";
}
function validateJointFrame(field, value, diagnostics) {
    if (!validateVector(field, value, 4, diagnostics)) {
        return;
    }
    if (value === undefined) {
        return;
    }
    const length = Math.hypot(value[0] ?? Number.NaN, value[1] ?? Number.NaN, value[2] ?? Number.NaN, value[3] ?? Number.NaN);
    if (length === 0) {
        diagnostics.push({
            code: `aperture.physics.joint.invalid.${field}`,
            message: `${field} must be a non-zero quaternion.`,
            data: { field, value: Array.from(value) },
        });
        return;
    }
    if (Math.abs(length - 1) > 0.001) {
        diagnostics.push({
            code: `aperture.physics.joint.nonUnit.${field}`,
            message: `${field} should be a unit-length quaternion.`,
            data: { field, value: Array.from(value), length },
        });
    }
}
function validateVector(field, value, length, diagnostics) {
    if (value === undefined) {
        return true;
    }
    if (value.length !== length) {
        diagnostics.push({
            code: `aperture.physics.invalid.${field}`,
            message: `${field} must have ${length} numeric components.`,
            data: { field, length: value.length },
        });
        return false;
    }
    let valid = true;
    for (let index = 0; index < length; index += 1) {
        const component = value[index];
        if (!Number.isFinite(component)) {
            diagnostics.push({
                code: `aperture.physics.invalid.${field}`,
                message: `${field} components must be finite numbers.`,
                data: { field, index, value: component },
            });
            valid = false;
        }
    }
    return valid;
}
function validateFinite(field, value, diagnostics) {
    if (value === undefined) {
        return;
    }
    if (!Number.isFinite(value)) {
        diagnostics.push({
            code: `aperture.physics.invalid.${field}`,
            message: `${field} must be a finite number.`,
            data: { field, value },
        });
    }
}
function validatePositive(field, value, diagnostics) {
    if (!isPositive(value)) {
        diagnostics.push({
            code: `aperture.physics.invalid.${field}`,
            message: `${field} must be a positive finite number.`,
            data: { field, value },
        });
    }
}
function validatePositiveOptional(field, value, diagnostics) {
    if (value === undefined) {
        return;
    }
    validatePositive(field, value, diagnostics);
}
function validateNonNegative(field, value, diagnostics) {
    if (value === undefined) {
        return;
    }
    if (!Number.isFinite(value) || value < 0) {
        diagnostics.push({
            code: `aperture.physics.invalid.${field}`,
            message: `${field} must be a finite number greater than or equal to zero.`,
            data: { field, value },
        });
    }
}
function validateInt32(field, value, diagnostics) {
    if (value === undefined) {
        return;
    }
    if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
        diagnostics.push({
            code: `aperture.physics.invalid.${field}`,
            message: `${field} must be a signed 32-bit integer.`,
            data: { field, value },
        });
    }
}
function validateNonEmptyString(field, value, diagnostics) {
    if (value.trim().length === 0) {
        diagnostics.push({
            code: `aperture.physics.invalid.${field}`,
            message: `${field} must be a non-empty string.`,
            data: { field, value },
        });
    }
}
function isRigidBodyType(value) {
    return Object.values(PhysicsRigidBodyType).includes(value);
}
function isPositive(value) {
    return Number.isFinite(value) && value > 0;
}
//# sourceMappingURL=validation.js.map