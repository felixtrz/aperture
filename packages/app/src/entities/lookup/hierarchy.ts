import type { EcsWorld } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../../config.js";
import {
  collectActiveEntities,
  compareEntitySummaries,
  entityRefKey,
  entitySummary,
} from "./summary.js";
import type {
  ApertureEntityHierarchyNode,
  ApertureEntityHierarchyReport,
  ApertureEntityLookupDiagnostic,
} from "./types.js";

interface MutableHierarchyNode {
  readonly entity: EcsEntityRef;
  readonly key?: string;
  readonly name: string;
  readonly parent?: EcsEntityRef;
  readonly children: MutableHierarchyNode[];
}

export function createApertureEntityHierarchy(
  world: EcsWorld,
): ApertureEntityHierarchyReport {
  const summaries = collectActiveEntities(world)
    .map(entitySummary)
    .sort(compareEntitySummaries);
  const nodes = new Map<string, MutableHierarchyNode>();
  const diagnostics: ApertureEntityLookupDiagnostic[] = [];

  for (const summary of summaries) {
    nodes.set(entityRefKey(summary.entity), {
      entity: summary.entity,
      ...(summary.key === undefined ? {} : { key: summary.key }),
      name: summary.name,
      ...(summary.parent === undefined ? {} : { parent: summary.parent }),
      children: [],
    });
  }

  const roots: MutableHierarchyNode[] = [];

  for (const node of nodes.values()) {
    if (node.parent === undefined) {
      roots.push(node);
      continue;
    }

    const parent = nodes.get(entityRefKey(node.parent));
    if (parent === undefined) {
      diagnostics.push({
        code: "aperture.entityHierarchy.staleParent",
        severity: "warning",
        message: `Entity ${node.entity.index} references a parent that is not active in the hierarchy snapshot.`,
        data: {
          entity: node.entity,
          parent: node.parent,
        },
        suggestedFix:
          "Resolve transforms and remove stale Parent references from app systems.",
      });
      roots.push(node);
      continue;
    }

    parent.children.push(node);
  }

  return {
    roots: sortHierarchyNodes(roots),
    total: summaries.length,
    diagnostics,
  };
}

function sortHierarchyNodes(
  nodes: readonly MutableHierarchyNode[],
): readonly ApertureEntityHierarchyNode[] {
  return [...nodes]
    .sort(
      (a, b) =>
        a.entity.index - b.entity.index ||
        a.entity.generation - b.entity.generation,
    )
    .map((node) => ({
      entity: node.entity,
      ...(node.key === undefined ? {} : { key: node.key }),
      name: node.name,
      ...(node.parent === undefined ? {} : { parent: node.parent }),
      children: sortHierarchyNodes(node.children),
    }));
}
