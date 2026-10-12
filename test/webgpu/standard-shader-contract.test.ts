import { describe, expect, it } from "vitest";
import {
  applyOutputTonemapToStandardShader,
  createIndirectColorChannelShaderVariant,
  createMotionVectorBuiltInShaderVariant,
  createStandardTextureVariantShader,
  validateStandardShaderMetadata,
  type BuiltInShaderSourceModule,
  type StandardTextureShaderFeatures,
} from "@aperture-engine/webgpu/test-support";
import { applyStandardLightArguments } from "../../packages/webgpu/src/materials/standard/standard-shader-extension-sampling.js";
import { findWgslFunctionDeclaration } from "../../packages/webgpu/src/gpu/wgsl-function-declaration.js";

const base: StandardTextureShaderFeatures = {
  baseColorTexture: false,
  metallicRoughnessTexture: false,
  normalTexture: false,
  occlusionTexture: false,
  emissiveTexture: false,
};

const lightRoutes = [
  { name: "unshadowed", features: {} },
  { name: "directional", features: { shadowMap: true } },
  {
    name: "cascaded",
    features: { shadowMap: true, cascadedShadowMap: true },
  },
  { name: "spot", features: { shadowMap: true, spotShadowMap: true } },
  { name: "point", features: { pointShadowMap: true } },
  { name: "multi", features: { shadowMap: true, pointShadowMap: true } },
  { name: "clustered", features: { clusteredLocalLights: true } },
  {
    name: "clustered-spot",
    features: {
      shadowMap: true,
      spotShadowMap: true,
      clusteredLocalLights: true,
    },
  },
  {
    name: "clustered-directional-point",
    features: {
      shadowMap: true,
      pointShadowMap: true,
      directionalPointShadowMap: true,
      clusteredLocalLights: true,
      clusteredLocalLightPointArrayShadows: true,
    },
  },
  {
    name: "directional-point",
    features: {
      shadowMap: true,
      pointShadowMap: true,
      directionalPointShadowMap: true,
    },
  },
  {
    name: "directional-point-array",
    features: {
      shadowMap: true,
      pointShadowMap: true,
      directionalPointShadowMap: true,
      clusteredLocalLightPointArrayShadows: true,
    },
  },
] as const satisfies readonly {
  readonly name: string;
  readonly features: Partial<StandardTextureShaderFeatures>;
}[];

const lobes = [
  { name: "clearcoat", features: { clearcoat: true } },
  { name: "sheen", features: { sheen: true } },
  { name: "combined-scalar", features: { clearcoat: true, sheen: true } },
  {
    name: "combined-textured",
    features: {
      clearcoat: true,
      clearcoatTexture: true,
      clearcoatRoughnessTexture: true,
      sheen: true,
      sheenColorTexture: true,
      sheenRoughnessTexture: true,
    },
  },
  {
    name: "combined-normal-iridescence-transmission",
    features: {
      normalTexture: true,
      clearcoat: true,
      clearcoatTexture: true,
      clearcoatRoughnessTexture: true,
      sheen: true,
      sheenColorTexture: true,
      sheenRoughnessTexture: true,
      iridescence: true,
      iridescenceTexture: true,
      iridescenceThicknessTexture: true,
      transmission: true,
      transmissionTexture: true,
    },
  },
  { name: "iridescence", features: { iridescence: true } },
] as const satisfies readonly {
  readonly name: string;
  readonly features: Partial<StandardTextureShaderFeatures>;
}[];

describe("StandardMaterial composed shader contracts", () => {
  it.each(
    lobes.flatMap((lobe) =>
      lightRoutes.map((route) => ({
        name: `${lobe.name}/${route.name}`,
        features: { ...base, ...lobe.features, ...route.features },
      })),
    ),
  )(
    "threads every direct-light argument in declaration order for $name",
    ({ features }) => {
      const shader = createStandardTextureVariantShader(features);
      for (const name of ["evaluateDirectLight", "evaluateAreaLight"]) {
        const declaration = findWgslFunctionDeclaration(shader.code, name)!;
        expect(declaration, name).not.toBeNull();
        const calls = functionCalls(shader.code, name);
        expect(
          calls.length,
          `${name} has actual emitted calls`,
        ).toBeGreaterThan(0);
        const extensionParameters = declaration.parameters
          .slice(7)
          .map((p) => p.name);
        for (const call of calls) {
          expect(call.arguments.length, call.source).toBe(
            declaration.parameters.length,
          );
          expect(call.arguments.slice(7), call.source).toEqual(
            extensionParameters,
          );
        }
      }
      expectShadowCallArities(shader.code);
    },
  );

  it("forwards the computed normal to nonclustered directional-point shadow receivers", () => {
    const shader = createStandardTextureVariantShader({
      ...base,
      ...lightRoutes[9].features,
      normalTexture: true,
    });
    const helper = findWgslFunctionDeclaration(
      shader.code,
      "sampleDirectionalShadowFactor",
    )!;
    expect(helper.parameters.map((parameter) => parameter.name)).toEqual([
      "worldPosition",
      "normal",
    ]);
    expectShadowCallArities(shader.code);
    expect(shader.code).toContain(
      "sampleDirectionalShadowFactor(input.worldPosition, normal)",
    );
    const ordinary = createStandardTextureVariantShader({
      ...base,
      ...lightRoutes[5].features,
    });
    expect(
      findWgslFunctionDeclaration(
        ordinary.code,
        "sampleDirectionalShadowFactor",
      )!.parameters.map((parameter) => parameter.name),
    ).toEqual(["worldPosition"]);
    expectShadowCallArities(ordinary.code);
  });

  it.each([
    {
      name: "clearcoat",
      features: lobes[0].features,
      route: lightRoutes[6].features,
    },
    {
      name: "sheen",
      features: lobes[1].features,
      route: lightRoutes[6].features,
    },
    {
      name: "iridescence",
      features: lobes[5].features,
      route: lightRoutes[6].features,
    },
    {
      name: "combined",
      features: lobes[2].features,
      route: lightRoutes[6].features,
    },
    {
      name: "combined-spot",
      features: lobes[2].features,
      route: lightRoutes[7].features,
    },
    {
      name: "combined-directional-point",
      features: lobes[2].features,
      route: lightRoutes[8].features,
    },
  ])(
    "forwards typed fragment lobe values into the clustered $name helper",
    (input) => {
      const scalar: StandardTextureShaderFeatures = {
        ...base,
        ...input.features,
        ...input.route,
      };
      const textured: StandardTextureShaderFeatures = {
        ...scalar,
        clearcoatTexture: scalar.clearcoat === true,
        clearcoatRoughnessTexture: scalar.clearcoat === true,
        sheenColorTexture: scalar.sheen === true,
        sheenRoughnessTexture: scalar.sheen === true,
        iridescenceTexture: scalar.iridescence === true,
        iridescenceThicknessTexture: scalar.iridescence === true,
      };
      for (const features of [scalar, textured]) {
        const shader = createStandardTextureVariantShader(features);
        const helper = findWgslFunctionDeclaration(
          shader.code,
          "evaluateClusteredLocalLights",
        )!;
        const helperEnd = functionBodyEnd(shader.code, helper.bodyStart);
        const direct = findWgslFunctionDeclaration(
          shader.code,
          "evaluateDirectLight",
        )!;
        const expected = direct.parameters.slice(7);
        expect(
          helper.parameters.slice(0, 6).map((parameter) => parameter.name),
        ).toEqual([
          "position",
          "normal",
          "viewDir",
          "baseColor",
          "metallic",
          "roughness",
        ]);
        expect(helper.parameters.slice(6)).toEqual(expected);

        const localCalls = functionCalls(
          shader.code,
          "evaluateDirectLight",
        ).filter(
          (call) => call.start > helper.bodyStart && call.start < helperEnd,
        );
        expect(localCalls).toHaveLength(2);
        for (const call of localCalls) {
          expect(call.arguments.slice(7)).toEqual(
            expected.map((parameter) => parameter.name),
          );
          for (const parameter of expected) {
            expect(
              helper.parameters.find(
                (candidate) => candidate.name === parameter.name,
              ),
            ).toEqual(parameter);
          }
        }
        // Area lighting remains in the fragment scope and keeps its own context;
        // it does not acquire clearcoat/sheen parameters through the clustered helper.
        expect(
          functionCalls(shader.code, "evaluateAreaLight").filter(
            (call) => call.start > helper.bodyStart && call.start < helperEnd,
          ),
        ).toEqual([]);
        const fragment = findWgslFunctionDeclaration(shader.code, "fs_main")!;
        const calls = functionCalls(
          shader.code,
          "evaluateClusteredLocalLights",
        );
        expect(calls).toHaveLength(1);
        for (const call of calls) {
          expect(call.start).toBeGreaterThan(fragment.bodyStart);
          expect(call.arguments).toEqual([
            "input.worldPosition",
            "normal",
            "viewDir",
            "baseColor",
            "metallic",
            "roughness",
            ...expected.map((parameter) => parameter.name),
          ]);
          const precedingFragment = shader.code.slice(
            fragment.bodyStart,
            call.start,
          );
          for (const parameter of expected) {
            expect(precedingFragment).toMatch(
              new RegExp(`\\blet ${parameter.name}\\s*=`),
            );
          }
          if (features === textured) {
            for (const [value, texture] of [
              ["clearcoatFactor", "clearcoatTexture"],
              ["clearcoatRoughness", "clearcoatRoughnessTexture"],
              ["sheenColor", "sheenColorTexture"],
              ["sheenRoughness", "sheenRoughnessTexture"],
              ["iridescence", "iridescenceTexture"],
              ["iridescenceThickness", "iridescenceThicknessTexture"],
            ]) {
              if (expected.some((parameter) => parameter.name === value)) {
                const initializer = new RegExp(
                  `\\blet ${value}\\s*=([^;]+);`,
                ).exec(precedingFragment);
                expect(initializer?.[1]).toContain(`textureSample(${texture},`);
              }
            }
          }
        }
      }
    },
  );

  const metadataVariants = [
    { name: "base", features: base },
    {
      name: "textured",
      features: {
        ...base,
        baseColorTexture: true,
        metallicRoughnessTexture: true,
      },
    },
    {
      name: "normal-skinned-morphed",
      features: { ...base, normalTexture: true, skinned: true, morphed: true },
    },
    {
      name: "shadow-IBL",
      features: {
        ...base,
        shadowMap: true,
        iblDiffuse: true,
        iblSpecularBrdf: true,
      },
    },
    {
      name: "combined-lobes",
      features: { ...base, ...lobes[4].features },
    },
    {
      name: "clustered-multi-shadow",
      features: { ...base, ...lightRoutes[8].features },
    },
  ] satisfies readonly {
    readonly name: string;
    readonly features: StandardTextureShaderFeatures;
  }[];

  it.each(metadataVariants)(
    "covers actual WGSL resources through derived $name variants",
    ({ features }) => {
      const shader = createStandardTextureVariantShader(features);
      const output = applyOutputTonemapToStandardShader(shader, "aces", "srgb");
      const variants = [
        shader,
        output,
        createMotionVectorBuiltInShaderVariant(output),
        createIndirectColorChannelShaderVariant(output),
      ];
      for (const variant of variants) {
        const declared = declaredBindings(variant.code);
        const metadata = variant.bindings.map((binding) => ({
          slot: `${binding.group}:${binding.binding}`,
          resource: binding.resource,
        }));
        expect(new Set(metadata.map((b) => b.slot)).size).toBe(metadata.length);
        expect(
          [...metadata].sort((a, b) => a.slot.localeCompare(b.slot)),
        ).toEqual(
          declared
            .map(({ slot, resource }) => ({ slot, resource }))
            .sort((a, b) => a.slot.localeCompare(b.slot)),
        );
        for (const resource of declared.filter((binding) =>
          binding.name.startsWith("standardAreaLightLtc"),
        )) {
          expect(
            variant.bindings.filter((binding) => binding.id === resource.name),
          ).toHaveLength(1);
        }
        expect(validateStandardShaderMetadata(variant)).toEqual({
          valid: true,
          diagnostics: [],
        });
      }
      expect(output.bindings).toBe(shader.bindings);
      expect(createIndirectColorChannelShaderVariant(output).bindings).toBe(
        shader.bindings,
      );
    },
  );

  it("ignores nested/comment-only calls and keeps final argument repair idempotent", () => {
    const shader = createStandardTextureVariantShader({
      ...base,
      clearcoat: true,
      sheen: true,
      iridescence: true,
      clusteredLocalLights: true,
    });
    const comment =
      "/* 🌈 outer /* nested */ evaluateDirectLight(notAnArgument) */\n// 🚀 evaluateDirectLight(ignored)\n";
    expect(applyStandardLightArguments(comment + shader.code)).toBe(
      comment + shader.code,
    );
  });

  it.each([
    "standardAreaLightLtcMatrixTexture",
    "standardAreaLightLtcFresnelTexture",
    "standardAreaLightLtcSampler",
  ])("reports missing required reachable resource %s", (id: string) => {
    const shader = createStandardTextureVariantShader(base);
    const incomplete = {
      ...shader,
      bindings: shader.bindings.filter((binding) => binding.id !== id),
    };
    expect(validateStandardShaderMetadata(incomplete)).toEqual({
      valid: false,
      diagnostics: [
        {
          code: "shaderMetadata.missingBinding",
          field: `bindings.${id}`,
          message: `Built-in shader metadata is missing '${id}' binding metadata.`,
        },
      ],
    });
  });
});

// This checks generated declaration/call shapes; native compilation remains a
// separate gate. Nested calls and comments must not become extra arguments.
function expectShadowCallArities(code: string): void {
  const masked = maskComments(code);
  const names = new Set(
    [...masked.matchAll(/\b(sample\w*Shadow\w*)\s*\(/gu)].map(
      (match) => match[1]!,
    ),
  );
  for (const name of names) {
    const declaration = findWgslFunctionDeclaration(code, name)!;
    expect(
      declaration,
      `${name} has an actual emitted declaration`,
    ).not.toBeNull();
    for (const call of functionCalls(code, name)) {
      expect(call.arguments.length, call.source).toBe(
        declaration.parameters.length,
      );
    }
  }
}

function functionCalls(
  code: string,
  name: string,
): readonly {
  readonly start: number;
  readonly source: string;
  readonly arguments: readonly string[];
}[] {
  const masked = maskComments(code);
  const declaration = findWgslFunctionDeclaration(code, name)!;
  const calls = [];
  for (const match of masked.matchAll(new RegExp(`\\b${name}\\s*\\(`, "gu"))) {
    const start = match.index;
    if (start >= declaration.start && start < declaration.bodyStart) continue;
    const open = start + match[0].lastIndexOf("(");
    const stack = ["("];
    const args = [];
    let argumentStart = open + 1;
    let cursor = argumentStart;
    for (; cursor < masked.length && stack.length > 0; cursor++) {
      const c = masked[cursor]!;
      if ("([{".includes(c)) stack.push(c);
      else if (")]}".includes(c)) {
        const expected = c === ")" ? "(" : c === "]" ? "[" : "{";
        if (stack.pop() !== expected)
          throw new Error("Unbalanced generated WGSL call");
        if (stack.length === 0) {
          if (masked.slice(argumentStart, cursor).trim())
            args.push(code.slice(argumentStart, cursor).trim());
          break;
        }
      } else if (c === "," && stack.length === 1) {
        if (masked.slice(argumentStart, cursor).trim())
          args.push(code.slice(argumentStart, cursor).trim());
        argumentStart = cursor + 1;
      }
    }
    if (stack.length !== 0) throw new Error("Unterminated generated WGSL call");
    calls.push({
      start,
      source: code.slice(start, cursor + 1),
      arguments: args,
    });
  }
  return calls;
}

function functionBodyEnd(code: string, start: number): number {
  const masked = maskComments(code);
  let depth = 0;
  for (let cursor = start; cursor < masked.length; cursor++) {
    if (masked[cursor] === "{") depth++;
    else if (masked[cursor] === "}" && --depth === 0) return cursor + 1;
  }
  throw new Error("Unbalanced generated WGSL function body");
}

function declaredBindings(code: string): readonly {
  readonly slot: string;
  readonly name: string;
  readonly resource: BuiltInShaderSourceModule["bindings"][number]["resource"];
}[] {
  return [
    ...maskComments(code).matchAll(
      /@group\((\d+)\)\s*@binding\((\d+)\)\s*var(?:<([^>]+)>)?\s*(\w+)\s*:\s*([^;]+);/gu,
    ),
  ].map((match) => {
    const [, group, binding, storage, name, type] = match;
    const resource =
      storage?.trim() === "uniform"
        ? "uniform-buffer"
        : storage?.startsWith("storage")
          ? "read-only-storage-buffer"
          : type!.startsWith("texture_")
            ? "texture"
            : type!.startsWith("sampler")
              ? "sampler"
              : null;
    if (resource === null)
      throw new Error(`Unrecognized generated resource ${name}: ${type}`);
    return { slot: `${group}:${binding}`, name: name!, resource };
  });
}

function maskComments(code: string): string {
  const chars = code.split("");
  for (let cursor = 0; cursor < code.length; ) {
    let end = cursor;
    if (code.startsWith("//", cursor)) {
      end = code.indexOf("\n", cursor + 2);
      if (end < 0) end = code.length;
    } else if (code.startsWith("/*", cursor)) {
      end = cursor + 2;
      let depth = 1;
      while (end < code.length && depth > 0) {
        if (code.startsWith("/*", end)) {
          depth++;
          end += 2;
        } else if (code.startsWith("*/", end)) {
          depth--;
          end += 2;
        } else end++;
      }
      if (depth > 0) throw new Error("Unterminated WGSL comment");
    }
    if (end > cursor) {
      for (let i = cursor; i < end; i++) if (chars[i] !== "\n") chars[i] = " ";
      cursor = end;
    } else cursor++;
  }
  return chars.join("");
}
