import {
  Enabled,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import {
  RuntimeUniform,
  validateRuntimeUniformInput,
  type RuntimeUniformInput,
  type RuntimeUniformValues,
} from "./index.js";
import {
  createStableRenderId,
  type RenderDiagnostic,
  type RuntimeUniformPacket,
  type RuntimeUniformValuePacket,
  type RuntimeUniformValueRecord,
} from "./snapshot.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";

export function extractRuntimeUniforms(
  world: EcsWorld,
  diagnostics: RenderDiagnostic[],
): RuntimeUniformPacket[] {
  const query = world.queryManager.registerQuery({
    required: [RuntimeUniform],
  });
  const packets: RuntimeUniformPacket[] = [];
  const seenKeys = new Set<string>();

  for (const entity of sortedEntities(query.entities)) {
    if (
      entity.hasComponent(Enabled) &&
      entity.getValue(Enabled, "value") === false
    ) {
      diagnostics.push(diagnostic("render.disabled", entity));
      continue;
    }

    const input = runtimeUniformInput(entity);
    const validation = validateRuntimeUniformInput(input);

    if (!validation.valid) {
      for (const uniformDiagnostic of validation.diagnostics) {
        diagnostics.push(
          diagnostic(`render.${uniformDiagnostic.code}`, entity),
        );
      }
      continue;
    }

    if (seenKeys.has(input.key)) {
      diagnostics.push({
        ...diagnostic("render.runtimeUniform.duplicateKey", entity),
        runtimeUniformKey: input.key,
      });
      continue;
    }

    seenKeys.add(input.key);

    packets.push({
      uniformId: createStableRenderId(entityRef(entity)),
      entity: entityRef(entity),
      key: input.key,
      values: cloneRuntimeUniformValues(input.values),
      version: input.version ?? 0,
    });
  }

  return packets.sort((a, b) => a.key.localeCompare(b.key));
}

function runtimeUniformInput(entity: Entity): RuntimeUniformInput {
  return {
    key:
      typeof entity.getValue(RuntimeUniform, "key") === "string"
        ? (entity.getValue(RuntimeUniform, "key") as string)
        : "",
    values: runtimeUniformValues(entity.getValue(RuntimeUniform, "values")),
    version:
      typeof entity.getValue(RuntimeUniform, "version") === "number"
        ? (entity.getValue(RuntimeUniform, "version") as number)
        : 0,
  };
}

function runtimeUniformValues(value: unknown): RuntimeUniformValues {
  return isPlainObject(value) ? (value as RuntimeUniformValues) : {};
}

function cloneRuntimeUniformValues(
  values: RuntimeUniformValues,
): RuntimeUniformValueRecord {
  const cloned: Record<string, RuntimeUniformValuePacket> = {};

  for (const [key, value] of Object.entries(values)) {
    cloned[key] = Array.isArray(value) ? [...value] : value;
  }

  return cloned;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
