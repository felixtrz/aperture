import type { RgbaColor, RgbaPixel } from "./png.js";

export interface ExampleStatusBase {
  readonly example: string;
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
  };
  readonly binding?: {
    readonly planned?: number;
    readonly applied: number;
    readonly ready: number;
    readonly diagnostics: number;
  };
  readonly renderWorld?: {
    readonly active: number;
    readonly ready: number;
    readonly blocked: number;
  };
  readonly draw?: {
    readonly packages: number;
    readonly descriptors?: number;
    readonly drawList?: number;
    readonly resolved?: number;
    readonly renderIds?: readonly number[];
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
}
