import type { EcsWorld, Entity } from "@aperture-engine/simulation";
import { entitySummary, jsonSafeValue } from "./summary.js";
import { resolveActiveEntity } from "./resolve.js";
import type {
  ApertureEntityLookupDiagnostic,
  ApertureEntitySetComponentFieldReport,
  ApertureEntitySetComponentFieldRequest,
} from "./types.js";
import { DebugMetadata } from "../../systems.js";

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
