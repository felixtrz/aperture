import {
  APERTURE_LIT_PIPELINE_FEATURE,
  APERTURE_LIT_WGSL_HEADER,
  createInstanceAttributeLayout,
  customWgslColorTargetsPipelineKeySegment,
  type InstanceAttributeLayout,
} from "../materials/index.js";
import type {
  CustomWgslMaterialSource,
  PreparedCustomWgslColorTarget,
  PreparedCustomWgslMaterial,
} from "./custom-wgsl-material-types.js";

export function createPreparedCustomWgslMaterial(input: {
  readonly source: CustomWgslMaterialSource;
  readonly assetKey: string;
  readonly shaderCode: string;
  readonly shaderSourceKey: string;
}): PreparedCustomWgslMaterial {
  const lit = input.source.lighting === "lit";
  // Lit materials get the renderer-owned group(3) contract header prepended
  // to the module (A1): the shader hash therefore covers the header, so a
  // contract-header change rebuilds lit pipelines while unlit materials stay
  // byte-identical to today.
  const shaderCode = lit
    ? `${APERTURE_LIT_WGSL_HEADER}\n${input.shaderCode}`
    : input.shaderCode;
  const shaderHash = stableStringHash(shaderCode);
  const instanceAttributes = createInstanceAttributeLayout(
    input.source.instanceAttributes,
  );
  const moduleKey = `custom-wgsl-module:${input.shaderSourceKey}:${shaderHash}`;
  const pipelineKey = customWgslMaterialPipelineKey(
    input.source,
    shaderHash,
    instanceAttributes,
  );
  const bindGroupLayoutResourceKey = `custom-wgsl-bind-group-layout:${input.assetKey}:${pipelineKey}`;
  const bindGroupResourceKey = `custom-wgsl-bind-group:${input.assetKey}:${pipelineKey}`;
  const bindings = [...(input.source.bindings ?? [])].sort(
    (a, b) => a.binding - b.binding,
  );
  const layoutEntries = bindings.map((binding) => ({
    binding: binding.binding,
    kind: binding.kind,
    visibility: [...binding.visibility].sort(),
    label: binding.label ?? `binding-${binding.binding}`,
    ...(binding.kind === "uniform-buffer"
      ? {
          fields: binding.fields,
          ...(binding.values === undefined ? {} : { values: binding.values }),
          ...(binding.runtimeUniformKey === undefined
            ? {}
            : { runtimeUniformKey: binding.runtimeUniformKey }),
        }
      : {}),
    ...(binding.kind === "storage-buffer"
      ? {
          ...(binding.buffer === undefined ? {} : { buffer: binding.buffer }),
          ...(binding.runtimeBufferKey === undefined
            ? {}
            : { runtimeBufferKey: binding.runtimeBufferKey }),
        }
      : {}),
    // B4: the texture/sampler layout variants. Each is carried ONLY when the
    // declaration set it, so default (float/2d/filtering) bindings keep the
    // pre-B4 prepared entry shape byte-for-byte.
    ...(binding.kind === "texture"
      ? {
          ...(binding.sampleType === undefined
            ? {}
            : { sampleType: binding.sampleType }),
          ...(binding.viewDimension === undefined
            ? {}
            : { viewDimension: binding.viewDimension }),
          ...(binding.multisampled === undefined
            ? {}
            : { multisampled: binding.multisampled }),
          ...(binding.source === undefined ? {} : { source: binding.source }),
        }
      : {}),
    ...(binding.kind === "sampler" && binding.samplerType !== undefined
      ? { samplerType: binding.samplerType }
      : {}),
  }));
  const samplesSceneDepth = bindings.some(
    (binding) => binding.kind === "texture" && binding.source === "scene-depth",
  );

  return {
    resourceFamily: "custom-wgsl-material",
    sourceMaterialKey: input.assetKey,
    materialKey: input.assetKey,
    label: input.source.label,
    materialFamily: input.source.familyKey,
    // Present only when lit so unlit prepared materials stay byte-identical.
    ...(lit ? { lighting: "lit" as const } : {}),
    // Present only when a scene-depth texture binding was declared (B4) so
    // every other prepared material keeps its byte-identical shape.
    ...(samplesSceneDepth ? { samplesSceneDepth: true as const } : {}),
    pipelineKey,
    materialResourceKey: bindGroupResourceKey,
    bindGroupResourceKey,
    shader: {
      language: "wgsl",
      moduleKey,
      code: shaderCode,
      sourceKey: input.shaderSourceKey,
      vertexEntryPoint: input.source.entryPoints.vertex,
      fragmentEntryPoint: input.source.entryPoints.fragment,
      ...(input.source.entryPoints.shadowVertex === undefined
        ? {}
        : { shadowVertexEntryPoint: input.source.entryPoints.shadowVertex }),
    },
    pipeline: {
      pipelineKey,
      shaderModuleKey: moduleKey,
      vertexEntryPoint: input.source.entryPoints.vertex,
      fragmentEntryPoint: input.source.entryPoints.fragment,
      ...(input.source.entryPoints.shadowVertex === undefined
        ? {}
        : { shadowVertexEntryPoint: input.source.entryPoints.shadowVertex }),
      renderState: input.source.renderState,
      instanceAttributes,
      // Present only when declared (B3) so undeclared prepared materials
      // stay byte-identical.
      ...(input.source.colorTargets === undefined
        ? {}
        : {
            colorTargets: input.source.colorTargets.map(
              (target): PreparedCustomWgslColorTarget => ({
                format: target.format,
                writeMask: target.writeMask ?? "all",
                ...(target.renderTarget === undefined
                  ? {}
                  : { renderTarget: target.renderTarget }),
              }),
            ),
          }),
    },
    bindGroupLayout: {
      resourceKey: bindGroupLayoutResourceKey,
      entries: layoutEntries,
    },
    bindGroup: {
      resourceKey: bindGroupResourceKey,
      layoutResourceKey: bindGroupLayoutResourceKey,
      entries: layoutEntries.map((entry) => ({
        binding: entry.binding,
        kind: entry.kind,
        resourceKey: `${input.assetKey}:binding:${entry.binding}`,
      })),
    },
  };
}

function customWgslMaterialPipelineKey(
  source: CustomWgslMaterialSource,
  shaderHash: string,
  instanceAttributes: InstanceAttributeLayout | null,
): string {
  return [
    source.familyKey,
    `shader:${shaderHash}`,
    `vs:${source.entryPoints.vertex}`,
    `fs:${source.entryPoints.fragment}`,
    // The shadow-caster entry point participates only when authored so
    // materials without one keep byte-identical pipeline keys (zero
    // regression for existing caches, snapshots, and goldens).
    ...(source.entryPoints.shadowVertex === undefined
      ? []
      : [`shadow-vs:${source.entryPoints.shadowVertex}`]),
    // The lit-contract segment participates only when lighting is "lit"
    // (same byte-identity rule); it carries the contract version so future
    // group(3) layout changes cannot collide with cached pipelines.
    ...(source.lighting === "lit" ? [APERTURE_LIT_PIPELINE_FEATURE] : []),
    // The MRT segment participates only when colorTargets is declared (B3,
    // same byte-identity rule) and must sit BEFORE the trailing render-state
    // segments the webgpu render-state parser slices off the key's tail.
    ...colorTargetsSegments(source),
    `instance-attributes:${instanceAttributes?.layoutKey ?? "none"}`,
    `features:${source.pipelineKey.features.join(",")}`,
    `specialization:${stableStringHash(
      JSON.stringify(source.pipelineKey.specialization),
    )}`,
    `bindings:${source.bindings
      .map(customWgslBindingLayoutSignature)
      .sort()
      .join(",")}`,
    source.renderState.alphaMode,
    source.renderState.cullMode,
    source.renderState.depth.compare,
    source.renderState.blend.preset,
  ].join("|");
}

function colorTargetsSegments(
  source: CustomWgslMaterialSource,
): readonly string[] {
  const segment = customWgslColorTargetsPipelineKeySegment(source.colorTargets);

  return segment === null ? [] : [segment];
}

function customWgslBindingLayoutSignature(
  binding: CustomWgslMaterialSource["bindings"][number],
): string {
  const visibility = [...binding.visibility].sort().join("+");

  if (binding.kind === "uniform-buffer") {
    const fields = Object.entries(binding.fields)
      .map(([name, field]) => `${name}:${field.type}`)
      .sort()
      .join("+");

    return `${binding.binding}:uniform-buffer:visibility:${visibility}:fields:${fields}`;
  }

  // B4: the texture/sampler layout variant participates in the pipeline key
  // ONLY when the declaration set it to a non-default value. A float/2d/
  // filtering texture and a filtering sampler append no variant suffix, so
  // pre-B4 materials keep byte-identical keys (depth/unfilterable/comparison/
  // multisampled/cube/scene-depth bindings each get their own pipeline).
  const variant =
    binding.kind === "texture"
      ? customWgslTextureVariantSignature(binding)
      : binding.kind === "sampler"
        ? customWgslSamplerVariantSignature(binding)
        : "";

  return `${binding.binding}:${binding.kind}:visibility:${visibility}${variant}`;
}

function customWgslTextureVariantSignature(
  binding: Extract<
    CustomWgslMaterialSource["bindings"][number],
    { kind: "texture" }
  >,
): string {
  const tokens: string[] = [];

  if (binding.sampleType !== undefined && binding.sampleType !== "float") {
    tokens.push(`sample:${binding.sampleType}`);
  }

  if (binding.viewDimension !== undefined && binding.viewDimension !== "2d") {
    tokens.push(`dim:${binding.viewDimension}`);
  }

  if (binding.multisampled === true) {
    tokens.push("multisampled");
  }

  if (binding.source !== undefined) {
    tokens.push(`source:${binding.source}`);
  }

  return tokens.length === 0 ? "" : `:${tokens.join(":")}`;
}

function customWgslSamplerVariantSignature(
  binding: Extract<
    CustomWgslMaterialSource["bindings"][number],
    { kind: "sampler" }
  >,
): string {
  return binding.samplerType !== undefined &&
    binding.samplerType !== "filtering"
    ? `:sampler:${binding.samplerType}`
    : "";
}

function stableStringHash(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
