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
    readonly textures?: number;
    readonly samplers?: number;
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
  readonly pipelines?: {
    readonly count: number;
    readonly keys: readonly string[];
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
    readonly fovYRadians?: number;
    readonly orthographicHeight?: number;
  };
  readonly renderOrder?: {
    readonly back: number;
    readonly front: number;
    readonly expectedTopMaterial: string;
  };
  readonly depth?: {
    readonly format: string;
  };
  readonly texture?: {
    readonly materialKey: string;
    readonly textureKey: string;
    readonly samplerKey: string;
    readonly expectedLeftColor: readonly [number, number, number, number];
    readonly expectedRightColor: readonly [number, number, number, number];
    readonly expectedQuadrants?: readonly {
      readonly sampleId: string;
      readonly expectedColor: readonly [number, number, number, number];
    }[];
  };
  readonly sampler?: {
    readonly samplerKey: string;
    readonly textureKey: string;
    readonly addressModeU: string;
    readonly addressModeV: string;
    readonly addressModeW: string;
    readonly magFilter: string;
    readonly minFilter: string;
    readonly mipmapFilter: string;
    readonly expectedSampleIds: readonly string[];
    readonly expectedColor: readonly [number, number, number, number];
    readonly rejectedColors?: {
      readonly nearestMirror?: readonly [number, number, number, number];
      readonly repeatLinear?: readonly [number, number, number, number];
      readonly clamp?: readonly [number, number, number, number];
    };
  };
  readonly texturedTint?: {
    readonly materialKey: string;
    readonly textureKey: string;
    readonly samplerKey: string;
    readonly sampleId: string;
    readonly textureColor: readonly [number, number, number, number];
    readonly tintFactor: readonly [number, number, number, number];
    readonly expectedColor: readonly [number, number, number, number];
  };
  readonly samplerVAddress?: {
    readonly samplerKey: string;
    readonly textureKey: string;
    readonly addressModeU: string;
    readonly addressModeV: string;
    readonly addressModeW: string;
    readonly magFilter: string;
    readonly minFilter: string;
    readonly mipmapFilter: string;
    readonly expectedSampleIds: readonly string[];
    readonly expectedColor: readonly [number, number, number, number];
    readonly rejectedColors?: {
      readonly nearestMirror?: readonly [number, number, number, number];
      readonly repeatLinear?: readonly [number, number, number, number];
      readonly clamp?: readonly [number, number, number, number];
    };
  };
  readonly multiTextured?: {
    readonly sharedSamplerKey?: string;
    readonly left: {
      readonly sampleId: string;
      readonly materialKey: string;
      readonly textureKey: string;
      readonly samplerKey: string;
      readonly expectedColor: readonly [number, number, number, number];
    };
    readonly right: {
      readonly sampleId: string;
      readonly materialKey: string;
      readonly textureKey: string;
      readonly samplerKey: string;
      readonly expectedColor: readonly [number, number, number, number];
    };
  };
  readonly sharedTextureTinted?: {
    readonly textureKey: string;
    readonly samplerKey: string;
    readonly textureColor: readonly [number, number, number, number];
    readonly left: {
      readonly sampleId: string;
      readonly materialKey: string;
      readonly tintFactor: readonly [number, number, number, number];
      readonly expectedColor: readonly [number, number, number, number];
    };
    readonly right: {
      readonly sampleId: string;
      readonly materialKey: string;
      readonly tintFactor: readonly [number, number, number, number];
      readonly expectedColor: readonly [number, number, number, number];
    };
  };
  readonly mixedPipelines?: {
    readonly factorMaterialKey: string;
    readonly texturedMaterialKey: string;
    readonly expectedFactorColor: readonly [number, number, number, number];
    readonly expectedTexturedColor: readonly [number, number, number, number];
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
    readonly renderableLayerMask?: number;
    readonly visibleLayerMask?: number;
    readonly skippedLayerMask?: number;
    readonly skippedMaterialKey?: string;
    readonly skippedMaterialColor?: readonly [number, number, number, number];
    readonly extracted?: number;
    readonly skipped?: number;
    readonly diagnostics: readonly string[];
  };
  readonly assetStatus?: {
    readonly mesh?: string;
    readonly material?: string;
    readonly texture?: string;
    readonly sampler?: string;
    readonly diagnostics: readonly string[];
    readonly registryDiagnostics?: readonly {
      readonly code: string;
      readonly message: string;
      readonly severity?: string;
    }[];
  };
  readonly textureDependency?: {
    readonly dependencyKind: "texture" | "sampler";
    readonly assetStatus: string;
    readonly textureKey: string;
    readonly samplerKey: string;
  };
  readonly invalidTextureUpload?: {
    readonly textureKey: string;
    readonly expectedDiagnostic: string;
    readonly bytesPerRow: number;
    readonly dataBytes?: number;
    readonly rowsPerImage?: number;
  };
  readonly missingTextureResource?: {
    readonly textureKey: string;
    readonly expectedDiagnostic: string;
  };
  readonly disabled?: {
    readonly authored: number;
    readonly enabled?: number;
    readonly disabled?: number;
    readonly extracted: number;
    readonly disabledMaterialKey?: string;
    readonly disabledMaterialColor?: readonly [number, number, number, number];
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
