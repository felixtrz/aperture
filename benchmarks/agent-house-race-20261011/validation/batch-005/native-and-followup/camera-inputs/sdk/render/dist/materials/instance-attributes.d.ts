export type InstanceAttributeFormat = "float32" | "float32x2" | "float32x3" | "float32x4";
export type InstanceAttributeValue = number | readonly [number] | readonly [number, number] | readonly [number, number, number] | readonly [number, number, number, number];
export type InstanceDataValues = Record<string, InstanceAttributeValue>;
export interface InstanceAttributeDeclaration {
    readonly name: string;
    readonly format: InstanceAttributeFormat;
    readonly shaderLocation?: number;
}
export interface DefinedInstanceAttribute {
    readonly name: string;
    readonly format: InstanceAttributeFormat;
    readonly shaderLocation: number;
    readonly offset: number;
    readonly floatOffset: number;
    readonly components: number;
}
export interface InstanceAttributeLayout {
    readonly attributes: readonly DefinedInstanceAttribute[];
    readonly stride: number;
    readonly strideFloats: number;
    readonly layoutKey: string;
}
export interface InstanceAttributeLayoutInput {
    readonly attributes: readonly InstanceAttributeDeclaration[];
}
export declare function defineInstanceAttributes(attributes: readonly InstanceAttributeDeclaration[]): InstanceAttributeLayoutInput;
export declare function createInstanceAttributeLayout(input: InstanceAttributeLayoutInput | undefined): InstanceAttributeLayout | null;
export declare function instanceAttributeComponentCount(format: InstanceAttributeFormat): number;
//# sourceMappingURL=instance-attributes.d.ts.map