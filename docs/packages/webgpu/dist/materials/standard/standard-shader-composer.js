export const STANDARD_FRAGMENT_ASSEMBLY_BEGIN = "  // @aperture-standard-fragment-assembly:begin";
export const STANDARD_FRAGMENT_ASSEMBLY_END = "  // @aperture-standard-fragment-assembly:end";
export const STANDARD_FRAGMENT_HELPERS_BEGIN = "// @aperture-standard-fragment-helpers:begin";
export const STANDARD_FRAGMENT_HELPERS_END = "// @aperture-standard-fragment-helpers:end";
export const STANDARD_FRAGMENT_BASE_COLOR_ALPHA_BEGIN = "  // @aperture-standard-fragment-base-color-alpha:begin";
export const STANDARD_FRAGMENT_BASE_COLOR_ALPHA_END = "  // @aperture-standard-fragment-base-color-alpha:end";
export const STANDARD_FRAGMENT_NORMAL_SETUP_BEGIN = "  // @aperture-standard-fragment-normal-setup:begin";
export const STANDARD_FRAGMENT_NORMAL_SETUP_END = "  // @aperture-standard-fragment-normal-setup:end";
export const STANDARD_FRAGMENT_METALLIC_ROUGHNESS_BEGIN = "  // @aperture-standard-fragment-metallic-roughness:begin";
export const STANDARD_FRAGMENT_METALLIC_ROUGHNESS_END = "  // @aperture-standard-fragment-metallic-roughness:end";
export const STANDARD_AMBIENT_DIFFUSE_BRDF_EXPRESSION = "ambient * baseColor * (1.0 - metallic) * (1.0 / PI)";
export class StandardShaderComposerError extends Error {
    constructor(message) {
        super(message);
        this.name = "StandardShaderComposerError";
    }
}
export class StandardFragmentComposer {
    #helperFunctions = [];
    #baseColorAlphaStatements = [];
    #baseColorAlphaMutations = [];
    #materialStatements = [];
    #metallicRoughnessStatements = [];
    #indirectDiffuseTerms = new Map();
    #indirectSpecularTerms = new Map();
    #directTerms = new Map();
    #colorMutationStatements = [];
    #baseColorExpression = "material.baseColorFactor.rgb";
    #alphaExpression = "material.baseColorFactor.a";
    #baseColorMutable = false;
    #alphaMutable = false;
    #normalExpression = "standardGeometryNormal(input.worldNormal, frontFacing)";
    #metallicExpression = "clamp(material.metallicFactor, 0.0, 1.0)";
    #roughnessExpression = "clamp(material.roughnessFactor, 0.045, 1.0)";
    #emissiveTerm = null;
    #outputColorExpression = "color";
    #indirectOutputColorExpression = "standardIndirectColor";
    constructor(options = {}) {
        if (options.defaults !== false) {
            this.addIndirectDiffuseTerm("ambientDiffuse", "ambientDiffuse", `  let ambientDiffuse = ${STANDARD_AMBIENT_DIFFUSE_BRDF_EXPRESSION};`);
            this.addDirectTerm("direct", "direct");
            this.setEmissiveTerm("materialEmissive", "material.emissiveFactor");
        }
    }
    addMaterialStatement(statement) {
        this.#materialStatements.push(statement);
    }
    addHelperFunction(helper) {
        this.#helperFunctions.push(helper);
    }
    addBaseColorAlphaStatement(statement) {
        this.#baseColorAlphaStatements.push(statement);
    }
    addBaseColorAlphaMutation(statement) {
        this.#baseColorAlphaMutations.push(statement);
    }
    setBaseColorExpression(expression) {
        this.#baseColorExpression = expression;
    }
    multiplyBaseColorExpression(factorExpression) {
        this.#baseColorExpression = `${this.#baseColorExpression} * ${factorExpression}`;
    }
    setBaseColorMutable() {
        this.#baseColorMutable = true;
    }
    setAlphaExpression(expression) {
        this.#alphaExpression = expression;
    }
    multiplyAlphaExpression(factorExpression) {
        this.#alphaExpression = `${this.#alphaExpression} * ${factorExpression}`;
    }
    setAlphaMutable() {
        this.#alphaMutable = true;
    }
    setNormalExpression(expression) {
        this.#normalExpression = expression;
    }
    addMetallicRoughnessStatement(statement) {
        this.#metallicRoughnessStatements.push(statement);
    }
    setMetallicExpression(expression) {
        this.#metallicExpression = expression;
    }
    setRoughnessExpression(expression) {
        this.#roughnessExpression = expression;
    }
    addIndirectDiffuseTerm(id, expression, statement) {
        addUniqueTerm(this.#indirectDiffuseTerms, "indirectDiffuse", id, expression);
        if (statement !== undefined) {
            this.addMaterialStatement(statement);
        }
    }
    setIndirectDiffuseTerm(id, expression, statement) {
        this.#indirectDiffuseTerms.delete(id);
        if (id === "ambientDiffuse") {
            removeFirstMatchingStatement(this.#materialStatements, "  let ambientDiffuse = ");
        }
        this.addIndirectDiffuseTerm(id, expression, statement);
    }
    addIndirectSpecularTerm(id, expression, statement) {
        addUniqueTerm(this.#indirectSpecularTerms, "indirectSpecular", id, expression);
        if (statement !== undefined) {
            this.addMaterialStatement(statement);
        }
    }
    addDirectTerm(id, expression) {
        addUniqueTerm(this.#directTerms, "direct", id, expression);
    }
    setDirectTerm(id, expression) {
        this.#directTerms.clear();
        this.addDirectTerm(id, expression);
    }
    setEmissiveTerm(id, expression) {
        if (this.#emissiveTerm !== null && this.#emissiveTerm.id !== id) {
            throw new StandardShaderComposerError(`StandardMaterial fragment composer slot 'emissive' is already owned by '${this.#emissiveTerm.id}' and cannot be replaced by '${id}'.`);
        }
        this.#emissiveTerm = { id, expression };
    }
    replaceEmissiveTerm(id, expression) {
        this.#emissiveTerm = { id, expression };
    }
    addColorMutationStatement(statement) {
        this.#colorMutationStatements.push(statement);
    }
    setOutputColorExpression(expression) {
        this.#outputColorExpression = expression;
    }
    setIndirectOutputColorExpression(expression) {
        this.#indirectOutputColorExpression = expression;
    }
    contract() {
        this.#validate();
        const emissiveTerm = this.#emissiveTerm;
        if (emissiveTerm === null) {
            throw new StandardShaderComposerError("StandardMaterial fragment composer requires an emissive term.");
        }
        return {
            helperFunctions: [...this.#helperFunctions],
            baseColorAlphaStatements: [...this.#baseColorAlphaStatements],
            baseColorAlphaMutations: [...this.#baseColorAlphaMutations],
            baseColorExpression: this.#baseColorExpression,
            alphaExpression: this.#alphaExpression,
            baseColorMutable: this.#baseColorMutable,
            alphaMutable: this.#alphaMutable,
            normalExpression: this.#normalExpression,
            metallicRoughnessStatements: [...this.#metallicRoughnessStatements],
            metallicExpression: this.#metallicExpression,
            roughnessExpression: this.#roughnessExpression,
            materialStatements: [...this.#materialStatements],
            indirectDiffuseTerms: mapTerms(this.#indirectDiffuseTerms),
            indirectSpecularTerms: mapTerms(this.#indirectSpecularTerms),
            directTerms: mapTerms(this.#directTerms),
            emissiveTerm,
            colorMutationStatements: [...this.#colorMutationStatements],
            outputColorExpression: this.#outputColorExpression,
            indirectOutputColorExpression: this.#indirectOutputColorExpression,
        };
    }
    emitHelperFunctions() {
        const contract = this.contract();
        return [
            STANDARD_FRAGMENT_HELPERS_BEGIN,
            ...contract.helperFunctions,
            STANDARD_FRAGMENT_HELPERS_END,
        ].join("\n");
    }
    emitBaseColorAlphaBlock() {
        const contract = this.contract();
        const baseColorBinding = contract.baseColorMutable ? "var" : "let";
        const alphaBinding = contract.alphaMutable ? "var" : "let";
        return [
            STANDARD_FRAGMENT_BASE_COLOR_ALPHA_BEGIN,
            ...contract.baseColorAlphaStatements,
            `  ${baseColorBinding} baseColor = ${contract.baseColorExpression};`,
            `  ${alphaBinding} alpha = ${contract.alphaExpression};`,
            ...contract.baseColorAlphaMutations,
            STANDARD_FRAGMENT_BASE_COLOR_ALPHA_END,
        ].join("\n");
    }
    emitNormalSetupBlock() {
        const contract = this.contract();
        return [
            STANDARD_FRAGMENT_NORMAL_SETUP_BEGIN,
            `  let normal = ${contract.normalExpression};`,
            STANDARD_FRAGMENT_NORMAL_SETUP_END,
        ].join("\n");
    }
    emitMetallicRoughnessBlock() {
        const contract = this.contract();
        return [
            STANDARD_FRAGMENT_METALLIC_ROUGHNESS_BEGIN,
            ...contract.metallicRoughnessStatements,
            `  let metallic = ${contract.metallicExpression};`,
            `  let roughness = ${contract.roughnessExpression};`,
            STANDARD_FRAGMENT_METALLIC_ROUGHNESS_END,
        ].join("\n");
    }
    emit() {
        const contract = this.contract();
        const indirectTerms = [
            ...contract.indirectDiffuseTerms,
            ...contract.indirectSpecularTerms,
        ];
        const indirectExpression = sumExpressions(indirectTerms.map((term) => term.expression));
        const directExpression = sumExpressions(contract.directTerms.map((term) => term.expression));
        const lines = [
            STANDARD_FRAGMENT_ASSEMBLY_BEGIN,
            ...contract.materialStatements,
            `  let standardIndirectColor = ${indirectExpression};`,
            `  let standardDirectColor = ${directExpression};`,
            `  let standardEmissiveColor = ${contract.emissiveTerm.expression};`,
            "  var color = standardIndirectColor + standardDirectColor + standardEmissiveColor;",
            ...contract.colorMutationStatements,
            `  let standardIndirectOutputColor = ${contract.indirectOutputColorExpression};`,
            `  return vec4f(${contract.outputColorExpression}, alpha);`,
            STANDARD_FRAGMENT_ASSEMBLY_END,
        ];
        return lines.join("\n");
    }
    #validate() {
        if (this.#indirectDiffuseTerms.size === 0) {
            throw new StandardShaderComposerError("StandardMaterial fragment composer requires at least one indirect diffuse term.");
        }
        if (this.#directTerms.size === 0) {
            throw new StandardShaderComposerError("StandardMaterial fragment composer requires at least one direct-light term.");
        }
        if (this.#emissiveTerm === null) {
            throw new StandardShaderComposerError("StandardMaterial fragment composer requires an emissive term.");
        }
    }
}
export function createStandardFragmentComposer() {
    return new StandardFragmentComposer();
}
export function replaceStandardFragmentAssembly(code, composer) {
    return replaceStandardFragmentSlot(code, STANDARD_FRAGMENT_ASSEMBLY_BEGIN, STANDARD_FRAGMENT_ASSEMBLY_END, composer.emit(), "fragment assembly");
}
export function replaceStandardFragmentSlots(code, composer) {
    let next = replaceStandardFragmentSlot(code, STANDARD_FRAGMENT_HELPERS_BEGIN, STANDARD_FRAGMENT_HELPERS_END, composer.emitHelperFunctions(), "fragment helper");
    next = replaceStandardFragmentSlot(next, STANDARD_FRAGMENT_BASE_COLOR_ALPHA_BEGIN, STANDARD_FRAGMENT_BASE_COLOR_ALPHA_END, composer.emitBaseColorAlphaBlock(), "fragment base-color/alpha");
    next = replaceStandardFragmentSlot(next, STANDARD_FRAGMENT_NORMAL_SETUP_BEGIN, STANDARD_FRAGMENT_NORMAL_SETUP_END, composer.emitNormalSetupBlock(), "fragment normal setup");
    next = replaceStandardFragmentSlot(next, STANDARD_FRAGMENT_METALLIC_ROUGHNESS_BEGIN, STANDARD_FRAGMENT_METALLIC_ROUGHNESS_END, composer.emitMetallicRoughnessBlock(), "fragment metallic/roughness");
    return replaceStandardFragmentAssembly(next, composer);
}
function addUniqueTerm(terms, slot, id, expression) {
    if (terms.has(id)) {
        throw new StandardShaderComposerError(`StandardMaterial fragment composer slot '${slot}' already has term '${id}'.`);
    }
    terms.set(id, expression);
}
function mapTerms(terms) {
    return [...terms].map(([id, expression]) => ({ id, expression }));
}
function sumExpressions(expressions) {
    if (expressions.length === 0) {
        return "vec3f(0.0)";
    }
    return expressions.join(" + ");
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
function replaceStandardFragmentSlot(code, beginMarker, endMarker, replacement, label) {
    const begin = escapeRegExp(beginMarker);
    const end = escapeRegExp(endMarker);
    const pattern = new RegExp(`${begin}[\\s\\S]*?${end}`, "u");
    if (!pattern.test(code)) {
        throw new StandardShaderComposerError(`StandardMaterial shader source is missing the ${label} slot.`);
    }
    return code.replace(pattern, replacement);
}
function removeFirstMatchingStatement(statements, prefix) {
    const index = statements.findIndex((statement) => statement.startsWith(prefix));
    if (index >= 0) {
        statements.splice(index, 1);
    }
}
//# sourceMappingURL=standard-shader-composer.js.map