import { promises as fs } from "node:fs";
import path from "node:path";
import * as ts from "typescript";
import { readOptionalText, resolveConfigFile } from "./file-utils.js";
import { isNamedPropertyAssignment, propertyNameText, scriptKindForPath, } from "./typescript-ast.js";
const APERTURE_GENERATED_DIRECTORY = ".aperture/generated";
const APERTURE_GENERATED_TYPES_FILE = "aperture-env.d.ts";
export async function writeApertureGeneratedActionTypes(options) {
    const configFile = options.configFile ?? resolveConfigFile(options.root, undefined);
    const source = await readOptionalText(configFile);
    const contents = createApertureGeneratedActionTypes(source, configFile);
    const directory = path.join(options.root, APERTURE_GENERATED_DIRECTORY);
    const file = path.join(directory, APERTURE_GENERATED_TYPES_FILE);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(file, contents, "utf8");
    return file;
}
export function createApertureGeneratedActionTypes(source, fileName = "aperture.config.ts") {
    const actions = source === null ? [] : parseGeneratedInputActionTypes(source, fileName);
    const lines = [
        `import type { InputAxis1dAction, InputAxis2dAction, InputButtonAction } from "@aperture-engine/app/systems";`,
        "",
        `declare module "@aperture-engine/app/systems" {`,
        `  interface ApertureGeneratedActionMap {`,
        ...actions.map((action) => `    readonly ${generatedActionProperty(action.name)}: ${generatedActionTypeName(action.kind)};`),
        `  }`,
        `}`,
        "",
        `export {};`,
        "",
    ];
    return lines.join("\n");
}
function parseGeneratedInputActionTypes(source, fileName) {
    const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKindForPath(fileName));
    const actions = [];
    const visit = (node) => {
        if (ts.isCallExpression(node) && isDefineApertureConfigCall(node)) {
            const descriptor = node.arguments[0];
            const actionObject = descriptor !== undefined && ts.isObjectLiteralExpression(descriptor)
                ? readInputActionsObject(descriptor)
                : null;
            if (actionObject !== null) {
                actions.push(...readGeneratedInputActions(actionObject));
            }
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return dedupeGeneratedInputActions(actions);
}
function isDefineApertureConfigCall(node) {
    const expression = node.expression;
    return ((ts.isIdentifier(expression) &&
        expression.text === "defineApertureConfig") ||
        (ts.isPropertyAccessExpression(expression) &&
            expression.name.text === "defineApertureConfig"));
}
function readInputActionsObject(descriptor) {
    const inputProperty = descriptor.properties.find((property) => isNamedPropertyAssignment(property, "input"));
    if (inputProperty === undefined ||
        !ts.isObjectLiteralExpression(inputProperty.initializer)) {
        return null;
    }
    const actionsProperty = inputProperty.initializer.properties.find((property) => isNamedPropertyAssignment(property, "actions"));
    return actionsProperty !== undefined &&
        ts.isObjectLiteralExpression(actionsProperty.initializer)
        ? actionsProperty.initializer
        : null;
}
function readGeneratedInputActions(actionsObject) {
    const actions = [];
    for (const property of actionsObject.properties) {
        if (!ts.isPropertyAssignment(property)) {
            continue;
        }
        const name = propertyNameText(property.name);
        const kind = readGeneratedInputActionKind(property.initializer);
        if (name !== null && kind !== null) {
            actions.push({ name, kind });
        }
    }
    return actions;
}
function readGeneratedInputActionKind(initializer) {
    if (ts.isArrayLiteralExpression(initializer)) {
        return "button";
    }
    if (ts.isObjectLiteralExpression(initializer)) {
        const kindProperty = initializer.properties.find((property) => isNamedPropertyAssignment(property, "kind"));
        const kind = kindProperty !== undefined && ts.isStringLiteral(kindProperty.initializer)
            ? kindProperty.initializer.text
            : null;
        return kind === "button" || kind === "axis1d" || kind === "axis2d"
            ? kind
            : null;
    }
    if (!ts.isCallExpression(initializer)) {
        return null;
    }
    const expression = initializer.expression;
    const helper = ts.isPropertyAccessExpression(expression) &&
        ts.isIdentifier(expression.name)
        ? expression.name.text
        : ts.isIdentifier(expression)
            ? expression.text
            : null;
    return helper === "button" || helper === "axis1d" || helper === "axis2d"
        ? helper
        : null;
}
function dedupeGeneratedInputActions(actions) {
    const byName = new Map();
    for (const action of actions) {
        byName.set(action.name, action.kind);
    }
    return [...byName].map(([name, kind]) => ({ name, kind }));
}
function generatedActionProperty(name) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}
function generatedActionTypeName(kind) {
    if (kind === "button") {
        return "InputButtonAction";
    }
    return kind === "axis1d" ? "InputAxis1dAction" : "InputAxis2dAction";
}
//# sourceMappingURL=generated-action-types.js.map