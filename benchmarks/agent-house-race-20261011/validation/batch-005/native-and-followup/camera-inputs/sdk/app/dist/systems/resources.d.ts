import type { QuatTuple, Vec2Tuple, Vec3Tuple, Vec4Tuple } from "@aperture-engine/simulation";
export type ApertureResourceState = Record<string, unknown>;
export interface ApertureResourceField<TValue> {
    readonly kind: string;
    createDefault(): TValue;
    summarize(value: TValue): unknown;
}
export type ApertureResourceStateFromSchema<TSchema extends Readonly<Record<string, ApertureResourceField<unknown>>>> = {
    -readonly [K in keyof TSchema]: TSchema[K] extends ApertureResourceField<infer TValue> ? TValue : never;
};
export interface ApertureResourceDescriptor<TState extends ApertureResourceState = ApertureResourceState> {
    readonly id: string;
    readonly schema: {
        readonly [K in keyof TState]: ApertureResourceField<TState[K]>;
    };
}
export interface ApertureResourceFieldSummary {
    readonly name: string;
    readonly kind: string;
}
export interface ApertureResourceSummaryEntry {
    readonly id: string;
    readonly version: number;
    readonly fields: readonly ApertureResourceFieldSummary[];
    readonly values: Readonly<Record<string, unknown>>;
}
export interface ApertureResourceStoreSummary {
    readonly count: number;
    readonly entries: readonly ApertureResourceSummaryEntry[];
}
export interface ResourceStore {
    has<TState extends ApertureResourceState>(descriptor: ApertureResourceDescriptor<TState>): boolean;
    read<TState extends ApertureResourceState>(descriptor: ApertureResourceDescriptor<TState>): Readonly<TState>;
    write<TState extends ApertureResourceState>(descriptor: ApertureResourceDescriptor<TState>, mutator: (state: TState) => void): Readonly<TState>;
    set<TState extends ApertureResourceState>(descriptor: ApertureResourceDescriptor<TState>, value: TState): Readonly<TState>;
    reset<TState extends ApertureResourceState>(descriptor: ApertureResourceDescriptor<TState>): Readonly<TState>;
    patchById(id: string, values: Readonly<Record<string, unknown>>): ApertureResourceSummaryEntry | null;
    summary(): ApertureResourceStoreSummary;
}
export declare function defineResource<const TSchema extends Readonly<Record<string, ApertureResourceField<unknown>>>>(id: string, schema: TSchema): ApertureResourceDescriptor<ApertureResourceStateFromSchema<TSchema>>;
/** Look up a module-scope resource descriptor by id (latest wins). */
export declare function findDefinedResource(id: string): ApertureResourceDescriptor | undefined;
export declare const resource: Readonly<{
    boolean(defaultValue?: boolean): ApertureResourceField<boolean>;
    number(defaultValue?: number): ApertureResourceField<number>;
    string(defaultValue?: string): ApertureResourceField<string>;
    vec2(defaultValue?: Vec2Tuple): ApertureResourceField<Vec2Tuple>;
    vec3(defaultValue?: Vec3Tuple): ApertureResourceField<Vec3Tuple>;
    nullableVec3(defaultValue?: Vec3Tuple | null): ApertureResourceField<Vec3Tuple | null>;
    vec4(defaultValue?: Vec4Tuple): ApertureResourceField<Vec4Tuple>;
    quat(defaultValue?: QuatTuple): ApertureResourceField<QuatTuple>;
    value<TValue>(defaultValue: TValue | (() => TValue), options?: {
        readonly kind?: string;
        readonly summarize?: (value: TValue) => unknown;
    }): ApertureResourceField<TValue>;
}>;
export declare function createResourceStore(): ResourceStore;
//# sourceMappingURL=resources.d.ts.map