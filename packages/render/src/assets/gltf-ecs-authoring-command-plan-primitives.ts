import type { GltfTraversedNode } from "./gltf-scene-traversal.js";
import type {
  GltfResolvedPrimitiveMaterial,
  GltfUnresolvedPrimitiveMaterial,
} from "./gltf-primitive-material-resolution.js";
import type {
  GltfEcsAuthoringCommand,
  GltfEcsAuthoringCommandPlanOptions,
  GltfEcsAuthoringDiagnostic,
  GltfSkippedEcsAuthoringEntry,
} from "./gltf-ecs-authoring-command-plan-types.js";
import {
  appendGltfEcsEntityCommands,
  gltfIdentityLocalTransformCommandValue,
} from "./gltf-ecs-authoring-command-plan-entities.js";

export interface GltfEcsMeshReadiness {
  readonly ready: ReadonlySet<string>;
  readonly skippedReasons: ReadonlyMap<string, string>;
}

export function createGltfEcsMeshReadiness(
  options: GltfEcsAuthoringCommandPlanOptions,
): GltfEcsMeshReadiness {
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

export function appendGltfEcsPrimitiveCommands(input: {
  readonly node: GltfTraversedNode;
  readonly options: GltfEcsAuthoringCommandPlanOptions;
  readonly commands: GltfEcsAuthoringCommand[];
  readonly diagnostics: GltfEcsAuthoringDiagnostic[];
  readonly skipped: GltfSkippedEcsAuthoringEntry[];
  readonly seenEntityKeys: Set<string>;
  readonly dependencies: Set<string>;
  readonly meshReadiness: GltfEcsMeshReadiness;
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
  }
}

function meshReadinessStatus(
  readiness: GltfEcsMeshReadiness,
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
