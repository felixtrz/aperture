import type { EcsWorld, Entity } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "./config.js";
import {
  entitySummary,
  jsonSafeValue,
  validEntityRef,
} from "./entity-lookup-summary.js";
import type {
  ApertureEntityLookupDiagnostic,
  ApertureEntitySetComponentFieldReport,
  ApertureEntitySetComponentFieldRequest,
} from "./entity-lookup-types.js";
import { DebugMetadata } from "./systems.js";

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

function resolveActiveEntity(
  world: EcsWorld,
  ref: EcsEntityRef,
):
  | { readonly ok: true; readonly entity: Entity }
  | {
      readonly ok: false;
      readonly diagnostic: ApertureEntityLookupDiagnostic;
    } {
  if (!validEntityRef(ref)) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.entityLookup.invalidRef",
        severity: "error",
        message:
          "Entity lookup requires a finite integer { index, generation } reference.",
        data: { entity: ref },
        suggestedFix:
          "Re-run aperture_entity_find and pass the full returned { index, generation } pair.",
      },
    };
  }

  const entity = world.entityManager.getEntityByIndex(ref.index);

  if (entity === null || !entity.active) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.entityLookup.notFound",
        severity: "error",
        message: `No active entity exists at index ${ref.index}.`,
        data: { entity: ref },
        suggestedFix:
          "The entity may have been destroyed. Re-run aperture_entity_find before issuing a follow-up operation.",
      },
    };
  }

  if (entity.generation !== ref.generation) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.entityLookup.generationMismatch",
        severity: "error",
        message: `Entity index ${ref.index} is active with generation ${entity.generation}, not requested generation ${ref.generation}.`,
        data: {
          requested: ref,
          active: { index: entity.index, generation: entity.generation },
        },
        suggestedFix:
          "Re-run aperture_entity_find and use the current { index, generation } pair before mutating ECS state.",
      },
    };
  }

  return { ok: true, entity };
}
