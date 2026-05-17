import type {
  GltfMeshPrimitiveMappingReport,
  GltfPlannedMeshPrimitiveAsset,
} from "./gltf-mesh-primitive.js";
import type {
  GltfSourceAssetRegistrationDiagnosticCode,
  GltfSourceAssetRegistrationReport,
} from "./gltf-source-registration.js";

export type GltfPrimitiveMaterialResolutionSource =
  | "registered"
  | "available"
  | "default";

export type GltfPrimitiveMaterialResolutionDiagnosticCode =
  | "gltfPrimitiveMaterial.unregisteredMaterial"
  | "gltfPrimitiveMaterial.skippedMaterial"
  | "gltfPrimitiveMaterial.duplicateMaterialUnavailable"
  | "gltfPrimitiveMaterial.failedMaterialDependency"
  | "gltfPrimitiveMaterial.defaultMaterialRequired"
  | "gltfPrimitiveMaterial.defaultMaterialUnavailable";

export interface GltfPrimitiveMaterialResolutionDiagnostic {
  readonly code: GltfPrimitiveMaterialResolutionDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
  readonly meshHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly materialIndex: number | null;
  readonly materialHandleKey?: string;
  readonly registrationReason?: GltfSourceAssetRegistrationDiagnosticCode;
  readonly dependencyKey?: string;
}

export interface GltfResolvedPrimitiveMaterial {
  readonly meshHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly materialIndex: number | null;
  readonly materialHandleKey: string;
  readonly source: GltfPrimitiveMaterialResolutionSource;
}

export interface GltfUnresolvedPrimitiveMaterial {
  readonly meshHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly materialIndex: number | null;
  readonly materialHandleKey?: string;
  readonly reason: GltfPrimitiveMaterialResolutionDiagnosticCode;
  readonly diagnostics: readonly GltfPrimitiveMaterialResolutionDiagnostic[];
}

export interface GltfPrimitiveMaterialResolutionReport {
  readonly valid: boolean;
  readonly resolved: readonly GltfResolvedPrimitiveMaterial[];
  readonly unresolved: readonly GltfUnresolvedPrimitiveMaterial[];
  readonly diagnostics: readonly GltfPrimitiveMaterialResolutionDiagnostic[];
}

export type GltfPrimitiveMaterialResolutionReportJsonValue =
  GltfPrimitiveMaterialResolutionReport;

export interface GltfPrimitiveMaterialResolutionOptions {
  readonly primitiveReport: GltfMeshPrimitiveMappingReport;
  readonly registrationReport: GltfSourceAssetRegistrationReport;
  readonly availableMaterialHandleKeys?: readonly string[];
  readonly defaultMaterialHandleKey?: string;
  readonly keyPrefix?: string;
}

export function createGltfPrimitiveMaterialResolutionReport(
  options: GltfPrimitiveMaterialResolutionOptions,
): GltfPrimitiveMaterialResolutionReport {
  const diagnostics: GltfPrimitiveMaterialResolutionDiagnostic[] = [];
  const resolved: GltfResolvedPrimitiveMaterial[] = [];
  const unresolved: GltfUnresolvedPrimitiveMaterial[] = [];
  const context = {
    ...options,
    availableMaterialHandleKeys: new Set(
      options.availableMaterialHandleKeys ?? [],
    ),
    keyPrefix: options.keyPrefix ?? "gltf",
  };

  for (const primitive of options.primitiveReport.meshes) {
    const resolution = resolvePrimitiveMaterial(context, primitive);
    if (resolution.kind === "resolved") {
      resolved.push(resolution.value);
      continue;
    }

    diagnostics.push(...resolution.value.diagnostics);
    unresolved.push(resolution.value);
  }

  return {
    valid: diagnostics.length === 0,
    resolved,
    unresolved,
    diagnostics,
  };
}

export function gltfPrimitiveMaterialResolutionReportToJsonValue(
  report: GltfPrimitiveMaterialResolutionReport,
): GltfPrimitiveMaterialResolutionReportJsonValue {
  return {
    valid: report.valid,
    resolved: report.resolved.map((entry) => ({ ...entry })),
    unresolved: report.unresolved.map((entry) => ({
      ...entry,
      diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfPrimitiveMaterialResolutionReportToJson(
  report: GltfPrimitiveMaterialResolutionReport,
): string {
  return JSON.stringify(
    gltfPrimitiveMaterialResolutionReportToJsonValue(report),
  );
}

function resolvePrimitiveMaterial(
  context: {
    readonly registrationReport: GltfSourceAssetRegistrationReport;
    readonly availableMaterialHandleKeys: ReadonlySet<string>;
    readonly defaultMaterialHandleKey?: string;
    readonly keyPrefix: string;
  },
  primitive: GltfPlannedMeshPrimitiveAsset,
):
  | { readonly kind: "resolved"; readonly value: GltfResolvedPrimitiveMaterial }
  | {
      readonly kind: "unresolved";
      readonly value: GltfUnresolvedPrimitiveMaterial;
    } {
  if (primitive.materialIndex === null) {
    return resolveDefaultMaterial(context, primitive);
  }

  const materialHandleKey = materialHandleKeyForIndex(
    context.keyPrefix,
    primitive.materialIndex,
  );
  const written = context.registrationReport.written.find(
    (entry) =>
      entry.kind === "material" &&
      entry.registeredHandleKey === materialHandleKey,
  );
  if (written !== undefined) {
    return {
      kind: "resolved",
      value: resolved(primitive, materialHandleKey, "registered"),
    };
  }

  if (context.availableMaterialHandleKeys.has(materialHandleKey)) {
    return {
      kind: "resolved",
      value: resolved(primitive, materialHandleKey, "available"),
    };
  }

  const skipped = context.registrationReport.skipped.find(
    (entry) =>
      entry.kind === "material" &&
      entry.registeredHandleKey === materialHandleKey,
  );
  if (skipped !== undefined) {
    const code = skippedReasonToResolutionCode(skipped.reason);
    const dependencyKey = skipped.diagnostics.find(
      (diagnostic) => diagnostic.dependencyKey !== undefined,
    )?.dependencyKey;
    return unresolved(primitive, code, {
      materialHandleKey,
      registrationReason: skipped.reason,
      ...(dependencyKey === undefined ? {} : { dependencyKey }),
    });
  }

  return unresolved(primitive, "gltfPrimitiveMaterial.unregisteredMaterial", {
    materialHandleKey,
  });
}

function resolveDefaultMaterial(
  context: {
    readonly registrationReport: GltfSourceAssetRegistrationReport;
    readonly availableMaterialHandleKeys: ReadonlySet<string>;
    readonly defaultMaterialHandleKey?: string;
  },
  primitive: GltfPlannedMeshPrimitiveAsset,
):
  | { readonly kind: "resolved"; readonly value: GltfResolvedPrimitiveMaterial }
  | {
      readonly kind: "unresolved";
      readonly value: GltfUnresolvedPrimitiveMaterial;
    } {
  if (context.defaultMaterialHandleKey === undefined) {
    return unresolved(
      primitive,
      "gltfPrimitiveMaterial.defaultMaterialRequired",
      {},
    );
  }

  const materialHandleKey = context.defaultMaterialHandleKey;
  const written = context.registrationReport.written.some(
    (entry) =>
      entry.kind === "material" &&
      entry.registeredHandleKey === materialHandleKey,
  );
  if (written || context.availableMaterialHandleKeys.has(materialHandleKey)) {
    return {
      kind: "resolved",
      value: resolved(primitive, materialHandleKey, "default"),
    };
  }

  return unresolved(
    primitive,
    "gltfPrimitiveMaterial.defaultMaterialUnavailable",
    {
      materialHandleKey,
    },
  );
}

function resolved(
  primitive: GltfPlannedMeshPrimitiveAsset,
  materialHandleKey: string,
  source: GltfPrimitiveMaterialResolutionSource,
): GltfResolvedPrimitiveMaterial {
  return {
    meshHandleKey: primitive.registeredHandleKey,
    meshIndex: primitive.meshIndex,
    primitiveIndex: primitive.primitiveIndex,
    materialIndex: primitive.materialIndex,
    materialHandleKey,
    source,
  };
}

function unresolved(
  primitive: GltfPlannedMeshPrimitiveAsset,
  code: GltfPrimitiveMaterialResolutionDiagnosticCode,
  options: {
    readonly materialHandleKey?: string;
    readonly registrationReason?: GltfSourceAssetRegistrationDiagnosticCode;
    readonly dependencyKey?: string;
  },
): {
  readonly kind: "unresolved";
  readonly value: GltfUnresolvedPrimitiveMaterial;
} {
  const diagnostic: GltfPrimitiveMaterialResolutionDiagnostic = {
    code,
    severity: "error",
    message: diagnosticMessage(primitive, code, options.materialHandleKey),
    meshHandleKey: primitive.registeredHandleKey,
    meshIndex: primitive.meshIndex,
    primitiveIndex: primitive.primitiveIndex,
    materialIndex: primitive.materialIndex,
    ...(options.materialHandleKey === undefined
      ? {}
      : { materialHandleKey: options.materialHandleKey }),
    ...(options.registrationReason === undefined
      ? {}
      : { registrationReason: options.registrationReason }),
    ...(options.dependencyKey === undefined
      ? {}
      : { dependencyKey: options.dependencyKey }),
  };

  return {
    kind: "unresolved",
    value: {
      meshHandleKey: primitive.registeredHandleKey,
      meshIndex: primitive.meshIndex,
      primitiveIndex: primitive.primitiveIndex,
      materialIndex: primitive.materialIndex,
      ...(options.materialHandleKey === undefined
        ? {}
        : { materialHandleKey: options.materialHandleKey }),
      reason: code,
      diagnostics: [diagnostic],
    },
  };
}

function skippedReasonToResolutionCode(
  reason: GltfSourceAssetRegistrationDiagnosticCode,
): GltfPrimitiveMaterialResolutionDiagnosticCode {
  switch (reason) {
    case "gltfRegistration.duplicateAssetKey":
      return "gltfPrimitiveMaterial.duplicateMaterialUnavailable";
    case "gltfRegistration.missingDependency":
      return "gltfPrimitiveMaterial.failedMaterialDependency";
    case "gltfRegistration.rootInvalid":
    case "gltfRegistration.invalidPlannedAsset":
      return "gltfPrimitiveMaterial.skippedMaterial";
  }
}

function materialHandleKeyForIndex(
  keyPrefix: string,
  materialIndex: number,
): string {
  return `material:${keyPrefix}:material:${materialIndex}`;
}

function diagnosticMessage(
  primitive: GltfPlannedMeshPrimitiveAsset,
  code: GltfPrimitiveMaterialResolutionDiagnosticCode,
  materialHandleKey: string | undefined,
): string {
  const primitiveLabel = `glTF mesh ${primitive.meshIndex} primitive ${primitive.primitiveIndex}`;
  switch (code) {
    case "gltfPrimitiveMaterial.unregisteredMaterial":
      return `${primitiveLabel} references material '${materialHandleKey}' but it was not registered or provided as available.`;
    case "gltfPrimitiveMaterial.skippedMaterial":
      return `${primitiveLabel} references material '${materialHandleKey}' but that source material was skipped during registration.`;
    case "gltfPrimitiveMaterial.duplicateMaterialUnavailable":
      return `${primitiveLabel} references duplicate material '${materialHandleKey}', but the existing material was not provided as available.`;
    case "gltfPrimitiveMaterial.failedMaterialDependency":
      return `${primitiveLabel} references material '${materialHandleKey}' with failed source asset dependencies.`;
    case "gltfPrimitiveMaterial.defaultMaterialRequired":
      return `${primitiveLabel} has no glTF material and no default material handle was provided.`;
    case "gltfPrimitiveMaterial.defaultMaterialUnavailable":
      return `${primitiveLabel} requires default material '${materialHandleKey}' but it was not registered or provided as available.`;
  }
}
