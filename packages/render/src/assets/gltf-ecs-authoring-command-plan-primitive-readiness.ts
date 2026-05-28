import type { GltfResolvedPrimitiveMaterial } from "./gltf-primitive-material-resolution.js";
import type { GltfEcsAuthoringCommandPlanOptions } from "./gltf-ecs-authoring-command-plan-types.js";

export interface GltfEcsMeshReadiness {
  readonly ready: ReadonlySet<string>;
  readonly skippedReasons: ReadonlyMap<string, string>;
}

export type GltfEcsMeshReadinessStatus =
  | { readonly kind: "ready" }
  | { readonly kind: "skipped"; readonly reason: string }
  | { readonly kind: "missing" };

export function createGltfEcsMeshReadiness(
  options: GltfEcsAuthoringCommandPlanOptions,
): GltfEcsMeshReadiness {
  return {
    ready: new Set([
      ...(options.meshRegistrationReport?.written.map(
        (entry) => entry.registeredHandleKey,
      ) ?? []),
      ...(options.availableMeshHandleKeys ?? []),
    ]),
    skippedReasons: new Map(
      options.meshRegistrationReport?.skipped.map((entry) => [
        entry.registeredHandleKey,
        entry.reason,
      ]) ?? [],
    ),
  };
}

export function gltfEcsMeshReadinessStatus(
  readiness: GltfEcsMeshReadiness,
  material: GltfResolvedPrimitiveMaterial,
): GltfEcsMeshReadinessStatus {
  if (readiness.ready.has(material.meshHandleKey)) {
    return { kind: "ready" };
  }

  const skippedReason = readiness.skippedReasons.get(material.meshHandleKey);
  if (skippedReason !== undefined) {
    return { kind: "skipped", reason: skippedReason };
  }

  return { kind: "missing" };
}
