import type { TextureAsset } from "./types.js";
import {
  SUPPORTED_STANDARD_TEXCOORDS,
  isSupportedStandardTexCoord,
} from "./standard-texture-readiness-expectations.js";
import type {
  StandardMaterialTextureExpectation,
  StandardMaterialTextureField,
  StandardMaterialTextureReadinessDiagnostic,
  StandardMaterialTextureReadinessSlot,
} from "./standard-texture-readiness-types.js";
import { textureFormatMatchesColorSpace } from "./standard-texture-readiness-utils.js";

export function inspectReadyStandardTexture(input: {
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
  const formatReady = textureFormatMatchesColorSpace(input.texture);
  const texCoordReady = isSupportedStandardTexCoord(input.texCoord);

  input.slots.push({
    field: input.expectation.field,
    textureKey: input.textureKey,
    expectedSemantic: input.expectation.semantic,
    actualSemantic: input.texture.semantic,
    expectedColorSpaces: input.expectation.colorSpaces,
    actualColorSpace: input.texture.colorSpace,
    actualFormat: input.texture.format,
    texCoord: input.texCoord,
    ready: semanticReady && colorSpaceReady && formatReady && texCoordReady,
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

  if (!formatReady) {
    const expectedFormatSrgb = input.texture.colorSpace === "srgb";

    input.diagnostics.push({
      code: "standardMaterialTexture.invalidColorSpaceFormat",
      severity: "warning",
      materialKey: input.materialKey,
      textureKey: input.textureKey,
      field: input.expectation.field,
      expectedSemantic: input.expectation.semantic,
      actualSemantic: input.texture.semantic,
      expectedColorSpaces: input.expectation.colorSpaces,
      actualColorSpace: input.texture.colorSpace,
      expectedFormatSrgb,
      actualFormat: input.texture.format,
      message: `StandardMaterial ${input.expectation.field} texture '${input.textureKey}' declares color space '${input.texture.colorSpace}' but uses texture format '${input.texture.format}'.`,
    });
  }
}

export function pushUnsupportedStandardTexCoordDiagnostic(input: {
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
