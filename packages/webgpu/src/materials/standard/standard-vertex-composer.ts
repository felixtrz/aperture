export const STANDARD_VERTEX_BINDINGS_BEGIN =
  "// @aperture-standard-vertex-bindings:begin";
export const STANDARD_VERTEX_BINDINGS_END =
  "// @aperture-standard-vertex-bindings:end";
export const STANDARD_VERTEX_INPUT_FIELDS_BEGIN =
  "  // @aperture-standard-vertex-input-fields:begin";
export const STANDARD_VERTEX_INPUT_FIELDS_END =
  "  // @aperture-standard-vertex-input-fields:end";
export const STANDARD_VERTEX_OUTPUT_FIELDS_BEGIN =
  "  // @aperture-standard-vertex-output-fields:begin";
export const STANDARD_VERTEX_OUTPUT_FIELDS_END =
  "  // @aperture-standard-vertex-output-fields:end";
export const STANDARD_VERTEX_HELPERS_BEGIN =
  "// @aperture-standard-vertex-helpers:begin";
export const STANDARD_VERTEX_HELPERS_END =
  "// @aperture-standard-vertex-helpers:end";
export const STANDARD_VERTEX_LOCAL_TRANSFORM_BEGIN =
  "  // @aperture-standard-vertex-local-transform:begin";
export const STANDARD_VERTEX_LOCAL_TRANSFORM_END =
  "  // @aperture-standard-vertex-local-transform:end";
export const STANDARD_VERTEX_NORMAL_OUTPUT_BEGIN =
  "  // @aperture-standard-vertex-normal-output:begin";
export const STANDARD_VERTEX_NORMAL_OUTPUT_END =
  "  // @aperture-standard-vertex-normal-output:end";
export const STANDARD_VERTEX_PRE_UV_OUTPUT_BEGIN =
  "  // @aperture-standard-vertex-pre-uv-output:begin";
export const STANDARD_VERTEX_PRE_UV_OUTPUT_END =
  "  // @aperture-standard-vertex-pre-uv-output:end";
export const STANDARD_VERTEX_POST_UV_OUTPUT_BEGIN =
  "  // @aperture-standard-vertex-post-uv-output:begin";
export const STANDARD_VERTEX_POST_UV_OUTPUT_END =
  "  // @aperture-standard-vertex-post-uv-output:end";

export interface StandardVertexSlotContribution {
  readonly id: string;
  readonly code: string;
}

export interface StandardVertexCompositionContract {
  readonly bindings: readonly StandardVertexSlotContribution[];
  readonly inputFields: readonly StandardVertexSlotContribution[];
  readonly outputFields: readonly StandardVertexSlotContribution[];
  readonly helperFunctions: readonly StandardVertexSlotContribution[];
  readonly localStatements: readonly string[];
  readonly localPositionExpression: string;
  readonly localNormalExpression: string;
  readonly localTangentExpression: string;
  readonly tangentOutputEnabled: boolean;
  readonly preUvOutputAssignments: readonly string[];
  readonly postUvOutputAssignments: readonly string[];
}

export class StandardVertexComposerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StandardVertexComposerError";
  }
}

export class StandardVertexComposer {
  readonly #bindings = new Map<string, string>();
  readonly #inputFields = new Map<string, string>();
  readonly #outputFields = new Map<string, string>();
  readonly #helperFunctions = new Map<string, string>();
  readonly #localStatements: string[] = [];
  readonly #preUvOutputAssignments: string[] = [];
  readonly #postUvOutputAssignments: string[] = [];
  #tangentOutputEnabled = false;
  #localPositionExpression = "input.position";
  #localNormalExpression = "input.normal";
  #localTangentExpression = "input.tangent.xyz";

  addBinding(id: string, code: string): void {
    addUniqueContribution(this.#bindings, "binding", id, code);
  }

  addInputField(id: string, code: string): void {
    addUniqueContribution(this.#inputFields, "input field", id, code);
  }

  addOutputField(id: string, code: string): void {
    addUniqueContribution(this.#outputFields, "output field", id, code);
  }

  addHelperFunction(id: string, code: string): void {
    addUniqueContribution(this.#helperFunctions, "helper function", id, code);
  }

  addLocalStatement(statement: string): void {
    this.#localStatements.push(statement);
  }

  setLocalPositionExpression(expression: string): void {
    this.#localPositionExpression = expression;
  }

  setLocalNormalExpression(expression: string): void {
    this.#localNormalExpression = expression;
  }

  setLocalTangentExpression(expression: string): void {
    this.#localTangentExpression = expression;
  }

  enableTangentOutput(): void {
    this.#tangentOutputEnabled = true;
  }

  addPreUvOutputAssignment(statement: string): void {
    this.#preUvOutputAssignments.push(statement);
  }

  addPostUvOutputAssignment(statement: string): void {
    this.#postUvOutputAssignments.push(statement);
  }

  contract(): StandardVertexCompositionContract {
    return {
      bindings: mapContributions(this.#bindings),
      inputFields: mapContributions(this.#inputFields),
      outputFields: mapContributions(this.#outputFields),
      helperFunctions: mapContributions(this.#helperFunctions),
      localStatements: [...this.#localStatements],
      localPositionExpression: this.#localPositionExpression,
      localNormalExpression: this.#localNormalExpression,
      localTangentExpression: this.#localTangentExpression,
      tangentOutputEnabled: this.#tangentOutputEnabled,
      preUvOutputAssignments: [...this.#preUvOutputAssignments],
      postUvOutputAssignments: [...this.#postUvOutputAssignments],
    };
  }

  emitBindings(): string {
    const contract = this.contract();
    return [
      STANDARD_VERTEX_BINDINGS_BEGIN,
      ...contract.bindings.map((binding) => binding.code),
      STANDARD_VERTEX_BINDINGS_END,
    ].join("\n");
  }

  emitInputFields(): string {
    const contract = this.contract();
    return [
      STANDARD_VERTEX_INPUT_FIELDS_BEGIN,
      ...contract.inputFields.map((field) => field.code),
      STANDARD_VERTEX_INPUT_FIELDS_END,
    ].join("\n");
  }

  emitOutputFields(): string {
    const contract = this.contract();
    return [
      STANDARD_VERTEX_OUTPUT_FIELDS_BEGIN,
      ...contract.outputFields.map((field) => field.code),
      STANDARD_VERTEX_OUTPUT_FIELDS_END,
    ].join("\n");
  }

  emitHelperFunctions(): string {
    const contract = this.contract();
    return [
      STANDARD_VERTEX_HELPERS_BEGIN,
      ...contract.helperFunctions.map((helper) => helper.code),
      STANDARD_VERTEX_HELPERS_END,
    ].join("\n");
  }

  emitLocalTransformBlock(): string {
    const contract = this.contract();
    return [
      STANDARD_VERTEX_LOCAL_TRANSFORM_BEGIN,
      ...contract.localStatements,
      `  let worldPosition = world * vec4f(${contract.localPositionExpression}, 1.0);`,
      STANDARD_VERTEX_LOCAL_TRANSFORM_END,
    ].join("\n");
  }

  emitNormalOutputBlock(): string {
    const contract = this.contract();
    return [
      STANDARD_VERTEX_NORMAL_OUTPUT_BEGIN,
      `  output.worldNormal = normalize((world * vec4f(${contract.localNormalExpression}, 0.0)).xyz);`,
      STANDARD_VERTEX_NORMAL_OUTPUT_END,
    ].join("\n");
  }

  emitPreUvOutputAssignments(): string {
    const contract = this.contract();
    const tangentOutputAssignments = contract.tangentOutputEnabled
      ? [
          `  output.worldTangent = normalize((world * vec4f(${contract.localTangentExpression}, 0.0)).xyz);`,
          "  output.tangentSign = input.tangent.w;",
        ]
      : [];

    return [
      STANDARD_VERTEX_PRE_UV_OUTPUT_BEGIN,
      ...tangentOutputAssignments,
      ...contract.preUvOutputAssignments,
      STANDARD_VERTEX_PRE_UV_OUTPUT_END,
    ].join("\n");
  }

  emitPostUvOutputAssignments(): string {
    const contract = this.contract();
    return [
      STANDARD_VERTEX_POST_UV_OUTPUT_BEGIN,
      ...contract.postUvOutputAssignments,
      STANDARD_VERTEX_POST_UV_OUTPUT_END,
    ].join("\n");
  }
}

export function createStandardVertexComposer(): StandardVertexComposer {
  return new StandardVertexComposer();
}

export function replaceStandardVertexSlots(
  code: string,
  composer: StandardVertexComposer,
): string {
  let next = replaceStandardVertexSlot(
    code,
    STANDARD_VERTEX_BINDINGS_BEGIN,
    STANDARD_VERTEX_BINDINGS_END,
    composer.emitBindings(),
    "vertex binding",
  );
  next = replaceStandardVertexSlot(
    next,
    STANDARD_VERTEX_INPUT_FIELDS_BEGIN,
    STANDARD_VERTEX_INPUT_FIELDS_END,
    composer.emitInputFields(),
    "vertex input field",
  );
  next = replaceStandardVertexSlot(
    next,
    STANDARD_VERTEX_OUTPUT_FIELDS_BEGIN,
    STANDARD_VERTEX_OUTPUT_FIELDS_END,
    composer.emitOutputFields(),
    "vertex output field",
  );
  next = replaceStandardVertexSlot(
    next,
    STANDARD_VERTEX_HELPERS_BEGIN,
    STANDARD_VERTEX_HELPERS_END,
    composer.emitHelperFunctions(),
    "vertex helper",
  );
  next = replaceStandardVertexSlot(
    next,
    STANDARD_VERTEX_LOCAL_TRANSFORM_BEGIN,
    STANDARD_VERTEX_LOCAL_TRANSFORM_END,
    composer.emitLocalTransformBlock(),
    "vertex local transform",
  );
  next = replaceStandardVertexSlot(
    next,
    STANDARD_VERTEX_NORMAL_OUTPUT_BEGIN,
    STANDARD_VERTEX_NORMAL_OUTPUT_END,
    composer.emitNormalOutputBlock(),
    "vertex normal output",
  );
  next = replaceStandardVertexSlot(
    next,
    STANDARD_VERTEX_PRE_UV_OUTPUT_BEGIN,
    STANDARD_VERTEX_PRE_UV_OUTPUT_END,
    composer.emitPreUvOutputAssignments(),
    "vertex pre-uv output",
  );
  return replaceStandardVertexSlot(
    next,
    STANDARD_VERTEX_POST_UV_OUTPUT_BEGIN,
    STANDARD_VERTEX_POST_UV_OUTPUT_END,
    composer.emitPostUvOutputAssignments(),
    "vertex post-uv output",
  );
}

function addUniqueContribution(
  contributions: Map<string, string>,
  slot: string,
  id: string,
  code: string,
): void {
  if (contributions.has(id)) {
    throw new StandardVertexComposerError(
      `StandardMaterial vertex composer slot '${slot}' already has contribution '${id}'.`,
    );
  }

  contributions.set(id, code);
}

function mapContributions(
  contributions: ReadonlyMap<string, string>,
): StandardVertexSlotContribution[] {
  return [...contributions].map(([id, code]) => ({ id, code }));
}

function replaceStandardVertexSlot(
  code: string,
  beginMarker: string,
  endMarker: string,
  replacement: string,
  label: string,
): string {
  const begin = escapeRegExp(beginMarker);
  const end = escapeRegExp(endMarker);
  const pattern = new RegExp(`${begin}[\\s\\S]*?${end}`, "u");

  if (!pattern.test(code)) {
    throw new StandardVertexComposerError(
      `StandardMaterial shader source is missing the ${label} slot.`,
    );
  }

  return code.replace(pattern, replacement);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
