import type { BuiltInShaderSourceModule } from "../unlit/unlit-shader.js";

// M5-T6 (approach A): emit the lit pass's named INDIRECT
// (ambient + IBL/specular IBL after output-space transforms) into a second color
// attachment so screen-space AO can attenuate indirect light only.

const INDIRECT_FRAGMENT_OUTPUT_STRUCT = `struct StandardIndirectFragmentOutput {
  @location(0) color: vec4f,
  @location(1) indirect: vec4f,
};`;

export function createIndirectColorChannelShaderVariant(
  shader: BuiltInShaderSourceModule,
): BuiltInShaderSourceModule {
  const fragmentEntry = shader.entryPoints.fragment;
  const escapedFragmentEntry = fragmentEntry.replace(
    /[.*+?^${}()|[\]\\]/gu,
    "\\$&",
  );
  const signaturePattern = new RegExp(
    `@fragment\\nfn ${escapedFragmentEntry}\\(([\\s\\S]*?)\\) -> @location\\(0\\) vec4f \\{`,
    "u",
  );

  if (
    !signaturePattern.test(shader.code) ||
    !shader.code.includes("let standardIndirectOutputColor =")
  ) {
    return shader;
  }

  const returnPattern = / {2}return vec4f\((.+), alpha\);/u;

  if (!returnPattern.test(shader.code)) {
    return shader;
  }

  const code = shader.code
    .replace(
      signaturePattern,
      (_match, parameters: string) =>
        `${INDIRECT_FRAGMENT_OUTPUT_STRUCT}\n\n@fragment\nfn ${fragmentEntry}(${parameters}) -> StandardIndirectFragmentOutput {`,
    )
    .replace(returnPattern, (_match, expression: string) => {
      return `  var standardFragmentOutput: StandardIndirectFragmentOutput;
  standardFragmentOutput.color = vec4f(${expression}, alpha);
  standardFragmentOutput.indirect = vec4f(standardIndirectOutputColor, 1.0);
  return standardFragmentOutput;`;
    });

  return {
    ...shader,
    label: `${shader.label}-indirect-channel`,
    code,
  };
}
