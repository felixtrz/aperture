import { EcsType, type ComponentInitialData, type EcsWorld, type Entity } from "../ecs/index.js";
import { type Mat4Like, type QuatLike, type Vec3Like } from "@aperture-engine/math";
export interface LocalTransformInput {
    readonly translation?: Vec3Like;
    readonly rotation?: QuatLike;
    readonly scale?: Vec3Like;
}
export interface RootTransformInitialData {
    readonly local: ComponentInitialData<typeof LocalTransform>;
    readonly parent: ComponentInitialData<typeof Parent>;
    readonly world: ComponentInitialData<typeof WorldTransform>;
}
export declare function registerTransformComponents(world: EcsWorld): EcsWorld;
export declare function registerMetadataComponents(world: EcsWorld): EcsWorld;
export declare const LocalTransform: import("elics").Component<{
    translation: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    rotation: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    scale: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
}>;
export declare const Parent: import("elics").Component<{
    entity: {
        type: EcsType.Entity;
        default: null;
    };
}>;
export declare const WorldTransform: import("elics").Component<{
    col0: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    col1: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    col2: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    col3: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
}>;
export declare const Children: import("elics").Component<{
    refs: {
        type: EcsType.String;
        default: string;
    };
}>;
export declare const Enabled: import("elics").Component<{
    value: {
        type: EcsType.Boolean;
        default: true;
    };
}>;
export declare const Name: import("elics").Component<{
    value: {
        type: EcsType.String;
        default: string;
    };
}>;
export declare const DebugMetadata: import("elics").Component<{
    tag: {
        type: EcsType.String;
        default: string;
    };
    note: {
        type: EcsType.String;
        default: string;
    };
}>;
export declare function createLocalTransform(input?: LocalTransformInput): ComponentInitialData<typeof LocalTransform>;
export declare function createParent(parent?: Entity | null): ComponentInitialData<typeof Parent>;
export declare function createWorldTransform(matrix?: Mat4Like): ComponentInitialData<typeof WorldTransform>;
export declare function createRootTransform(input?: LocalTransformInput): RootTransformInitialData;
//# sourceMappingURL=components.d.ts.map