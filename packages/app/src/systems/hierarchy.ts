import {
  despawnRecursive as despawnRecursiveSubtree,
  getChildren as getChildEntities,
  setParent as setParentEntity,
  type EcsWorld,
  type Entity,
  type SetParentDiagnostic,
} from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
import type { ApertureEntityLookupDiagnostic } from "../entities/lookup/types.js";
import { resolveActiveEntity } from "../entities/lookup/resolve.js";

// M7-T2: surface the M7-T1 transform-hierarchy helpers (setParent / getChildren /
// despawnRecursive) on the system context so worker-authored routes can reparent,
// enumerate, and recursively despawn live entities by EcsEntityRef. Refs are
// resolved through the shared generation-checked resolveActiveEntity path so a
// stale or destroyed ref returns a structured diagnostic instead of mutating the
// wrong entity. The underlying setParent preserves the child's world transform.

export interface HierarchyChildrenResult {
  readonly ok: boolean;
  readonly children: readonly EcsEntityRef[];
  readonly diagnostic?: ApertureEntityLookupDiagnostic;
}

export interface HierarchySetParentResult {
  readonly ok: boolean;
  readonly diagnostic?: ApertureEntityLookupDiagnostic;
}

export interface HierarchyDespawnResult {
  readonly ok: boolean;
  readonly despawned: number;
  readonly diagnostic?: ApertureEntityLookupDiagnostic;
}

export interface HierarchyAccess {
  /** Ordered, live children of `entity` (stale refs dropped). */
  children(entity: EcsEntityRef): HierarchyChildrenResult;
  /**
   * Reparent `child` under `parent` (or detach to a transform root when `parent`
   * is null) while preserving the child's world-space transform. Cycles and
   * missing/invalid world transforms are reported as diagnostics.
   */
  setParent(
    child: EcsEntityRef,
    parent: EcsEntityRef | null,
  ): HierarchySetParentResult;
  /** Destroy `entity` and its entire subtree; returns the count destroyed. */
  despawnRecursive(entity: EcsEntityRef): HierarchyDespawnResult;
}

export function createHierarchyAccess(world: EcsWorld): HierarchyAccess {
  return {
    children(entity) {
      const resolved = resolveActiveEntity(world, entity);
      if (!resolved.ok) {
        return { ok: false, children: [], diagnostic: resolved.diagnostic };
      }
      const children = getChildEntities(world, resolved.entity).map(entityRef);
      return { ok: true, children };
    },
    setParent(child, parent) {
      const resolvedChild = resolveActiveEntity(world, child);
      if (!resolvedChild.ok) {
        return { ok: false, diagnostic: resolvedChild.diagnostic };
      }

      let parentEntity: Entity | null = null;
      if (parent !== null) {
        const resolvedParent = resolveActiveEntity(world, parent);
        if (!resolvedParent.ok) {
          return { ok: false, diagnostic: resolvedParent.diagnostic };
        }
        parentEntity = resolvedParent.entity;
      }

      const result = setParentEntity(world, resolvedChild.entity, parentEntity);
      if (!result.ok) {
        return {
          ok: false,
          diagnostic: hierarchyDiagnostic(result.diagnostic, child, parent),
        };
      }
      return { ok: true };
    },
    despawnRecursive(entity) {
      const resolved = resolveActiveEntity(world, entity);
      if (!resolved.ok) {
        return { ok: false, despawned: 0, diagnostic: resolved.diagnostic };
      }
      const despawned = despawnRecursiveSubtree(world, resolved.entity);
      return { ok: true, despawned };
    },
  };
}

function entityRef(entity: Entity): EcsEntityRef {
  return { index: entity.index, generation: entity.generation };
}

function hierarchyDiagnostic(
  diagnostic: SetParentDiagnostic | undefined,
  child: EcsEntityRef,
  parent: EcsEntityRef | null,
): ApertureEntityLookupDiagnostic {
  const code = diagnostic?.code ?? "invalid-world-transform";
  return {
    code: `aperture.hierarchy.${code}`,
    severity: "error",
    message:
      diagnostic?.message ??
      "setParent failed to reparent the entity while preserving its world transform.",
    data: {
      child,
      parent,
      ...(diagnostic?.cycle === undefined ? {} : { cycle: diagnostic.cycle }),
    },
    suggestedFix: hierarchySuggestedFix(code),
  };
}

function hierarchySuggestedFix(code: SetParentDiagnostic["code"]): string {
  switch (code) {
    case "cycle":
      return "Choose a parent that is not the child itself or one of its descendants.";
    case "missing-world-transform":
      return "Resolve world transforms (step the app or call resolveWorldTransforms) so both entities have a WorldTransform before reparenting.";
    case "invalid-world-transform":
      return "Ensure both entities carry non-singular, affine world transforms before reparenting.";
  }
}
