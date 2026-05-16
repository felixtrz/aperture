import type { RgbaColor, RgbaPixel } from "./png.js";

export interface ExampleStatusBase {
  readonly example: string;
  readonly scenario?: string;
  readonly availableScenarios?: readonly string[];
  readonly ok: boolean;
  readonly phase?: string;
  readonly reason?: string;
  readonly message?: string;
  readonly renderingBackend?: string;
}

export interface ClearExampleStatus extends ExampleStatusBase {
  readonly format?: string;
  readonly clearColor?: RgbaColor;
  readonly readback?: ClearReadbackStatus;
}

export type ClearReadbackStatus =
  | {
      readonly ok: true;
      readonly source: "current-texture";
      readonly format: string;
      readonly origin: {
        readonly x: number;
        readonly y: number;
      };
      readonly bytesPerRow: number;
      readonly pixel: RgbaPixel;
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly message: string;
      readonly clearOk: boolean;
    };

export type SceneReadbackStatus =
  | {
      readonly ok: true;
      readonly source: "current-texture";
      readonly format: string;
      readonly bytesPerRow: number;
      readonly samples: readonly {
        readonly id: string;
        readonly origin: {
          readonly x: number;
          readonly y: number;
        };
        readonly pixel: RgbaPixel;
      }[];
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly message: string;
      readonly clearOk: boolean;
    };

export interface SingleDrawExampleStatus extends ExampleStatusBase {
  readonly clearColor?: RgbaColor;
  readonly readback?: SceneReadbackStatus;
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
  readonly binding?: {
    readonly planned: number;
    readonly applied: number;
    readonly diagnostics: number;
  };
  readonly renderWorld?: {
    readonly active: number;
    readonly ready: number;
    readonly blocked: number;
  };
  readonly draw?: {
    readonly packages: number;
    readonly descriptors: number;
    readonly drawList: number;
    readonly resolved: number;
  };
  readonly command?: {
    readonly commands: number;
    readonly drawCount: number;
    readonly indexedDrawCount: number;
  };
  readonly submission?: {
    readonly commandBuffers: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
  };
}

export interface MultiEntityExampleStatus extends ExampleStatusBase {
  readonly clearColor?: RgbaColor;
  readonly readback?: SceneReadbackStatus;
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
  readonly resources?: {
    readonly materials: number;
    readonly bindGroups: number;
    readonly missing?: string;
  };
  readonly binding?: {
    readonly planned?: number;
    readonly applied: number;
    readonly ready: number;
    readonly diagnostics: number;
    readonly diagnosticCodes?: readonly string[];
  };
  readonly renderWorld?: {
    readonly active: number;
    readonly ready: number;
    readonly blocked: number;
    readonly blockedReasons?: readonly string[];
    readonly diagnostics?: readonly string[];
  };
  readonly draw?: {
    readonly packages: number;
    readonly descriptors?: number;
    readonly drawList?: number;
    readonly resolved?: number;
    readonly renderIds?: readonly number[];
  };
  readonly geometry?: {
    readonly primitive: string;
    readonly meshLabel: string;
    readonly vertexStreams: number;
    readonly vertexCount: number;
    readonly indexCount: number;
    readonly topology: string;
    readonly source: string;
  };
  readonly camera?: {
    readonly projection: string;
    readonly orthographicHeight?: number;
  };
  readonly renderOrder?: {
    readonly back: number;
    readonly front: number;
    readonly expectedTopMaterial: string;
  };
  readonly visibility?: {
    readonly authored: number;
    readonly extracted: number;
    readonly skipped: number;
    readonly hiddenMaterialKey: string;
    readonly hiddenMaterialColor: readonly [number, number, number, number];
    readonly diagnostics: readonly string[];
  };
  readonly layerFiltering?: {
    readonly cameraLayerMask: number;
    readonly renderableLayerMask: number;
    readonly diagnostics: readonly string[];
  };
  readonly assetStatus?: {
    readonly mesh?: string;
    readonly material?: string;
    readonly diagnostics: readonly string[];
  };
  readonly disabled?: {
    readonly authored: number;
    readonly extracted: number;
    readonly diagnostics: readonly string[];
  };
  readonly command?: {
    readonly commands?: number;
    readonly drawCount?: number;
    readonly indexedDrawCount?: number;
    readonly firstInstances?: readonly number[];
  };
  readonly submission?: {
    readonly commandBuffers?: number;
    readonly commands?: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls?: number;
  };
  readonly diagnosticCounts?: {
    readonly extraction: number;
    readonly resources: number;
    readonly binding: number;
    readonly draw: number;
    readonly submission: number;
    readonly readback: number;
  };
  readonly diagnostics?: readonly {
    readonly code: string;
    readonly message: string;
    readonly severity: string;
    readonly assetKey?: string;
    readonly entity?: {
      readonly index: number;
      readonly generation: number;
    };
  }[];
}
