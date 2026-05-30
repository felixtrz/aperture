import type { BuiltInShaderSourceModule } from "../unlit/unlit-shader.js";

// M5-T6 (approach A): emit the lit pass's INDIRECT (ambient + IBL) lighting term
// into a second color attachment so a screen-space AO pass can attenuate ONLY
// indirect light, leaving direct light and emissive untouched. This mirrors the
// motion-vector second-attachment variant (createMotionVectorBuiltInShaderVariant)
// — it is mutually exclusive with motion vectors (both target @location(1)).
//
// The standard fragment assembles `let color = <indirect> + direct + <emissive>;`
// (the non-shadow variants). We split out `<indirect>` as `standardIndirectColor`
// and emit a two-target fragment output. The final return expression — which may
// be the plain `color` or the tonemap/sRGB-wrapped form
// `apertureOutputColorSpace(apertureOutputTonemap(color))` — is reused verbatim
// for the color target and re-applied to `standardIndirectColor` for the indirect
// target, so both channels live in the same space (the AO composite subtracts
// them directly). Variants without a separable indirect term (e.g. shadowed)
// emit a zero indirect channel, so AO leaves those fragments unchanged.

const INDIRECT_FRAGMENT_OUTPUT_STRUCT = `struct StandardIndirectFragmentOutput {
  @location(0) color: vec4f,
  @location(1) indirect: vec4f,
};`;

export function createIndirectColorChannelShaderVariant(
  shader: BuiltInShaderSourceModule,
): BuiltInShaderSourceModule {
  const fragmentEntry = shader.entryPoints.fragment;
  const signature = `@fragment\nfn ${fragmentEntry}(input: VertexOutput) -> @location(0) vec4f {`;

  if (!shader.code.includes(signature)) {
    // Unknown fragment shape — leave the shader untouched; the caller must not
    // request the indirect channel for a shader it cannot transform.
    return shader;
  }

  let captured = false;
  let code = shader.code.replace(
    / {2}let color = (.+) \+ direct \+ (material\.emissiveFactor|emissive);/,
    (_match, indirect: string, emissive: string) => {
      captured = true;
      return `  let standardIndirectColor = ${indirect};\n  let color = standardIndirectColor + direct + ${emissive};`;
    },
  );

  const returnPattern = / {2}return vec4f\((.+), alpha\);/;

  if (!returnPattern.test(code)) {
    return shader;
  }

  if (!captured) {
    // Shadowed / unrecognized lighting composition: no cleanly separable
    // indirect term. Emit a zero indirect channel so the second attachment is
    // valid and AO applies nothing to these fragments.
    code = code.replace(
      returnPattern,
      (match) => `  let standardIndirectColor = vec3f(0.0);\n${match}`,
    );
  }

  code = code
    .replace(
      signature,
      `${INDIRECT_FRAGMENT_OUTPUT_STRUCT}\n\n@fragment\nfn ${fragmentEntry}(input: VertexOutput) -> StandardIndirectFragmentOutput {`,
    )
    .replace(returnPattern, (_match, expression: string) => {
      const indirectExpression = expression.replace(
        /\bcolor\b/g,
        "standardIndirectColor",
      );
      return `  var standardFragmentOutput: StandardIndirectFragmentOutput;
  standardFragmentOutput.color = vec4f(${expression}, alpha);
  standardFragmentOutput.indirect = vec4f(${indirectExpression}, 1.0);
  return standardFragmentOutput;`;
    });

  return {
    ...shader,
    label: `${shader.label}-indirect-channel`,
    code,
  };
}
