import type { RgbaColor, RgbaPixel } from "./png.js";

export type RgbaTuple = readonly [number, number, number, number];

export interface TextureSampleExpectation {
  readonly sampleId: string;
  readonly expectedColor: RgbaTuple;
}

export interface TextureMaterialSampleStatus extends TextureSampleExpectation {
  readonly materialKey: string;
  readonly textureKey: string;
  readonly samplerKey: string;
}

export interface TintedMaterialSampleStatus extends TextureSampleExpectation {
  readonly materialKey: string;
  readonly tintFactor: RgbaTuple;
}

export interface SamplerBehaviorStatus {
  readonly samplerKey: string;
  readonly textureKey: string;
  readonly addressModeU: string;
  readonly addressModeV: string;
  readonly addressModeW: string;
  readonly magFilter: string;
  readonly minFilter: string;
  readonly mipmapFilter: string;
  readonly expectedSampleIds: readonly string[];
  readonly expectedColor: RgbaTuple;
  readonly rejectedColors?: {
    readonly nearestMirror?: RgbaTuple;
    readonly repeatLinear?: RgbaTuple;
    readonly clamp?: RgbaTuple;
  };
}

export interface MissingTextureResourceStatus {
  readonly textureKey: string;
  readonly expectedDiagnostic: string;
}

export interface MissingSamplerResourceStatus {
  readonly samplerKey: string;
  readonly expectedDiagnostic: string;
}

export interface MissingTextureAssetStatus extends MissingTextureResourceStatus {
  readonly materialKey: string;
  readonly samplerKey: string;
}

export interface MissingSamplerAssetStatus extends MissingSamplerResourceStatus {
  readonly materialKey: string;
  readonly textureKey: string;
}

export interface MissingSharedTextureAssetStatus extends MissingTextureResourceStatus {
  readonly samplerKey: string;
}

export type MissingSharedSamplerAssetStatus = MissingSamplerResourceStatus;

export interface TextureUploadValidationStatus extends MissingTextureResourceStatus {
  readonly bytesPerRow: number;
  readonly dataBytes?: number;
  readonly rowsPerImage?: number;
}

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
    readonly expectedLeftColor: RgbaTuple;
    readonly expectedRightColor: RgbaTuple;
    readonly expectedQuadrants?: readonly TextureSampleExpectation[];
  };
  readonly sampler?: SamplerBehaviorStatus;
  readonly texturedTint?: TextureMaterialSampleStatus & {
    readonly textureColor: RgbaTuple;
    readonly tintFactor: RgbaTuple;
  };
  readonly samplerVAddress?: SamplerBehaviorStatus;
  readonly multiTextured?: {
    readonly sharedSamplerKey?: string;
    readonly left: TextureMaterialSampleStatus;
    readonly right: TextureMaterialSampleStatus;
  };
  readonly sharedTextureTinted?: {
    readonly textureKey: string;
    readonly samplerKey: string;
    readonly textureColor: RgbaTuple;
    readonly left: TintedMaterialSampleStatus;
    readonly right: TintedMaterialSampleStatus;
  };
  readonly mixedPipelines?: {
    readonly factorMaterialKey: string;
    readonly texturedMaterialKey: string;
    readonly expectedFactorColor: RgbaTuple;
    readonly expectedTexturedColor: RgbaTuple;
  };
  readonly visibility?: {
    readonly authored: number;
    readonly extracted: number;
    readonly skipped: number;
    readonly hiddenMaterialKey: string;
    readonly hiddenMaterialColor: RgbaTuple;
    readonly diagnostics: readonly string[];
  };
  readonly layerFiltering?: {
    readonly cameraLayerMask: number;
    readonly renderableLayerMask?: number;
    readonly visibleLayerMask?: number;
    readonly skippedLayerMask?: number;
    readonly skippedMaterialKey?: string;
    readonly skippedMaterialColor?: RgbaTuple;
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
  readonly invalidTextureUpload?: TextureUploadValidationStatus;
  readonly missingTextureResource?: MissingTextureResourceStatus;
  readonly missingSamplerResource?: MissingSamplerResourceStatus;
  readonly missingTextureAsset?: MissingTextureAssetStatus;
  readonly missingSamplerAsset?: MissingSamplerAssetStatus;
  readonly missingSharedTextureAsset?: MissingSharedTextureAssetStatus;
  readonly missingSharedSamplerAsset?: MissingSharedSamplerAssetStatus;
  readonly disabled?: {
    readonly authored: number;
    readonly enabled?: number;
    readonly disabled?: number;
    readonly extracted: number;
    readonly disabledMaterialKey?: string;
    readonly disabledMaterialColor?: RgbaTuple;
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
    readonly resourceKey?: string;
    readonly entity?: {
      readonly index: number;
      readonly generation: number;
    };
  }[];
}
