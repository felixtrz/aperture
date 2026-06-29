import type { EcsWorld } from "@aperture-engine/simulation";
import {
  APERTURE_ENTITY_DIFF_COMMAND_CHANNEL,
  APERTURE_ENTITY_FIND_COMMAND_CHANNEL,
  APERTURE_ENTITY_GET_COMMAND_CHANNEL,
  APERTURE_ENTITY_HIERARCHY_COMMAND_CHANNEL,
  APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL,
  APERTURE_ENTITY_SNAPSHOT_COMMAND_CHANNEL,
  type ApertureGeneratedCommand,
} from "../commands.js";
import type { EcsEntityRef } from "../config.js";
import {
  createApertureEntityHierarchy,
  createApertureEntityLookupSnapshot,
  diffApertureEntityLookupSnapshots,
  findApertureEntities,
  getApertureEntitySummary,
  setApertureEntityComponentField,
  type ApertureEntityFindQuery,
  type ApertureEntityFindReport,
  type ApertureEntityGetReport,
  type ApertureEntityHierarchyReport,
  type ApertureEntityLookupDiagnostic,
  type ApertureEntityLookupSnapshot,
  type ApertureEntityLookupSnapshotOptions,
  type ApertureEntitySetComponentFieldReport,
  type ApertureEntitySetComponentFieldRequest,
  type ApertureEntitySnapshotDiff,
} from "../entity-lookup.js";
import {
  isRecord,
  jsonSafeValue,
  numberFromValue,
  stringArrayFromValue,
  stringFromValue,
} from "./payload.js";
import type { GeneratedDevtoolsToolResult } from "./types.js";

interface GeneratedEntityToolRequest {
  readonly channel: string;
  readonly payload: unknown;
}

interface GeneratedEntityToolStatus {
  readonly finds: number;
  readonly gets: number;
  readonly mutations: number;
  readonly snapshots: number;
  readonly diffs: number;
  readonly hierarchies: number;
  readonly lastRequest: GeneratedEntityToolRequest | null;
  readonly lastFind: ApertureEntityFindReport | null;
  readonly lastGet: ApertureEntityGetReport | null;
  readonly lastMutation: ApertureEntitySetComponentFieldReport | null;
  readonly lastSnapshot: ApertureEntityLookupSnapshot | null;
  readonly lastDiff: ApertureEntitySnapshotDiff | null;
  readonly lastHierarchy: ApertureEntityHierarchyReport | null;
  readonly diagnostics: readonly ApertureEntityLookupDiagnostic[];
}

export interface GeneratedEntityToolBridge {
  handle(command: ApertureGeneratedCommand): boolean;
  call(tool: string, payload: unknown): GeneratedDevtoolsToolResult;
  summary(): GeneratedEntityToolStatus;
}

export function createGeneratedEntityToolBridge(
  world: EcsWorld,
): GeneratedEntityToolBridge {
  let finds = 0;
  let gets = 0;
  let mutations = 0;
  let snapshots = 0;
  let diffs = 0;
  let hierarchies = 0;
  let lastRequest: GeneratedEntityToolRequest | null = null;
  let lastFind: ApertureEntityFindReport | null = null;
  let lastGet: ApertureEntityGetReport | null = null;
  let lastMutation: ApertureEntitySetComponentFieldReport | null = null;
  let lastSnapshot: ApertureEntityLookupSnapshot | null = null;
  let lastDiff: ApertureEntitySnapshotDiff | null = null;
  let lastHierarchy: ApertureEntityHierarchyReport | null = null;
  let diagnostics: readonly ApertureEntityLookupDiagnostic[] = [];

  return {
    handle(command) {
      if (command.channel === APERTURE_ENTITY_FIND_COMMAND_CHANNEL) {
        const report = findApertureEntities(
          world,
          findQueryFromPayload(command.payload, 50),
        );

        finds += 1;
        lastRequest = entityToolRequest(command);
        lastFind = report;
        diagnostics = report.diagnostics;
        return true;
      }

      if (command.channel === APERTURE_ENTITY_GET_COMMAND_CHANNEL) {
        const ref = entityRefFromPayload(command.payload, lastFind, lastGet);
        const report =
          ref === null
            ? {
                ok: false as const,
                diagnostic: missingEntityRefDiagnostic(command.channel),
              }
            : getApertureEntitySummary(world, ref);

        gets += 1;
        lastRequest = entityToolRequest(command);
        lastGet = report;
        diagnostics = report.ok ? [] : [report.diagnostic];
        return true;
      }

      if (command.channel === APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL) {
        const request = setComponentRequestFromPayload(
          command.payload,
          lastFind,
          lastGet,
        );
        const report =
          "diagnostic" in request
            ? {
                ok: false as const,
                diagnostic: request.diagnostic,
              }
            : setApertureEntityComponentField(world, request);

        mutations += 1;
        lastRequest = entityToolRequest(command);
        lastMutation = report;
        diagnostics = report.ok ? [] : [report.diagnostic];
        return true;
      }

      if (command.channel === APERTURE_ENTITY_SNAPSHOT_COMMAND_CHANNEL) {
        const snapshot = createApertureEntityLookupSnapshot(
          world,
          snapshotOptionsFromPayload(
            command.payload,
            `generated-snapshot-${snapshots + 1}`,
          ),
        );

        snapshots += 1;
        lastRequest = entityToolRequest(command);
        lastSnapshot = snapshot;
        lastDiff = null;
        diagnostics = snapshot.diagnostics;
        return true;
      }

      if (command.channel === APERTURE_ENTITY_DIFF_COMMAND_CHANNEL) {
        lastRequest = entityToolRequest(command);

        if (lastSnapshot === null) {
          diagnostics = [
            {
              code: "aperture.entityTools.diffMissingSnapshot",
              severity: "error",
              message:
                "Entity diff requires a previous generated entity snapshot.",
              data: { channel: command.channel },
              suggestedFix:
                "Request aperture.devtools.entity.snapshot before requesting aperture.devtools.entity.diff.",
            },
          ];
          lastDiff = null;
          return true;
        }

        const nextSnapshot = createApertureEntityLookupSnapshot(
          world,
          snapshotOptionsFromPayload(
            command.payload,
            `generated-diff-${diffs + 1}`,
          ),
        );
        const diff = diffApertureEntityLookupSnapshots(
          lastSnapshot,
          nextSnapshot,
        );

        snapshots += 1;
        diffs += 1;
        lastSnapshot = nextSnapshot;
        lastDiff = diff;
        diagnostics = diff.diagnostics;
        return true;
      }

      if (command.channel === APERTURE_ENTITY_HIERARCHY_COMMAND_CHANNEL) {
        const hierarchy = createApertureEntityHierarchy(world);

        hierarchies += 1;
        lastRequest = entityToolRequest(command);
        lastHierarchy = hierarchy;
        diagnostics = hierarchy.diagnostics;
        return true;
      }

      return false;
    },
    call(tool, payload) {
      if (tool === "ecs_find_entities" || tool === "ecs_query") {
        const report = findApertureEntities(
          world,
          findQueryFromPayload(payload, 50),
        );

        finds += 1;
        lastRequest = { channel: tool, payload: jsonSafeValue(payload) };
        lastFind = report;
        diagnostics = report.diagnostics;
        return {
          ok: true,
          result: report,
          diagnostics: report.diagnostics,
        };
      }

      if (tool === "ecs_get_entity") {
        const ref = entityRefFromPayload(payload, lastFind, lastGet);
        const report =
          ref === null
            ? {
                ok: false as const,
                diagnostic: missingEntityRefDiagnostic(tool),
              }
            : getApertureEntitySummary(world, ref);

        gets += 1;
        lastRequest = { channel: tool, payload: jsonSafeValue(payload) };
        lastGet = report;
        diagnostics = report.ok ? [] : [report.diagnostic];
        return report.ok
          ? { ok: true, result: report }
          : { ok: false, diagnostics: [report.diagnostic], result: report };
      }

      if (tool === "ecs_set_component_field") {
        const request = setComponentRequestFromPayload(
          payload,
          lastFind,
          lastGet,
        );
        const report =
          "diagnostic" in request
            ? {
                ok: false as const,
                diagnostic: request.diagnostic,
              }
            : setApertureEntityComponentField(world, request);

        mutations += 1;
        lastRequest = { channel: tool, payload: jsonSafeValue(payload) };
        lastMutation = report;
        diagnostics = report.ok ? [] : [report.diagnostic];
        return report.ok
          ? { ok: true, result: report }
          : { ok: false, diagnostics: [report.diagnostic], result: report };
      }

      if (tool === "ecs_snapshot") {
        const snapshot = createApertureEntityLookupSnapshot(
          world,
          snapshotOptionsFromPayload(
            payload,
            `generated-snapshot-${snapshots + 1}`,
          ),
        );

        snapshots += 1;
        lastRequest = { channel: tool, payload: jsonSafeValue(payload) };
        lastSnapshot = snapshot;
        lastDiff = null;
        diagnostics = snapshot.diagnostics;
        return {
          ok: true,
          result: snapshot,
          diagnostics: snapshot.diagnostics,
        };
      }

      if (tool === "ecs_diff") {
        lastRequest = { channel: tool, payload: jsonSafeValue(payload) };

        if (lastSnapshot === null) {
          diagnostics = [
            {
              code: "aperture.entityTools.diffMissingSnapshot",
              severity: "error",
              message:
                "Entity diff requires a previous generated entity snapshot.",
              data: { channel: tool },
              suggestedFix: "Call ecs_snapshot before requesting ecs_diff.",
            },
          ];
          lastDiff = null;
          return { ok: false, diagnostics, result: null };
        }

        const nextSnapshot = createApertureEntityLookupSnapshot(
          world,
          snapshotOptionsFromPayload(payload, `generated-diff-${diffs + 1}`),
        );
        const diff = diffApertureEntityLookupSnapshots(
          lastSnapshot,
          nextSnapshot,
        );

        snapshots += 1;
        diffs += 1;
        lastSnapshot = nextSnapshot;
        lastDiff = diff;
        diagnostics = diff.diagnostics;
        return { ok: true, result: diff, diagnostics: diff.diagnostics };
      }

      if (tool === "ecs_get_hierarchy") {
        const hierarchy = createApertureEntityHierarchy(world);

        hierarchies += 1;
        lastRequest = { channel: tool, payload: jsonSafeValue(payload) };
        lastHierarchy = hierarchy;
        diagnostics = hierarchy.diagnostics;
        return {
          ok: true,
          result: hierarchy,
          diagnostics: hierarchy.diagnostics,
        };
      }

      if (tool === "ecs_get_component_schema") {
        const report = createComponentSchemaReport(world, payload);

        lastRequest = { channel: tool, payload: jsonSafeValue(payload) };
        diagnostics = report.diagnostics;
        return {
          ok: report.diagnostics.every(
            (diagnostic) => diagnostic.severity !== "error",
          ),
          result: report,
          diagnostics: report.diagnostics,
        };
      }

      return {
        ok: false,
        diagnostics: [
          {
            code: "aperture.devtools.unsupportedEntityTool",
            severity: "error",
            message: `Unsupported generated entity devtools tool '${tool}'.`,
            data: { tool },
            suggestedFix:
              "Use one of the supported ECS tools or add a focused generated worker handler.",
          },
        ],
      };
    },
    summary() {
      return {
        finds,
        gets,
        mutations,
        snapshots,
        diffs,
        hierarchies,
        lastRequest,
        lastFind,
        lastGet,
        lastMutation,
        lastSnapshot,
        lastDiff,
        lastHierarchy,
        diagnostics,
      };
    },
  };
}

export function entityRefFromValue(value: unknown): EcsEntityRef | null {
  if (!isRecord(value)) {
    return null;
  }

  const index = numberFromValue(value["index"]);
  const generation = numberFromValue(value["generation"]);

  return index === undefined || generation === undefined
    ? null
    : { index, generation };
}

function createComponentSchemaReport(
  world: EcsWorld,
  payload: unknown,
): {
  readonly schemas: readonly {
    readonly id: string;
    readonly description?: string;
    readonly fields: Readonly<Record<string, unknown>>;
  }[];
  readonly diagnostics: readonly ApertureEntityLookupDiagnostic[];
} {
  const requested = stringFromValue(
    isRecord(payload) ? (payload["component"] ?? payload["id"]) : undefined,
  );
  const components = new Map<
    string,
    {
      readonly id: string;
      readonly description?: string;
      readonly fields: Readonly<Record<string, unknown>>;
    }
  >();

  for (const entity of world.queryManager.registerQuery({ required: [] })
    .entities) {
    for (const component of entity.getComponents()) {
      if (requested !== undefined && component.id !== requested) {
        continue;
      }

      components.set(component.id, {
        id: component.id,
        ...(typeof component.description === "string" &&
        component.description.length > 0
          ? { description: component.description }
          : {}),
        fields: jsonSafeValue(component.schema) as Readonly<
          Record<string, unknown>
        >,
      });
    }
  }

  const schemas = [...components.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const diagnostics: ApertureEntityLookupDiagnostic[] =
    requested !== undefined && schemas.length === 0
      ? [
          {
            code: "aperture.devtools.componentSchemaNotFound",
            severity: "error",
            message: `No active component schema was found for '${requested}'.`,
            data: { component: requested },
            suggestedFix:
              "Check the component id or inspect an entity that currently has the component.",
          },
        ]
      : [];

  return { schemas, diagnostics };
}

function findQueryFromPayload(
  payload: unknown,
  fallbackLimit: number,
): ApertureEntityFindQuery {
  const record = isRecord(payload) ? payload : {};
  const query = isRecord(record["query"]) ? record["query"] : record;
  const source = sourceFilterFromValue(query["source"]);
  const key = stringFromValue(query["key"]);
  const namePattern = stringFromValue(query["namePattern"]);
  const withComponents = stringArrayFromValue(query["withComponents"]);
  const tags = stringArrayFromValue(query["tags"]);
  const limit = numberFromValue(query["limit"]);

  return {
    ...(key === undefined ? {} : { key }),
    ...(namePattern === undefined ? {} : { namePattern }),
    ...(withComponents === undefined ? {} : { withComponents }),
    ...(tags === undefined ? {} : { tags }),
    ...(source === undefined ? {} : { source }),
    limit: limit ?? fallbackLimit,
  };
}

function entityRefFromPayload(
  payload: unknown,
  lastFind: ApertureEntityFindReport | null,
  lastGet: ApertureEntityGetReport | null,
): EcsEntityRef | null {
  const record = isRecord(payload) ? payload : {};
  const explicit = entityRefFromValue(record["entity"] ?? record);

  if (explicit !== null) {
    return explicit;
  }

  const queryRef = firstEntityFromFindReportPayload(payload);
  if (queryRef !== null) {
    return queryRef;
  }

  if (lastGet?.ok) {
    return lastGet.summary.entity;
  }

  return lastFind?.summaries[0]?.entity ?? null;
}

function firstEntityFromFindReportPayload(
  payload: unknown,
): EcsEntityRef | null {
  const record = isRecord(payload) ? payload : {};
  const summaries = Array.isArray(record["summaries"])
    ? record["summaries"]
    : [];
  const first = summaries.find(isRecord);

  return first === undefined ? null : entityRefFromValue(first["entity"]);
}

function setComponentRequestFromPayload(
  payload: unknown,
  lastFind: ApertureEntityFindReport | null,
  lastGet: ApertureEntityGetReport | null,
):
  | ApertureEntitySetComponentFieldRequest
  | { readonly diagnostic: ApertureEntityLookupDiagnostic } {
  const record = isRecord(payload) ? payload : {};
  const entity = entityRefFromPayload(payload, lastFind, lastGet);
  const component = stringFromValue(record["component"]);
  const field = stringFromValue(record["field"]);

  if (entity === null) {
    return {
      diagnostic: missingEntityRefDiagnostic(
        APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL,
      ),
    };
  }

  if (component === undefined || field === undefined) {
    return {
      diagnostic: {
        code: "aperture.entityTools.invalidMutationRequest",
        severity: "error",
        message: "Entity mutation requires component and field string values.",
        data: {
          channel: APERTURE_ENTITY_SET_COMPONENT_COMMAND_CHANNEL,
          hasComponent: component !== undefined,
          hasField: field !== undefined,
        },
        suggestedFix:
          "Dispatch aperture.devtools.entity.setComponent with { entity, component, field, value }.",
      },
    };
  }

  return {
    entity,
    component,
    field,
    value: record["value"],
  };
}

function missingEntityRefDiagnostic(
  channel: string,
): ApertureEntityLookupDiagnostic {
  return {
    code: "aperture.entityTools.missingEntityRef",
    severity: "error",
    message:
      "Entity tool command requires an entity { index, generation } reference.",
    data: { channel },
    suggestedFix:
      "Run aperture.devtools.entity.find first and pass the returned entity reference, or select an entity in the developer panel.",
  };
}

function snapshotOptionsFromPayload(
  payload: unknown,
  fallbackLabel: string,
): ApertureEntityLookupSnapshotOptions {
  const record = isRecord(payload) ? payload : {};
  const query = isRecord(record["query"]) ? record["query"] : record;
  const source = sourceFilterFromValue(query["source"]);
  const entities = entityRefsFromValue(query["entities"]);
  const key = stringFromValue(query["key"]);
  const namePattern = stringFromValue(query["namePattern"]);
  const withComponents = stringArrayFromValue(query["withComponents"]);
  const tags = stringArrayFromValue(query["tags"]);
  const limit = numberFromValue(query["limit"]);

  return {
    label: stringFromValue(record["label"]) ?? fallbackLabel,
    ...(key === undefined ? {} : { key }),
    ...(namePattern === undefined ? {} : { namePattern }),
    ...(withComponents === undefined ? {} : { withComponents }),
    ...(tags === undefined ? {} : { tags }),
    ...(source === undefined ? {} : { source }),
    ...(limit === undefined ? {} : { limit }),
    ...(entities === undefined ? {} : { entities }),
  };
}

function entityToolRequest(
  command: ApertureGeneratedCommand,
): GeneratedEntityToolRequest {
  return {
    channel: command.channel,
    payload: jsonSafeValue(command.payload),
  };
}

function sourceFilterFromValue(
  value: unknown,
): ApertureEntityLookupSnapshotOptions["source"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const assetId = stringFromValue(value["assetId"]);
  const gltfNodeIndex = numberFromValue(value["gltfNodeIndex"]);
  const gltfNodePath = stringFromValue(value["gltfNodePath"]);

  return {
    ...(assetId === undefined ? {} : { assetId }),
    ...(gltfNodeIndex === undefined ? {} : { gltfNodeIndex }),
    ...(gltfNodePath === undefined ? {} : { gltfNodePath }),
  };
}

function entityRefsFromValue(
  value: unknown,
): ApertureEntityLookupSnapshotOptions["entities"] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const refs = value
    .filter(isRecord)
    .map((entry) => ({
      index: numberFromValue(entry["index"]),
      generation: numberFromValue(entry["generation"]),
    }))
    .filter(
      (
        ref,
      ): ref is {
        readonly index: number;
        readonly generation: number;
      } => ref.index !== undefined && ref.generation !== undefined,
    );

  return refs.length === 0 ? undefined : refs;
}
