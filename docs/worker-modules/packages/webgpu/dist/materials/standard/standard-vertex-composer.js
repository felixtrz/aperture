export const STANDARD_VERTEX_BINDINGS_BEGIN = "// @aperture-standard-vertex-bindings:begin";
export const STANDARD_VERTEX_BINDINGS_END = "// @aperture-standard-vertex-bindings:end";
export const STANDARD_VERTEX_INPUT_FIELDS_BEGIN = "  // @aperture-standard-vertex-input-fields:begin";
export const STANDARD_VERTEX_INPUT_FIELDS_END = "  // @aperture-standard-vertex-input-fields:end";
export const STANDARD_VERTEX_OUTPUT_FIELDS_BEGIN = "  // @aperture-standard-vertex-output-fields:begin";
export const STANDARD_VERTEX_OUTPUT_FIELDS_END = "  // @aperture-standard-vertex-output-fields:end";
export const STANDARD_VERTEX_HELPERS_BEGIN = "// @aperture-standard-vertex-helpers:begin";
export const STANDARD_VERTEX_HELPERS_END = "// @aperture-standard-vertex-helpers:end";
export const STANDARD_VERTEX_LOCAL_TRANSFORM_BEGIN = "  // @aperture-standard-vertex-local-transform:begin";
export const STANDARD_VERTEX_LOCAL_TRANSFORM_END = "  // @aperture-standard-vertex-local-transform:end";
export const STANDARD_VERTEX_NORMAL_OUTPUT_BEGIN = "  // @aperture-standard-vertex-normal-output:begin";
export const STANDARD_VERTEX_NORMAL_OUTPUT_END = "  // @aperture-standard-vertex-normal-output:end";
export const STANDARD_VERTEX_PRE_UV_OUTPUT_BEGIN = "  // @aperture-standard-vertex-pre-uv-output:begin";
export const STANDARD_VERTEX_PRE_UV_OUTPUT_END = "  // @aperture-standard-vertex-pre-uv-output:end";
export const STANDARD_VERTEX_POST_UV_OUTPUT_BEGIN = "  // @aperture-standard-vertex-post-uv-output:begin";
export const STANDARD_VERTEX_POST_UV_OUTPUT_END = "  // @aperture-standard-vertex-post-uv-output:end";
export class StandardVertexComposerError extends Error {
    constructor(message) {
        super(message);
        this.name = "StandardVertexComposerError";
    }
}
export class StandardVertexComposer {
    #bindings = new Map();
    #inputFields = new Map();
    #outputFields = new Map();
    #helperFunctions = new Map();
    #localStatements = [];
    #preUvOutputAssignments = [];
    #postUvOutputAssignments = [];
    #tangentOutputEnabled = false;
    #localPositionExpression = "input.position";
    #localNormalExpression = "input.normal";
    #localTangentExpression = "input.tangent.xyz";
    addBinding(id, code) {
        addUniqueContribution(this.#bindings, "binding", id, code);
    }
    addInputField(id, code) {
        addUniqueContribution(this.#inputFields, "input field", id, code);
    }
    addOutputField(id, code) {
        addUniqueContribution(this.#outputFields, "output field", id, code);
    }
    addHelperFunction(id, code) {
        addUniqueContribution(this.#helperFunctions, "helper function", id, code);
    }
    addLocalStatement(statement) {
        this.#localStatements.push(statement);
    }
    setLocalPositionExpression(expression) {
        this.#localPositionExpression = expression;
    }
    setLocalNormalExpression(expression) {
        this.#localNormalExpression = expression;
    }
    setLocalTangentExpression(expression) {
        this.#localTangentExpression = expression;
    }
    enableTangentOutput() {
        this.#tangentOutputEnabled = true;
    }
    addPreUvOutputAssignment(statement) {
        this.#preUvOutputAssignments.push(statement);
    }
    addPostUvOutputAssignment(statement) {
        this.#postUvOutputAssignments.push(statement);
    }
    contract() {
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
    emitBindings() {
        const contract = this.contract();
        return [
            STANDARD_VERTEX_BINDINGS_BEGIN,
            ...contract.bindings.map((binding) => binding.code),
            STANDARD_VERTEX_BINDINGS_END,
        ].join("\n");
    }
    emitInputFields() {
        const contract = this.contract();
        return [
            STANDARD_VERTEX_INPUT_FIELDS_BEGIN,
            ...contract.inputFields.map((field) => field.code),
            STANDARD_VERTEX_INPUT_FIELDS_END,
        ].join("\n");
    }
    emitOutputFields() {
        const contract = this.contract();
        return [
            STANDARD_VERTEX_OUTPUT_FIELDS_BEGIN,
            ...contract.outputFields.map((field) => field.code),
            STANDARD_VERTEX_OUTPUT_FIELDS_END,
        ].join("\n");
    }
    emitHelperFunctions() {
        const contract = this.contract();
        return [
            STANDARD_VERTEX_HELPERS_BEGIN,
            ...contract.helperFunctions.map((helper) => helper.code),
            STANDARD_VERTEX_HELPERS_END,
        ].join("\n");
    }
    emitLocalTransformBlock() {
        const contract = this.contract();
        return [
            STANDARD_VERTEX_LOCAL_TRANSFORM_BEGIN,
            ...contract.localStatements,
            `  let worldPosition = world * vec4f(${contract.localPositionExpression}, 1.0);`,
            STANDARD_VERTEX_LOCAL_TRANSFORM_END,
        ].join("\n");
    }
    emitNormalOutputBlock() {
        const contract = this.contract();
        return [
            STANDARD_VERTEX_NORMAL_OUTPUT_BEGIN,
            `  output.worldNormal = normalize((world * vec4f(${contract.localNormalExpression}, 0.0)).xyz);`,
            STANDARD_VERTEX_NORMAL_OUTPUT_END,
        ].join("\n");
    }
    emitPreUvOutputAssignments() {
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
    emitPostUvOutputAssignments() {
        const contract = this.contract();
        return [
            STANDARD_VERTEX_POST_UV_OUTPUT_BEGIN,
            ...contract.postUvOutputAssignments,
            STANDARD_VERTEX_POST_UV_OUTPUT_END,
        ].join("\n");
    }
}
export function createStandardVertexComposer() {
    return new StandardVertexComposer();
}
export function replaceStandardVertexSlots(code, composer) {
    let next = replaceStandardVertexSlot(code, STANDARD_VERTEX_BINDINGS_BEGIN, STANDARD_VERTEX_BINDINGS_END, composer.emitBindings(), "vertex binding");
    next = replaceStandardVertexSlot(next, STANDARD_VERTEX_INPUT_FIELDS_BEGIN, STANDARD_VERTEX_INPUT_FIELDS_END, composer.emitInputFields(), "vertex input field");
    next = replaceStandardVertexSlot(next, STANDARD_VERTEX_OUTPUT_FIELDS_BEGIN, STANDARD_VERTEX_OUTPUT_FIELDS_END, composer.emitOutputFields(), "vertex output field");
    next = replaceStandardVertexSlot(next, STANDARD_VERTEX_HELPERS_BEGIN, STANDARD_VERTEX_HELPERS_END, composer.emitHelperFunctions(), "vertex helper");
    next = replaceStandardVertexSlot(next, STANDARD_VERTEX_LOCAL_TRANSFORM_BEGIN, STANDARD_VERTEX_LOCAL_TRANSFORM_END, composer.emitLocalTransformBlock(), "vertex local transform");
    next = replaceStandardVertexSlot(next, STANDARD_VERTEX_NORMAL_OUTPUT_BEGIN, STANDARD_VERTEX_NORMAL_OUTPUT_END, composer.emitNormalOutputBlock(), "vertex normal output");
    next = replaceStandardVertexSlot(next, STANDARD_VERTEX_PRE_UV_OUTPUT_BEGIN, STANDARD_VERTEX_PRE_UV_OUTPUT_END, composer.emitPreUvOutputAssignments(), "vertex pre-uv output");
    return replaceStandardVertexSlot(next, STANDARD_VERTEX_POST_UV_OUTPUT_BEGIN, STANDARD_VERTEX_POST_UV_OUTPUT_END, composer.emitPostUvOutputAssignments(), "vertex post-uv output");
}
function addUniqueContribution(contributions, slot, id, code) {
    if (contributions.has(id)) {
        throw new StandardVertexComposerError(`StandardMaterial vertex composer slot '${slot}' already has contribution '${id}'.`);
    }
    contributions.set(id, code);
}
function mapContributions(contributions) {
    return [...contributions].map(([id, code]) => ({ id, code }));
}
function replaceStandardVertexSlot(code, beginMarker, endMarker, replacement, label) {
    const begin = escapeRegExp(beginMarker);
    const end = escapeRegExp(endMarker);
    const pattern = new RegExp(`${begin}[\\s\\S]*?${end}`, "u");
    if (!pattern.test(code)) {
        throw new StandardVertexComposerError(`StandardMaterial shader source is missing the ${label} slot.`);
    }
    return code.replace(pattern, replacement);
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
//# sourceMappingURL=standard-vertex-composer.js.map