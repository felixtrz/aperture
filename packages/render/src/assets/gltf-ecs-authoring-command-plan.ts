import type {
  GltfNodeLocalTransform,
  GltfSceneTraversalReport,
  GltfTraversedNode,
} from "./gltf-scene-traversal.js";
import type {
  GltfResolvedPrimitiveMaterial,
  GltfUnresolvedPrimitiveMaterial,
} from "./gltf-primitive-material-resolution.js";
import {
  gltfEcsAuthoringCommandPlanToJson,
  gltfEcsAuthoringCommandPlanToJsonValue,
} from "./gltf-ecs-authoring-command-plan-report.js";
import type {
  GltfEcsAuthoringCommand,
  GltfEcsAuthoringCommandPlan,
  GltfEcsAuthoringCommandPlanOptions,
  GltfEcsAuthoringDiagnostic,
  GltfLocalTransformCommandValue,
  GltfSkippedEcsAuthoringEntry,
  GltfWorldTransformCommandValue,
} from "./gltf-ecs-authoring-command-plan-types.js";

export {
  gltfEcsAuthoringCommandPlanToJson,
  gltfEcsAuthoringCommandPlanToJsonValue,
};

export type * from "./gltf-ecs-authoring-command-plan-types.js";

export function createGltfEcsAuthoringCommandPlan(
  options: GltfEcsAuthoringCommandPlanOptions,
): GltfEcsAuthoringCommandPlan {
  const commands: GltfEcsAuthoringCommand[] = [];
  const diagnostics: GltfEcsAuthoringDiagnostic[] = [];
  const skipped: GltfSkippedEcsAuthoringEntry[] = [];
  const seenEntityKeys = new Set<string>();
  const dependencies = new Set<string>();
  const meshReadiness = createMeshReadiness(options);

  if (!options.traversalReport.valid) {
    diagnostics.push({
      code: "gltfEcsAuthoring.invalidTraversalReport",
      severity: "error",
      message:
        "No ECS authoring commands were planned because scene traversal is invalid.",
      ...(options.traversalReport.sceneIndex === null
        ? {}
        : { sceneIndex: options.traversalReport.sceneIndex }),
    });
    return result(options.traversalReport, commands, diagnostics, skipped, []);
  }

  if (options.traversalReport.sceneEntityKey === null) {
    diagnostics.push({
      code: "gltfEcsAuthoring.missingSceneRoot",
      severity: "error",
      message:
        "No ECS authoring commands were planned because traversal did not select a scene root.",
      ...(options.traversalReport.sceneIndex === null
        ? {}
        : { sceneIndex: options.traversalReport.sceneIndex }),
    });
    return result(options.traversalReport, commands, diagnostics, skipped, []);
  }

  appendEntityCommands({
    commands,
    diagnostics,
    seenEntityKeys,
    entityKey: options.traversalReport.sceneEntityKey,
    label: sceneLabel(options.traversalReport.sceneIndex),
    parentEntityKey: null,
    localTransform: identityLocalTransform(),
    sceneIndex: options.traversalReport.sceneIndex,
  });

  const skippedEntityKeys = new Set<string>();
  for (const node of options.traversalReport.nodes) {
    if (skippedEntityKeys.has(node.parentEntityKey)) {
      skipNodeByAncestor({
        node,
        diagnostics,
        skipped,
        skippedEntityKeys,
      });
      continue;
    }

    appendEntityCommands({
      commands,
      diagnostics,
      seenEntityKeys,
      entityKey: node.entityKey,
      label: node.label,
      parentEntityKey: node.parentEntityKey,
      localTransform: localTransformValue(node.localTransform),
      sceneIndex: options.traversalReport.sceneIndex,
      nodeIndex: node.nodeIndex,
    });

    appendPrimitiveCommands({
      node,
      options,
      commands,
      diagnostics,
      skipped,
      seenEntityKeys,
      dependencies,
      meshReadiness,
    });
  }

  return result(options.traversalReport, commands, diagnostics, skipped, [
    ...dependencies,
  ]);
}

function appendEntityCommands(input: {
  readonly commands: GltfEcsAuthoringCommand[];
  readonly diagnostics: GltfEcsAuthoringDiagnostic[];
  readonly seenEntityKeys: Set<string>;
  readonly entityKey: string;
  readonly label: string;
  readonly parentEntityKey: string | null;
  readonly localTransform: GltfLocalTransformCommandValue;
  readonly sceneIndex: number | null;
  readonly nodeIndex?: number;
}): boolean {
  if (input.seenEntityKeys.has(input.entityKey)) {
    input.diagnostics.push({
      code: "gltfEcsAuthoring.duplicateEntityKey",
      severity: "error",
      message: `Entity key '${input.entityKey}' was planned more than once.`,
      ...(input.sceneIndex === null ? {} : { sceneIndex: input.sceneIndex }),
      ...(input.nodeIndex === undefined ? {} : { nodeIndex: input.nodeIndex }),
      entityKey: input.entityKey,
      parentEntityKey: input.parentEntityKey,
    });
    return false;
  }

  input.seenEntityKeys.add(input.entityKey);
  input.commands.push(
    {
      type: "createEntity",
      entityKey: input.entityKey,
      label: input.label,
    },
    {
      type: "addComponent",
      entityKey: input.entityKey,
      component: "Name",
      value: { value: input.label },
    },
    {
      type: "addComponent",
      entityKey: input.entityKey,
      component: "Parent",
      value: { parentEntityKey: input.parentEntityKey },
    },
    {
      type: "addComponent",
      entityKey: input.entityKey,
      component: "LocalTransform",
      value: input.localTransform,
    },
    {
      type: "addComponent",
      entityKey: input.entityKey,
      component: "WorldTransform",
      value: identityWorldTransform(),
    },
    {
      type: "addComponent",
      entityKey: input.entityKey,
      component: "Visibility",
      value: { visible: true },
    },
  );
  return true;
}

function appendPrimitiveCommands(input: {
  readonly node: GltfTraversedNode;
  readonly options: GltfEcsAuthoringCommandPlanOptions;
  readonly commands: GltfEcsAuthoringCommand[];
  readonly diagnostics: GltfEcsAuthoringDiagnostic[];
  readonly skipped: GltfSkippedEcsAuthoringEntry[];
  readonly seenEntityKeys: Set<string>;
  readonly dependencies: Set<string>;
  readonly meshReadiness: MeshReadiness;
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
    const diagnostic: GltfEcsAuthoringDiagnostic = {
      code: "gltfEcsAuthoring.missingPrimitiveMaterialResolution",
      severity: "error",
      message: `Node '${input.node.entityKey}' references glTF mesh ${input.node.meshIndex}, but no primitive material resolution entries were provided.`,
      nodeIndex: input.node.nodeIndex,
      entityKey: input.node.entityKey,
      meshIndex: input.node.meshIndex,
    };
    input.diagnostics.push(diagnostic);
    input.skipped.push({
      entityKey: input.node.entityKey,
      reason: diagnostic.code,
      nodeIndex: input.node.nodeIndex,
      diagnostics: [diagnostic],
    });
    return;
  }

  for (const entry of unresolved) {
    skipUnresolvedPrimitiveMaterial({
      node: input.node,
      unresolved: entry,
      diagnostics: input.diagnostics,
      skipped: input.skipped,
    });
  }

  for (const entry of resolved) {
    const meshStatus = meshReadinessStatus(input.meshReadiness, entry);
    if (meshStatus.kind !== "ready") {
      skipMeshNotReady({
        node: input.node,
        material: entry,
        meshStatus,
        diagnostics: input.diagnostics,
        skipped: input.skipped,
      });
      continue;
    }

    const entityKey = primitiveEntityKey(input.node, entry);
    const appended = appendEntityCommands({
      commands: input.commands,
      diagnostics: input.diagnostics,
      seenEntityKeys: input.seenEntityKeys,
      entityKey,
      label: `${input.node.label}.Primitive${entry.primitiveIndex}`,
      parentEntityKey: input.node.entityKey,
      localTransform: identityLocalTransform(),
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
  }
}

interface MeshReadiness {
  readonly ready: ReadonlySet<string>;
  readonly skippedReasons: ReadonlyMap<string, string>;
}

function createMeshReadiness(
  options: GltfEcsAuthoringCommandPlanOptions,
): MeshReadiness {
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

function meshReadinessStatus(
  readiness: MeshReadiness,
  material: GltfResolvedPrimitiveMaterial,
):
  | { readonly kind: "ready" }
  | { readonly kind: "skipped"; readonly reason: string }
  | { readonly kind: "missing" } {
  if (readiness.ready.has(material.meshHandleKey)) {
    return { kind: "ready" };
  }

  const skippedReason = readiness.skippedReasons.get(material.meshHandleKey);
  if (skippedReason !== undefined) {
    return { kind: "skipped", reason: skippedReason };
  }

  return { kind: "missing" };
}

function skipMeshNotReady(input: {
  readonly node: GltfTraversedNode;
  readonly material: GltfResolvedPrimitiveMaterial;
  readonly meshStatus:
    | { readonly kind: "skipped"; readonly reason: string }
    | { readonly kind: "missing" };
  readonly diagnostics: GltfEcsAuthoringDiagnostic[];
  readonly skipped: GltfSkippedEcsAuthoringEntry[];
}): void {
  const code =
    input.meshStatus.kind === "skipped"
      ? "gltfEcsAuthoring.skippedMeshRegistration"
      : "gltfEcsAuthoring.missingMeshRegistration";
  const entityKey = primitiveEntityKey(input.node, input.material);
  const diagnostic: GltfEcsAuthoringDiagnostic = {
    code,
    severity: "error",
    message:
      input.meshStatus.kind === "skipped"
        ? `Primitive '${entityKey}' was not planned because mesh '${input.material.meshHandleKey}' was skipped during registration.`
        : `Primitive '${entityKey}' was not planned because mesh '${input.material.meshHandleKey}' is not registered or available.`,
    nodeIndex: input.node.nodeIndex,
    entityKey,
    parentEntityKey: input.node.entityKey,
    meshIndex: input.material.meshIndex,
    primitiveIndex: input.material.primitiveIndex,
    meshHandleKey: input.material.meshHandleKey,
    materialHandleKey: input.material.materialHandleKey,
    ...(input.meshStatus.kind === "skipped"
      ? { sourceReason: input.meshStatus.reason }
      : {}),
  };
  input.diagnostics.push(diagnostic);
  input.skipped.push({
    entityKey,
    reason: code,
    nodeIndex: input.node.nodeIndex,
    parentEntityKey: input.node.entityKey,
    diagnostics: [diagnostic],
  });
}

function skipUnresolvedPrimitiveMaterial(input: {
  readonly node: GltfTraversedNode;
  readonly unresolved: GltfUnresolvedPrimitiveMaterial;
  readonly diagnostics: GltfEcsAuthoringDiagnostic[];
  readonly skipped: GltfSkippedEcsAuthoringEntry[];
}): void {
  const entityKey = primitiveEntityKey(input.node, input.unresolved);
  const diagnostic: GltfEcsAuthoringDiagnostic = {
    code: "gltfEcsAuthoring.unresolvedPrimitiveMaterial",
    severity: "error",
    message: `Primitive '${entityKey}' was not planned because material resolution failed.`,
    nodeIndex: input.node.nodeIndex,
    entityKey,
    parentEntityKey: input.node.entityKey,
    meshIndex: input.unresolved.meshIndex,
    primitiveIndex: input.unresolved.primitiveIndex,
    meshHandleKey: input.unresolved.meshHandleKey,
    ...(input.unresolved.materialHandleKey === undefined
      ? {}
      : { materialHandleKey: input.unresolved.materialHandleKey }),
    sourceReason: input.unresolved.reason,
  };
  input.diagnostics.push(diagnostic);
  input.skipped.push({
    entityKey,
    reason: diagnostic.code,
    nodeIndex: input.node.nodeIndex,
    parentEntityKey: input.node.entityKey,
    diagnostics: [diagnostic],
  });
}

function skipNodeByAncestor(input: {
  readonly node: GltfTraversedNode;
  readonly diagnostics: GltfEcsAuthoringDiagnostic[];
  readonly skipped: GltfSkippedEcsAuthoringEntry[];
  readonly skippedEntityKeys: Set<string>;
}): void {
  const diagnostic: GltfEcsAuthoringDiagnostic = {
    code: "gltfEcsAuthoring.nodeSkippedByAncestor",
    severity: "error",
    message: `Node '${input.node.entityKey}' was skipped because an ancestor node was skipped.`,
    nodeIndex: input.node.nodeIndex,
    entityKey: input.node.entityKey,
    parentEntityKey: input.node.parentEntityKey,
  };
  input.diagnostics.push(diagnostic);
  input.skipped.push({
    entityKey: input.node.entityKey,
    reason: diagnostic.code,
    nodeIndex: input.node.nodeIndex,
    parentEntityKey: input.node.parentEntityKey,
    diagnostics: [diagnostic],
  });
  input.skippedEntityKeys.add(input.node.entityKey);
}

function localTransformValue(
  transform: GltfNodeLocalTransform | null,
): GltfLocalTransformCommandValue {
  if (transform === null) {
    return identityLocalTransform();
  }

  return {
    translation: transform.translation,
    rotation: transform.rotation,
    scale: transform.scale,
  };
}

function identityLocalTransform(): GltfLocalTransformCommandValue {
  return {
    translation: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    scale: [1, 1, 1],
  };
}

function identityWorldTransform(): GltfWorldTransformCommandValue {
  return {
    col0: [1, 0, 0, 0],
    col1: [0, 1, 0, 0],
    col2: [0, 0, 1, 0],
    col3: [0, 0, 0, 1],
  };
}

function sceneLabel(sceneIndex: number | null): string {
  return sceneIndex === null ? "Scene" : `Scene${sceneIndex}`;
}

function primitiveEntityKey(
  node: GltfTraversedNode,
  primitive: {
    readonly meshIndex: number;
    readonly primitiveIndex: number;
  },
): string {
  return `${node.entityKey}:mesh:${primitive.meshIndex}:primitive:${primitive.primitiveIndex}`;
}

function assetIdFromHandleKey(handleKey: string, kind: "mesh" | "material") {
  const prefix = `${kind}:`;
  return handleKey.startsWith(prefix)
    ? handleKey.slice(prefix.length)
    : handleKey;
}

function result(
  traversalReport: GltfSceneTraversalReport,
  commands: readonly GltfEcsAuthoringCommand[],
  diagnostics: readonly GltfEcsAuthoringDiagnostic[],
  skipped: readonly GltfSkippedEcsAuthoringEntry[],
  dependencies: readonly string[],
): GltfEcsAuthoringCommandPlan {
  return {
    valid: diagnostics.length === 0,
    sceneIndex: traversalReport.sceneIndex,
    rootEntityKeys:
      traversalReport.sceneEntityKey === null
        ? []
        : [traversalReport.sceneEntityKey],
    commands,
    dependencies,
    skipped,
    diagnostics,
  };
}
