import { EcsType, type EcsWorld } from "@aperture-engine/simulation";
export declare const AppEntityKey: import("elics").Component<{
    value: {
        type: EcsType.String;
        default: string;
    };
}>;
export declare const AppEntityTags: import("elics").Component<{
    valuesJson: {
        type: EcsType.String;
        default: string;
    };
}>;
export declare const AppEntitySource: import("elics").Component<{
    kind: {
        type: EcsType.String;
        default: string;
    };
    assetId: {
        type: EcsType.String;
        default: string;
    };
    gltfNodeIndex: {
        type: EcsType.Int32;
        default: number;
    };
    gltfNodePath: {
        type: EcsType.String;
        default: string;
    };
}>;
export declare const RenderInterpolation: import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
    initialized: {
        type: EcsType.Boolean;
        default: false;
    };
    previousTranslation: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    previousRotation: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    previousScale: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    currentTranslation: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
    currentRotation: {
        type: EcsType.Vec4;
        default: [number, number, number, number];
    };
    currentScale: {
        type: EcsType.Vec3;
        default: [number, number, number];
    };
}>;
export declare function registerApertureAppComponents(world: EcsWorld): EcsWorld;
//# sourceMappingURL=components.d.ts.map