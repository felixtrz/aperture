import {
  createInstanceAttributeLayout,
  type InstanceAttributeLayout,
} from "../materials/index.js";
import type {
  CustomWgslMaterialSource,
  PreparedCustomWgslMaterial,
} from "./custom-wgsl-material-types.js";

export function createPreparedCustomWgslMaterial(input: {
  readonly source: CustomWgslMaterialSource;
  readonly assetKey: string;
  readonly shaderCode: string;
  readonly shaderSourceKey: string;
}): PreparedCustomWgslMaterial {
  const shaderHash = stableStringHash(input.shaderCode);
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
        }
      : {}),
  }));

  return {
    resourceFamily: "custom-wgsl-material",
    sourceMaterialKey: input.assetKey,
    materialKey: input.assetKey,
    label: input.source.label,
    materialFamily: input.source.familyKey,
    pipelineKey,
    materialResourceKey: bindGroupResourceKey,
    bindGroupResourceKey,
    shader: {
      language: "wgsl",
      moduleKey,
      code: input.shaderCode,
      sourceKey: input.shaderSourceKey,
      vertexEntryPoint: input.source.entryPoints.vertex,
      fragmentEntryPoint: input.source.entryPoints.fragment,
    },
    pipeline: {
      pipelineKey,
      shaderModuleKey: moduleKey,
      vertexEntryPoint: input.source.entryPoints.vertex,
      fragmentEntryPoint: input.source.entryPoints.fragment,
      renderState: input.source.renderState,
      instanceAttributes,
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
    `instance-attributes:${instanceAttributes?.layoutKey ?? "none"}`,
    `features:${source.pipelineKey.features.join(",")}`,
    `specialization:${stableStringHash(
      JSON.stringify(source.pipelineKey.specialization),
    )}`,
    `bindings:${source.bindings
      .map((binding) => `${binding.binding}:${binding.kind}`)
      .sort()
      .join(",")}`,
    source.renderState.alphaMode,
    source.renderState.cullMode,
    source.renderState.depth.compare,
    source.renderState.blend.preset,
  ].join("|");
}

function stableStringHash(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
