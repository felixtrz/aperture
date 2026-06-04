import { describe, expect, it } from "vitest";
import {
  createDebugNormalMaterialAsset,
  createDebugNormalPreparedMaterialResourceDescriptor,
  createMatcapMaterialAsset,
  createMatcapPreparedMaterialResourceDescriptor,
  createPreparedMaterialResourceDescriptor,
  createRenderAssetCollections,
  createStandardMaterialAsset,
  createStandardPreparedMaterialResourceDescriptor,
  createUnlitMaterialAsset,
  createUnlitPreparedMaterialResourceDescriptor,
} from "@aperture-engine/render";
import {
  createSamplerHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";

describe("prepared material resource descriptors", () => {
  it("creates JSON-safe descriptors for all built-in material families", () => {
    const assets = createRenderAssetCollections();
    const colorTexture = createTextureHandle("color");
    const normalTexture = createTextureHandle("normal");
    const matcapTexture = createTextureHandle("matcap");
    const sampler = createSamplerHandle("linear");

    for (const handle of [
      colorTexture,
      normalTexture,
      matcapTexture,
      sampler,
    ]) {
      assets.registry.register(handle);
      assets.registry.markReady(handle, {});
    }

    const unlit = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "Textured Unlit",
        baseColorTexture: { texture: colorTexture, sampler },
      }),
    );
    const matcap = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Clay Matcap",
        matcapTexture: { texture: matcapTexture, sampler },
      }),
    );
    const standard = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Textured Standard",
        baseColorTexture: { texture: colorTexture, sampler },
        normalTexture: { texture: normalTexture, sampler },
      }),
    );
    const debugNormal = assets.materials.debugNormal.add(
      createDebugNormalMaterialAsset({ label: "Normals" }),
    );

    const unlitDescriptor = createUnlitPreparedMaterialResourceDescriptor({
      registry: assets.registry,
      material: unlit,
    });
    const matcapDescriptor = createMatcapPreparedMaterialResourceDescriptor({
      registry: assets.registry,
      material: matcap,
    });
    const standardDescriptor = createStandardPreparedMaterialResourceDescriptor(
      {
        registry: assets.registry,
        material: standard,
      },
    );
    const debugDescriptor = createDebugNormalPreparedMaterialResourceDescriptor(
      {
        registry: assets.registry,
        material: debugNormal,
      },
    );

    expect(
      [
        unlitDescriptor,
        matcapDescriptor,
        standardDescriptor,
        debugDescriptor,
      ].map((result) => result.valid),
    ).toEqual([true, true, true, true]);
    expect(unlitDescriptor.descriptor).toMatchObject({
      resourceFamily: "material",
      sourceMaterialKey: "material:unlit-material-1",
      materialFamily: "unlit",
      pipelineKey: "unlit|baseColorTexture|opaque|back|less|none",
      materialResourceKey: "prepared-material:material:unlit-material-1@v1",
      dependencies: ["texture:color", "sampler:linear"],
      textureBindings: [
        {
          field: "baseColorTexture",
          textureKey: "texture:color",
          samplerKey: "sampler:linear",
        },
      ],
      dependencyReadiness: {
        ready: true,
        materialKind: "unlit",
      },
    });
    expect(matcapDescriptor.descriptor).toMatchObject({
      sourceMaterialKey: "material:matcap-material-1",
      materialFamily: "matcap",
      pipelineKey: "matcap|matcapTexture|opaque|back|less|none",
      dependencies: ["texture:matcap", "sampler:linear"],
    });
    expect(standardDescriptor.descriptor).toMatchObject({
      sourceMaterialKey: "material:standard-material-1",
      materialFamily: "standard",
      pipelineKey:
        "standard|baseColorTexture|normalTexture|opaque|back|less|none",
      dependencies: ["texture:color", "sampler:linear", "texture:normal"],
      textureBindings: [
        {
          field: "baseColorTexture",
          textureKey: "texture:color",
          samplerKey: "sampler:linear",
        },
        {
          field: "normalTexture",
          textureKey: "texture:normal",
          samplerKey: "sampler:linear",
        },
      ],
    });
    expect(debugDescriptor.descriptor).toMatchObject({
      sourceMaterialKey: "material:debug-normal-material-1",
      materialFamily: "debug-normal",
      pipelineKey: "debug-normal|opaque|back|less|none",
      dependencies: [],
      textureBindings: [],
      dependencyReadiness: {
        ready: true,
        slots: [],
        diagnostics: [],
      },
    });

    expect(JSON.parse(JSON.stringify(standardDescriptor.descriptor))).toEqual(
      standardDescriptor.descriptor,
    );
  });

  it("rejects invalid source material kinds in family-specific helpers", () => {
    const assets = createRenderAssetCollections();
    const material = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Not Unlit" }),
    );

    expect(
      createUnlitPreparedMaterialResourceDescriptor({
        registry: assets.registry,
        material,
      }),
    ).toMatchObject({
      valid: false,
      descriptor: null,
      diagnostics: [
        {
          code: "preparedMaterialResource.unsupportedMaterialKind",
          materialKey: "material:standard-material-1",
          expectedMaterialFamily: "unlit",
          actualMaterialFamily: "standard",
        },
      ],
    });
  });

  it("reports blocked dependencies before creating a descriptor", () => {
    const assets = createRenderAssetCollections();
    const texture = createTextureHandle("loading-color");
    const sampler = createSamplerHandle("linear");

    assets.registry.register(texture);
    assets.registry.register(sampler);
    assets.registry.markLoading(texture);
    assets.registry.markReady(sampler, {});

    const material = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        baseColorTexture: { texture, sampler },
      }),
    );

    expect(
      createPreparedMaterialResourceDescriptor({
        registry: assets.registry,
        material,
      }),
    ).toMatchObject({
      valid: false,
      descriptor: null,
      diagnostics: [
        {
          code: "materialDependency.dependencyLoading",
          materialKey: "material:unlit-material-1",
          dependencyKey: "texture:loading-color",
        },
      ],
    });
  });
});
