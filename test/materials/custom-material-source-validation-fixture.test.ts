import { describe, expect, it } from "vitest";

type SourceDiagnosticCode =
  | "customMaterialSource.invalidDiscriminator"
  | "customMaterialSource.invalidFamilyKey"
  | "customMaterialSource.reservedFamilyKey"
  | "customMaterialSource.invalidLabel"
  | "customMaterialSource.invalidRenderState"
  | "customMaterialSource.invalidPipelineKeyInput"
  | "customMaterialSource.invalidBindingDeclaration"
  | "customMaterialSource.invalidDependency"
  | "customMaterialSource.invalidMetadata"
  | "customMaterialSource.liveRendererObject";

interface SourceValidationDiagnostic {
  readonly code: SourceDiagnosticCode;
  readonly severity: "error" | "warning";
  readonly field: string;
  readonly message: string;
  readonly familyKey?: string;
  readonly label?: string;
  readonly expected?: string;
  readonly actual?: string | number | boolean | null;
}

type SourceRecord = Record<string, unknown>;

const BUILT_IN_FAMILY_KEYS = new Set([
  "unlit",
  "matcap",
  "standard",
  "debug-normal",
]);

const VALID_ALPHA_MODES = new Set(["opaque", "mask", "blend"]);
const VALID_BINDING_KINDS = new Set([
  "uniform",
  "texture",
  "sampler",
  "storage",
]);
const VALID_DEPENDENCY_KINDS = new Set([
  "texture",
  "sampler",
  "shader",
  "buffer",
  "light",
  "environment",
]);

describe("custom material source validation fixture", () => {
  it("accepts a minimal data-only source fixture", () => {
    expect(validateCustomMaterialSourceFixture(minimalSource())).toEqual([]);
  });

  it("reports source-shape diagnostics without route/app diagnostic codes", () => {
    const diagnostics = validateCustomMaterialSourceFixture({
      ...minimalSource(),
      sourceDiscriminator: "standard",
      familyKey: "standard",
      label: "",
      renderState: { alphaMode: "screen" },
      pipelineKey: { features: [() => "not serializable"] },
      bindings: [{ name: "baseColor" }],
      dependencies: [{ name: "shaderMain", kind: "pipeline" }],
      metadata: { affectsRendering: true },
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "customMaterialSource.invalidDiscriminator",
      "customMaterialSource.reservedFamilyKey",
      "customMaterialSource.invalidLabel",
      "customMaterialSource.invalidRenderState",
      "customMaterialSource.invalidPipelineKeyInput",
      "customMaterialSource.invalidBindingDeclaration",
      "customMaterialSource.invalidDependency",
      "customMaterialSource.invalidMetadata",
      "customMaterialSource.liveRendererObject",
    ]);
    expect(
      diagnostics.every((diagnostic) =>
        diagnostic.code.startsWith("customMaterialSource."),
      ),
    ).toBe(true);
  });

  it("distinguishes empty and malformed family keys", () => {
    expect(
      validateCustomMaterialSourceFixture({
        ...minimalSource(),
        familyKey: "",
      }),
    ).toMatchObject([
      {
        code: "customMaterialSource.invalidFamilyKey",
        severity: "error",
        field: "familyKey",
        actual: "",
      },
    ]);

    expect(
      validateCustomMaterialSourceFixture({
        ...minimalSource(),
        familyKey: "preview",
      }),
    ).toMatchObject([
      {
        code: "customMaterialSource.invalidFamilyKey",
        severity: "error",
        field: "familyKey",
        actual: "preview",
      },
    ]);
  });

  it("rejects live renderer values and keeps diagnostics JSON-safe", () => {
    const diagnostics = validateCustomMaterialSourceFixture({
      ...minimalSource(),
      bindings: [
        {
          name: "gpuBuffer",
          kind: "uniform",
          resource: { __gpuType: "GPUBuffer", hiddenHandle: "buffer-1" },
        },
        {
          name: "callback",
          kind: "uniform",
          resource: () => "not data",
        },
      ],
      metadata: {
        upload: new Uint8Array([1, 2, 3, 4]),
      },
      sourceData: {
        bytes: new Uint8Array([9, 9, 9, 9]),
      },
    });

    expect(
      diagnostics.filter(
        (diagnostic) =>
          diagnostic.code === "customMaterialSource.liveRendererObject",
      ),
    ).toMatchObject([
      {
        field: "bindings[0].resource",
        actual: "GPUBuffer",
      },
      {
        field: "bindings[1].resource",
        actual: "function",
      },
      {
        field: "metadata.upload",
        actual: "Uint8Array",
      },
      {
        field: "sourceData.bytes",
        actual: "Uint8Array",
      },
    ]);

    const json = JSON.stringify(diagnostics);

    expect(json).not.toContain("hiddenHandle");
    expect(json).not.toContain("buffer-1");
    expect(json).not.toContain('"bytes"');
    expect(json).not.toContain("[1,2,3,4]");
    expect(json).not.toContain("[9,9,9,9]");
  });
});

function minimalSource(): SourceRecord {
  return {
    sourceDiscriminator: "custom-material-source",
    familyKey: "example.preview/custom",
    label: "Preview custom",
    renderState: {
      alphaMode: "opaque",
    },
    pipelineKey: {
      features: ["base-color"],
    },
    bindings: [
      {
        name: "baseColor",
        kind: "uniform",
      },
    ],
    dependencies: [
      {
        name: "previewShader",
        kind: "shader",
      },
    ],
    metadata: {
      authoring: "test-only",
    },
  };
}

function validateCustomMaterialSourceFixture(
  source: SourceRecord,
): SourceValidationDiagnostic[] {
  const diagnostics: SourceValidationDiagnostic[] = [];
  const familyKey =
    typeof source.familyKey === "string" ? source.familyKey : undefined;
  const label = typeof source.label === "string" ? source.label : undefined;

  if (source.sourceDiscriminator !== "custom-material-source") {
    diagnostics.push({
      code: "customMaterialSource.invalidDiscriminator",
      severity: "error",
      field: "sourceDiscriminator",
      message:
        "Custom material sources must use the custom material source discriminator.",
      expected: "custom-material-source",
      actual: describeValue(source.sourceDiscriminator),
      ...(familyKey === undefined ? {} : { familyKey }),
      ...(label === undefined ? {} : { label }),
    });
  }

  validateFamilyKey(source.familyKey, diagnostics);
  validateLabel(source.label, diagnostics, familyKey);
  validateRenderState(source.renderState, diagnostics, familyKey, label);
  validatePipelineKey(source.pipelineKey, diagnostics, familyKey, label);
  validateBindings(source.bindings, diagnostics, familyKey, label);
  validateDependencies(source.dependencies, diagnostics, familyKey, label);
  validateMetadata(source.metadata, diagnostics, familyKey, label);
  rejectLiveValues(source, "", diagnostics, familyKey, label);

  return diagnostics;
}

function validateFamilyKey(
  value: unknown,
  diagnostics: SourceValidationDiagnostic[],
): void {
  if (typeof value === "string" && BUILT_IN_FAMILY_KEYS.has(value)) {
    diagnostics.push({
      code: "customMaterialSource.reservedFamilyKey",
      severity: "error",
      field: "familyKey",
      message: "Custom material family keys must not collide with built-ins.",
      familyKey: value,
      expected:
        "custom family key that does not collide with built-in families",
      actual: value,
    });
    return;
  }

  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    !isNamespaced(value)
  ) {
    diagnostics.push({
      code: "customMaterialSource.invalidFamilyKey",
      severity: "error",
      field: "familyKey",
      message: "Custom material family keys must be non-empty and namespaced.",
      expected: "non-empty namespaced custom material family key",
      actual: describeValue(value),
    });
    return;
  }
}

function validateLabel(
  value: unknown,
  diagnostics: SourceValidationDiagnostic[],
  familyKey: string | undefined,
): void {
  if (typeof value !== "string" || value.trim() === "") {
    diagnostics.push({
      code: "customMaterialSource.invalidLabel",
      severity: "warning",
      field: "label",
      message: "Custom material source labels should be non-empty.",
      expected: "non-empty label",
      actual: describeValue(value),
      ...(familyKey === undefined ? {} : { familyKey }),
    });
  }
}

function validateRenderState(
  value: unknown,
  diagnostics: SourceValidationDiagnostic[],
  familyKey: string | undefined,
  label: string | undefined,
): void {
  const renderState = asRecord(value);
  const alphaMode = renderState?.alphaMode;

  if (typeof alphaMode !== "string" || !VALID_ALPHA_MODES.has(alphaMode)) {
    diagnostics.push({
      code: "customMaterialSource.invalidRenderState",
      severity: "error",
      field: "renderState.alphaMode",
      message: "Custom material alpha mode must be a supported render state.",
      expected: "opaque | mask | blend",
      actual: describeValue(alphaMode),
      ...(familyKey === undefined ? {} : { familyKey }),
      ...(label === undefined ? {} : { label }),
    });
  }
}

function validatePipelineKey(
  value: unknown,
  diagnostics: SourceValidationDiagnostic[],
  familyKey: string | undefined,
  label: string | undefined,
): void {
  const pipelineKey = asRecord(value);
  const features = pipelineKey?.features;

  if (!Array.isArray(features)) {
    diagnostics.push({
      code: "customMaterialSource.invalidPipelineKeyInput",
      severity: "error",
      field: "pipelineKey.features",
      message: "Custom material pipeline features must be string keys.",
      expected: "array of strings",
      actual: describeValue(features),
      ...(familyKey === undefined ? {} : { familyKey }),
      ...(label === undefined ? {} : { label }),
    });
    return;
  }

  const invalidIndex = features.findIndex(
    (feature) => typeof feature !== "string",
  );
  if (invalidIndex >= 0) {
    diagnostics.push({
      code: "customMaterialSource.invalidPipelineKeyInput",
      severity: "error",
      field: `pipelineKey.features[${invalidIndex}]`,
      message: "Custom material pipeline features must be string keys.",
      expected: "string",
      actual: describeValue(features[invalidIndex]),
      ...(familyKey === undefined ? {} : { familyKey }),
      ...(label === undefined ? {} : { label }),
    });
  }
}

function validateBindings(
  value: unknown,
  diagnostics: SourceValidationDiagnostic[],
  familyKey: string | undefined,
  label: string | undefined,
): void {
  if (!Array.isArray(value)) {
    diagnostics.push(bindingDiagnostic("bindings", value, familyKey, label));
    return;
  }

  value.forEach((binding, index) => {
    const record = asRecord(binding);
    if (
      record === null ||
      typeof record.name !== "string" ||
      record.name.trim() === "" ||
      typeof record.kind !== "string" ||
      !VALID_BINDING_KINDS.has(record.kind)
    ) {
      diagnostics.push(
        bindingDiagnostic(`bindings[${index}]`, binding, familyKey, label),
      );
    }
  });
}

function validateDependencies(
  value: unknown,
  diagnostics: SourceValidationDiagnostic[],
  familyKey: string | undefined,
  label: string | undefined,
): void {
  if (!Array.isArray(value)) {
    diagnostics.push(
      dependencyDiagnostic("dependencies", value, familyKey, label),
    );
    return;
  }

  value.forEach((dependency, index) => {
    const record = asRecord(dependency);
    if (
      record === null ||
      typeof record.name !== "string" ||
      record.name.trim() === "" ||
      typeof record.kind !== "string" ||
      !VALID_DEPENDENCY_KINDS.has(record.kind)
    ) {
      diagnostics.push(
        dependencyDiagnostic(
          `dependencies[${index}]`,
          dependency,
          familyKey,
          label,
        ),
      );
    }
  });
}

function validateMetadata(
  value: unknown,
  diagnostics: SourceValidationDiagnostic[],
  familyKey: string | undefined,
  label: string | undefined,
): void {
  const metadata = asRecord(value);
  if (metadata?.affectsRendering === true) {
    diagnostics.push({
      code: "customMaterialSource.invalidMetadata",
      severity: "warning",
      field: "metadata",
      message:
        "Custom material metadata must not affect rendering unless declared as a validated input.",
      expected: "metadata that does not affect rendering",
      actual: true,
      ...(familyKey === undefined ? {} : { familyKey }),
      ...(label === undefined ? {} : { label }),
    });
  }
}

function rejectLiveValues(
  value: unknown,
  path: string,
  diagnostics: SourceValidationDiagnostic[],
  familyKey: string | undefined,
  label: string | undefined,
): void {
  if (typeof value === "function") {
    diagnostics.push(liveDiagnostic(path, "function", familyKey, label));
    return;
  }

  if (value instanceof Uint8Array) {
    diagnostics.push(liveDiagnostic(path, "Uint8Array", familyKey, label));
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      rejectLiveValues(
        item,
        `${path}[${index}]`,
        diagnostics,
        familyKey,
        label,
      ),
    );
    return;
  }

  const record = asRecord(value);
  if (record === null) {
    return;
  }

  if (typeof record.__gpuType === "string") {
    diagnostics.push(liveDiagnostic(path, record.__gpuType, familyKey, label));
    return;
  }

  Object.entries(record).forEach(([key, entry]) => {
    rejectLiveValues(
      entry,
      path === "" ? key : `${path}.${key}`,
      diagnostics,
      familyKey,
      label,
    );
  });
}

function bindingDiagnostic(
  field: string,
  value: unknown,
  familyKey: string | undefined,
  label: string | undefined,
): SourceValidationDiagnostic {
  return {
    code: "customMaterialSource.invalidBindingDeclaration",
    severity: "error",
    field,
    message: "Custom material binding declarations require a name and kind.",
    expected: "binding with name and supported kind",
    actual: describeValue(value),
    ...(familyKey === undefined ? {} : { familyKey }),
    ...(label === undefined ? {} : { label }),
  };
}

function dependencyDiagnostic(
  field: string,
  value: unknown,
  familyKey: string | undefined,
  label: string | undefined,
): SourceValidationDiagnostic {
  return {
    code: "customMaterialSource.invalidDependency",
    severity: "error",
    field,
    message: "Custom material dependencies require a name and supported kind.",
    expected: "dependency with name and supported kind",
    actual: describeValue(value),
    ...(familyKey === undefined ? {} : { familyKey }),
    ...(label === undefined ? {} : { label }),
  };
}

function liveDiagnostic(
  field: string,
  actual: string,
  familyKey: string | undefined,
  label: string | undefined,
): SourceValidationDiagnostic {
  return {
    code: "customMaterialSource.liveRendererObject",
    severity: "error",
    field,
    message:
      "Custom material source diagnostics must not expose live renderer objects.",
    expected: "stable data key or asset handle",
    actual,
    ...(familyKey === undefined ? {} : { familyKey }),
    ...(label === undefined ? {} : { label }),
  };
}

function isNamespaced(value: string): boolean {
  return value.includes("/") || value.includes(".");
}

function asRecord(value: unknown): SourceRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as SourceRecord;
}

function describeValue(value: unknown): string | number | boolean | null {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "function") {
    return "function";
  }

  if (value instanceof Uint8Array) {
    return "Uint8Array";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}
