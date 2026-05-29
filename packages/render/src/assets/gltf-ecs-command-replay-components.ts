import {
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  type Entity,
} from "@aperture-engine/simulation";

import {
  Material,
  Mesh,
  Skin,
  Visibility,
  type SkinSkeleton,
} from "../rendering/authoring.js";
import {
  skipGltfEcsReplayCommand,
  skipInvalidGltfEcsReplayComponentValue,
} from "./gltf-ecs-command-replay-diagnostics.js";
import type {
  GltfEcsCommandReplayDiagnostic,
  GltfSkippedEcsCommand,
} from "./gltf-ecs-command-replay-types.js";
import {
  isRecord,
  isTuple3,
  isTuple4,
  tuple3,
  tuple4,
} from "./gltf-ecs-command-replay-value-guards.js";
import type {
  GltfEcsAuthoringCommand,
  GltfLocalTransformCommandValue,
  GltfMaterialCommandValue,
  GltfMeshCommandValue,
  GltfNameCommandValue,
  GltfParentCommandValue,
  GltfSkinCommandValue,
  GltfVisibilityCommandValue,
  GltfWorldTransformCommandValue,
} from "./gltf-ecs-authoring-command-plan.js";

export function applyGltfEcsReplayComponent(input: {
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
          skipInvalidGltfEcsReplayComponentValue(
            input,
            "Name.value must be a string.",
          );
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
          skipInvalidGltfEcsReplayComponentValue(
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
          skipInvalidGltfEcsReplayComponentValue(
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
          skipGltfEcsReplayCommand({
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
          skipInvalidGltfEcsReplayComponentValue(
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
          skipInvalidGltfEcsReplayComponentValue(
            input,
            "Visibility.visible must be a boolean.",
          );
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
          skipInvalidGltfEcsReplayComponentValue(
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
          skipInvalidGltfEcsReplayComponentValue(
            input,
            "Material value must contain materialId and handleKey strings.",
          );
          return false;
        }
        input.entity.addComponent(Material, { materialId: value.handleKey });
        return true;
      }
      case "Skin": {
        const value = input.command.value as GltfSkinCommandValue;
        if (
          !isRecord(value) ||
          !Array.isArray(value.jointEntityKeys) ||
          !value.jointEntityKeys.every((key) => typeof key === "string") ||
          !Array.isArray(value.inverseBindMatrices) ||
          !value.inverseBindMatrices.every(
            (component) =>
              typeof component === "number" && Number.isFinite(component),
          ) ||
          !(
            value.skeletonEntityKey === null ||
            typeof value.skeletonEntityKey === "string"
          )
        ) {
          skipInvalidGltfEcsReplayComponentValue(
            input,
            "Skin value must contain jointEntityKeys (strings), inverseBindMatrices (finite numbers), and a nullable skeletonEntityKey.",
          );
          return false;
        }

        // Resolve joint node keys to live entities, deferred to replay time
        // like Parent — joints may be created after the skinned mesh entity.
        const joints: Entity[] = [];
        for (const jointKey of value.jointEntityKeys) {
          const joint = input.entitiesByKey.get(jointKey);
          if (joint === undefined) {
            skipGltfEcsReplayCommand({
              diagnostics: input.diagnostics,
              skipped: input.skipped,
              commandIndex: input.commandIndex,
              entityKey: input.command.entityKey,
              component: input.command.component,
              code: "gltfEcsReplay.missingJointEntityKey",
              message: `Skin joint '${jointKey}' was not found for entity '${input.command.entityKey}'.`,
            });
            return false;
          }
          joints.push(joint);
        }

        const skeleton: SkinSkeleton = {
          joints,
          inverseBindMatrices: Float32Array.from(value.inverseBindMatrices),
        };
        // Seed the palette with identity matrices so the mesh renders in its
        // rest pose until the joint-palette system (M2-T6) computes it.
        const identityPalette = createIdentityJointPalette(joints.length);
        input.entity.addComponent(Skin, {
          jointCount: joints.length,
          jointMatricesJson: JSON.stringify(identityPalette),
          skeleton,
        });
        return true;
      }
      default:
        skipGltfEcsReplayCommand({
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
    skipGltfEcsReplayCommand({
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

function createIdentityJointPalette(jointCount: number): number[] {
  const palette = new Array<number>(jointCount * 16).fill(0);
  for (let joint = 0; joint < jointCount; joint += 1) {
    const base = joint * 16;
    palette[base] = 1;
    palette[base + 5] = 1;
    palette[base + 10] = 1;
    palette[base + 15] = 1;
  }
  return palette;
}
