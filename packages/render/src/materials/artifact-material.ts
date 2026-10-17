import {
  ShaderError,
  packShaderBuffer,
  type ShaderArtifact,
} from "@aperture-engine/shader";
import { createCustomWgslMaterialAsset } from "./factories.js";
import type {
  CustomWgslMaterialAsset,
  CustomWgslBindingDeclaration,
} from "./types.js";

/** Explicit interleaved mesh-stream contract; locations may be remapped by the author. */
export interface CustomMaterialVertexLayout {
  readonly arrayStride: number;
  readonly stepMode: "vertex";
  readonly attributes: readonly {
    readonly shaderLocation: number;
    readonly offset: number;
    readonly format:
      | "float32"
      | "float32x2"
      | "float32x3"
      | "float32x4"
      | "uint32"
      | "uint32x2"
      | "uint32x3"
      | "uint32x4";
  }[];
}
/** Fully authored color programs must opt out of engine-generated visibility.
 * Use a standard extension when lighting, shadow, pick and motion variants are needed. */
export interface CustomMaterialEnginePasses {
  readonly color: true;
  readonly shadow: "none";
  readonly picking: "none";
  readonly motion: "none";
}
export interface ArtifactMaterialOptions extends Omit<
  Parameters<typeof createCustomWgslMaterialAsset>[0],
  "shader" | "artifact" | "vertexLayout" | "enginePasses"
> {
  readonly artifact: ShaderArtifact;
  readonly vertexLayout: CustomMaterialVertexLayout;
  readonly enginePasses: CustomMaterialEnginePasses;
}
/** Adapt a compiled artifact to the existing custom-material asset/worker route. */
export function createArtifactMaterialAsset(
  options: ArtifactMaterialOptions,
): CustomWgslMaterialAsset {
  return createCustomWgslMaterialAsset({
    ...options,
    shader: {
      kind: "inline-wgsl",
      code: options.artifact.code,
      virtualPath: options.artifact.entry,
    },
  });
}
export function validateArtifactMaterial(
  material: Pick<
    CustomWgslMaterialAsset,
    | "artifact"
    | "shader"
    | "entryPoints"
    | "bindings"
    | "vertexLayout"
    | "enginePasses"
  >,
): void {
  const artifact = material.artifact;
  if (artifact === undefined) return;
  const fail = (message: string): never => {
    throw new ShaderError([
      {
        code: "aperture.material.artifactContract",
        severity: "error",
        message,
      },
    ]);
  };
  if (artifact.format !== "aperture.shader" || artifact.version !== 1)
    fail("Unsupported custom material shader artifact.");
  if (
    material.shader.kind !== "inline-wgsl" ||
    material.shader.code !== artifact.code
  )
    fail("Custom material source must match its compiled artifact.");
  for (const stage of ["vertex", "fragment"] as const)
    if (
      !artifact.entryPoints.some(
        (entry) =>
          entry.stage === stage && entry.name === material.entryPoints[stage],
      )
    )
      fail(`Missing ${stage} entry point '${material.entryPoints[stage]}'.`);
  if (
    !material.enginePasses ||
    material.enginePasses.color !== true ||
    ["shadow", "picking", "motion"].some(
      (pass) => material.enginePasses![pass as "shadow"] !== "none",
    )
  )
    fail(
      "Fully authored material v1 supports color with explicit shadow/picking/motion:'none'; use standard extensions for generated engine variants.",
    );
  const layout = material.vertexLayout;
  if (
    !layout ||
    layout.stepMode !== "vertex" ||
    !Number.isSafeInteger(layout.arrayStride) ||
    layout.arrayStride < 4 ||
    layout.arrayStride % 4 !== 0 ||
    layout.attributes.length === 0
  )
    fail(
      "Provide a nonempty interleaved vertex layout with a positive, four-byte-aligned stride.",
    );
  const locations = new Set<number>();
  for (const attribute of layout!.attributes) {
    const match = /^(?:float32|uint32)(?:x([234]))?$/.exec(attribute.format);
    const size = 4 * Number(match?.[1] ?? 1);
    if (
      !match ||
      !Number.isSafeInteger(attribute.offset) ||
      attribute.offset < 0 ||
      attribute.offset % 4 !== 0 ||
      attribute.offset + size > layout!.arrayStride ||
      !Number.isSafeInteger(attribute.shaderLocation) ||
      attribute.shaderLocation < 0 ||
      locations.has(attribute.shaderLocation)
    )
      fail(
        "Custom vertex layout contains an invalid format, offset or duplicate shader location.",
      );
    locations.add(attribute.shaderLocation);
  }
  for (const binding of artifact.bindings) {
    if (binding.group < 2) {
      if (
        binding.binding !== 0 ||
        (binding.group === 0
          ? binding.kind !== "uniform-buffer"
          : binding.kind !== "storage-buffer" || binding.access !== "read")
      )
        fail(
          "Groups 0 and 1 are reserved for the engine view uniform and read-only world transforms at binding 0.",
        );
      continue;
    }
    if (binding.group !== 2)
      fail(
        "Custom material resources must use group 2; other groups are reserved.",
      );
    const declaration = material.bindings.find(
      (value) => value.binding === binding.binding,
    );
    if (
      !declaration ||
      declaration.kind !== binding.kind ||
      declaration.name !== binding.name
    )
      fail(
        `Binding ${binding.binding} '${binding.name}' does not match the reflected resource contract.`,
      );
    for (const stage of binding.visibility)
      if (!declaration!.visibility.includes(stage as "vertex" | "fragment"))
        fail(`Binding '${binding.name}' is missing ${stage} visibility.`);
    if (
      binding.kind === "storage-buffer" &&
      declaration!.kind === "storage-buffer" &&
      binding.access !==
        (declaration!.access === "read-write" ? "read_write" : "read")
    )
      fail(`Storage access mismatch for '${binding.name}'.`);
    if (binding.kind === "uniform-buffer") {
      if (
        binding.layout?.kind !== "struct" ||
        declaration!.kind !== "uniform-buffer"
      )
        fail(`Uniform '${binding.name}' requires a reflected struct.`);
      const uniform = declaration as Extract<
        CustomWgslBindingDeclaration,
        { kind: "uniform-buffer" }
      >;
      const reflected = binding.layout!;
      if (reflected.kind !== "struct") continue;
      const values: Record<string, number | readonly number[]> = {};
      const types: Record<string, string> = {
        f32: "float32",
        i32: "int32",
        u32: "uint32",
        vec2f: "vec2",
        vec3f: "vec3",
        vec4f: "vec4",
        "vec2<f32>": "vec2",
        "vec3<f32>": "vec3",
        "vec4<f32>": "vec4",
        mat4x4f: "mat4x4",
        "mat4x4<f32>": "mat4x4",
      };
      for (const field of reflected.fields) {
        const authored = uniform.fields[field.name],
          expected = types[field.layout.type];
        if (
          !authored ||
          !expected ||
          authored.type.toLowerCase().replace("color", "vec4") !== expected
        )
          fail(
            `Uniform field '${binding.name}.${field.name}' does not match reflected type ${field.layout.type}; nested fields require a source-buffer binding.`,
          );
        values[field.name] = (uniform.values?.[field.name] ??
          authored!.default ??
          (field.layout.kind === "scalar"
            ? 0
            : Array(field.layout.size / 4).fill(0))) as
          | number
          | readonly number[];
      }
      if (
        Object.keys(uniform.fields).some(
          (name) => !reflected.fields.some((field) => field.name === name),
        )
      )
        fail(`Uniform '${binding.name}' declares fields absent from WGSL.`);
      packShaderBuffer(reflected, values);
    }
    if (
      binding.texture &&
      declaration!.kind === "texture" &&
      ((declaration!.viewDimension ?? "2d") !== binding.texture.dimension ||
        (declaration!.sampleType ?? "float") !== binding.texture.sampleType ||
        (declaration!.multisampled ?? false) !== binding.texture.multisampled)
    )
      fail(`Texture contract mismatch for '${binding.name}'.`);
    if (
      binding.sampler &&
      declaration!.kind === "sampler" &&
      (declaration!.samplerType ?? "filtering") !== binding.sampler
    )
      fail(`Sampler contract mismatch for '${binding.name}'.`);
  }
  for (const declaration of material.bindings)
    if (
      !artifact.bindings.some(
        (binding) =>
          binding.group === 2 && binding.binding === declaration.binding,
      )
    )
      fail(`Binding '${declaration.name}' is not declared by the artifact.`);
}
