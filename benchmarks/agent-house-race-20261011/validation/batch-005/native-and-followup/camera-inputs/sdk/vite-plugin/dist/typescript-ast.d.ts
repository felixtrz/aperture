import * as ts from "typescript";
export declare function isNamedPropertyAssignment(property: ts.ObjectLiteralElementLike, name: string): property is ts.PropertyAssignment;
export declare function propertyNameText(name: ts.PropertyName): string | null;
export declare function numericLiteralValue(node: ts.Expression): number | null;
export declare function scriptKindForPath(fileName: string): ts.ScriptKind;
//# sourceMappingURL=typescript-ast.d.ts.map