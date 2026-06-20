import type { BuiltInShaderSourceModule } from "../../materials/unlit/unlit-shader.js";

export const MOTION_VECTOR_SHADER_VARIANT_SUFFIX = "motion-vector";
export const PREVIOUS_WORLD_TRANSFORM_BINDING = 3;

export function createMotionVectorBuiltInShaderVariant(
  shader: BuiltInShaderSourceModule,
): BuiltInShaderSourceModule {
  const codeWithUniform = addPreviousViewProjectionUniform(shader.code);
  const codeWithPreviousTransforms =
    addPreviousWorldTransformStorage(codeWithUniform);
  const codeWithVaryings = addMotionVectorVaryings(codeWithPreviousTransforms);
  const codeWithAssignments = addMotionVectorAssignments(codeWithVaryings);
  const code = wrapFragmentWithMotionVectorOutput(
    codeWithAssignments,
    shader.entryPoints.fragment,
  );

  return {
    ...shader,
    label: `${shader.label}/${MOTION_VECTOR_SHADER_VARIANT_SUFFIX}`,
    code,
    bindings: addPreviousWorldTransformBinding(shader.bindings),
  };
}

function addPreviousViewProjectionUniform(code: string): string {
  if (code.includes("previousViewProjection: mat4x4f")) {
    return code;
  }

  return code.replace(
    "  cameraPosition: vec4f,\n",
    "  cameraPosition: vec4f,\n  previousViewProjection: mat4x4f,\n",
  );
}

function addPreviousWorldTransformStorage(code: string): string {
  if (code.includes("previousWorldTransforms: array<mat4x4f>")) {
    return code;
  }

  return code.replace(
    "@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;",
    `@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(1) @binding(${PREVIOUS_WORLD_TRANSFORM_BINDING}) var<storage, read> previousWorldTransforms: array<mat4x4f>;`,
  );
}

function addMotionVectorVaryings(code: string): string {
  if (code.includes("motionClipPosition: vec4f")) {
    return code;
  }

  return code.replace(
    /(struct VertexOutput \{[\s\S]*?)(\n};)/,
    "$1\n  @location(14) motionClipPosition: vec4f,\n  @location(15) previousMotionClipPosition: vec4f,$2",
  );
}

function addMotionVectorAssignments(code: string): string {
  if (code.includes("output.previousMotionClipPosition")) {
    return code;
  }

  const codeWithPreviousWorld = addPreviousWorldLocal(code);
  const previousLocalPosition = previousLocalPositionExpression(
    codeWithPreviousWorld,
  );

  if (
    codeWithPreviousWorld.includes(
      "output.position = view.viewProjection * worldPosition;",
    )
  ) {
    return codeWithPreviousWorld.replace(
      "  output.position = view.viewProjection * worldPosition;\n",
      `  output.position = view.viewProjection * worldPosition;
  output.motionClipPosition = output.position;
  output.previousMotionClipPosition = view.previousViewProjection * previousWorld * ${previousLocalPosition};
`,
    );
  }

  return codeWithPreviousWorld.replace(
    "  output.position = view.viewProjection * world * vec4f(input.position, 1.0);\n",
    `  let worldPosition = world * vec4f(input.position, 1.0);
  output.position = view.viewProjection * worldPosition;
  output.motionClipPosition = output.position;
  output.previousMotionClipPosition = view.previousViewProjection * previousWorld * vec4f(input.position, 1.0);
`,
  );
}

function addPreviousWorldLocal(code: string): string {
  if (code.includes("let previousWorld = previousWorldTransforms")) {
    return code;
  }

  return code.replace(
    "  let world = worldTransforms[input.instanceIndex];",
    "  let world = worldTransforms[input.instanceIndex];\n  let previousWorld = previousWorldTransforms[input.instanceIndex];",
  );
}

function previousLocalPositionExpression(code: string): string {
  if (code.includes("let skinnedPosition = ")) {
    return "vec4f(skinnedPosition, 1.0)";
  }

  if (code.includes("let morphedPosition = ")) {
    return "vec4f(morphedPosition, 1.0)";
  }

  return "vec4f(input.position, 1.0)";
}

function addPreviousWorldTransformBinding(
  bindings: BuiltInShaderSourceModule["bindings"],
): BuiltInShaderSourceModule["bindings"] {
  if (bindings.some((binding) => binding.id === "previousWorldTransforms")) {
    return bindings;
  }

  return [
    ...bindings,
    {
      id: "previousWorldTransforms",
      label: "Previous world transform matrix storage",
      group: 1,
      binding: PREVIOUS_WORLD_TRANSFORM_BINDING,
      resource: "read-only-storage-buffer",
    },
  ];
}

function wrapFragmentWithMotionVectorOutput(
  code: string,
  fragmentEntryPoint: string,
): string {
  const colorEntryPoint = `${fragmentEntryPoint}_color`;
  const fragmentPattern = new RegExp(
    `@fragment\\s+fn ${escapeRegExp(
      fragmentEntryPoint,
    )}\\(([\\s\\S]*?)\\)\\s*->\\s*@location\\(0\\)\\s*vec4f\\s*\\{`,
    "u",
  );
  const fragmentMatch = fragmentPattern.exec(code);

  if (fragmentMatch === null) {
    return code;
  }

  const fragmentParameters = fragmentMatch[1] ?? "";
  const fragmentParameterInfo = parseWgslParameterList(fragmentParameters);
  const fragmentArgumentList = fragmentParameterInfo
    .map((parameter) => parameter.name)
    .join(", ");
  const vertexInputName =
    fragmentParameterInfo.find((parameter) => parameter.type === "VertexOutput")
      ?.name ??
    fragmentParameterInfo[0]?.name ??
    "input";
  const colorCode = code.replace(
    fragmentPattern,
    `fn ${colorEntryPoint}($1) -> vec4f {`,
  );

  return `${colorCode}

struct MotionVectorFragmentOutput {
  @location(0) color: vec4f,
  @location(1) motionVector: vec4f,
};

fn clipToNdcForMotionVector(clip: vec4f) -> vec2f {
  let fallbackW = select(-0.000001, 0.000001, clip.w >= 0.0);
  let w = select(clip.w, fallbackW, abs(clip.w) < 0.000001);
  return clip.xy / w;
}

fn encodeMotionVector(currentClip: vec4f, previousClip: vec4f) -> vec4f {
  let currentNdc = clipToNdcForMotionVector(currentClip);
  let previousNdc = clipToNdcForMotionVector(previousClip);
  let motion = clamp((currentNdc - previousNdc) * vec2f(0.5, -0.5), vec2f(-1.0), vec2f(1.0));
  return vec4f(motion * 0.5 + vec2f(0.5), 0.5, 1.0);
}

@fragment
fn ${fragmentEntryPoint}(${fragmentParameters}) -> MotionVectorFragmentOutput {
  var output: MotionVectorFragmentOutput;
  output.color = ${colorEntryPoint}(${fragmentArgumentList});
  output.motionVector = encodeMotionVector(${vertexInputName}.motionClipPosition, ${vertexInputName}.previousMotionClipPosition);
  return output;
}`;
}

interface WgslParameterInfo {
  readonly name: string;
  readonly type: string;
}

function parseWgslParameterList(parameters: string): WgslParameterInfo[] {
  return splitTopLevelWgslParameters(parameters).map(parseWgslParameter);
}

function splitTopLevelWgslParameters(parameters: string): string[] {
  const result: string[] = [];
  let start = 0;
  let parenDepth = 0;
  let angleDepth = 0;

  for (let index = 0; index < parameters.length; index += 1) {
    const char = parameters[index];
    if (char === "(") {
      parenDepth += 1;
    } else if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
    } else if (char === "<") {
      angleDepth += 1;
    } else if (char === ">") {
      angleDepth = Math.max(0, angleDepth - 1);
    } else if (char === "," && parenDepth === 0 && angleDepth === 0) {
      const parameter = parameters.slice(start, index).trim();
      if (parameter.length > 0) {
        result.push(parameter);
      }
      start = index + 1;
    }
  }

  const tail = parameters.slice(start).trim();
  if (tail.length > 0) {
    result.push(tail);
  }

  return result;
}

function parseWgslParameter(parameter: string): WgslParameterInfo {
  const parameterWithoutAttributes = parameter.replace(
    /^(?:\s*@\w+(?:\([^)]*\))?\s*)+/u,
    "",
  );
  const match = /^\s*([A-Za-z_]\w*)\s*:\s*([A-Za-z_]\w*(?:<[^>]*>)?)/u.exec(
    parameterWithoutAttributes,
  );

  return {
    name: match?.[1] ?? "input",
    type: match?.[2] ?? "",
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
