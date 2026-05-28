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
}): PreparedCustomWgslMaterial {
  const shaderHash = stableStringHash(input.source.shader.code);
  const instanceAttributes = createInstanceAttributeLayout(
    input.source.instanceAttributes,
  );
  const moduleKey = `custom-wgsl-module:${input.assetKey}:${shaderHash}`;
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
  }));

  return {
    resourceFamily: "custom-wgsl-material",
    sourceMaterialKey: input.assetKey,
    materialKey: input.assetKey,
    label: input.source.label,
    materialFamily: input.source.family,
    shader: {
      language: "wgsl",
      moduleKey,
      code: input.source.shader.code,
      vertexEntryPoint: input.source.shader.vertexEntryPoint,
      fragmentEntryPoint: input.source.shader.fragmentEntryPoint,
    },
    pipeline: {
      pipelineKey,
      shaderModuleKey: moduleKey,
      vertexEntryPoint: input.source.shader.vertexEntryPoint,
      fragmentEntryPoint: input.source.shader.fragmentEntryPoint,
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
    source.family,
    `shader:${shaderHash}`,
    `vs:${source.shader.vertexEntryPoint}`,
    `fs:${source.shader.fragmentEntryPoint}`,
    `instance-attributes:${instanceAttributes?.layoutKey ?? "none"}`,
    `bindings:${(source.bindings ?? [])
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
