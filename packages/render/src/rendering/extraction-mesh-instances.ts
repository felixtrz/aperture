import type { Entity } from "@aperture-engine/simulation";
import { InstanceData, InstanceTint } from "./index.js";
import type { InstanceAttributePacket, RenderDiagnostic } from "./snapshot.js";
import { diagnostic, entityRef } from "./extraction-diagnostics.js";
import { pushVec4 } from "./extraction-packing.js";

export function pushInstanceTint(
  values: number[],
  entity: Entity,
): number | undefined {
  if (!entity.hasComponent(InstanceTint)) {
    return undefined;
  }

  return pushVec4(values, entity.getVectorView(InstanceTint, "color"));
}

export function pushInstanceAttributePacket(
  values: number[],
  packets: InstanceAttributePacket[],
  diagnostics: RenderDiagnostic[],
  entity: Entity,
): number | undefined {
  if (!entity.hasComponent(InstanceData)) {
    return undefined;
  }

  const materialKind = entity.getValue(InstanceData, "materialKind") ?? "";
  const valuesJson = entity.getValue(InstanceData, "valuesJson") ?? "{}";
  const fields: InstanceAttributePacket["fields"][number][] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(valuesJson);
  } catch {
    diagnostics.push(diagnostic("render.instanceData.invalidJson", entity));
    return undefined;
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    diagnostics.push(diagnostic("render.instanceData.invalidValues", entity));
    return undefined;
  }

  for (const name of Object.keys(parsed).sort()) {
    const source = (parsed as Record<string, unknown>)[name];
    const components = instanceDataComponents(source);

    if (components === null) {
      diagnostics.push(diagnostic("render.instanceData.invalidValue", entity));
      continue;
    }

    const offset = values.length;

    values.push(...components);
    fields.push({
      name,
      offset,
      components: components.length,
    });
  }

  if (fields.length === 0) {
    return undefined;
  }

  const packetIndex = packets.length;

  packets.push({
    packetIndex,
    entity: entityRef(entity),
    materialKind,
    fields,
  });

  return packetIndex;
}

function instanceDataComponents(value: unknown): readonly number[] | null {
  const raw = Array.isArray(value) ? value : [value];

  if (raw.length < 1 || raw.length > 4) {
    return null;
  }

  const components: number[] = [];

  for (const component of raw) {
    if (typeof component !== "number" || !Number.isFinite(component)) {
      return null;
    }

    components.push(component);
  }

  return components;
}
