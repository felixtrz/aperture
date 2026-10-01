/**
 * Machine-readable authoring affordances for the shared ECS tool contracts.
 * These schemas describe existing arguments; they do not validate or widen the
 * runtime mutation allowlist. Keep parser parity tests alongside changes here.
 */
export function entityReferenceSchema(): Record<string, unknown> {
  return {
    type: "object",
    description: "A current generation-checked ECS entity reference.",
    properties: {
      index: { type: "integer", minimum: 0 },
      generation: { type: "integer", minimum: 0 },
    },
    required: ["index", "generation"],
  };
}

function queryFilters(includeTagAlias: boolean): Record<string, unknown> {
  return {
    key: { type: "string", description: "Exact app-authored entity key." },
    namePattern: {
      type: "string",
      description:
        "JavaScript regular-expression source matched against entity names (Unicode flag).",
    },
    withComponents: {
      type: "array",
      items: { type: "string" },
      description: "Require every listed component id.",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "Require every listed tag.",
    },
    ...(includeTagAlias
      ? {
          tag: {
            type: "string",
            description:
              "One required tag, merged with tags when both are supplied.",
          },
        }
      : {}),
    source: {
      type: "object",
      description:
        "Exact-match imported-source filters; an entity must have source metadata.",
      properties: {
        assetId: { type: "string" },
        gltfNodeIndex: {
          type: "number",
          description:
            "Exact source node index, including -1 for a scene root.",
        },
        gltfNodePath: {
          type: "string",
          description: "Exact source path, not a regular expression.",
        },
      },
    },
    limit: {
      type: "number",
      default: 50,
      description:
        "Maximum results; finite positive values are floored, non-positive values return none.",
    },
  };
}

export function entityQueryProperties(): Record<string, unknown> {
  const filters = queryFilters(true);
  return {
    ...filters,
    query: {
      type: "object",
      description:
        "Optional nested filters. When present, replaces all flat filters rather than merging with them.",
      properties: filters,
      additionalProperties: false,
    },
  };
}

export function entitySelectorProperties(): Record<string, unknown> {
  return {
    entity: entityReferenceSchema(),
    index: {
      type: "integer",
      minimum: 0,
      description: "Flat entity-reference alias; provide generation too.",
    },
    generation: {
      type: "integer",
      minimum: 0,
      description: "Flat entity-reference alias; provide index too.",
    },
    summaries: {
      type: "array",
      description:
        "Piped find-report summaries; the first object supplies its entity reference.",
      items: {
        type: "object",
        properties: { entity: entityReferenceSchema() },
        required: ["entity"],
      },
    },
    key: {
      type: "string",
      description:
        "Exact entity key, resolved only when no explicit or piped reference is supplied.",
    },
    namePattern: {
      type: "string",
      description:
        "JavaScript regular-expression source; selects the first match when no reference is supplied. If key is also supplied, both must match.",
    },
  };
}

export function entitySchemaProperties(): Record<string, unknown> {
  return {
    component: {
      type: "string",
      description:
        "Exact component id. Omit both component/id to list schemas on active entities.",
    },
    id: {
      type: "string",
      description:
        "Alias for component, used when component is absent or null.",
    },
  };
}

export function entityMutationProperties(): Record<string, unknown> {
  return {
    ...entitySelectorProperties(),
    component: {
      type: "string",
      minLength: 1,
      description: "Exact component id from ecs_get_component_schema.",
    },
    field: {
      type: "string",
      minLength: 1,
      description:
        "One literal top-level field from the schema's mutation.writableFields. Dot paths and tuple indexes are not supported.",
    },
    value: {
      description:
        "The complete JSON field value. Preserve its declared type; vectors/colors/quaternions use whole numeric arrays. Runtime value constraints still apply.",
    },
  };
}

export function entitySnapshotProperties(): Record<string, unknown> {
  // Snapshot/diff deliberately do not parse the singular `tag` alias.
  const filters = {
    ...queryFilters(false),
    entities: {
      type: "array",
      items: entityReferenceSchema(),
      description:
        "A nonempty explicit reference list supersedes filters and limit; empty is treated as absent.",
    },
  };
  return {
    ...filters,
    label: {
      type: "string",
      description:
        "Snapshot label (outer argument only); omitted/empty labels are generated by the session.",
    },
    query: {
      type: "object",
      description:
        "Optional nested filters/references; replaces flat filters. Keep label at the outer level.",
      properties: filters,
    },
  };
}
