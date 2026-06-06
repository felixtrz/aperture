import {
  LocalTransform,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import {
  Collider,
  ExternalForce,
  ExternalImpulse,
  KinematicTarget,
  PhysicsCharacterController,
  PhysicsCharacterMassMode,
  PhysicsColliderAxis,
  PhysicsColliderShapeKind,
  PhysicsDebug,
  PhysicsGravity,
  PhysicsJoint,
  PhysicsJointKind,
  PhysicsJointMotorMode,
  PhysicsJointMotorModel,
  PhysicsMaterial,
  PhysicsMaterialCombineRule,
  PhysicsRigidBodyType,
  PhysicsVelocity,
  RigidBody,
} from "@aperture-engine/physics";
import { entitySummary, jsonSafeValue } from "./summary.js";
import { resolveActiveEntity } from "./resolve.js";
import type {
  ApertureEntityLookupDiagnostic,
  ApertureEntitySetComponentFieldReport,
  ApertureEntitySetComponentFieldRequest,
} from "./types.js";
import { DebugMetadata } from "../../systems.js";
import { tuple3FromValue, tuple4FromValue } from "../../worker/payload.js";

export function setApertureEntityComponentField(
  world: EcsWorld,
  request: ApertureEntitySetComponentFieldRequest,
): ApertureEntitySetComponentFieldReport {
  const resolved = resolveActiveEntity(world, request.entity);

  if (!resolved.ok) {
    return resolved;
  }

  const mutation = componentFieldMutations[request.component];

  if (mutation === undefined) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.entityLookup.componentMutationUnsupported",
        severity: "error",
        message: `Component '${request.component}' is not mutable through the developer entity helper.`,
        data: { component: request.component, entity: request.entity },
        suggestedFix:
          "Use an explicit app system or add a narrow whitelist entry for this component field before mutating it from tooling.",
      },
    };
  }

  const setField = mutation[request.field];

  if (setField === undefined) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.entityLookup.componentFieldUnsupported",
        severity: "error",
        message: `Field '${request.field}' on component '${request.component}' is not mutable through the developer entity helper.`,
        data: {
          component: request.component,
          field: request.field,
          entity: request.entity,
        },
        suggestedFix:
          "Use one of the whitelisted fields or add a focused mutation helper for this component field.",
      },
    };
  }

  const diagnostic = setField(resolved.entity, request);

  if (diagnostic !== null) {
    return { ok: false, diagnostic };
  }

  return {
    ok: true,
    component: request.component,
    field: request.field,
    value: jsonSafeValue(request.value),
    summary: entitySummary(resolved.entity),
  };
}

type ComponentFieldMutation = (
  entity: Entity,
  request: ApertureEntitySetComponentFieldRequest,
) => ApertureEntityLookupDiagnostic | null;

const componentFieldMutations: Readonly<
  Record<string, Readonly<Record<string, ComponentFieldMutation>>>
> = {
  [DebugMetadata.id]: {
    tag: setDebugMetadataStringField("tag"),
    note: setDebugMetadataStringField("note"),
  },
  [LocalTransform.id]: {
    translation: setLocalTransformVec3Field("translation"),
    rotation: setLocalTransformRotationField(),
    scale: setLocalTransformVec3Field("scale"),
  },
  [RigidBody.id]: {
    enabled: setRigidBodyBooleanField("enabled"),
    type: setRigidBodyTypeField(),
    gravityScale: setRigidBodyNumberField("gravityScale"),
    linearDamping: setRigidBodyNumberField("linearDamping", {
      nonNegative: true,
    }),
    angularDamping: setRigidBodyNumberField("angularDamping", {
      nonNegative: true,
    }),
    canSleep: setRigidBodyBooleanField("canSleep"),
    ccdEnabled: setRigidBodyBooleanField("ccdEnabled"),
    lockTranslationX: setRigidBodyBooleanField("lockTranslationX"),
    lockTranslationY: setRigidBodyBooleanField("lockTranslationY"),
    lockTranslationZ: setRigidBodyBooleanField("lockTranslationZ"),
    lockRotationX: setRigidBodyBooleanField("lockRotationX"),
    lockRotationY: setRigidBodyBooleanField("lockRotationY"),
    lockRotationZ: setRigidBodyBooleanField("lockRotationZ"),
  },
  [Collider.id]: {
    enabled: setColliderBooleanField("enabled"),
    shapeKind: setColliderShapeKindField(),
    halfExtents: setColliderVec3Field("halfExtents", { positive: true }),
    radius: setColliderNumberField("radius", { positive: true }),
    halfHeight: setColliderNumberField("halfHeight", { positive: true }),
    axis: setColliderAxisField(),
    meshId: setColliderStringField("meshId"),
    heightfieldAssetId: setColliderStringField("heightfieldAssetId"),
    offsetTranslation: setColliderVec3Field("offsetTranslation"),
    offsetRotation: setColliderRotationField(),
    sensor: setColliderBooleanField("sensor"),
    density: setColliderNumberField("density", { nonNegative: true }),
    friction: setColliderNumberField("friction", { nonNegative: true }),
    restitution: setColliderNumberField("restitution", { nonNegative: true }),
    collisionGroups: setColliderInt32Field("collisionGroups"),
    solverGroups: setColliderInt32Field("solverGroups"),
  },
  [PhysicsVelocity.id]: {
    linear: setPhysicsVelocityVec3Field("linear"),
    angular: setPhysicsVelocityVec3Field("angular"),
  },
  [ExternalForce.id]: {
    force: setExternalForceVec3Field("force"),
    torque: setExternalForceVec3Field("torque"),
  },
  [ExternalImpulse.id]: {
    impulse: setExternalImpulseVec3Field("impulse"),
    angularImpulse: setExternalImpulseVec3Field("angularImpulse"),
  },
  [KinematicTarget.id]: {
    enabled: setKinematicTargetBooleanField("enabled"),
    translation: setKinematicTargetVec3Field("translation"),
    rotation: setKinematicTargetRotationField(),
  },
  [PhysicsGravity.id]: {
    gravity: setPhysicsGravityVec3Field(),
  },
  [PhysicsCharacterController.id]: {
    enabled: setPhysicsCharacterControllerBooleanField("enabled"),
    offset: setPhysicsCharacterControllerNumberField("offset", {
      positive: true,
    }),
    up: setPhysicsCharacterControllerVec3Field("up"),
    slide: setPhysicsCharacterControllerBooleanField("slide"),
    maxSlopeClimbAngleEnabled: setPhysicsCharacterControllerBooleanField(
      "maxSlopeClimbAngleEnabled",
    ),
    maxSlopeClimbAngle:
      setPhysicsCharacterControllerNumberField("maxSlopeClimbAngle"),
    minSlopeSlideAngleEnabled: setPhysicsCharacterControllerBooleanField(
      "minSlopeSlideAngleEnabled",
    ),
    minSlopeSlideAngle:
      setPhysicsCharacterControllerNumberField("minSlopeSlideAngle"),
    snapToGroundDistance: setPhysicsCharacterControllerNumberField(
      "snapToGroundDistance",
      { nonNegative: true },
    ),
    autostepEnabled:
      setPhysicsCharacterControllerBooleanField("autostepEnabled"),
    autostepMaxHeight: setPhysicsCharacterControllerNumberField(
      "autostepMaxHeight",
      { positive: true },
    ),
    autostepMinWidth: setPhysicsCharacterControllerNumberField(
      "autostepMinWidth",
      { positive: true },
    ),
    autostepIncludeDynamicBodies: setPhysicsCharacterControllerBooleanField(
      "autostepIncludeDynamicBodies",
    ),
    applyImpulsesToDynamicBodies: setPhysicsCharacterControllerBooleanField(
      "applyImpulsesToDynamicBodies",
    ),
    characterMassMode: setPhysicsCharacterControllerMassModeField(),
    characterMass: setPhysicsCharacterControllerNumberField("characterMass", {
      nonNegative: true,
    }),
  },
  [PhysicsMaterial.id]: {
    friction: setPhysicsMaterialNumberField("friction", {
      nonNegative: true,
    }),
    restitution: setPhysicsMaterialNumberField("restitution", {
      nonNegative: true,
    }),
    density: setPhysicsMaterialNumberField("density", {
      nonNegative: true,
    }),
    frictionCombine: setPhysicsMaterialCombineRuleField("frictionCombine"),
    restitutionCombine:
      setPhysicsMaterialCombineRuleField("restitutionCombine"),
  },
  [PhysicsDebug.id]: {
    colliderWireframes: setPhysicsDebugBooleanField("colliderWireframes"),
    contactNormals: setPhysicsDebugBooleanField("contactNormals"),
    bodyStateMarkers: setPhysicsDebugBooleanField("bodyStateMarkers"),
    broadphaseAabbs: setPhysicsDebugBooleanField("broadphaseAabbs"),
    jointFrames: setPhysicsDebugBooleanField("jointFrames"),
  },
  [PhysicsJoint.id]: {
    enabled: setPhysicsJointBooleanField("enabled"),
    kind: setPhysicsJointEnumField("kind", PhysicsJointKind),
    bodyARef: setPhysicsJointStringField("bodyARef"),
    bodyBRef: setPhysicsJointStringField("bodyBRef"),
    anchorA: setPhysicsJointVec3Field("anchorA"),
    anchorB: setPhysicsJointVec3Field("anchorB"),
    frameA: setPhysicsJointRotationField("frameA"),
    frameB: setPhysicsJointRotationField("frameB"),
    axis: setPhysicsJointVec3Field("axis"),
    minLimit: setPhysicsJointNumberField("minLimit"),
    maxLimit: setPhysicsJointNumberField("maxLimit"),
    motorMode: setPhysicsJointEnumField("motorMode", PhysicsJointMotorMode),
    motorModel: setPhysicsJointEnumField("motorModel", PhysicsJointMotorModel),
    motorTarget: setPhysicsJointNumberField("motorTarget"),
    motorVelocity: setPhysicsJointNumberField("motorVelocity"),
    motorStiffness: setPhysicsJointNumberField("motorStiffness", {
      nonNegative: true,
    }),
    motorDamping: setPhysicsJointNumberField("motorDamping", {
      nonNegative: true,
    }),
    motorFactor: setPhysicsJointNumberField("motorFactor", {
      nonNegative: true,
    }),
    motorMaxForce: setPhysicsJointNumberField("motorMaxForce", {
      nonNegative: true,
    }),
    contactsEnabled: setPhysicsJointBooleanField("contactsEnabled"),
    breakForce: setPhysicsJointNumberField("breakForce", {
      nonNegative: true,
    }),
  },
};

function setDebugMetadataStringField(
  field: "tag" | "note",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(DebugMetadata)) {
      return {
        code: "aperture.entityLookup.componentMissing",
        severity: "error",
        message: `Entity ${entity.index} does not have component '${DebugMetadata.id}'.`,
        data: {
          entity: request.entity,
          component: DebugMetadata.id,
          field,
        },
        suggestedFix:
          "Find an entity with the requested component, or add the component from an app system before mutating its field.",
      };
    }

    if (typeof request.value !== "string") {
      return {
        code: "aperture.entityLookup.invalidComponentFieldValue",
        severity: "error",
        message: `Field '${field}' on component '${DebugMetadata.id}' requires a string value.`,
        data: {
          entity: request.entity,
          component: DebugMetadata.id,
          field,
          valueType: typeof request.value,
        },
        suggestedFix: "Pass a string value for this component field.",
      };
    }

    entity.setValue(DebugMetadata, field, request.value);
    return null;
  };
}

function setRigidBodyBooleanField(
  field:
    | "enabled"
    | "canSleep"
    | "ccdEnabled"
    | "lockTranslationX"
    | "lockTranslationY"
    | "lockTranslationZ"
    | "lockRotationX"
    | "lockRotationY"
    | "lockRotationZ",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(RigidBody)) {
      return missingRigidBodyDiagnostic(entity, request, field);
    }

    if (typeof request.value !== "boolean") {
      return invalidComponentFieldValueDiagnostic(
        request,
        RigidBody.id,
        field,
        "a boolean value",
        "Pass a boolean value for this rigid body field.",
      );
    }

    entity.setValue(RigidBody, field, request.value);
    return null;
  };
}

function setRigidBodyTypeField(): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(RigidBody)) {
      return missingRigidBodyDiagnostic(entity, request, "type");
    }

    if (
      typeof request.value !== "string" ||
      !stringValueIn(request.value, PhysicsRigidBodyType)
    ) {
      return invalidComponentFieldValueDiagnostic(
        request,
        RigidBody.id,
        "type",
        `one of ${Object.values(PhysicsRigidBodyType).join(", ")}`,
        `Pass one of: ${Object.values(PhysicsRigidBodyType).join(", ")}.`,
      );
    }

    entity.setValue(RigidBody, "type", request.value);
    return null;
  };
}

function setRigidBodyNumberField(
  field: "gravityScale" | "linearDamping" | "angularDamping",
  options: { readonly nonNegative?: boolean } = {},
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(RigidBody)) {
      return missingRigidBodyDiagnostic(entity, request, field);
    }

    if (!validNumber(request.value, options)) {
      return invalidFiniteNumberDiagnostic(
        request,
        RigidBody.id,
        field,
        options,
      );
    }

    entity.setValue(RigidBody, field, request.value);
    return null;
  };
}

function setColliderBooleanField(
  field: "enabled" | "sensor",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(Collider)) {
      return missingColliderDiagnostic(entity, request, field);
    }

    if (typeof request.value !== "boolean") {
      return invalidComponentFieldValueDiagnostic(
        request,
        Collider.id,
        field,
        "a boolean value",
        "Pass a boolean value for this collider field.",
      );
    }

    entity.setValue(Collider, field, request.value);
    return null;
  };
}

function setColliderShapeKindField(): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(Collider)) {
      return missingColliderDiagnostic(entity, request, "shapeKind");
    }

    if (
      typeof request.value !== "string" ||
      !stringValueIn(request.value, PhysicsColliderShapeKind)
    ) {
      return invalidComponentFieldValueDiagnostic(
        request,
        Collider.id,
        "shapeKind",
        `one of ${Object.values(PhysicsColliderShapeKind).join(", ")}`,
        `Pass one of: ${Object.values(PhysicsColliderShapeKind).join(", ")}.`,
      );
    }

    entity.setValue(Collider, "shapeKind", request.value);
    return null;
  };
}

function setColliderAxisField(): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(Collider)) {
      return missingColliderDiagnostic(entity, request, "axis");
    }

    if (
      typeof request.value !== "string" ||
      !stringValueIn(request.value, PhysicsColliderAxis)
    ) {
      return invalidComponentFieldValueDiagnostic(
        request,
        Collider.id,
        "axis",
        `one of ${Object.values(PhysicsColliderAxis).join(", ")}`,
        `Pass one of: ${Object.values(PhysicsColliderAxis).join(", ")}.`,
      );
    }

    entity.setValue(Collider, "axis", request.value);
    return null;
  };
}

function setColliderStringField(
  field: "meshId" | "heightfieldAssetId",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(Collider)) {
      return missingColliderDiagnostic(entity, request, field);
    }

    if (typeof request.value !== "string") {
      return invalidComponentFieldValueDiagnostic(
        request,
        Collider.id,
        field,
        "a string value",
        "Pass a string value for this collider field.",
      );
    }

    entity.setValue(Collider, field, request.value);
    return null;
  };
}

function setColliderVec3Field(
  field: "halfExtents" | "offsetTranslation",
  options: { readonly positive?: boolean } = {},
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(Collider)) {
      return missingColliderDiagnostic(entity, request, field);
    }

    const value = tuple3FromValue(request.value);

    if (
      value === null ||
      (options.positive === true && value.some((entry) => entry <= 0))
    ) {
      return invalidComponentFieldValueDiagnostic(
        request,
        Collider.id,
        field,
        options.positive === true
          ? "a finite [x, y, z] tuple with values greater than zero"
          : "a finite [x, y, z] number tuple",
        options.positive === true
          ? "Pass a three-number array with positive values, for example { value: [0.5, 0.5, 0.5] }."
          : "Pass a three-number array, for example { value: [0, 0, 0] }.",
      );
    }

    entity.getVectorView(Collider, field).set(value);
    return null;
  };
}

function setColliderRotationField(): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(Collider)) {
      return missingColliderDiagnostic(entity, request, "offsetRotation");
    }

    const value = tuple4FromValue(request.value);

    if (value === null || !isUsableQuaternion(value)) {
      return invalidComponentFieldValueDiagnostic(
        request,
        Collider.id,
        "offsetRotation",
        "a finite, nonzero [x, y, z, w] quaternion tuple",
        "Pass a finite quaternion tuple, for example { value: [0, 0, 0, 1] }.",
      );
    }

    entity.getVectorView(Collider, "offsetRotation").set(value);
    return null;
  };
}

function setColliderNumberField(
  field: "radius" | "halfHeight" | "density" | "friction" | "restitution",
  options: { readonly positive?: boolean; readonly nonNegative?: boolean } = {},
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(Collider)) {
      return missingColliderDiagnostic(entity, request, field);
    }

    if (!validNumber(request.value, options)) {
      return invalidFiniteNumberDiagnostic(
        request,
        Collider.id,
        field,
        options,
      );
    }

    entity.setValue(Collider, field, request.value);
    return null;
  };
}

function setColliderInt32Field(
  field: "collisionGroups" | "solverGroups",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(Collider)) {
      return missingColliderDiagnostic(entity, request, field);
    }

    if (
      typeof request.value !== "number" ||
      !Number.isInteger(request.value) ||
      request.value < -2147483648 ||
      request.value > 2147483647
    ) {
      return invalidComponentFieldValueDiagnostic(
        request,
        Collider.id,
        field,
        "a signed 32-bit integer",
        "Pass a signed 32-bit integer collision group mask.",
      );
    }

    entity.setValue(Collider, field, request.value);
    return null;
  };
}

function setPhysicsVelocityVec3Field(
  field: "linear" | "angular",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(PhysicsVelocity)) {
      return {
        code: "aperture.entityLookup.componentMissing",
        severity: "error",
        message: `Entity ${entity.index} does not have component '${PhysicsVelocity.id}'.`,
        data: {
          entity: request.entity,
          component: PhysicsVelocity.id,
          field,
        },
        suggestedFix:
          "Find an entity with PhysicsVelocity, or add the component from an app system before mutating its velocity.",
      };
    }

    const value = tuple3FromValue(request.value);

    if (value === null) {
      return {
        code: "aperture.entityLookup.invalidComponentFieldValue",
        severity: "error",
        message: `Field '${field}' on component '${PhysicsVelocity.id}' requires a finite [x, y, z] number tuple.`,
        data: {
          entity: request.entity,
          component: PhysicsVelocity.id,
          field,
          value: jsonSafeValue(request.value),
        },
        suggestedFix:
          "Pass a three-number array, for example { value: [0, 1, 0] }.",
      };
    }

    entity.getVectorView(PhysicsVelocity, field).set(value);
    return null;
  };
}

function setExternalForceVec3Field(
  field: "force" | "torque",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(ExternalForce)) {
      return {
        code: "aperture.entityLookup.componentMissing",
        severity: "error",
        message: `Entity ${entity.index} does not have component '${ExternalForce.id}'.`,
        data: {
          entity: request.entity,
          component: ExternalForce.id,
          field,
        },
        suggestedFix:
          "Find an entity with ExternalForce, or add the component from an app system before mutating its force command.",
      };
    }

    const value = tuple3FromValue(request.value);

    if (value === null) {
      return {
        code: "aperture.entityLookup.invalidComponentFieldValue",
        severity: "error",
        message: `Field '${field}' on component '${ExternalForce.id}' requires a finite [x, y, z] number tuple.`,
        data: {
          entity: request.entity,
          component: ExternalForce.id,
          field,
          value: jsonSafeValue(request.value),
        },
        suggestedFix:
          "Pass a three-number array, for example { value: [0, 10, 0] }.",
      };
    }

    entity.getVectorView(ExternalForce, field).set(value);
    return null;
  };
}

function setExternalImpulseVec3Field(
  field: "impulse" | "angularImpulse",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(ExternalImpulse)) {
      return {
        code: "aperture.entityLookup.componentMissing",
        severity: "error",
        message: `Entity ${entity.index} does not have component '${ExternalImpulse.id}'.`,
        data: {
          entity: request.entity,
          component: ExternalImpulse.id,
          field,
        },
        suggestedFix:
          "Find an entity with ExternalImpulse, or add the component from an app system before mutating its impulse command.",
      };
    }

    const value = tuple3FromValue(request.value);

    if (value === null) {
      return {
        code: "aperture.entityLookup.invalidComponentFieldValue",
        severity: "error",
        message: `Field '${field}' on component '${ExternalImpulse.id}' requires a finite [x, y, z] number tuple.`,
        data: {
          entity: request.entity,
          component: ExternalImpulse.id,
          field,
          value: jsonSafeValue(request.value),
        },
        suggestedFix:
          "Pass a three-number array, for example { value: [1, 0, 0] }.",
      };
    }

    entity.getVectorView(ExternalImpulse, field).set(value);
    return null;
  };
}

function setKinematicTargetBooleanField(
  field: "enabled",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(KinematicTarget)) {
      return {
        code: "aperture.entityLookup.componentMissing",
        severity: "error",
        message: `Entity ${entity.index} does not have component '${KinematicTarget.id}'.`,
        data: {
          entity: request.entity,
          component: KinematicTarget.id,
          field,
        },
        suggestedFix:
          "Find an entity with KinematicTarget, or add the component from an app system before mutating its target pose.",
      };
    }

    if (typeof request.value !== "boolean") {
      return {
        code: "aperture.entityLookup.invalidComponentFieldValue",
        severity: "error",
        message: `Field '${field}' on component '${KinematicTarget.id}' requires a boolean value.`,
        data: {
          entity: request.entity,
          component: KinematicTarget.id,
          field,
          value: jsonSafeValue(request.value),
        },
        suggestedFix: "Pass a boolean value for this component field.",
      };
    }

    entity.setValue(KinematicTarget, field, request.value);
    return null;
  };
}

function setKinematicTargetVec3Field(
  field: "translation",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(KinematicTarget)) {
      return {
        code: "aperture.entityLookup.componentMissing",
        severity: "error",
        message: `Entity ${entity.index} does not have component '${KinematicTarget.id}'.`,
        data: {
          entity: request.entity,
          component: KinematicTarget.id,
          field,
        },
        suggestedFix:
          "Find an entity with KinematicTarget, or add the component from an app system before mutating its target pose.",
      };
    }

    const value = tuple3FromValue(request.value);

    if (value === null) {
      return {
        code: "aperture.entityLookup.invalidComponentFieldValue",
        severity: "error",
        message: `Field '${field}' on component '${KinematicTarget.id}' requires a finite [x, y, z] number tuple.`,
        data: {
          entity: request.entity,
          component: KinematicTarget.id,
          field,
          value: jsonSafeValue(request.value),
        },
        suggestedFix:
          "Pass a three-number array, for example { value: [1, 2, 3] }.",
      };
    }

    entity.getVectorView(KinematicTarget, field).set(value);
    return null;
  };
}

function setKinematicTargetRotationField(): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(KinematicTarget)) {
      return {
        code: "aperture.entityLookup.componentMissing",
        severity: "error",
        message: `Entity ${entity.index} does not have component '${KinematicTarget.id}'.`,
        data: {
          entity: request.entity,
          component: KinematicTarget.id,
          field: "rotation",
        },
        suggestedFix:
          "Find an entity with KinematicTarget, or add the component from an app system before mutating its target pose.",
      };
    }

    const value = tuple4FromValue(request.value);

    if (value === null || !isUsableQuaternion(value)) {
      return {
        code: "aperture.entityLookup.invalidComponentFieldValue",
        severity: "error",
        message: `Field 'rotation' on component '${KinematicTarget.id}' requires a finite, nonzero [x, y, z, w] quaternion tuple.`,
        data: {
          entity: request.entity,
          component: KinematicTarget.id,
          field: "rotation",
          value: jsonSafeValue(request.value),
        },
        suggestedFix:
          "Pass a finite quaternion tuple, for example { value: [0, 0, 0, 1] }.",
      };
    }

    entity.getVectorView(KinematicTarget, "rotation").set(value);
    return null;
  };
}

function setPhysicsGravityVec3Field(): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(PhysicsGravity)) {
      return missingPhysicsGravityDiagnostic(entity, request);
    }

    const value = tuple3FromValue(request.value);

    if (value === null) {
      return invalidComponentFieldValueDiagnostic(
        request,
        PhysicsGravity.id,
        "gravity",
        "a finite [x, y, z] number tuple",
        "Pass gravity as a finite [x, y, z] number tuple.",
      );
    }

    entity.getVectorView(PhysicsGravity, "gravity").set(value);
    return null;
  };
}

function setPhysicsCharacterControllerBooleanField(
  field:
    | "enabled"
    | "slide"
    | "maxSlopeClimbAngleEnabled"
    | "minSlopeSlideAngleEnabled"
    | "autostepEnabled"
    | "autostepIncludeDynamicBodies"
    | "applyImpulsesToDynamicBodies",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(PhysicsCharacterController)) {
      return missingPhysicsCharacterControllerDiagnostic(
        entity,
        request,
        field,
      );
    }

    if (typeof request.value !== "boolean") {
      return invalidComponentFieldValueDiagnostic(
        request,
        PhysicsCharacterController.id,
        field,
        "a boolean value",
        "Pass a boolean value for this character-controller field.",
      );
    }

    entity.setValue(PhysicsCharacterController, field, request.value);
    return null;
  };
}

function setPhysicsCharacterControllerNumberField(
  field:
    | "offset"
    | "maxSlopeClimbAngle"
    | "minSlopeSlideAngle"
    | "snapToGroundDistance"
    | "autostepMaxHeight"
    | "autostepMinWidth"
    | "characterMass",
  options: { readonly positive?: boolean; readonly nonNegative?: boolean } = {},
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(PhysicsCharacterController)) {
      return missingPhysicsCharacterControllerDiagnostic(
        entity,
        request,
        field,
      );
    }

    if (!validNumber(request.value, options)) {
      return invalidFiniteNumberDiagnostic(
        request,
        PhysicsCharacterController.id,
        field,
        options,
      );
    }

    entity.setValue(PhysicsCharacterController, field, request.value);
    return null;
  };
}

function setPhysicsCharacterControllerVec3Field(
  field: "up",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(PhysicsCharacterController)) {
      return missingPhysicsCharacterControllerDiagnostic(
        entity,
        request,
        field,
      );
    }

    const value = tuple3FromValue(request.value);

    if (value === null || !isUsableDirection(value)) {
      return invalidComponentFieldValueDiagnostic(
        request,
        PhysicsCharacterController.id,
        field,
        "a finite, nonzero [x, y, z] number tuple",
        "Pass a nonzero direction tuple, for example { value: [0, 1, 0] }.",
      );
    }

    entity.getVectorView(PhysicsCharacterController, field).set(value);
    return null;
  };
}

function setPhysicsCharacterControllerMassModeField(): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(PhysicsCharacterController)) {
      return missingPhysicsCharacterControllerDiagnostic(
        entity,
        request,
        "characterMassMode",
      );
    }

    if (
      typeof request.value !== "string" ||
      !stringValueIn(request.value, PhysicsCharacterMassMode)
    ) {
      return invalidComponentFieldValueDiagnostic(
        request,
        PhysicsCharacterController.id,
        "characterMassMode",
        `one of ${Object.values(PhysicsCharacterMassMode).join(", ")}`,
        `Pass one of: ${Object.values(PhysicsCharacterMassMode).join(", ")}.`,
      );
    }

    entity.setValue(
      PhysicsCharacterController,
      "characterMassMode",
      request.value,
    );
    return null;
  };
}

function setPhysicsMaterialNumberField(
  field: "density" | "friction" | "restitution",
  options: { readonly nonNegative?: boolean } = {},
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(PhysicsMaterial)) {
      return missingPhysicsMaterialDiagnostic(entity, request, field);
    }

    if (!validNumber(request.value, options)) {
      return invalidFiniteNumberDiagnostic(
        request,
        PhysicsMaterial.id,
        field,
        options,
      );
    }

    entity.setValue(PhysicsMaterial, field, request.value);
    return null;
  };
}

function setPhysicsMaterialCombineRuleField(
  field: "frictionCombine" | "restitutionCombine",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(PhysicsMaterial)) {
      return missingPhysicsMaterialDiagnostic(entity, request, field);
    }

    if (
      typeof request.value !== "string" ||
      !stringValueIn(request.value, PhysicsMaterialCombineRule)
    ) {
      return invalidComponentFieldValueDiagnostic(
        request,
        PhysicsMaterial.id,
        field,
        `one of ${Object.values(PhysicsMaterialCombineRule).join(", ")}`,
        `Pass one of: ${Object.values(PhysicsMaterialCombineRule).join(", ")}.`,
      );
    }

    entity.setValue(PhysicsMaterial, field, request.value);
    return null;
  };
}

function setPhysicsDebugBooleanField(
  field:
    | "colliderWireframes"
    | "contactNormals"
    | "bodyStateMarkers"
    | "broadphaseAabbs"
    | "jointFrames",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(PhysicsDebug)) {
      return missingPhysicsDebugDiagnostic(entity, request, field);
    }

    if (typeof request.value !== "boolean") {
      return invalidComponentFieldValueDiagnostic(
        request,
        PhysicsDebug.id,
        field,
        "a boolean value",
        "Pass a boolean value for this physics debug field.",
      );
    }

    entity.setValue(PhysicsDebug, field, request.value);
    return null;
  };
}

function setPhysicsJointBooleanField(
  field: "enabled" | "contactsEnabled",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(PhysicsJoint)) {
      return missingPhysicsJointDiagnostic(entity, request, field);
    }

    if (typeof request.value !== "boolean") {
      return {
        code: "aperture.entityLookup.invalidComponentFieldValue",
        severity: "error",
        message: `Field '${field}' on component '${PhysicsJoint.id}' requires a boolean value.`,
        data: {
          entity: request.entity,
          component: PhysicsJoint.id,
          field,
          value: jsonSafeValue(request.value),
        },
        suggestedFix: "Pass a boolean value for this component field.",
      };
    }

    entity.setValue(PhysicsJoint, field, request.value);
    return null;
  };
}

function setPhysicsJointStringField(
  field: "bodyARef" | "bodyBRef",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(PhysicsJoint)) {
      return missingPhysicsJointDiagnostic(entity, request, field);
    }

    if (typeof request.value !== "string") {
      return {
        code: "aperture.entityLookup.invalidComponentFieldValue",
        severity: "error",
        message: `Field '${field}' on component '${PhysicsJoint.id}' requires a string value.`,
        data: {
          entity: request.entity,
          component: PhysicsJoint.id,
          field,
          value: jsonSafeValue(request.value),
        },
        suggestedFix:
          "Pass a serialized entity reference string, for example '12:0'.",
      };
    }

    entity.setValue(PhysicsJoint, field, request.value);
    return null;
  };
}

function setPhysicsJointEnumField(
  field: "kind" | "motorMode" | "motorModel",
  values: Readonly<Record<string, string>>,
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(PhysicsJoint)) {
      return missingPhysicsJointDiagnostic(entity, request, field);
    }

    if (
      typeof request.value !== "string" ||
      !Object.values(values).includes(request.value)
    ) {
      return {
        code: "aperture.entityLookup.invalidComponentFieldValue",
        severity: "error",
        message: `Field '${field}' on component '${PhysicsJoint.id}' requires one of ${Object.values(values).join(", ")}.`,
        data: {
          entity: request.entity,
          component: PhysicsJoint.id,
          field,
          value: jsonSafeValue(request.value),
        },
        suggestedFix: `Pass one of: ${Object.values(values).join(", ")}.`,
      };
    }

    entity.setValue(PhysicsJoint, field, request.value);
    return null;
  };
}

function setPhysicsJointVec3Field(
  field: "anchorA" | "anchorB" | "axis",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(PhysicsJoint)) {
      return missingPhysicsJointDiagnostic(entity, request, field);
    }

    const value = tuple3FromValue(request.value);

    if (value === null) {
      return {
        code: "aperture.entityLookup.invalidComponentFieldValue",
        severity: "error",
        message: `Field '${field}' on component '${PhysicsJoint.id}' requires a finite [x, y, z] number tuple.`,
        data: {
          entity: request.entity,
          component: PhysicsJoint.id,
          field,
          value: jsonSafeValue(request.value),
        },
        suggestedFix:
          "Pass a three-number array, for example { value: [0, 1, 0] }.",
      };
    }

    entity.getVectorView(PhysicsJoint, field).set(value);
    return null;
  };
}

function setPhysicsJointRotationField(
  field: "frameA" | "frameB",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(PhysicsJoint)) {
      return missingPhysicsJointDiagnostic(entity, request, field);
    }

    const value = tuple4FromValue(request.value);

    if (value === null || !isUsableQuaternion(value)) {
      return {
        code: "aperture.entityLookup.invalidComponentFieldValue",
        severity: "error",
        message: `Field '${field}' on component '${PhysicsJoint.id}' requires a finite, nonzero [x, y, z, w] quaternion tuple.`,
        data: {
          entity: request.entity,
          component: PhysicsJoint.id,
          field,
          value: jsonSafeValue(request.value),
        },
        suggestedFix:
          "Pass a finite quaternion tuple, for example { value: [0, 0, 0, 1] }.",
      };
    }

    entity.getVectorView(PhysicsJoint, field).set(value);
    return null;
  };
}

function setPhysicsJointNumberField(
  field:
    | "minLimit"
    | "maxLimit"
    | "motorTarget"
    | "motorVelocity"
    | "motorStiffness"
    | "motorDamping"
    | "motorFactor"
    | "motorMaxForce"
    | "breakForce",
  options: { readonly nonNegative?: boolean } = {},
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(PhysicsJoint)) {
      return missingPhysicsJointDiagnostic(entity, request, field);
    }

    if (
      typeof request.value !== "number" ||
      !Number.isFinite(request.value) ||
      (options.nonNegative === true && request.value < 0)
    ) {
      return {
        code: "aperture.entityLookup.invalidComponentFieldValue",
        severity: "error",
        message: `Field '${field}' on component '${PhysicsJoint.id}' requires a finite${options.nonNegative === true ? ", nonnegative" : ""} number.`,
        data: {
          entity: request.entity,
          component: PhysicsJoint.id,
          field,
          value: jsonSafeValue(request.value),
        },
        suggestedFix:
          options.nonNegative === true
            ? "Pass a finite number greater than or equal to zero."
            : "Pass a finite number.",
      };
    }

    entity.setValue(PhysicsJoint, field, request.value);
    return null;
  };
}

function missingPhysicsCharacterControllerDiagnostic(
  entity: Entity,
  request: ApertureEntitySetComponentFieldRequest,
  field: string,
): ApertureEntityLookupDiagnostic {
  return {
    code: "aperture.entityLookup.componentMissing",
    severity: "error",
    message: `Entity ${entity.index} does not have component '${PhysicsCharacterController.id}'.`,
    data: {
      entity: request.entity,
      component: PhysicsCharacterController.id,
      field,
    },
    suggestedFix:
      "Find an entity with PhysicsCharacterController, or add the controller component from an app system before mutating its authoring fields.",
  };
}

function missingPhysicsMaterialDiagnostic(
  entity: Entity,
  request: ApertureEntitySetComponentFieldRequest,
  field: string,
): ApertureEntityLookupDiagnostic {
  return {
    code: "aperture.entityLookup.componentMissing",
    severity: "error",
    message: `Entity ${entity.index} does not have component '${PhysicsMaterial.id}'.`,
    data: {
      entity: request.entity,
      component: PhysicsMaterial.id,
      field,
    },
    suggestedFix:
      "Find an entity with PhysicsMaterial, or add the material component from an app system before mutating its authoring fields.",
  };
}

function missingPhysicsGravityDiagnostic(
  entity: Entity,
  request: ApertureEntitySetComponentFieldRequest,
): ApertureEntityLookupDiagnostic {
  return {
    code: "aperture.entity.componentField.missingComponent",
    severity: "error",
    message: `Entity ${entity.index} does not have component '${PhysicsGravity.id}'.`,
    data: {
      entity: request.entity,
      component: PhysicsGravity.id,
      field: "gravity",
    },
    suggestedFix:
      "Find an entity with PhysicsGravity, or add the gravity component from an app system before mutating world gravity.",
  };
}

function missingPhysicsDebugDiagnostic(
  entity: Entity,
  request: ApertureEntitySetComponentFieldRequest,
  field: string,
): ApertureEntityLookupDiagnostic {
  return {
    code: "aperture.entityLookup.componentMissing",
    severity: "error",
    message: `Entity ${entity.index} does not have component '${PhysicsDebug.id}'.`,
    data: {
      entity: request.entity,
      component: PhysicsDebug.id,
      field,
    },
    suggestedFix:
      "Find an entity with PhysicsDebug, or add the debug component from an app system before mutating its authoring fields.",
  };
}

function missingPhysicsJointDiagnostic(
  entity: Entity,
  request: ApertureEntitySetComponentFieldRequest,
  field: string,
): ApertureEntityLookupDiagnostic {
  return {
    code: "aperture.entityLookup.componentMissing",
    severity: "error",
    message: `Entity ${entity.index} does not have component '${PhysicsJoint.id}'.`,
    data: {
      entity: request.entity,
      component: PhysicsJoint.id,
      field,
    },
    suggestedFix:
      "Find an entity with PhysicsJoint, or add the joint component from an app system before mutating its authoring fields.",
  };
}

function missingRigidBodyDiagnostic(
  entity: Entity,
  request: ApertureEntitySetComponentFieldRequest,
  field: string,
): ApertureEntityLookupDiagnostic {
  return {
    code: "aperture.entityLookup.componentMissing",
    severity: "error",
    message: `Entity ${entity.index} does not have component '${RigidBody.id}'.`,
    data: {
      entity: request.entity,
      component: RigidBody.id,
      field,
    },
    suggestedFix:
      "Find an entity with RigidBody, or add the rigid body component from an app system before mutating its authoring fields.",
  };
}

function missingColliderDiagnostic(
  entity: Entity,
  request: ApertureEntitySetComponentFieldRequest,
  field: string,
): ApertureEntityLookupDiagnostic {
  return {
    code: "aperture.entityLookup.componentMissing",
    severity: "error",
    message: `Entity ${entity.index} does not have component '${Collider.id}'.`,
    data: {
      entity: request.entity,
      component: Collider.id,
      field,
    },
    suggestedFix:
      "Find an entity with Collider, or add the collider component from an app system before mutating its authoring fields.",
  };
}

function invalidComponentFieldValueDiagnostic(
  request: ApertureEntitySetComponentFieldRequest,
  component: string,
  field: string,
  requirement: string,
  suggestedFix: string,
): ApertureEntityLookupDiagnostic {
  return {
    code: "aperture.entityLookup.invalidComponentFieldValue",
    severity: "error",
    message: `Field '${field}' on component '${component}' requires ${requirement}.`,
    data: {
      entity: request.entity,
      component,
      field,
      value: jsonSafeValue(request.value),
    },
    suggestedFix,
  };
}

function invalidFiniteNumberDiagnostic(
  request: ApertureEntitySetComponentFieldRequest,
  component: string,
  field: string,
  options: { readonly positive?: boolean; readonly nonNegative?: boolean },
): ApertureEntityLookupDiagnostic {
  return invalidComponentFieldValueDiagnostic(
    request,
    component,
    field,
    options.positive === true
      ? "a finite number greater than zero"
      : options.nonNegative === true
        ? "a finite number greater than or equal to zero"
        : "a finite number",
    options.positive === true
      ? "Pass a finite number greater than zero."
      : options.nonNegative === true
        ? "Pass a finite number greater than or equal to zero."
        : "Pass a finite number.",
  );
}

function validNumber(
  value: unknown,
  options: { readonly positive?: boolean; readonly nonNegative?: boolean },
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    (options.positive !== true || value > 0) &&
    (options.nonNegative !== true || value >= 0)
  );
}

function stringValueIn(
  value: string,
  allowed: Readonly<Record<string, string>>,
): boolean {
  return Object.values(allowed).includes(value);
}

function setLocalTransformVec3Field(
  field: "translation" | "scale",
): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(LocalTransform)) {
      return {
        code: "aperture.entityLookup.componentMissing",
        severity: "error",
        message: `Entity ${entity.index} does not have component '${LocalTransform.id}'.`,
        data: {
          entity: request.entity,
          component: LocalTransform.id,
          field,
        },
        suggestedFix:
          "Find an entity with LocalTransform, or add the component from an app system before mutating its transform.",
      };
    }

    const value = tuple3FromValue(request.value);

    if (value === null) {
      return {
        code: "aperture.entityLookup.invalidComponentFieldValue",
        severity: "error",
        message: `Field '${field}' on component '${LocalTransform.id}' requires a finite [x, y, z] number tuple.`,
        data: {
          entity: request.entity,
          component: LocalTransform.id,
          field,
          value: jsonSafeValue(request.value),
        },
        suggestedFix:
          "Pass a three-number array, for example { value: [1, 2, 3] }.",
      };
    }

    entity.getVectorView(LocalTransform, field).set(value);
    return null;
  };
}

function setLocalTransformRotationField(): ComponentFieldMutation {
  return (entity, request) => {
    if (!entity.hasComponent(LocalTransform)) {
      return {
        code: "aperture.entityLookup.componentMissing",
        severity: "error",
        message: `Entity ${entity.index} does not have component '${LocalTransform.id}'.`,
        data: {
          entity: request.entity,
          component: LocalTransform.id,
          field: "rotation",
        },
        suggestedFix:
          "Find an entity with LocalTransform, or add the component from an app system before mutating its transform.",
      };
    }

    const value = tuple4FromValue(request.value);

    if (value === null || !isUsableQuaternion(value)) {
      return {
        code: "aperture.entityLookup.invalidComponentFieldValue",
        severity: "error",
        message: `Field 'rotation' on component '${LocalTransform.id}' requires a finite, nonzero [x, y, z, w] quaternion tuple.`,
        data: {
          entity: request.entity,
          component: LocalTransform.id,
          field: "rotation",
          value: jsonSafeValue(request.value),
        },
        suggestedFix:
          "Pass a finite quaternion tuple, for example { value: [0, 0, 0, 1] }.",
      };
    }

    entity.getVectorView(LocalTransform, "rotation").set(value);
    return null;
  };
}

function isUsableQuaternion(
  value: readonly [number, number, number, number],
): boolean {
  const lengthSq =
    value[0] * value[0] +
    value[1] * value[1] +
    value[2] * value[2] +
    value[3] * value[3];

  return lengthSq > 0.000001;
}

function isUsableDirection(value: readonly [number, number, number]): boolean {
  const lengthSq =
    value[0] * value[0] + value[1] * value[1] + value[2] * value[2];

  return lengthSq > 0.000001;
}
