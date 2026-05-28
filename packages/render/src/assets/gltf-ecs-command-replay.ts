import {
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  registerMetadataComponents,
  registerTransformComponents,
  type Entity,
} from "@aperture-engine/simulation";

import {
  Material,
  Mesh,
  Visibility,
  registerRenderAuthoringComponents,
} from "../rendering/authoring.js";
import {
  createGltfEcsCommandReplayReport,
  gltfEcsCommandReplayReportToJson,
  gltfEcsCommandReplayReportToJsonValue,
} from "./gltf-ecs-command-replay-report.js";
import type {
  GltfAppliedEcsComponent,
  GltfCreatedEcsEntity,
  GltfEcsCommandReplayDiagnostic,
  GltfEcsCommandReplayDiagnosticCode,
  GltfEcsCommandReplayOptions,
  GltfEcsCommandReplayReport,
  GltfSkippedEcsCommand,
} from "./gltf-ecs-command-replay-types.js";
import type {
  GltfEcsAuthoringCommand,
  GltfLocalTransformCommandValue,
  GltfMaterialCommandValue,
  GltfMeshCommandValue,
  GltfNameCommandValue,
  GltfParentCommandValue,
  GltfVisibilityCommandValue,
  GltfWorldTransformCommandValue,
} from "./gltf-ecs-authoring-command-plan.js";

export {
  gltfEcsCommandReplayReportToJson,
  gltfEcsCommandReplayReportToJsonValue,
};

export type * from "./gltf-ecs-command-replay-types.js";

export function replayGltfEcsAuthoringCommands(
  options: GltfEcsCommandReplayOptions,
): GltfEcsCommandReplayReport {
  const entitiesByKey = new Map<string, Entity>();
  const created: GltfCreatedEcsEntity[] = [];
  const appliedComponents: GltfAppliedEcsComponent[] = [];
  const skipped: GltfSkippedEcsCommand[] = [];
  const diagnostics: GltfEcsCommandReplayDiagnostic[] = [];

  if (!options.plan.valid) {
    const diagnostic: GltfEcsCommandReplayDiagnostic = {
      code: "gltfEcsReplay.invalidPlan",
      severity: "error",
      message:
        "GLB ECS authoring commands were not replayed because the command plan is invalid.",
    };
    diagnostics.push(diagnostic);
    return createGltfEcsCommandReplayReport({
      entitiesByKey,
      created,
      appliedComponents,
      skipped,
      diagnostics,
    });
  }

  if (options.registerComponents ?? true) {
    registerTransformComponents(options.world);
    registerMetadataComponents(options.world);
    registerRenderAuthoringComponents(options.world);
  }

  options.plan.commands.forEach((command, commandIndex) => {
    if (command.type !== "createEntity") {
      return;
    }

    if (entitiesByKey.has(command.entityKey)) {
      skip({
        diagnostics,
        skipped,
        commandIndex,
        entityKey: command.entityKey,
        code: "gltfEcsReplay.duplicateEntityKey",
        message: `Entity key '${command.entityKey}' was created more than once.`,
      });
      return;
    }

    const entity = options.world.createEntity();
    entitiesByKey.set(command.entityKey, entity);
    created.push({
      entityKey: command.entityKey,
      label: command.label,
      entityIndex: entity.index,
      entityGeneration: entity.generation,
    });
  });

  options.plan.commands.forEach((command, commandIndex) => {
    if (command.type !== "addComponent") {
      return;
    }

    const entity = entitiesByKey.get(command.entityKey);
    if (entity === undefined) {
      skip({
        diagnostics,
        skipped,
        commandIndex,
        entityKey: command.entityKey,
        component: command.component,
        code: "gltfEcsReplay.missingEntityKey",
        message: `Component '${command.component}' was not applied because entity key '${command.entityKey}' was not created.`,
      });
      return;
    }

    const applied = applyComponent({
      entity,
      command,
      commandIndex,
      entitiesByKey,
      diagnostics,
      skipped,
    });
    if (applied) {
      appliedComponents.push({
        entityKey: command.entityKey,
        component: command.component,
        commandIndex,
      });
    }
  });

  return createGltfEcsCommandReplayReport({
    entitiesByKey,
    created,
    appliedComponents,
    skipped,
    diagnostics,
  });
}

function applyComponent(input: {
  readonly entity: Entity;
  readonly command: Extract<GltfEcsAuthoringCommand, { type: "addComponent" }>;
  readonly commandIndex: number;
  readonly entitiesByKey: ReadonlyMap<string, Entity>;
  readonly diagnostics: GltfEcsCommandReplayDiagnostic[];
  readonly skipped: GltfSkippedEcsCommand[];
}): boolean {
  try {
    switch (input.command.component) {
      case "Name": {
        const value = input.command.value as GltfNameCommandValue;
        if (!isRecord(value) || typeof value.value !== "string") {
          invalidComponentValue(input, "Name.value must be a string.");
          return false;
        }
        input.entity.addComponent(Name, { value: value.value });
        return true;
      }
      case "LocalTransform": {
        const value = input.command.value as GltfLocalTransformCommandValue;
        if (
          !isRecord(value) ||
          !isTuple3(value.translation) ||
          !isTuple4(value.rotation) ||
          !isTuple3(value.scale)
        ) {
          invalidComponentValue(
            input,
            "LocalTransform value must contain finite translation, rotation, and scale tuples.",
          );
          return false;
        }
        input.entity.addComponent(LocalTransform, {
          translation: tuple3(value.translation),
          rotation: tuple4(value.rotation),
          scale: tuple3(value.scale),
        });
        return true;
      }
      case "Parent": {
        const value = input.command.value as GltfParentCommandValue;
        if (
          !isRecord(value) ||
          !(
            value.parentEntityKey === null ||
            typeof value.parentEntityKey === "string"
          )
        ) {
          invalidComponentValue(
            input,
            "Parent.parentEntityKey must be a string or null.",
          );
          return false;
        }
        const parent =
          value.parentEntityKey === null
            ? null
            : input.entitiesByKey.get(value.parentEntityKey);
        if (parent === undefined) {
          skip({
            diagnostics: input.diagnostics,
            skipped: input.skipped,
            commandIndex: input.commandIndex,
            entityKey: input.command.entityKey,
            component: input.command.component,
            code: "gltfEcsReplay.missingParentEntityKey",
            parentEntityKey: value.parentEntityKey,
            message: `Parent '${value.parentEntityKey}' was not found for entity '${input.command.entityKey}'.`,
          });
          return false;
        }

        input.entity.addComponent(Parent, { entity: parent });
        return true;
      }
      case "WorldTransform": {
        const value = input.command.value as GltfWorldTransformCommandValue;
        if (
          !isRecord(value) ||
          !isTuple4(value.col0) ||
          !isTuple4(value.col1) ||
          !isTuple4(value.col2) ||
          !isTuple4(value.col3)
        ) {
          invalidComponentValue(
            input,
            "WorldTransform value must contain finite column tuples.",
          );
          return false;
        }
        input.entity.addComponent(WorldTransform, {
          col0: tuple4(value.col0),
          col1: tuple4(value.col1),
          col2: tuple4(value.col2),
          col3: tuple4(value.col3),
        });
        return true;
      }
      case "Visibility": {
        const value = input.command.value as GltfVisibilityCommandValue;
        if (!isRecord(value) || typeof value.visible !== "boolean") {
          invalidComponentValue(input, "Visibility.visible must be a boolean.");
          return false;
        }
        input.entity.addComponent(Visibility, { visible: value.visible });
        return true;
      }
      case "Mesh": {
        const value = input.command.value as GltfMeshCommandValue;
        if (
          !isRecord(value) ||
          typeof value.meshId !== "string" ||
          typeof value.handleKey !== "string"
        ) {
          invalidComponentValue(
            input,
            "Mesh value must contain meshId and handleKey strings.",
          );
          return false;
        }
        input.entity.addComponent(Mesh, { meshId: value.handleKey });
        return true;
      }
      case "Material": {
        const value = input.command.value as GltfMaterialCommandValue;
        if (
          !isRecord(value) ||
          typeof value.materialId !== "string" ||
          typeof value.handleKey !== "string"
        ) {
          invalidComponentValue(
            input,
            "Material value must contain materialId and handleKey strings.",
          );
          return false;
        }
        input.entity.addComponent(Material, { materialId: value.handleKey });
        return true;
      }
      default:
        skip({
          diagnostics: input.diagnostics,
          skipped: input.skipped,
          commandIndex: input.commandIndex,
          entityKey: input.command.entityKey,
          component: input.command.component,
          code: "gltfEcsReplay.unknownComponent",
          message: `Component '${input.command.component}' is not supported by GLB ECS replay.`,
        });
        return false;
    }
  } catch (error) {
    skip({
      diagnostics: input.diagnostics,
      skipped: input.skipped,
      commandIndex: input.commandIndex,
      entityKey: input.command.entityKey,
      component: input.command.component,
      code: "gltfEcsReplay.componentApplyFailed",
      message:
        error instanceof Error
          ? error.message
          : `Component '${input.command.component}' could not be applied.`,
    });
    return false;
  }
}

function invalidComponentValue(
  input: {
    readonly command: Extract<
      GltfEcsAuthoringCommand,
      { type: "addComponent" }
    >;
    readonly commandIndex: number;
    readonly diagnostics: GltfEcsCommandReplayDiagnostic[];
    readonly skipped: GltfSkippedEcsCommand[];
  },
  message: string,
): void {
  skip({
    diagnostics: input.diagnostics,
    skipped: input.skipped,
    commandIndex: input.commandIndex,
    entityKey: input.command.entityKey,
    component: input.command.component,
    code: "gltfEcsReplay.invalidComponentValue",
    message,
  });
}

function skip(input: {
  readonly diagnostics: GltfEcsCommandReplayDiagnostic[];
  readonly skipped: GltfSkippedEcsCommand[];
  readonly commandIndex: number;
  readonly entityKey?: string;
  readonly component?: string;
  readonly code: GltfEcsCommandReplayDiagnosticCode;
  readonly message: string;
  readonly parentEntityKey?: string | null;
}): void {
  const diagnostic: GltfEcsCommandReplayDiagnostic = {
    code: input.code,
    severity: "error",
    message: input.message,
    commandIndex: input.commandIndex,
    ...(input.entityKey === undefined ? {} : { entityKey: input.entityKey }),
    ...(input.component === undefined ? {} : { component: input.component }),
    ...(input.parentEntityKey === undefined
      ? {}
      : { parentEntityKey: input.parentEntityKey }),
  };
  input.diagnostics.push(diagnostic);
  input.skipped.push({
    commandIndex: input.commandIndex,
    ...(input.entityKey === undefined ? {} : { entityKey: input.entityKey }),
    ...(input.component === undefined ? {} : { component: input.component }),
    reason: input.code,
    diagnostics: [diagnostic],
  });
}

function tuple3(
  value: readonly [number, number, number],
): [number, number, number] {
  return [value[0], value[1], value[2]];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTuple3(value: unknown): value is readonly [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

function isTuple4(
  value: unknown,
): value is readonly [number, number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

function tuple4(
  value: readonly [number, number, number, number],
): [number, number, number, number] {
  return [value[0], value[1], value[2], value[3]];
}
