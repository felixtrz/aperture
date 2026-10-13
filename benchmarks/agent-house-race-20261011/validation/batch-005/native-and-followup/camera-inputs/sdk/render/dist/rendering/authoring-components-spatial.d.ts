import { EcsType } from "@aperture-engine/simulation";
export declare const Pickable: import("elics").Component<{
    enabled: {
        type: EcsType.Boolean;
        default: true;
    };
    layerMask: {
        type: EcsType.Int32;
        default: number;
    };
    precision: {
        type: EcsType.Enum;
        enum: {
            readonly Bounds: "bounds";
            readonly VisualMesh: "visual-mesh";
            readonly Collider: "collider";
        };
        default: "bounds";
    };
    blocksLower: {
        type: EcsType.Boolean;
        default: false;
    };
    priority: {
        type: EcsType.Int32;
        default: number;
    };
}>;
export declare const MeshQueryAcceleration: import("elics").Component<{
    mode: {
        type: EcsType.Enum;
        enum: {
            readonly None: "none";
            readonly AutoBvh: "auto-bvh";
            readonly Bvh: "bvh";
        };
        default: "auto-bvh";
    };
    strategy: {
        type: EcsType.Enum;
        enum: {
            readonly Center: "center";
            readonly Average: "average";
            readonly Sah: "sah";
        };
        default: "center";
    };
    maxLeafSize: {
        type: EcsType.Int32;
        default: number;
    };
    maxDepth: {
        type: EcsType.Int32;
        default: number;
    };
    dynamicPolicy: {
        type: EcsType.Enum;
        enum: {
            readonly Static: "static";
            readonly Refit: "refit";
            readonly Rebuild: "rebuild";
        };
        default: "static";
    };
    simplifiedMeshId: {
        type: EcsType.String;
        default: string;
    };
}>;
//# sourceMappingURL=authoring-components-spatial.d.ts.map