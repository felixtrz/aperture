import type { TextureAsset } from "./types.js";
import type {
  GltfTextureMappingReport,
  GltfTextureMappingReportJsonValue,
} from "./gltf-texture.js";

export function gltfTextureMappingReportToJsonValue(
  report: GltfTextureMappingReport,
): GltfTextureMappingReportJsonValue {
  return {
    valid: report.valid,
    texture:
      report.texture === null ? null : textureAssetToJsonValue(report.texture),
    sampler: report.sampler === null ? null : { ...report.sampler },
    textureIndex: report.textureIndex,
    slot: report.slot,
    ...(report.imageIndex === undefined
      ? {}
      : { imageIndex: report.imageIndex }),
    ...(report.samplerIndex === undefined
      ? {}
      : { samplerIndex: report.samplerIndex }),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfTextureMappingReportToJson(
  report: GltfTextureMappingReport,
): string {
  return JSON.stringify(gltfTextureMappingReportToJsonValue(report));
}

function textureAssetToJsonValue(
  texture: TextureAsset,
): Record<string, unknown> {
  return {
    ...texture,
    ...(texture.sourceData === undefined
      ? {}
      : {
          sourceData: {
            byteLength: texture.sourceData.bytes.byteLength,
            bytesPerRow: texture.sourceData.bytesPerRow,
            ...(texture.sourceData.rowsPerImage === undefined
              ? {}
              : { rowsPerImage: texture.sourceData.rowsPerImage }),
          },
        }),
  };
}
