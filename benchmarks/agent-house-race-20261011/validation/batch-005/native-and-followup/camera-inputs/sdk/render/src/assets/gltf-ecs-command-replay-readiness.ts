import type {
  GltfEcsAuthoringCommandPlan,
  GltfEcsAuthoringComponentName,
  GltfParentCommandValue,
} from "./gltf-ecs-authoring-command-plan.js";

export type GltfEcsReplayReadinessStatus = "absent" | "ready" | "blocked";

export type GltfEcsReplayReadinessBlockerCode =
  | "gltfEcsReplayReadiness.invalidPlan"
  | "gltfEcsReplayReadiness.duplicateEntityKey"
  | "gltfEcsReplayReadiness.missingEntityKey"
  | "gltfEcsReplayReadiness.missingParentEntityKey"
  | "gltfEcsReplayReadiness.unknownComponent";

export interface GltfEcsReplayReadinessBlockerSummary {
  readonly code: GltfEcsReplayReadinessBlockerCode;
  readonly message: string;
  readonly count: number;
}

export interface GltfEcsReplayReadinessSummaryJsonValue {
  readonly status: GltfEcsReplayReadinessStatus;
  readonly ready: boolean | null;
  readonly reason: string | null;
  readonly requiredWorld: true;
  readonly wouldRegisterComponents: boolean;
  readonly expectedCreateEntityCount: number;
  readonly expectedAddComponentCount: number;
  readonly requiredComponents: readonly GltfEcsAuthoringComponentName[];
  readonly blockerCount: number;
  readonly blockers: readonly GltfEcsReplayReadinessBlockerSummary[];
}

export interface GltfEcsReplayReadinessSummaryOptions {
  readonly registerComponents?: boolean;
}

export function createGltfEcsReplayReadinessSummaryJsonValue(
  plan: GltfEcsAuthoringCommandPlan | null,
  options: GltfEcsReplayReadinessSummaryOptions = {},
): GltfEcsReplayReadinessSummaryJsonValue {
  const wouldRegisterComponents = options.registerComponents ?? true;

  if (plan === null) {
    return {
      status: "absent",
      ready: null,
      reason: "No ECS command plan was provided.",
      requiredWorld: true,
      wouldRegisterComponents,
      expectedCreateEntityCount: 0,
      expectedAddComponentCount: 0,
      requiredComponents: [],
      blockerCount: 0,
      blockers: [],
    };
  }

  const createEntityKeys = new Set<string>();
  const requiredComponents = new Set<GltfEcsAuthoringComponentName>();
  const blockers = new Map<
    GltfEcsReplayReadinessBlockerCode,
    GltfEcsReplayReadinessBlockerSummary
  >();
  let expectedCreateEntityCount = 0;
  let expectedAddComponentCount = 0;

  if (!plan.valid) {
    addBlocker(
      blockers,
      "gltfEcsReplayReadiness.invalidPlan",
      "Command replay is blocked because the ECS command plan is invalid.",
    );
  }

  for (const command of plan.commands) {
    if (command.type !== "createEntity") {
      continue;
    }

    expectedCreateEntityCount += 1;
    if (createEntityKeys.has(command.entityKey)) {
      addBlocker(
        blockers,
        "gltfEcsReplayReadiness.duplicateEntityKey",
        "Command replay is blocked because a createEntity key appears more than once.",
      );
    }
    createEntityKeys.add(command.entityKey);
  }

  for (const command of plan.commands) {
    if (command.type !== "addComponent") {
      continue;
    }

    expectedAddComponentCount += 1;

    if (!isSupportedComponent(command.component)) {
      addBlocker(
        blockers,
        "gltfEcsReplayReadiness.unknownComponent",
        "Command replay is blocked because the command plan contains an unsupported component.",
      );
      continue;
    }

    requiredComponents.add(command.component);

    if (!createEntityKeys.has(command.entityKey)) {
      addBlocker(
        blockers,
        "gltfEcsReplayReadiness.missingEntityKey",
        "Command replay is blocked because an addComponent command targets an uncreated entity key.",
      );
    }

    if (command.component === "Parent") {
      const value = command.value as GltfParentCommandValue;
      if (
        value.parentEntityKey !== null &&
        !createEntityKeys.has(value.parentEntityKey)
      ) {
        addBlocker(
          blockers,
          "gltfEcsReplayReadiness.missingParentEntityKey",
          "Command replay is blocked because a Parent component references an uncreated parent entity key.",
        );
      }
    }
  }

  const blockerList = BLOCKER_ORDER.flatMap((code) => {
    const blocker = blockers.get(code);
    return blocker === undefined ? [] : [blocker];
  });
  const ready = blockerList.length === 0;

  return {
    status: ready ? "ready" : "blocked",
    ready,
    reason: ready
      ? null
      : "Command replay readiness found blocking command-plan issues.",
    requiredWorld: true,
    wouldRegisterComponents,
    expectedCreateEntityCount,
    expectedAddComponentCount,
    requiredComponents: COMPONENT_ORDER.filter((component) =>
      requiredComponents.has(component),
    ),
    blockerCount: blockerList.reduce(
      (total, blocker) => total + blocker.count,
      0,
    ),
    blockers: blockerList,
  };
}

function addBlocker(
  blockers: Map<
    GltfEcsReplayReadinessBlockerCode,
    GltfEcsReplayReadinessBlockerSummary
  >,
  code: GltfEcsReplayReadinessBlockerCode,
  message: string,
): void {
  const existing = blockers.get(code);
  if (existing === undefined) {
    blockers.set(code, { code, message, count: 1 });
    return;
  }

  blockers.set(code, {
    ...existing,
    count: existing.count + 1,
  });
}

function isSupportedComponent(
  component: string,
): component is GltfEcsAuthoringComponentName {
  return (COMPONENT_ORDER as readonly string[]).includes(component);
}

const COMPONENT_ORDER: readonly GltfEcsAuthoringComponentName[] = [
  "Name",
  "LocalTransform",
  "Parent",
  "WorldTransform",
  "Mesh",
  "Material",
  "Visibility",
];

const BLOCKER_ORDER: readonly GltfEcsReplayReadinessBlockerCode[] = [
  "gltfEcsReplayReadiness.invalidPlan",
  "gltfEcsReplayReadiness.duplicateEntityKey",
  "gltfEcsReplayReadiness.missingEntityKey",
  "gltfEcsReplayReadiness.missingParentEntityKey",
  "gltfEcsReplayReadiness.unknownComponent",
];
