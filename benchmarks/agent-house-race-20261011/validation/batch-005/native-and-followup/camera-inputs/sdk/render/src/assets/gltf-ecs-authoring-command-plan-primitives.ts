import type { GltfTraversedNode } from "./gltf-scene-traversal.js";
import type {
  GltfEcsAuthoringCommand,
  GltfEcsAuthoringCommandPlanOptions,
  GltfEcsAuthoringDiagnostic,
  GltfSkinCommandValue,
  GltfSkippedEcsAuthoringEntry,
} from "./gltf-ecs-authoring-command-plan-types.js";
import { findImportedSkin } from "./gltf-skin-import.js";
import {
  appendGltfEcsEntityCommands,
  gltfIdentityLocalTransformCommandValue,
} from "./gltf-ecs-authoring-command-plan-entities.js";
import {
  gltfEcsMeshReadinessStatus,
  type GltfEcsMeshReadiness,
} from "./gltf-ecs-authoring-command-plan-primitive-readiness.js";
import {
  gltfEcsPrimitiveEntityKey,
  skipGltfEcsMeshNotReady,
  skipGltfEcsMissingPrimitiveMaterialResolution,
  skipGltfEcsUnresolvedPrimitiveMaterial,
} from "./gltf-ecs-authoring-command-plan-primitive-skips.js";

export {
  createGltfEcsMeshReadiness,
  type GltfEcsMeshReadiness,
} from "./gltf-ecs-authoring-command-plan-primitive-readiness.js";

export function appendGltfEcsPrimitiveCommands(input: {
  readonly node: GltfTraversedNode;
  readonly options: GltfEcsAuthoringCommandPlanOptions;
  readonly commands: GltfEcsAuthoringCommand[];
  readonly diagnostics: GltfEcsAuthoringDiagnostic[];
  readonly skipped: GltfSkippedEcsAuthoringEntry[];
  readonly seenEntityKeys: Set<string>;
  readonly dependencies: Set<string>;
  readonly meshReadiness: GltfEcsMeshReadiness;
  readonly nodeEntityKeyByIndex: ReadonlyMap<number, string>;
}): void {
  if (
    input.node.meshIndex === null ||
    input.options.primitiveMaterialReport === undefined ||
    input.options.meshRegistrationReport === undefined
  ) {
    return;
  }

  const unresolved = input.options.primitiveMaterialReport.unresolved.filter(
    (entry) => entry.meshIndex === input.node.meshIndex,
  );
  const resolved = input.options.primitiveMaterialReport.resolved.filter(
    (entry) => entry.meshIndex === input.node.meshIndex,
  );

  if (resolved.length === 0 && unresolved.length === 0) {
    skipGltfEcsMissingPrimitiveMaterialResolution({
      node: input.node,
      meshIndex: input.node.meshIndex,
      diagnostics: input.diagnostics,
      skipped: input.skipped,
    });
    return;
  }

  for (const entry of unresolved) {
    skipGltfEcsUnresolvedPrimitiveMaterial({
      node: input.node,
      unresolved: entry,
      diagnostics: input.diagnostics,
      skipped: input.skipped,
    });
  }

  for (const entry of resolved) {
    const meshStatus = gltfEcsMeshReadinessStatus(input.meshReadiness, entry);
    if (meshStatus.kind !== "ready") {
      skipGltfEcsMeshNotReady({
        node: input.node,
        material: entry,
        meshStatus,
        diagnostics: input.diagnostics,
        skipped: input.skipped,
      });
      continue;
    }

    const entityKey = gltfEcsPrimitiveEntityKey(input.node, entry);
    const appended = appendGltfEcsEntityCommands({
      commands: input.commands,
      diagnostics: input.diagnostics,
      seenEntityKeys: input.seenEntityKeys,
      entityKey,
      label: `${input.node.label}.Primitive${entry.primitiveIndex}`,
      parentEntityKey: input.node.entityKey,
      localTransform: gltfIdentityLocalTransformCommandValue(),
      sceneIndex: input.options.traversalReport.sceneIndex,
      nodeIndex: input.node.nodeIndex,
    });
    if (!appended) {
      continue;
    }

    input.commands.push(
      {
        type: "addComponent",
        entityKey,
        component: "Mesh",
        value: {
          meshId: assetIdFromHandleKey(entry.meshHandleKey, "mesh"),
          handleKey: entry.meshHandleKey,
        },
      },
      {
        type: "addComponent",
        entityKey,
        component: "Material",
        value: {
          materialId: assetIdFromHandleKey(entry.materialHandleKey, "material"),
          handleKey: entry.materialHandleKey,
        },
      },
    );
    input.dependencies.add(entry.meshHandleKey);
    input.dependencies.add(entry.materialHandleKey);

    const skinValue = gltfSkinCommandValue({
      node: input.node,
      options: input.options,
      nodeEntityKeyByIndex: input.nodeEntityKeyByIndex,
      diagnostics: input.diagnostics,
    });
    if (skinValue !== null) {
      input.commands.push({
        type: "addComponent",
        entityKey,
        component: "Skin",
        value: skinValue,
      });
    }
  }
}

function gltfSkinCommandValue(input: {
  readonly node: GltfTraversedNode;
  readonly options: GltfEcsAuthoringCommandPlanOptions;
  readonly nodeEntityKeyByIndex: ReadonlyMap<number, string>;
  readonly diagnostics: GltfEcsAuthoringDiagnostic[];
}): GltfSkinCommandValue | null {
  if (input.node.skinIndex === null || input.options.skinReport === undefined) {
    return null;
  }

  const skin = findImportedSkin(input.options.skinReport, input.node.skinIndex);
  if (skin === null) {
    return null;
  }

  const jointEntityKeys: string[] = [];
  for (const jointNodeIndex of skin.jointNodeIndices) {
    const jointEntityKey = input.nodeEntityKeyByIndex.get(jointNodeIndex);
    if (jointEntityKey === undefined) {
      input.diagnostics.push({
        code: "gltfEcsAuthoring.skinJointNodeMissing",
        severity: "error",
        message: `glTF skin ${input.node.skinIndex} joint node ${jointNodeIndex} was not produced by scene traversal.`,
        nodeIndex: input.node.nodeIndex,
        entityKey: input.node.entityKey,
      });
      return null;
    }
    jointEntityKeys.push(jointEntityKey);
  }

  const skeletonEntityKey =
    skin.skeletonNodeIndex === null
      ? null
      : (input.nodeEntityKeyByIndex.get(skin.skeletonNodeIndex) ?? null);

  return {
    jointEntityKeys,
    inverseBindMatrices: Array.from(skin.inverseBindMatrices),
    skeletonEntityKey,
  };
}

function assetIdFromHandleKey(handleKey: string, kind: "mesh" | "material") {
  const prefix = `${kind}:`;
  return handleKey.startsWith(prefix)
    ? handleKey.slice(prefix.length)
    : handleKey;
}
