import { describe, expect, it } from "vitest";
import {
  createMaterialAssetFromGltfMaterial,
  createTextureAssetFromGltfTexture,
  GLTF_SAMPLER_FILTER,
  GLTF_SAMPLER_WRAP,
  type GltfMaterialTextureBindingResolver,
  type GltfMaterialTextureBindingResolverDiagnostic,
  type GltfTextureMappingDiagnostic,
  type GltfTextureMappingReport,
} from "@aperture-engine/render";
import {
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";

const decodedImage = {
  width: 2,
  height: 2,
  sourceData: {
    bytes: new Uint8Array(16),
    bytesPerRow: 8,
  },
};

describe("glTF material and texture mapping integration fixture", () => {
  it("uses successful texture mapping reports as material texture bindings", () => {
    const textureReport = createTextureAssetFromGltfTexture({
      textureIndex: 0,
      slot: "baseColorTexture",
      textures: [{ source: 0, sampler: 0 }],
      images: [{ bufferView: 1, mimeType: "image/png" }],
      samplers: [
        {
          wrapS: GLTF_SAMPLER_WRAP.REPEAT,
          wrapT: GLTF_SAMPLER_WRAP.REPEAT,
          magFilter: GLTF_SAMPLER_FILTER.LINEAR,
          minFilter: GLTF_SAMPLER_FILTER.LINEAR_MIPMAP_LINEAR,
        },
      ],
      resolveImageData: () => decodedImage,
    });
    const materialReport = createMaterialAssetFromGltfMaterial(
      {
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
        },
      },
      {
        materialKey: "material:integrated",
        resolveTextureBinding: resolverFromTextureReports([textureReport]),
      },
    );

    expect(textureReport.valid).toBe(true);
    expect(materialReport.valid).toBe(true);
    expect(materialReport.diagnostics).toEqual([]);
    expect(materialReport.material).toMatchObject({
      kind: "standard",
      baseColorTexture: {
        texture: createTextureHandle("gltf-texture:0:baseColorTexture"),
        sampler: createSamplerHandle("gltf-sampler:0:baseColorTexture"),
      },
    });
  });

  it("maps failed texture reports to texture and sampler resolver diagnostics", () => {
    const missingTextureReport = createTextureAssetFromGltfTexture({
      textureIndex: 0,
      slot: "baseColorTexture",
      textures: [{ source: 0 }],
      images: [{ bufferView: 1, mimeType: "image/png" }],
      resolveImageData: () => ({
        diagnostics: [{ message: "Image 0 was not decoded." }],
      }),
    });
    const missingSamplerReport = createTextureAssetFromGltfTexture({
      textureIndex: 1,
      slot: "metallicRoughnessTexture",
      textures: [{ source: 0 }, { source: 1, sampler: 4 }],
      images: [{ bufferView: 2, mimeType: "image/png" }, { uri: "mr.png" }],
      samplers: [],
      resolveImageData: () => decodedImage,
    });
    const materialReport = createMaterialAssetFromGltfMaterial(
      {
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicRoughnessTexture: { index: 1 },
        },
      },
      {
        materialKey: "material:missing-deps",
        resolveTextureBinding: resolverFromTextureReports([
          missingTextureReport,
          missingSamplerReport,
        ]),
      },
    );

    expect(materialReport.valid).toBe(false);
    expect(materialReport.material).toMatchObject({
      kind: "standard",
      baseColorTexture: null,
      metallicRoughnessTexture: null,
    });
    expect(materialReport.diagnostics).toMatchObject([
      {
        code: "gltfMaterial.unresolvedTextureBinding",
        field: "pbrMetallicRoughness.baseColorTexture",
        slot: "baseColorTexture",
        dependencyKind: "texture",
        textureIndex: 0,
        message: "Image 0 was not decoded.",
      },
      {
        code: "gltfMaterial.unresolvedTextureBinding",
        field: "pbrMetallicRoughness.metallicRoughnessTexture",
        slot: "metallicRoughnessTexture",
        dependencyKind: "sampler",
        textureIndex: 1,
        samplerIndex: 4,
      },
    ]);
  });
});

function resolverFromTextureReports(
  reports: readonly GltfTextureMappingReport[],
): GltfMaterialTextureBindingResolver {
  const reportsByTextureIndex = new Map(
    reports.map((report) => [report.textureIndex, report]),
  );

  return (input) => {
    const report = reportsByTextureIndex.get(input.textureIndex);
    if (
      report !== undefined &&
      report.valid &&
      report.texture !== null &&
      report.sampler !== null
    ) {
      return {
        texture: createTextureHandle(
          `gltf-texture:${report.textureIndex}:${input.slot}`,
        ),
        sampler: createSamplerHandle(
          `gltf-sampler:${report.textureIndex}:${input.slot}`,
        ),
      };
    }

    return {
      diagnostics: (report?.diagnostics ?? []).map((diagnostic) =>
        textureDiagnosticToResolverDiagnostic(diagnostic),
      ),
    };
  };
}

function textureDiagnosticToResolverDiagnostic(
  diagnostic: GltfTextureMappingDiagnostic,
): GltfMaterialTextureBindingResolverDiagnostic {
  const samplerFailure =
    diagnostic.code === "gltfTexture.invalidSamplerIndex" ||
    diagnostic.code === "gltfTexture.invalidSampler";

  return {
    dependencyKind: samplerFailure ? "sampler" : "texture",
    message: diagnostic.message,
    ...(diagnostic.samplerIndex === undefined
      ? {}
      : { samplerIndex: diagnostic.samplerIndex }),
  };
}
