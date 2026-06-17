import {
  Name,
  Parent,
  getChildren,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import { AppEntitySource as AppGltfSource } from "./components.js";

export type GltfNodeLookupDiagnosticCode =
  | "aperture.gltf.invalidNodeName"
  | "aperture.gltf.rootInactive"
  | "aperture.gltf.nodeMissing"
  | "aperture.gltf.nodeDuplicate";

export interface GltfNodeLookupDiagnostic {
  readonly code: GltfNodeLookupDiagnosticCode;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly suggestedFix: string;
  readonly data?: Record<string, unknown>;
}

export interface GltfNodeRecord {
  readonly entity: Entity;
  readonly name: string;
  readonly assetId: string;
  readonly nodeIndex: number;
  readonly nodePath: string;
}

export interface GltfNodeFilter {
  readonly name?: string;
  readonly nameIncludes?: string;
  readonly assetId?: string;
}

export interface GltfNodeLookupResult {
  readonly ok: boolean;
  readonly entity: Entity | null;
  readonly node: GltfNodeRecord | null;
  readonly matches: readonly GltfNodeRecord[];
  readonly diagnostic?: GltfNodeLookupDiagnostic;
}

export interface GltfInstanceAccess {
  /** Return GLTF-authored nodes in a spawned root subtree. */
  nodes(root: Entity, filter?: GltfNodeFilter): readonly GltfNodeRecord[];
  /**
   * Return exactly one named GLTF node from a spawned root subtree.
   * Missing and duplicate names are reported explicitly.
   */
  node(
    root: Entity,
    name: string,
    filter?: Omit<GltfNodeFilter, "name">,
  ): GltfNodeLookupResult;
}

export function createGltfInstanceAccess(world: EcsWorld): GltfInstanceAccess {
  return {
    nodes(root, filter = {}) {
      return findNodes(world, root, filter);
    },

    node(root, name, filter = {}) {
      if (!root.active) {
        return {
          ok: false,
          entity: null,
          node: null,
          matches: [],
          diagnostic: {
            code: "aperture.gltf.rootInactive",
            severity: "error",
            message: "Cannot look up a GLTF node from an inactive root entity.",
            suggestedFix:
              "Keep the spawned GLTF root entity alive while resolving nodes from it.",
          },
        };
      }

      if (name.trim().length === 0) {
        return {
          ok: false,
          entity: null,
          node: null,
          matches: [],
          diagnostic: {
            code: "aperture.gltf.invalidNodeName",
            severity: "error",
            message: "GLTF node lookup requires a non-empty node name.",
            suggestedFix:
              "Pass the imported node name, for example this.gltf.node(root, 'body').",
          },
        };
      }

      const matches = findNodes(world, root, { ...filter, name });
      if (matches.length === 1) {
        const node = matches[0]!;
        return { ok: true, entity: node.entity, node, matches };
      }

      if (matches.length === 0) {
        return {
          ok: false,
          entity: null,
          node: null,
          matches,
          diagnostic: {
            code: "aperture.gltf.nodeMissing",
            severity: "warning",
            message: `No GLTF node named '${name}' exists in the spawned root subtree.`,
            suggestedFix:
              "Check the imported GLTF node names or inspect this.gltf.nodes(root).",
            data: { name, ...filter },
          },
        };
      }

      return {
        ok: false,
        entity: null,
        node: null,
        matches,
        diagnostic: {
          code: "aperture.gltf.nodeDuplicate",
          severity: "warning",
          message: `Found ${matches.length} GLTF nodes named '${name}' in the spawned root subtree.`,
          suggestedFix:
            "Use this.gltf.nodes(root, { name }) and disambiguate by assetId or nodePath.",
          data: {
            name,
            ...filter,
            matches: matches.map((match) => ({
              assetId: match.assetId,
              nodeIndex: match.nodeIndex,
              nodePath: match.nodePath,
            })),
          },
        },
      };
    },
  };
}

function findNodes(
  world: EcsWorld,
  root: Entity,
  filter: GltfNodeFilter,
): readonly GltfNodeRecord[] {
  if (!root.active) {
    return [];
  }

  const result: GltfNodeRecord[] = [];
  for (const entity of traverseSubtree(world, root)) {
    const record = nodeRecord(entity);
    if (record !== null && matchesFilter(record, filter)) {
      result.push(record);
    }
  }
  return result;
}

function traverseSubtree(world: EcsWorld, root: Entity): Entity[] {
  const result: Entity[] = [];
  const visited = new Set<string>();
  const parentChildren = createParentChildrenIndex(world);
  const stack = [root];

  while (stack.length > 0) {
    const entity = stack.pop()!;
    const key = entityRefKey(entity);
    if (!entity.active || visited.has(key)) {
      continue;
    }

    visited.add(key);
    result.push(entity);

    const children = mergedChildren(world, entity, parentChildren);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]!);
    }
  }

  return result;
}

function createParentChildrenIndex(
  world: EcsWorld,
): ReadonlyMap<string, Entity[]> {
  const byParent = new Map<string, Entity[]>();
  if (!world.hasComponent(Parent)) {
    return byParent;
  }

  const query = world.queryManager.registerQuery({ required: [Parent] });
  for (const entity of query.entities) {
    if (!entity.active) {
      continue;
    }

    const parent = entity.getValue(Parent, "entity");
    if (parent === null || parent === undefined || !parent.active) {
      continue;
    }

    const key = entityRefKey(parent);
    const children = byParent.get(key) ?? [];
    children.push(entity);
    byParent.set(key, children);
  }

  return byParent;
}

function mergedChildren(
  world: EcsWorld,
  entity: Entity,
  parentChildren: ReadonlyMap<string, readonly Entity[]>,
): readonly Entity[] {
  const indexed = getChildren(world, entity);
  const parentLinked = parentChildren.get(entityRefKey(entity)) ?? [];

  if (indexed.length === 0) {
    return parentLinked;
  }
  if (parentLinked.length === 0) {
    return indexed;
  }

  const merged = [...indexed];
  const seen = new Set(indexed.map(entityRefKey));
  for (const child of parentLinked) {
    if (!seen.has(entityRefKey(child))) {
      merged.push(child);
    }
  }

  return merged;
}

function entityRefKey(entity: Entity): string {
  return `${entity.index}:${entity.generation}`;
}

function nodeRecord(entity: Entity): GltfNodeRecord | null {
  if (!entity.hasComponent(AppGltfSource)) {
    return null;
  }

  const kind = entity.getValue(AppGltfSource, "kind");
  if (kind !== "gltf") {
    return null;
  }

  const name = entity.hasComponent(Name) ? entity.getValue(Name, "value") : "";
  const assetId = entity.getValue(AppGltfSource, "assetId");
  const nodeIndex = entity.getValue(AppGltfSource, "gltfNodeIndex");
  const nodePath = entity.getValue(AppGltfSource, "gltfNodePath");

  if (
    typeof name !== "string" ||
    typeof assetId !== "string" ||
    typeof nodeIndex !== "number" ||
    typeof nodePath !== "string" ||
    !isAuthoredGltfNodePath(nodePath)
  ) {
    return null;
  }

  return { entity, name, assetId, nodeIndex, nodePath };
}

function isAuthoredGltfNodePath(nodePath: string): boolean {
  return (
    nodePath.startsWith("scene:") ||
    /^scene\[\d+\]$/u.test(nodePath) ||
    /^nodes\[\d+\]$/u.test(nodePath)
  );
}

function matchesFilter(
  record: GltfNodeRecord,
  filter: GltfNodeFilter,
): boolean {
  return (
    (filter.name === undefined || record.name === filter.name) &&
    (filter.nameIncludes === undefined ||
      record.name.includes(filter.nameIncludes)) &&
    (filter.assetId === undefined || record.assetId === filter.assetId)
  );
}
