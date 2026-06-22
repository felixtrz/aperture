import path from "node:path";
import * as ts from "typescript";

export function isNamedPropertyAssignment(
  property: ts.ObjectLiteralElementLike,
  name: string,
): property is ts.PropertyAssignment {
  if (!ts.isPropertyAssignment(property)) {
    return false;
  }

  return propertyNameText(property.name) === name;
}

export function propertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }

  if (ts.isNumericLiteral(name)) {
    return name.text;
  }

  return null;
}

export function numericLiteralValue(node: ts.Expression): number | null {
  if (ts.isNumericLiteral(node)) {
    return Number(node.text.replace(/_/g, ""));
  }

  if (
    ts.isPrefixUnaryExpression(node) &&
    (node.operator === ts.SyntaxKind.MinusToken ||
      node.operator === ts.SyntaxKind.PlusToken) &&
    ts.isNumericLiteral(node.operand)
  ) {
    const value = Number(node.operand.text.replace(/_/g, ""));

    return node.operator === ts.SyntaxKind.MinusToken ? -value : value;
  }

  return null;
}

export function scriptKindForPath(fileName: string): ts.ScriptKind {
  switch (path.extname(fileName)) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".js":
    case ".mjs":
    case ".cjs":
      return ts.ScriptKind.JS;
    case ".json":
      return ts.ScriptKind.JSON;
    default:
      return ts.ScriptKind.TS;
  }
}
