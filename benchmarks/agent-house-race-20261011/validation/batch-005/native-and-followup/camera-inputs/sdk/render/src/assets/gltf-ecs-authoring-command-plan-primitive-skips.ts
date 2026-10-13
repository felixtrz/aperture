import type { GltfTraversedNode } from "./gltf-scene-traversal.js";
import type {
  GltfResolvedPrimitiveMaterial,
  GltfUnresolvedPrimitiveMaterial,
} from "./gltf-primitive-material-resolution.js";
import type {
  GltfEcsAuthoringDiagnostic,
  GltfSkippedEcsAuthoringEntry,
} from "./gltf-ecs-authoring-command-plan-types.js";
import type { GltfEcsMeshReadinessStatus } from "./gltf-ecs-authoring-command-plan-primitive-readiness.js";

export function skipGltfEcsMissingPrimitiveMaterialResolution(input: {
  readonly node: GltfTraversedNode;
  readonly meshIndex: number;
  readonly diagnostics: GltfEcsAuthoringDiagnostic[];
  readonly skipped: GltfSkippedEcsAuthoringEntry[];
}): void {
  const diagnostic: GltfEcsAuthoringDiagnostic = {
    code: "gltfEcsAuthoring.missingPrimitiveMaterialResolution",
    severity: "error",
    message: `Node '${input.node.entityKey}' references glTF mesh ${input.meshIndex}, but no primitive material resolution entries were provided.`,
    nodeIndex: input.node.nodeIndex,
    entityKey: input.node.entityKey,
    meshIndex: input.meshIndex,
  };
  input.diagnostics.push(diagnostic);
  input.skipped.push({
    entityKey: input.node.entityKey,
    reason: diagnostic.code,
    nodeIndex: input.node.nodeIndex,
    diagnostics: [diagnostic],
  });
}

export function skipGltfEcsMeshNotReady(input: {
  readonly node: GltfTraversedNode;
  readonly material: GltfResolvedPrimitiveMaterial;
  readonly meshStatus: Exclude<
    GltfEcsMeshReadinessStatus,
    { readonly kind: "ready" }
  >;
  readonly diagnostics: GltfEcsAuthoringDiagnostic[];
  readonly skipped: GltfSkippedEcsAuthoringEntry[];
}): void {
  const code =
    input.meshStatus.kind === "skipped"
      ? "gltfEcsAuthoring.skippedMeshRegistration"
      : "gltfEcsAuthoring.missingMeshRegistration";
  const entityKey = gltfEcsPrimitiveEntityKey(input.node, input.material);
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

export function skipGltfEcsUnresolvedPrimitiveMaterial(input: {
  readonly node: GltfTraversedNode;
  readonly unresolved: GltfUnresolvedPrimitiveMaterial;
  readonly diagnostics: GltfEcsAuthoringDiagnostic[];
  readonly skipped: GltfSkippedEcsAuthoringEntry[];
}): void {
  const entityKey = gltfEcsPrimitiveEntityKey(input.node, input.unresolved);
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

export function gltfEcsPrimitiveEntityKey(
  node: GltfTraversedNode,
  primitive: {
    readonly meshIndex: number;
    readonly primitiveIndex: number;
  },
): string {
  return `${node.entityKey}:mesh:${primitive.meshIndex}:primitive:${primitive.primitiveIndex}`;
}
