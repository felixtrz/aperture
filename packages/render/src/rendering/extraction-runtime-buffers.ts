import {
  Enabled,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import {
  RuntimeBuffer,
  validateRuntimeBufferInput,
  type RuntimeBufferInput,
} from "./index.js";
import {
  createStableRenderId,
  type RenderDiagnostic,
  type RuntimeBufferPacket,
} from "./snapshot.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { sortedEntities } from "./extraction-entities.js";

export function extractRuntimeBuffers(
  world: EcsWorld,
  diagnostics: RenderDiagnostic[],
): RuntimeBufferPacket[] {
  const query = world.queryManager.registerQuery({
    required: [RuntimeBuffer],
  });
  const packets: RuntimeBufferPacket[] = [];
  const seenKeys = new Set<string>();

  for (const entity of sortedEntities(query.entities)) {
    if (
      entity.hasComponent(Enabled) &&
      entity.getValue(Enabled, "value") === false
    ) {
      diagnostics.push(diagnostic("render.disabled", entity));
      continue;
    }

    const input = runtimeBufferInput(entity);
    const validation = validateRuntimeBufferInput(input);

    if (!validation.valid) {
      for (const bufferDiagnostic of validation.diagnostics) {
        diagnostics.push(diagnostic(`render.${bufferDiagnostic.code}`, entity));
      }
      continue;
    }

    if (seenKeys.has(input.key)) {
      diagnostics.push({
        ...diagnostic("render.runtimeBuffer.duplicateKey", entity),
        runtimeBufferKey: input.key,
      });
      continue;
    }

    seenKeys.add(input.key);

    packets.push({
      bufferId: createStableRenderId(entityRef(entity)),
      entity: entityRef(entity),
      key: input.key,
      values: [...input.values],
      elementOffset: input.elementOffset ?? 0,
      version: input.version ?? 0,
    });
  }

  return packets.sort((a, b) => a.key.localeCompare(b.key));
}

function runtimeBufferInput(entity: Entity): RuntimeBufferInput {
  return {
    key:
      typeof entity.getValue(RuntimeBuffer, "key") === "string"
        ? (entity.getValue(RuntimeBuffer, "key") as string)
        : "",
    values: runtimeBufferValues(entity.getValue(RuntimeBuffer, "values")),
    elementOffset:
      typeof entity.getValue(RuntimeBuffer, "elementOffset") === "number"
        ? (entity.getValue(RuntimeBuffer, "elementOffset") as number)
        : 0,
    version:
      typeof entity.getValue(RuntimeBuffer, "version") === "number"
        ? (entity.getValue(RuntimeBuffer, "version") as number)
        : 0,
  };
}

function runtimeBufferValues(value: unknown): readonly number[] {
  return Array.isArray(value) ? (value as readonly number[]) : [];
}
