import {
  assetHandleKey,
  type AssetRegistry,
  type AssetStatus,
  type MaterialHandle,
} from "@aperture-engine/simulation";
import type {
  MaterialAsset,
  MaterialKind,
  MaterialTextureBinding,
  MaterialTextureTransform,
  SamplerAsset,
  StandardMaterialAsset,
  TextureAsset,
  TextureColorSpace,
  TextureSemantic,
} from "./types.js";

export type StandardMaterialTextureField =
  | "baseColorTexture"
  | "metallicRoughnessTexture"
  | "normalTexture"
  | "occlusionTexture"
  | "emissiveTexture";

export type StandardMaterialTextureReadinessDiagnosticCode =
  | "standardMaterialTexture.missingMaterial"
  | "standardMaterialTexture.materialNotReady"
  | "standardMaterialTexture.unsupportedMaterialKind"
  | "standardMaterialTexture.missingTextureHandle"
  | "standardMaterialTexture.missingSamplerHandle"
  | "standardMaterialTexture.textureNotReady"
  | "standardMaterialTexture.samplerNotReady"
  | "standardMaterialTexture.unsupportedTexCoord"
  | "standardMaterialTexture.unsupportedTextureTransform"
  | "standardMaterialTexture.invalidSemantic"
  | "standardMaterialTexture.invalidColorSpace";

export interface StandardMaterialTextureReadinessDiagnostic {
  readonly code: StandardMaterialTextureReadinessDiagnosticCode;
  readonly message: string;
  readonly severity: "warning" | "error";
  readonly materialKey: string;
  readonly textureKey?: string;
  readonly samplerKey?: string;
  readonly field?: StandardMaterialTextureField;
  readonly dependencyKind?: "texture" | "sampler";
  readonly status?: AssetStatus | "missing";
  readonly expectedSemantic?: TextureSemantic;
  readonly actualSemantic?: TextureSemantic;
  readonly expectedColorSpaces?: readonly TextureColorSpace[];
  readonly actualColorSpace?: TextureColorSpace;
  readonly texCoord?: number;
  readonly supportedTexCoords?: readonly number[];
  readonly textureTransform?: MaterialTextureTransform;
}

export interface StandardMaterialTextureReadinessSlot {
  readonly field: StandardMaterialTextureField;
  readonly textureKey: string;
  readonly expectedSemantic: TextureSemantic;
  readonly actualSemantic: TextureSemantic;
  readonly expectedColorSpaces: readonly TextureColorSpace[];
  readonly actualColorSpace: TextureColorSpace;
  readonly texCoord: number;
  readonly ready: boolean;
}

export interface StandardMaterialTextureReadinessReport {
  readonly ready: boolean;
  readonly materialKey: string;
  readonly materialStatus: AssetStatus | "missing";
  readonly materialKind?: MaterialKind;
  readonly slots: readonly StandardMaterialTextureReadinessSlot[];
  readonly diagnostics: readonly StandardMaterialTextureReadinessDiagnostic[];
}

export interface StandardMaterialTextureReadinessOptions {
  readonly registry: AssetRegistry;
  readonly material: MaterialHandle;
}

export type StandardMaterialTextureReadinessReportJsonValue =
  StandardMaterialTextureReadinessReport;

interface StandardMaterialTextureExpectation {
  readonly field: StandardMaterialTextureField;
  readonly semantic: TextureSemantic;
  readonly colorSpaces: readonly TextureColorSpace[];
}

const STANDARD_TEXTURE_EXPECTATIONS = [
  {
    field: "baseColorTexture",
    semantic: "base-color",
    colorSpaces: ["srgb"],
  },
  {
    field: "metallicRoughnessTexture",
    semantic: "metallic-roughness",
    colorSpaces: ["linear", "data"],
  },
  {
    field: "normalTexture",
    semantic: "normal",
    colorSpaces: ["linear", "data"],
  },
  {
    field: "occlusionTexture",
    semantic: "occlusion",
    colorSpaces: ["linear", "data"],
  },
  {
    field: "emissiveTexture",
    semantic: "emissive",
    colorSpaces: ["srgb"],
  },
] as const satisfies readonly StandardMaterialTextureExpectation[];
const SUPPORTED_STANDARD_TEXCOORDS = [0, 1] as const;

export function createStandardMaterialTextureReadinessReport(
  options: StandardMaterialTextureReadinessOptions,
): StandardMaterialTextureReadinessReport {
  const materialKey = assetHandleKey(options.material);
  const entry = options.registry.get<"material", MaterialAsset>(
    options.material,
  );

  if (entry === undefined) {
    return {
      ready: false,
      materialKey,
      materialStatus: "missing",
      slots: [],
      diagnostics: [
        {
          code: "standardMaterialTexture.missingMaterial",
          severity: "error",
          materialKey,
          status: "missing",
          message: `StandardMaterial texture readiness requires registered material '${materialKey}'.`,
        },
      ],
    };
  }

  if (entry.status !== "ready" || entry.asset === null) {
    return {
      ready: false,
      materialKey,
      materialStatus: entry.status,
      slots: [],
      diagnostics: [
        {
          code: "standardMaterialTexture.materialNotReady",
          severity: entry.status === "failed" ? "error" : "warning",
          materialKey,
          status: entry.status,
          message: `StandardMaterial texture readiness requires material '${materialKey}' to be ready, not '${entry.status}'.`,
        },
      ],
    };
  }

  if (entry.asset.kind !== "standard") {
    return {
      ready: false,
      materialKey,
      materialStatus: entry.status,
      materialKind: entry.asset.kind,
      slots: [],
      diagnostics: [
        {
          code: "standardMaterialTexture.unsupportedMaterialKind",
          severity: "error",
          materialKey,
          message: `StandardMaterial texture readiness requires a StandardMaterial, not '${entry.asset.kind}'.`,
        },
      ],
    };
  }

  return inspectStandardMaterialTextures(
    options.registry,
    materialKey,
    entry.asset,
  );
}

export function standardMaterialTextureReadinessReportToJsonValue(
  report: StandardMaterialTextureReadinessReport,
): StandardMaterialTextureReadinessReportJsonValue {
  return {
    ...report,
    slots: report.slots.map((slot) => ({
      ...slot,
      expectedColorSpaces: [...slot.expectedColorSpaces],
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      ...(diagnostic.expectedColorSpaces === undefined
        ? {}
        : { expectedColorSpaces: [...diagnostic.expectedColorSpaces] }),
      ...(diagnostic.supportedTexCoords === undefined
        ? {}
        : { supportedTexCoords: [...diagnostic.supportedTexCoords] }),
      ...(diagnostic.textureTransform === undefined
        ? {}
        : {
            textureTransform: cloneTextureTransform(
              diagnostic.textureTransform,
            ),
          }),
    })),
  };
}

export function standardMaterialTextureReadinessReportToJson(
  report: StandardMaterialTextureReadinessReport,
): string {
  return JSON.stringify(
    standardMaterialTextureReadinessReportToJsonValue(report),
  );
}

function inspectStandardMaterialTextures(
  registry: AssetRegistry,
  materialKey: string,
  material: StandardMaterialAsset,
): StandardMaterialTextureReadinessReport {
  const slots: StandardMaterialTextureReadinessSlot[] = [];
  const diagnostics: StandardMaterialTextureReadinessDiagnostic[] = [];

  for (const expectation of STANDARD_TEXTURE_EXPECTATIONS) {
    inspectTextureBinding({
      registry,
      materialKey,
      binding: material[expectation.field],
      expectation,
      slots,
      diagnostics,
    });
  }

  return {
    ready: diagnostics.length === 0,
    materialKey,
    materialStatus: "ready",
    materialKind: material.kind,
    slots,
    diagnostics,
  };
}

function inspectTextureBinding(input: {
  readonly registry: AssetRegistry;
  readonly materialKey: string;
  readonly binding: MaterialTextureBinding | null;
  readonly expectation: StandardMaterialTextureExpectation;
  readonly slots: StandardMaterialTextureReadinessSlot[];
  readonly diagnostics: StandardMaterialTextureReadinessDiagnostic[];
}): void {
  if (input.binding === null) {
    return;
  }

  const texCoord = input.binding.texCoord ?? 0;
  const texCoordReady = isSupportedStandardTexCoord(texCoord);
  const textureKey =
    input.binding.texture === null
      ? undefined
      : assetHandleKey(input.binding.texture);
  const samplerKey =
    input.binding.sampler === null
      ? undefined
      : assetHandleKey(input.binding.sampler);

  if (
    input.binding.transform !== undefined &&
    !isIdentityTextureTransform(input.binding.transform) &&
    !isSupportedStandardTextureTransform({
      field: input.expectation.field,
      texCoord,
      transform: input.binding.transform,
    })
  ) {
    input.diagnostics.push({
      code: "standardMaterialTexture.unsupportedTextureTransform",
      severity: "warning",
      materialKey: input.materialKey,
      ...(textureKey === undefined ? {} : { textureKey }),
      ...(samplerKey === undefined ? {} : { samplerKey }),
      field: input.expectation.field,
      expectedSemantic: input.expectation.semantic,
      expectedColorSpaces: input.expectation.colorSpaces,
      textureTransform: cloneTextureTransform(input.binding.transform),
      message: `StandardMaterial ${input.expectation.field} uses a texture transform that is not supported by current StandardMaterial shaders.`,
    });
  }

  if (input.binding.texture === null) {
    if (!texCoordReady) {
      pushUnsupportedTexCoordDiagnostic({
        materialKey: input.materialKey,
        field: input.expectation.field,
        expectation: input.expectation,
        texCoord,
        diagnostics: input.diagnostics,
      });
    }

    input.diagnostics.push({
      code: "standardMaterialTexture.missingTextureHandle",
      severity: "warning",
      materialKey: input.materialKey,
      field: input.expectation.field,
      dependencyKind: "texture",
      status: "missing",
      ...(samplerKey === undefined ? {} : { samplerKey }),
      expectedSemantic: input.expectation.semantic,
      expectedColorSpaces: input.expectation.colorSpaces,
      message: `StandardMaterial ${input.expectation.field} is missing a texture handle.`,
    });
  } else if (!texCoordReady) {
    const readyTextureKey = assetHandleKey(input.binding.texture);

    pushUnsupportedTexCoordDiagnostic({
      materialKey: input.materialKey,
      textureKey: readyTextureKey,
      field: input.expectation.field,
      expectation: input.expectation,
      texCoord,
      diagnostics: input.diagnostics,
    });
  }

  if (input.binding.texture !== null) {
    const readyTextureKey = assetHandleKey(input.binding.texture);
    const textureEntry = input.registry.get<"texture", TextureAsset>(
      input.binding.texture,
    );
    const textureStatus = textureEntry?.status ?? "missing";

    if (textureEntry === undefined || textureEntry.asset === null) {
      input.diagnostics.push({
        code: "standardMaterialTexture.textureNotReady",
        severity: textureStatus === "failed" ? "error" : "warning",
        materialKey: input.materialKey,
        textureKey: readyTextureKey,
        ...(samplerKey === undefined ? {} : { samplerKey }),
        field: input.expectation.field,
        dependencyKind: "texture",
        status: textureStatus,
        expectedSemantic: input.expectation.semantic,
        expectedColorSpaces: input.expectation.colorSpaces,
        message: `StandardMaterial ${input.expectation.field} texture '${readyTextureKey}' is '${textureStatus}', not ready.`,
      });
    } else {
      inspectReadyTexture({
        materialKey: input.materialKey,
        textureKey: readyTextureKey,
        texture: textureEntry.asset,
        expectation: input.expectation,
        texCoord,
        slots: input.slots,
        diagnostics: input.diagnostics,
      });
    }
  }

  if (input.binding.sampler === null) {
    input.diagnostics.push({
      code: "standardMaterialTexture.missingSamplerHandle",
      severity: "warning",
      materialKey: input.materialKey,
      ...(textureKey === undefined ? {} : { textureKey }),
      field: input.expectation.field,
      dependencyKind: "sampler",
      status: "missing",
      expectedSemantic: input.expectation.semantic,
      expectedColorSpaces: input.expectation.colorSpaces,
      message: `StandardMaterial ${input.expectation.field} is missing a sampler handle.`,
    });
    return;
  }

  const readySamplerKey = assetHandleKey(input.binding.sampler);
  const samplerEntry = input.registry.get<"sampler", SamplerAsset>(
    input.binding.sampler,
  );
  const samplerStatus = samplerEntry?.status ?? "missing";

  if (samplerEntry === undefined || samplerEntry.asset === null) {
    input.diagnostics.push({
      code: "standardMaterialTexture.samplerNotReady",
      severity: samplerStatus === "failed" ? "error" : "warning",
      materialKey: input.materialKey,
      ...(textureKey === undefined ? {} : { textureKey }),
      samplerKey: readySamplerKey,
      field: input.expectation.field,
      dependencyKind: "sampler",
      status: samplerStatus,
      expectedSemantic: input.expectation.semantic,
      expectedColorSpaces: input.expectation.colorSpaces,
      message: `StandardMaterial ${input.expectation.field} sampler '${readySamplerKey}' is '${samplerStatus}', not ready.`,
    });
  }
}

function inspectReadyTexture(input: {
  readonly materialKey: string;
  readonly textureKey: string;
  readonly texture: TextureAsset;
  readonly expectation: StandardMaterialTextureExpectation;
  readonly texCoord: number;
  readonly slots: StandardMaterialTextureReadinessSlot[];
  readonly diagnostics: StandardMaterialTextureReadinessDiagnostic[];
}): void {
  const semanticReady = input.texture.semantic === input.expectation.semantic;
  const colorSpaceReady = input.expectation.colorSpaces.includes(
    input.texture.colorSpace,
  );
  const texCoordReady = isSupportedStandardTexCoord(input.texCoord);

  input.slots.push({
    field: input.expectation.field,
    textureKey: input.textureKey,
    expectedSemantic: input.expectation.semantic,
    actualSemantic: input.texture.semantic,
    expectedColorSpaces: input.expectation.colorSpaces,
    actualColorSpace: input.texture.colorSpace,
    texCoord: input.texCoord,
    ready: semanticReady && colorSpaceReady && texCoordReady,
  });

  if (!semanticReady) {
    input.diagnostics.push({
      code: "standardMaterialTexture.invalidSemantic",
      severity: "warning",
      materialKey: input.materialKey,
      textureKey: input.textureKey,
      field: input.expectation.field,
      expectedSemantic: input.expectation.semantic,
      actualSemantic: input.texture.semantic,
      expectedColorSpaces: input.expectation.colorSpaces,
      actualColorSpace: input.texture.colorSpace,
      message: `StandardMaterial ${input.expectation.field} texture '${input.textureKey}' should use semantic '${input.expectation.semantic}', not '${input.texture.semantic}'.`,
    });
  }

  if (!colorSpaceReady) {
    input.diagnostics.push({
      code: "standardMaterialTexture.invalidColorSpace",
      severity: "warning",
      materialKey: input.materialKey,
      textureKey: input.textureKey,
      field: input.expectation.field,
      expectedSemantic: input.expectation.semantic,
      actualSemantic: input.texture.semantic,
      expectedColorSpaces: input.expectation.colorSpaces,
      actualColorSpace: input.texture.colorSpace,
      message: `StandardMaterial ${input.expectation.field} texture '${input.textureKey}' should use color space '${input.expectation.colorSpaces.join(
        "' or '",
      )}', not '${input.texture.colorSpace}'.`,
    });
  }
}

function pushUnsupportedTexCoordDiagnostic(input: {
  readonly materialKey: string;
  readonly textureKey?: string;
  readonly field: StandardMaterialTextureField;
  readonly expectation: StandardMaterialTextureExpectation;
  readonly texCoord: number;
  readonly diagnostics: StandardMaterialTextureReadinessDiagnostic[];
}): void {
  input.diagnostics.push({
    code: "standardMaterialTexture.unsupportedTexCoord",
    severity: "warning",
    materialKey: input.materialKey,
    ...(input.textureKey === undefined ? {} : { textureKey: input.textureKey }),
    field: input.field,
    texCoord: input.texCoord,
    supportedTexCoords: [...SUPPORTED_STANDARD_TEXCOORDS],
    expectedSemantic: input.expectation.semantic,
    expectedColorSpaces: input.expectation.colorSpaces,
    message: `StandardMaterial ${input.field} uses unsupported texCoord ${input.texCoord}; only TEXCOORD_0 and TEXCOORD_1 are currently rendered.`,
  });
}

function isSupportedStandardTexCoord(texCoord: number): boolean {
  return SUPPORTED_STANDARD_TEXCOORDS.includes(
    texCoord as (typeof SUPPORTED_STANDARD_TEXCOORDS)[number],
  );
}

function isIdentityTextureTransform(
  transform: MaterialTextureTransform,
): boolean {
  const offset = transform.offset ?? [0, 0];
  const scale = transform.scale ?? [1, 1];
  const rotation = transform.rotation ?? 0;

  return (
    offset[0] === 0 &&
    offset[1] === 0 &&
    scale[0] === 1 &&
    scale[1] === 1 &&
    rotation === 0
  );
}

function isSupportedStandardTextureTransform(input: {
  readonly field: StandardMaterialTextureField;
  readonly texCoord: number;
  readonly transform: MaterialTextureTransform;
}): boolean {
  const rotation = input.transform.rotation ?? 0;

  return (
    input.field === "baseColorTexture" && input.texCoord === 0 && rotation === 0
  );
}

function cloneTextureTransform(
  transform: MaterialTextureTransform,
): MaterialTextureTransform {
  return {
    ...(transform.offset === undefined
      ? {}
      : { offset: [transform.offset[0], transform.offset[1]] }),
    ...(transform.scale === undefined
      ? {}
      : { scale: [transform.scale[0], transform.scale[1]] }),
    ...(transform.rotation === undefined
      ? {}
      : { rotation: transform.rotation }),
  };
}
