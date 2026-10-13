import { assetHandleKey, type AssetHandle } from "@aperture-engine/simulation";
import type { Entity } from "@aperture-engine/simulation";
import type { RenderDiagnostic, RenderEntityRef } from "./snapshot.js";

export function entityRef(entity: Entity): RenderEntityRef {
  return { index: entity.index, generation: entity.generation };
}

export function diagnostic(
  code: string,
  entity: Entity,
  handle?: AssetHandle,
): RenderDiagnostic {
  const result: RenderDiagnostic = {
    code,
    severity: "warning",
    entity: entityRef(entity),
    message: code,
  };

  if (handle !== undefined) {
    return { ...result, assetKey: assetHandleKey(handle) };
  }

  return result;
}
