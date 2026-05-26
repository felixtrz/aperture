import { expect, test } from "@playwright/test";

import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  loadExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface RenderToTextureStatus extends ExampleStatusBase {
  readonly clearColors?: {
    readonly offscreen?: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
    readonly screen?: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
  };
  readonly renderTarget?: {
    readonly width?: number;
    readonly height?: number;
    readonly source?: string;
    readonly key?: string;
    readonly textureUsage?: {
      readonly renderAttachment?: boolean;
      readonly textureBinding?: boolean;
      readonly copySource?: boolean;
    };
  };
  readonly renderTargetResize?: {
    readonly mode?: string;
    readonly reason?: string;
    readonly renderTargetKey?: string;
    readonly before?: {
      readonly width?: number;
      readonly height?: number;
    };
    readonly after?: {
      readonly width?: number;
      readonly height?: number;
    };
    readonly reusedHandle?: boolean;
    readonly textureRecreated?: boolean;
    readonly previousTextureDestroyed?: boolean;
    readonly staleSizeGuard?: string;
    readonly stableRenderTargetKey?: boolean;
    readonly msaaSampleCount?: number;
    readonly attachment?: {
      readonly colorLoadOp?: string | null;
      readonly colorStoreOp?: string | null;
      readonly resolveTarget?: boolean;
      readonly behavior?: string;
    };
    readonly msaa?: {
      readonly mode?: string;
      readonly requestedSampleCount?: number;
      readonly sampleCount?: number;
      readonly enabled?: boolean;
      readonly clamped?: boolean;
      readonly supportedSampleCounts?: readonly number[];
      readonly colorTargets?: number;
      readonly colorTexturesCreated?: number;
      readonly colorTexturesReused?: number;
      readonly target?: {
        readonly source?: string;
        readonly width?: number;
        readonly height?: number;
        readonly drawCalls?: number;
        readonly msaaSampleCount?: number;
        readonly ok?: boolean;
      };
      readonly attachment?: {
        readonly colorLoadOp?: string | null;
        readonly colorStoreOp?: string | null;
        readonly resolveTarget?: boolean;
        readonly behavior?: string;
      };
    };
  };
  readonly renderTargetReuseStress?: {
    readonly mode?: string;
    readonly renderTargetKey?: string;
    readonly framesRequested?: number;
    readonly framesRendered?: number;
    readonly displayedFrame?: number;
    readonly reusedHandle?: boolean;
    readonly textureRecreated?: boolean;
    readonly stableRenderTargetKey?: boolean;
    readonly targetResourcePressure?: {
      readonly createdTextures?: number;
      readonly reusedTextures?: number;
      readonly stableDimensions?: boolean;
    };
    readonly msaa?: {
      readonly mode?: string;
      readonly requestedSampleCount?: number;
      readonly sampleCount?: number;
      readonly enabled?: boolean;
      readonly clamped?: boolean;
      readonly supportedSampleCounts?: readonly number[];
      readonly stableSampleCount?: boolean;
      readonly colorTargets?: number;
      readonly colorTexturesCreated?: number;
      readonly colorTexturesReused?: number;
      readonly resourcePressure?: {
        readonly framesRendered?: number;
        readonly colorTargets?: number;
        readonly colorTexturesCreated?: number;
        readonly colorTexturesReused?: number;
      };
      readonly resolveAttachments?: readonly {
        readonly frame?: number;
        readonly msaaSampleCount?: number;
        readonly colorLoadOp?: string | null;
        readonly colorStoreOp?: string | null;
        readonly resolveTarget?: boolean;
        readonly behavior?: string;
      }[];
    };
    readonly frames?: readonly {
      readonly frame?: number;
      readonly workerVariant?: string;
      readonly centerExpectation?: string;
      readonly renderTargetKey?: string;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly worldTranslation?: readonly number[];
      readonly msaaSampleCount?: number;
      readonly attachment?: {
        readonly colorLoadOp?: string | null;
        readonly colorStoreOp?: string | null;
        readonly resolveTarget?: boolean;
        readonly behavior?: string;
      };
      readonly msaa?: {
        readonly requestedSampleCount?: number;
        readonly sampleCount?: number;
        readonly enabled?: boolean;
        readonly clamped?: boolean;
        readonly supportedSampleCounts?: readonly number[];
        readonly colorTargets?: number;
        readonly colorTexturesCreated?: number;
        readonly colorTexturesReused?: number;
      };
      readonly diagnostics?: number;
    }[];
    readonly staleFirstFrameStatus?: boolean;
  };
  readonly mixedCameraTargets?: {
    readonly mode?: string;
    readonly renderTargetKey?: string;
    readonly source?: string;
    readonly views?: readonly {
      readonly viewId?: number;
      readonly priority?: number;
      readonly layerMask?: number;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly viewport?: readonly number[];
      readonly scissor?: readonly number[];
    }[];
    readonly passOrder?: readonly {
      readonly index?: number;
      readonly viewId?: number;
      readonly source?: string;
      readonly renderTargetKey?: string | null;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly ok?: boolean;
    }[];
    readonly displayPass?: {
      readonly loadOp?: string;
      readonly drawCalls?: number;
      readonly samples?: {
        readonly preview?: string;
        readonly screenClear?: string;
      };
    };
    readonly canvasReadback?: {
      readonly ok: boolean;
      readonly samples?: readonly {
        readonly id: string;
        readonly pixel: {
          readonly r: number;
          readonly g: number;
          readonly b: number;
          readonly a: number;
        };
      }[];
    } | null;
    readonly expectedSamples?: {
      readonly canvas?: {
        readonly sampleId?: string;
        readonly materialKey?: string;
        readonly expectedColor?: {
          readonly r: number;
          readonly g: number;
          readonly b: number;
          readonly a: number;
        };
      };
      readonly offscreenPreview?: {
        readonly sampleId?: string;
        readonly materialKey?: string;
        readonly expectedColor?: {
          readonly r: number;
          readonly g: number;
          readonly b: number;
          readonly a: number;
        };
      };
    };
  };
  readonly mixedMsaaRenderTargetResize?: {
    readonly mode?: string;
    readonly source?: string;
    readonly renderTargetKey?: string;
    readonly requestedSampleCount?: number;
    readonly sampleCount?: number;
    readonly enabled?: boolean;
    readonly clamped?: boolean;
    readonly supportedSampleCounts?: readonly number[];
    readonly colorTargets?: number;
    readonly colorTexturesCreated?: number;
    readonly colorTexturesReused?: number;
    readonly resize?: RenderToTextureStatus["renderTargetResize"];
    readonly renderTargets?: readonly {
      readonly role?: string;
      readonly target?: string;
      readonly key?: string | null;
      readonly source?: string;
      readonly viewId?: number | null;
      readonly width?: number;
      readonly height?: number;
      readonly ok?: boolean;
      readonly drawCalls?: number;
      readonly msaaSampleCount?: number;
      readonly attachment?: {
        readonly colorLoadOp?: string | null;
        readonly colorStoreOp?: string | null;
        readonly resolveTarget?: boolean;
        readonly behavior?: string;
      };
      readonly displaySample?: string;
      readonly readbackSample?: string;
    }[];
    readonly views?: readonly {
      readonly role?: string;
      readonly viewId?: number;
      readonly priority?: number;
      readonly layerMask?: number;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly viewport?: readonly number[];
      readonly scissor?: readonly number[];
    }[];
    readonly passOrder?: readonly {
      readonly index?: number;
      readonly viewId?: number;
      readonly source?: string;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly ok?: boolean;
      readonly msaaSampleCount?: number;
      readonly attachment?: {
        readonly colorLoadOp?: string | null;
        readonly colorStoreOp?: string | null;
        readonly resolveTarget?: boolean;
        readonly behavior?: string;
      };
    }[];
    readonly displayPass?: {
      readonly loadOp?: string;
      readonly drawCalls?: number;
      readonly samples?: {
        readonly preview?: string;
        readonly screenClear?: string;
      };
    };
    readonly currentTextureReadback?: {
      readonly ok: boolean;
      readonly samples?: readonly {
        readonly id: string;
        readonly pixel: {
          readonly r: number;
          readonly g: number;
          readonly b: number;
          readonly a: number;
        };
      }[];
    } | null;
  };
  readonly multiRenderTargets?: {
    readonly mode?: string;
    readonly source?: string;
    readonly renderTargets?: readonly {
      readonly role?: string;
      readonly key?: string;
      readonly source?: string;
      readonly viewId?: number | null;
      readonly width?: number;
      readonly height?: number;
      readonly ok?: boolean;
      readonly drawCalls?: number;
      readonly materialKey?: string;
      readonly displaySample?: string;
      readonly displayQuad?: {
        readonly role?: string;
        readonly source?: string;
        readonly renderTargetKey?: string | null;
        readonly sampleId?: string | null;
        readonly vertexCount?: number;
        readonly widthNdc?: number;
        readonly heightNdc?: number;
      } | null;
    }[];
    readonly views?: readonly {
      readonly viewId?: number;
      readonly priority?: number;
      readonly layerMask?: number;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly viewport?: readonly number[];
      readonly scissor?: readonly number[];
    }[];
    readonly passOrder?: readonly {
      readonly index?: number;
      readonly viewId?: number;
      readonly source?: string;
      readonly renderTargetKey?: string | null;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly ok?: boolean;
    }[];
    readonly displayPass?: {
      readonly loadOp?: string;
      readonly drawCalls?: number;
      readonly samples?: {
        readonly leftPreview?: string;
        readonly rightPreview?: string;
        readonly screenClear?: string;
      };
    };
  };
  readonly mixedMultiRenderTargets?: {
    readonly mode?: string;
    readonly source?: string;
    readonly renderTargets?: readonly {
      readonly role?: string;
      readonly target?: string;
      readonly key?: string | null;
      readonly source?: string;
      readonly viewId?: number | null;
      readonly width?: number;
      readonly height?: number;
      readonly ok?: boolean;
      readonly drawCalls?: number;
      readonly materialKey?: string;
      readonly displaySample?: string;
      readonly readbackSample?: string;
      readonly displayQuad?: {
        readonly role?: string;
        readonly source?: string;
        readonly renderTargetKey?: string | null;
        readonly sampleId?: string | null;
        readonly vertexCount?: number;
        readonly widthNdc?: number;
        readonly heightNdc?: number;
      } | null;
    }[];
    readonly views?: readonly {
      readonly viewId?: number;
      readonly priority?: number;
      readonly layerMask?: number;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly viewport?: readonly number[];
      readonly scissor?: readonly number[];
    }[];
    readonly passOrder?: readonly {
      readonly index?: number;
      readonly viewId?: number;
      readonly source?: string;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly ok?: boolean;
    }[];
    readonly displayPass?: {
      readonly loadOp?: string;
      readonly drawCalls?: number;
      readonly samples?: {
        readonly leftPreview?: string;
        readonly rightPreview?: string;
        readonly screenClear?: string;
      };
    };
    readonly currentTextureReadback?: {
      readonly ok: boolean;
      readonly samples?: readonly {
        readonly id: string;
        readonly pixel: {
          readonly r: number;
          readonly g: number;
          readonly b: number;
          readonly a: number;
        };
      }[];
    } | null;
  };
  readonly mixedDualSizeRenderTargets?: {
    readonly mode?: string;
    readonly source?: string;
    readonly renderTargets?: readonly {
      readonly role?: string;
      readonly target?: string;
      readonly key?: string | null;
      readonly source?: string;
      readonly viewId?: number | null;
      readonly width?: number;
      readonly height?: number;
      readonly ok?: boolean;
      readonly drawCalls?: number;
      readonly materialKey?: string;
      readonly displaySample?: string;
      readonly readbackSample?: string;
      readonly displayQuad?: {
        readonly role?: string;
        readonly source?: string;
        readonly renderTargetKey?: string | null;
        readonly sampleId?: string | null;
        readonly vertexCount?: number;
        readonly widthNdc?: number;
        readonly heightNdc?: number;
        readonly aspect?: {
          readonly targetWidth?: number;
          readonly targetHeight?: number;
          readonly targetAspectRatio?: number;
          readonly displayAspectRatio?: number;
          readonly preservesAspect?: boolean;
          readonly mapping?: string;
        };
      } | null;
      readonly aspect?: {
        readonly targetWidth?: number;
        readonly targetHeight?: number;
        readonly targetAspectRatio?: number;
        readonly displayAspectRatio?: number;
        readonly preservesAspect?: boolean;
        readonly mapping?: string;
      } | null;
    }[];
    readonly views?: readonly {
      readonly viewId?: number;
      readonly priority?: number;
      readonly layerMask?: number;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly viewport?: readonly number[];
      readonly scissor?: readonly number[];
    }[];
    readonly passOrder?: readonly {
      readonly index?: number;
      readonly viewId?: number;
      readonly source?: string;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly ok?: boolean;
    }[];
    readonly displayPass?: {
      readonly loadOp?: string;
      readonly drawCalls?: number;
      readonly samples?: {
        readonly leftPreview?: string;
        readonly rightPreview?: string;
        readonly screenClear?: string;
      };
    };
    readonly currentTextureReadback?: {
      readonly ok: boolean;
      readonly samples?: readonly {
        readonly id: string;
        readonly pixel: {
          readonly r: number;
          readonly g: number;
          readonly b: number;
          readonly a: number;
        };
      }[];
    } | null;
  };
  readonly mixedCroppedSecondaryRenderTargets?: {
    readonly mode?: string;
    readonly source?: string;
    readonly renderTargets?: readonly {
      readonly role?: string;
      readonly target?: string;
      readonly key?: string | null;
      readonly source?: string;
      readonly viewId?: number | null;
      readonly width?: number;
      readonly height?: number;
      readonly ok?: boolean;
      readonly drawCalls?: number;
      readonly materialKey?: string;
      readonly displaySample?: string;
      readonly readbackSample?: string;
      readonly displayQuad?: {
        readonly role?: string;
        readonly source?: string;
        readonly renderTargetKey?: string | null;
        readonly sampleId?: string | null;
        readonly vertexCount?: number;
        readonly widthNdc?: number;
        readonly heightNdc?: number;
      } | null;
    }[];
    readonly views?: readonly {
      readonly role?: string;
      readonly viewId?: number;
      readonly priority?: number;
      readonly layerMask?: number;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly viewport?: readonly number[];
      readonly scissor?: readonly number[];
    }[];
    readonly secondaryCrop?: {
      readonly renderTargetKey?: string;
      readonly expectedNormalizedRect?: readonly number[];
      readonly viewportPixels?: {
        readonly x?: number;
        readonly y?: number;
        readonly width?: number;
        readonly height?: number;
      } | null;
      readonly scissorPixels?: {
        readonly x?: number;
        readonly y?: number;
        readonly width?: number;
        readonly height?: number;
      } | null;
      readonly diagnostics?: readonly unknown[];
      readonly insideSample?: string;
      readonly outsideSample?: string;
    };
    readonly passOrder?: readonly {
      readonly index?: number;
      readonly viewId?: number;
      readonly source?: string;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly ok?: boolean;
    }[];
    readonly displayPass?: {
      readonly loadOp?: string;
      readonly drawCalls?: number;
      readonly samples?: {
        readonly leftPreview?: string;
        readonly secondaryInside?: string;
        readonly secondaryOutside?: string;
        readonly screenClear?: string;
      };
    };
    readonly currentTextureReadback?: {
      readonly ok: boolean;
      readonly samples?: readonly {
        readonly id: string;
        readonly pixel: {
          readonly r: number;
          readonly g: number;
          readonly b: number;
          readonly a: number;
        };
      }[];
    } | null;
  };
  readonly mixedMsaaMultiRenderTargets?: {
    readonly mode?: string;
    readonly source?: string;
    readonly requestedSampleCount?: number;
    readonly sampleCount?: number;
    readonly enabled?: boolean;
    readonly clamped?: boolean;
    readonly supportedSampleCounts?: readonly number[];
    readonly colorTargets?: number;
    readonly colorTexturesCreated?: number;
    readonly colorTexturesReused?: number;
    readonly renderTargets?: readonly {
      readonly role?: string;
      readonly target?: string;
      readonly key?: string | null;
      readonly source?: string;
      readonly viewId?: number | null;
      readonly width?: number;
      readonly height?: number;
      readonly ok?: boolean;
      readonly drawCalls?: number;
      readonly materialKey?: string;
      readonly displaySample?: string;
      readonly readbackSample?: string;
      readonly msaaSampleCount?: number;
      readonly attachment?: {
        readonly colorLoadOp?: string | null;
        readonly colorStoreOp?: string | null;
        readonly resolveTarget?: boolean;
        readonly behavior?: string;
      };
      readonly displayQuad?: {
        readonly role?: string;
        readonly source?: string;
        readonly renderTargetKey?: string | null;
        readonly sampleId?: string | null;
        readonly vertexCount?: number;
        readonly widthNdc?: number;
        readonly heightNdc?: number;
      } | null;
    }[];
    readonly views?: readonly {
      readonly role?: string;
      readonly viewId?: number;
      readonly priority?: number;
      readonly layerMask?: number;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly viewport?: readonly number[];
      readonly scissor?: readonly number[];
    }[];
    readonly passOrder?: readonly {
      readonly index?: number;
      readonly viewId?: number;
      readonly source?: string;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly ok?: boolean;
      readonly msaaSampleCount?: number;
      readonly attachment?: {
        readonly colorLoadOp?: string | null;
        readonly colorStoreOp?: string | null;
        readonly resolveTarget?: boolean;
        readonly behavior?: string;
      };
    }[];
    readonly displayPass?: {
      readonly loadOp?: string;
      readonly drawCalls?: number;
      readonly samples?: {
        readonly leftPreview?: string;
        readonly rightPreview?: string;
        readonly screenClear?: string;
      };
    };
    readonly currentTextureReadback?: {
      readonly ok: boolean;
      readonly samples?: readonly {
        readonly id: string;
        readonly pixel: {
          readonly r: number;
          readonly g: number;
          readonly b: number;
          readonly a: number;
        };
      }[];
    } | null;
  };
  readonly mixedMsaaCroppedSecondaryRenderTargets?: {
    readonly mode?: string;
    readonly source?: string;
    readonly requestedSampleCount?: number;
    readonly sampleCount?: number;
    readonly enabled?: boolean;
    readonly clamped?: boolean;
    readonly supportedSampleCounts?: readonly number[];
    readonly colorTargets?: number;
    readonly colorTexturesCreated?: number;
    readonly colorTexturesReused?: number;
    readonly renderTargets?: readonly {
      readonly role?: string;
      readonly target?: string;
      readonly key?: string | null;
      readonly source?: string;
      readonly viewId?: number | null;
      readonly width?: number;
      readonly height?: number;
      readonly ok?: boolean;
      readonly drawCalls?: number;
      readonly materialKey?: string;
      readonly displaySample?: string;
      readonly readbackSample?: string;
      readonly msaaSampleCount?: number;
      readonly attachment?: {
        readonly colorLoadOp?: string | null;
        readonly colorStoreOp?: string | null;
        readonly resolveTarget?: boolean;
        readonly behavior?: string;
      };
      readonly displayQuad?: {
        readonly role?: string;
        readonly source?: string;
        readonly renderTargetKey?: string | null;
        readonly sampleId?: string | null;
        readonly vertexCount?: number;
        readonly widthNdc?: number;
        readonly heightNdc?: number;
      } | null;
    }[];
    readonly views?: readonly {
      readonly role?: string;
      readonly viewId?: number;
      readonly priority?: number;
      readonly layerMask?: number;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly viewport?: readonly number[];
      readonly scissor?: readonly number[];
    }[];
    readonly secondaryCrop?: {
      readonly renderTargetKey?: string;
      readonly expectedNormalizedRect?: readonly number[];
      readonly viewportPixels?: {
        readonly x?: number;
        readonly y?: number;
        readonly width?: number;
        readonly height?: number;
      } | null;
      readonly scissorPixels?: {
        readonly x?: number;
        readonly y?: number;
        readonly width?: number;
        readonly height?: number;
      } | null;
      readonly diagnostics?: readonly unknown[];
      readonly insideSample?: string;
      readonly outsideSample?: string;
    };
    readonly passOrder?: readonly {
      readonly index?: number;
      readonly viewId?: number;
      readonly source?: string;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly ok?: boolean;
      readonly msaaSampleCount?: number;
      readonly attachment?: {
        readonly colorLoadOp?: string | null;
        readonly colorStoreOp?: string | null;
        readonly resolveTarget?: boolean;
        readonly behavior?: string;
      };
    }[];
    readonly displayPass?: {
      readonly loadOp?: string;
      readonly drawCalls?: number;
      readonly samples?: {
        readonly leftPreview?: string;
        readonly secondaryInside?: string;
        readonly secondaryOutside?: string;
        readonly screenClear?: string;
      };
    };
    readonly currentTextureReadback?: {
      readonly ok: boolean;
      readonly samples?: readonly {
        readonly id: string;
        readonly pixel: {
          readonly r: number;
          readonly g: number;
          readonly b: number;
          readonly a: number;
        };
      }[];
    } | null;
  };
  readonly dualSizeRenderTargets?: {
    readonly mode?: string;
    readonly source?: string;
    readonly renderTargets?: readonly {
      readonly role?: string;
      readonly key?: string;
      readonly source?: string;
      readonly viewId?: number | null;
      readonly width?: number;
      readonly height?: number;
      readonly ok?: boolean;
      readonly drawCalls?: number;
      readonly materialKey?: string;
      readonly displaySample?: string;
      readonly displayQuad?: {
        readonly role?: string;
        readonly source?: string;
        readonly renderTargetKey?: string | null;
        readonly sampleId?: string | null;
        readonly vertexCount?: number;
        readonly widthNdc?: number;
        readonly heightNdc?: number;
        readonly aspect?: {
          readonly targetWidth?: number;
          readonly targetHeight?: number;
          readonly targetAspectRatio?: number;
          readonly displayAspectRatio?: number;
          readonly preservesAspect?: boolean;
          readonly mapping?: string;
        };
      } | null;
      readonly aspect?: {
        readonly targetWidth?: number;
        readonly targetHeight?: number;
        readonly targetAspectRatio?: number;
        readonly displayAspectRatio?: number;
        readonly preservesAspect?: boolean;
        readonly mapping?: string;
      } | null;
    }[];
    readonly views?: readonly {
      readonly viewId?: number;
      readonly priority?: number;
      readonly layerMask?: number;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly viewport?: readonly number[];
      readonly scissor?: readonly number[];
    }[];
    readonly passOrder?: readonly {
      readonly index?: number;
      readonly viewId?: number;
      readonly source?: string;
      readonly renderTargetKey?: string | null;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly ok?: boolean;
    }[];
    readonly displayPass?: {
      readonly loadOp?: string;
      readonly drawCalls?: number;
      readonly samples?: {
        readonly leftPreview?: string;
        readonly rightPreview?: string;
        readonly screenClear?: string;
      };
    };
  };
  readonly msaaRenderTarget?: {
    readonly mode?: string;
    readonly source?: string;
    readonly renderTargetKey?: string;
    readonly requestedSampleCount?: number;
    readonly sampleCount?: number;
    readonly enabled?: boolean;
    readonly clamped?: boolean;
    readonly supportedSampleCounts?: readonly number[];
    readonly colorTargets?: number;
    readonly colorTexturesCreated?: number;
    readonly colorTexturesReused?: number;
    readonly target?: {
      readonly source?: string;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly msaaSampleCount?: number;
      readonly ok?: boolean;
    };
    readonly attachment?: {
      readonly colorLoadOp?: string | null;
      readonly colorStoreOp?: string | null;
      readonly resolveTarget?: boolean;
    };
    readonly displayPass?: {
      readonly loadOp?: string;
      readonly drawCalls?: number;
      readonly samples?: {
        readonly preview?: string;
        readonly screenClear?: string;
      };
    };
  };
  readonly msaaMultiRenderTargets?: {
    readonly mode?: string;
    readonly source?: string;
    readonly requestedSampleCount?: number;
    readonly sampleCount?: number;
    readonly enabled?: boolean;
    readonly clamped?: boolean;
    readonly supportedSampleCounts?: readonly number[];
    readonly colorTargets?: number;
    readonly colorTexturesCreated?: number;
    readonly colorTexturesReused?: number;
    readonly renderTargets?: readonly {
      readonly role?: string;
      readonly key?: string;
      readonly source?: string;
      readonly viewId?: number | null;
      readonly width?: number;
      readonly height?: number;
      readonly ok?: boolean;
      readonly drawCalls?: number;
      readonly materialKey?: string;
      readonly displaySample?: string;
      readonly msaaSampleCount?: number;
      readonly attachment?: {
        readonly colorLoadOp?: string | null;
        readonly colorStoreOp?: string | null;
        readonly resolveTarget?: boolean;
        readonly behavior?: string;
      };
      readonly displayQuad?: {
        readonly role?: string;
        readonly source?: string;
        readonly renderTargetKey?: string | null;
        readonly sampleId?: string | null;
        readonly vertexCount?: number;
        readonly widthNdc?: number;
        readonly heightNdc?: number;
      } | null;
    }[];
    readonly views?: readonly {
      readonly viewId?: number;
      readonly priority?: number;
      readonly layerMask?: number;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly viewport?: readonly number[];
      readonly scissor?: readonly number[];
    }[];
    readonly passOrder?: readonly {
      readonly index?: number;
      readonly viewId?: number;
      readonly source?: string;
      readonly renderTargetKey?: string | null;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly ok?: boolean;
      readonly msaaSampleCount?: number;
      readonly attachment?: {
        readonly colorLoadOp?: string | null;
        readonly colorStoreOp?: string | null;
        readonly resolveTarget?: boolean;
        readonly behavior?: string;
      };
    }[];
    readonly displayPass?: {
      readonly loadOp?: string;
      readonly drawCalls?: number;
      readonly samples?: {
        readonly leftPreview?: string;
        readonly rightPreview?: string;
        readonly screenClear?: string;
      };
    };
  };
  readonly msaaCroppedSecondaryRenderTargets?: {
    readonly mode?: string;
    readonly source?: string;
    readonly requestedSampleCount?: number;
    readonly sampleCount?: number;
    readonly enabled?: boolean;
    readonly clamped?: boolean;
    readonly supportedSampleCounts?: readonly number[];
    readonly colorTargets?: number;
    readonly colorTexturesCreated?: number;
    readonly colorTexturesReused?: number;
    readonly renderTargets?: readonly {
      readonly role?: string;
      readonly key?: string;
      readonly source?: string;
      readonly viewId?: number | null;
      readonly width?: number;
      readonly height?: number;
      readonly ok?: boolean;
      readonly drawCalls?: number;
      readonly materialKey?: string;
      readonly displaySample?: string;
      readonly msaaSampleCount?: number;
      readonly attachment?: {
        readonly colorLoadOp?: string | null;
        readonly colorStoreOp?: string | null;
        readonly resolveTarget?: boolean;
        readonly behavior?: string;
      };
      readonly displayQuad?: {
        readonly role?: string;
        readonly source?: string;
        readonly renderTargetKey?: string | null;
        readonly sampleId?: string | null;
        readonly vertexCount?: number;
        readonly widthNdc?: number;
        readonly heightNdc?: number;
      } | null;
    }[];
    readonly views?: readonly {
      readonly role?: string;
      readonly viewId?: number;
      readonly priority?: number;
      readonly layerMask?: number;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly viewport?: readonly number[];
      readonly scissor?: readonly number[];
    }[];
    readonly secondaryCrop?: {
      readonly renderTargetKey?: string;
      readonly expectedNormalizedRect?: readonly number[];
      readonly viewportPixels?: {
        readonly x?: number;
        readonly y?: number;
        readonly width?: number;
        readonly height?: number;
      } | null;
      readonly scissorPixels?: {
        readonly x?: number;
        readonly y?: number;
        readonly width?: number;
        readonly height?: number;
      } | null;
      readonly diagnostics?: readonly unknown[];
      readonly insideSample?: string;
      readonly outsideSample?: string;
    };
    readonly passOrder?: readonly {
      readonly index?: number;
      readonly viewId?: number;
      readonly source?: string;
      readonly renderTargetKey?: string | null;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly ok?: boolean;
      readonly msaaSampleCount?: number;
      readonly attachment?: {
        readonly colorLoadOp?: string | null;
        readonly colorStoreOp?: string | null;
        readonly resolveTarget?: boolean;
        readonly behavior?: string;
      };
    }[];
    readonly displayPass?: {
      readonly loadOp?: string;
      readonly drawCalls?: number;
      readonly samples?: {
        readonly leftPreview?: string;
        readonly secondaryInside?: string;
        readonly secondaryOutside?: string;
        readonly screenClear?: string;
      };
    };
  };
  readonly croppedSecondaryRenderTargets?: {
    readonly mode?: string;
    readonly source?: string;
    readonly renderTargets?: readonly {
      readonly role?: string;
      readonly key?: string;
      readonly source?: string;
      readonly viewId?: number | null;
      readonly width?: number;
      readonly height?: number;
      readonly ok?: boolean;
      readonly drawCalls?: number;
      readonly materialKey?: string;
      readonly displaySample?: string;
      readonly displayQuad?: {
        readonly role?: string;
        readonly source?: string;
        readonly renderTargetKey?: string | null;
        readonly sampleId?: string | null;
        readonly vertexCount?: number;
        readonly widthNdc?: number;
        readonly heightNdc?: number;
      } | null;
    }[];
    readonly views?: readonly {
      readonly role?: string;
      readonly viewId?: number;
      readonly priority?: number;
      readonly layerMask?: number;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly viewport?: readonly number[];
      readonly scissor?: readonly number[];
    }[];
    readonly secondaryCrop?: {
      readonly renderTargetKey?: string;
      readonly expectedNormalizedRect?: readonly number[];
      readonly viewportPixels?: {
        readonly x?: number;
        readonly y?: number;
        readonly width?: number;
        readonly height?: number;
      } | null;
      readonly scissorPixels?: {
        readonly x?: number;
        readonly y?: number;
        readonly width?: number;
        readonly height?: number;
      } | null;
      readonly diagnostics?: readonly unknown[];
      readonly insideSample?: string;
      readonly outsideSample?: string;
    };
    readonly passOrder?: readonly {
      readonly index?: number;
      readonly viewId?: number;
      readonly source?: string;
      readonly renderTargetKey?: string | null;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly ok?: boolean;
    }[];
    readonly displayPass?: {
      readonly loadOp?: string;
      readonly drawCalls?: number;
      readonly samples?: {
        readonly leftPreview?: string;
        readonly secondaryInside?: string;
        readonly secondaryOutside?: string;
        readonly screenClear?: string;
      };
    };
  };
  readonly offscreenTargetCrop?: {
    readonly mode?: string;
    readonly source?: string;
    readonly renderTargetKey?: string;
    readonly target?: {
      readonly source?: string;
      readonly width?: number;
      readonly height?: number;
      readonly msaaSampleCount?: number;
      readonly drawCalls?: number;
      readonly ok?: boolean;
    };
    readonly requestedSampleCount?: number;
    readonly sampleCount?: number;
    readonly enabled?: boolean;
    readonly clamped?: boolean;
    readonly supportedSampleCounts?: readonly number[];
    readonly colorTargets?: number;
    readonly colorTexturesCreated?: number;
    readonly colorTexturesReused?: number;
    readonly attachment?: {
      readonly colorLoadOp?: string | null;
      readonly colorStoreOp?: string | null;
      readonly resolveTarget?: boolean;
      readonly behavior?: string;
    };
    readonly view?: {
      readonly viewId?: number;
      readonly priority?: number;
      readonly layerMask?: number;
      readonly viewport?: readonly number[];
      readonly scissor?: readonly number[];
      readonly expectedNormalizedRect?: readonly number[];
    } | null;
    readonly viewportPixels?: {
      readonly x?: number;
      readonly y?: number;
      readonly width?: number;
      readonly height?: number;
    } | null;
    readonly scissorPixels?: {
      readonly x?: number;
      readonly y?: number;
      readonly width?: number;
      readonly height?: number;
    } | null;
    readonly diagnostics?: readonly unknown[];
    readonly displayPass?: {
      readonly loadOp?: string;
      readonly drawCalls?: number;
      readonly samples?: {
        readonly insideTarget?: string;
        readonly outsideTarget?: string;
        readonly screenClear?: string;
      };
    };
  };
  readonly sameRenderTargetClearLoad?: {
    readonly mode?: string;
    readonly source?: string;
    readonly renderTargetKey?: string;
    readonly requestedSampleCount?: number;
    readonly sampleCount?: number;
    readonly enabled?: boolean;
    readonly clamped?: boolean;
    readonly supportedSampleCounts?: readonly number[];
    readonly colorTargets?: number;
    readonly colorTexturesCreated?: number;
    readonly colorTexturesReused?: number;
    readonly views?: readonly {
      readonly index?: number;
      readonly role?: string;
      readonly viewId?: number;
      readonly priority?: number;
      readonly layerMask?: number;
      readonly target?: string;
      readonly renderTargetKey?: string | null;
      readonly viewport?: readonly number[];
      readonly scissor?: readonly number[];
    }[];
    readonly passOrder?: readonly {
      readonly index?: number;
      readonly role?: string;
      readonly viewId?: number;
      readonly source?: string;
      readonly renderTargetKey?: string | null;
      readonly width?: number;
      readonly height?: number;
      readonly drawCalls?: number;
      readonly ok?: boolean;
      readonly colorLoadOp?: string | null;
      readonly depthLoadOp?: string | null;
      readonly msaaSampleCount?: number;
      readonly attachment?: {
        readonly colorLoadOp?: string | null;
        readonly colorStoreOp?: string | null;
        readonly resolveTarget?: boolean;
        readonly behavior?: string;
      };
      readonly clearBehavior?: string;
    }[];
    readonly targetKeyReuse?: {
      readonly expectedRenderTargetKey?: string;
      readonly uniqueTargetKeys?: readonly (string | null)[];
      readonly allPassesShareTargetKey?: boolean;
      readonly passCount?: number;
    };
    readonly displayPass?: {
      readonly loadOp?: string;
      readonly drawCalls?: number;
      readonly samples?: {
        readonly clearOnly?: string;
        readonly basePreserved?: string;
        readonly overlay?: string;
        readonly screenClear?: string;
      };
    };
  };
  readonly mixedMsaaSameTargetClearLoad?: RenderToTextureStatus["sameRenderTargetClearLoad"] & {
    readonly currentTextureReadback?: {
      readonly ok: boolean;
      readonly samples?: readonly {
        readonly id: string;
        readonly pixel: {
          readonly r: number;
          readonly g: number;
          readonly b: number;
          readonly a: number;
        };
      }[];
    } | null;
  };
  readonly sourceView?: {
    readonly ok?: boolean;
    readonly viewId?: number;
    readonly priority?: number;
    readonly layerMask?: number;
    readonly viewport?: readonly number[];
    readonly scissor?: readonly number[];
    readonly clearColor?: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
    readonly renderTargetKey?: string | null;
    readonly expectedRenderTargetKey?: string;
    readonly renderTargetMatches?: boolean;
  };
  readonly scene?: {
    readonly materialKey?: string;
    readonly clearMaterialKey?: string;
    readonly canvasMaterialKey?: string;
    readonly currentMaterialKey?: string;
    readonly secondaryRenderTargetKey?: string;
    readonly materialKind?: string;
    readonly expectedCenterColor?: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
    readonly expectedClearMaterialColor?: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
    readonly expectedCanvasColor?: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
    readonly expectedCurrentColor?: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
  };
  readonly counts?: {
    readonly views?: number;
    readonly meshDraws?: number;
    readonly drawCalls?: number;
    readonly diagnostics?: number;
  };
  readonly report?: {
    readonly renderTargets?: readonly {
      readonly source: string;
      readonly renderTargetKey: string | null;
      readonly width: number;
      readonly height: number;
      readonly ok: boolean;
      readonly drawCalls: number;
    }[];
  };
  readonly screenPass?: {
    readonly phase?: string;
    readonly drawCalls?: number;
    readonly quad?: {
      readonly source?: string;
      readonly vertexCount?: number;
      readonly widthNdc?: number;
      readonly heightNdc?: number;
    };
    readonly quads?: readonly {
      readonly id?: string;
      readonly role?: string;
      readonly source?: string;
      readonly renderTargetKey?: string | null;
      readonly sampleId?: string | null;
      readonly vertexCount?: number;
      readonly widthNdc?: number;
      readonly heightNdc?: number;
      readonly aspect?: {
        readonly targetWidth?: number;
        readonly targetHeight?: number;
        readonly targetAspectRatio?: number;
        readonly displayAspectRatio?: number;
        readonly preservesAspect?: boolean;
        readonly mapping?: string;
      };
    }[];
    readonly samples?: {
      readonly preview?: string;
      readonly leftPreview?: string;
      readonly rightPreview?: string;
      readonly insideTarget?: string;
      readonly outsideTarget?: string;
      readonly secondaryInside?: string;
      readonly secondaryOutside?: string;
      readonly clearOnly?: string;
      readonly basePreserved?: string;
      readonly overlay?: string;
      readonly screenClear?: string;
    };
  };
  readonly readback?: {
    readonly ok: boolean;
    readonly samples?: readonly {
      readonly id: string;
      readonly pixel: {
        readonly r: number;
        readonly g: number;
        readonly b: number;
        readonly a: number;
      };
    }[];
  };
  readonly renderControl?: {
    readonly capabilities?: {
      readonly status?: boolean;
      readonly warnings?: boolean;
      readonly screenshot?: boolean;
      readonly snapshot?: boolean;
      readonly readback?: boolean;
    };
  };
}

test("render-to-texture example displays the off-screen pass on the canvas", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/render-to-texture.html",
    "render-to-texture-status",
  );

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-to-texture",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    clearColors: {
      offscreen: {
        r: 0.02,
        g: 0.035,
        b: 0.07,
        a: 1,
      },
      screen: {
        r: 0.015,
        g: 0.018,
        b: 0.023,
        a: 1,
      },
    },
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      viewport: [0, 0, 1, 1],
      scissor: [0, 0, 1, 1],
      clearColor: {
        r: 0.02,
        g: 0.035,
        b: 0.07,
        a: 1,
      },
      renderTargetKey: status.renderTarget?.key,
      expectedRenderTargetKey: status.renderTarget?.key,
      renderTargetMatches: true,
    },
    scene: {
      materialKind: "unlit",
    },
    counts: {
      views: 1,
      meshDraws: 1,
      drawCalls: 1,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 1,
      quad: {
        source: "off-screen render target",
        vertexCount: 6,
        widthNdc: 1.24,
        heightNdc: 1.24,
      },
      samples: {
        preview: "quad-center",
        screenClear: "screen-clear-corner",
      },
    },
    renderControl: {
      capabilities: {
        status: true,
        warnings: true,
        screenshot: true,
        snapshot: true,
        readback: false,
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey: status.renderTarget?.key,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus("render-to-texture-rendered-status", status);

  if (!status.readback?.ok) {
    test.skip(true, "Render-to-texture pixel assertion requires readback.");
    return;
  }

  const sample = status.readback.samples?.find(
    (entry) => entry.id === "quad-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(
    sample,
    `expected render-to-texture center readback sample; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeDefined();

  if (sample === undefined) {
    return;
  }

  expect(
    screenClearSample,
    `expected render-to-texture screen clear readback sample; status=${JSON.stringify(
      status,
      null,
      2,
    )}`,
  ).toBeDefined();

  if (screenClearSample === undefined) {
    return;
  }

  const expected = rgbaColorToPixel(
    status.scene?.expectedCenterColor ?? { r: 0.06, g: 0.88, b: 0.22, a: 1 },
  );
  const expectedScreenClear = rgbaColorToPixel(
    status.clearColors?.screen ?? { r: 0.015, g: 0.018, b: 0.023, a: 1 },
  );
  const expectedOffscreenClear = rgbaColorToPixel(
    status.clearColors?.offscreen ?? { r: 0.02, g: 0.035, b: 0.07, a: 1 },
  );

  expect(
    pixelDistance(sample.pixel, expected),
    `canvas quad center should sample the off-screen render target; sample=${JSON.stringify(
      sample.pixel,
    )} expected=${JSON.stringify(expected)}`,
  ).toBeLessThan(80);
  expect(
    pixelDistance(screenClearSample.pixel, expectedScreenClear),
    `screen clear readback should come from the main canvas clear region; sample=${JSON.stringify(
      screenClearSample.pixel,
    )} expected=${JSON.stringify(expectedScreenClear)}`,
  ).toBeLessThan(12);
  expect(
    pixelDistance(sample.pixel, screenClearSample.pixel),
    `canvas quad preview should differ from the untouched main-canvas clear region; preview=${JSON.stringify(
      sample.pixel,
    )} clear=${JSON.stringify(screenClearSample.pixel)}`,
  ).toBeGreaterThan(40);
  expect(
    pixelDistance(sample.pixel, expectedOffscreenClear),
    `canvas quad preview should differ from the off-screen render target clear color; preview=${JSON.stringify(
      sample.pixel,
    )} clear=${JSON.stringify(expectedOffscreenClear)}`,
  ).toBeGreaterThan(40);
});

test("mixed camera targets route keeps canvas and off-screen target passes distinct", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/mixed-camera-targets.html",
    "mixed-camera-targets-status",
  );

  if (status === undefined) {
    return;
  }

  const renderTargetKey = status.renderTarget?.key;

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "mixed-camera-targets",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey,
      expectedRenderTargetKey: renderTargetKey,
      renderTargetMatches: true,
    },
    mixedCameraTargets: {
      mode: "current-texture-plus-offscreen-render-target",
      renderTargetKey,
      source: "ViewPacket.renderTarget",
      views: [
        {
          viewId: 0,
          priority: 0,
          layerMask: 1,
          target: "offscreen",
          renderTargetKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          viewId: 1,
          priority: 1,
          layerMask: 2,
          target: "current-texture",
          renderTargetKey: null,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
      ],
      passOrder: [
        {
          index: 0,
          viewId: 0,
          source: "offscreen",
          renderTargetKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
        },
        {
          index: 1,
          viewId: 1,
          source: "swapchain",
          renderTargetKey: null,
          width: 960,
          height: 540,
          drawCalls: 1,
          ok: true,
        },
      ],
      displayPass: {
        loadOp: "clear",
        drawCalls: 1,
        samples: {
          preview: "offscreen-preview-center",
          screenClear: "screen-clear-corner",
        },
      },
    },
    counts: {
      views: 2,
      meshDraws: 2,
      drawCalls: 2,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 1,
      loadOp: "clear",
      samples: {
        preview: "offscreen-preview-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
    {
      source: "swapchain",
      renderTargetKey: null,
      width: 960,
      height: 540,
      ok: true,
      drawCalls: 1,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus("mixed-camera-targets-rendered-status", status);

  if (!status.readback?.ok || !status.mixedCameraTargets?.canvasReadback?.ok) {
    test.skip(true, "Mixed camera target pixel assertion requires readback.");
    return;
  }

  const canvasSample = status.mixedCameraTargets.canvasReadback.samples?.find(
    (entry) => entry.id === "canvas-direct-left",
  );
  const previewSample = status.readback.samples?.find(
    (entry) => entry.id === "offscreen-preview-center",
  );

  expect(canvasSample, "expected direct canvas sample").toBeDefined();
  expect(previewSample, "expected off-screen preview sample").toBeDefined();

  if (canvasSample === undefined || previewSample === undefined) {
    return;
  }

  expect(
    pixelDistance(
      canvasSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCanvasColor ?? {
          r: 0.1,
          g: 0.42,
          b: 0.95,
          a: 1,
        },
      ),
    ),
    "left canvas sample should come from the current-texture camera",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      previewSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "right preview sample should come from the off-screen render target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(canvasSample.pixel, previewSample.pixel),
    "mixed route should show distinct canvas and off-screen pixels",
  ).toBeGreaterThan(80);
});

test("multiple render targets route displays two distinct off-screen previews", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/multi-render-targets.html",
    "multi-render-targets-status",
  );

  if (status === undefined) {
    return;
  }

  const primaryKey = status.renderTarget?.key ?? "__missing-primary__";
  const secondaryKey =
    status.scene?.secondaryRenderTargetKey ?? "__missing-secondary__";

  expect(primaryKey).not.toBe("__missing-primary__");
  expect(secondaryKey).not.toBe("__missing-secondary__");
  expect(primaryKey).not.toBe(secondaryKey);

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "multi-render-targets",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      key: primaryKey,
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey: primaryKey,
      expectedRenderTargetKey: primaryKey,
      renderTargetMatches: true,
    },
    multiRenderTargets: {
      mode: "two-offscreen-render-target-previews",
      source: "ViewPacket.renderTarget",
      renderTargets: [
        {
          role: "primary",
          key: primaryKey,
          source: "offscreen",
          viewId: 0,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "left-target-preview-center",
          displayQuad: {
            role: "primary",
            renderTargetKey: primaryKey,
            sampleId: "left-target-preview-center",
            vertexCount: 6,
            widthNdc: 0.7,
            heightNdc: 1.16,
          },
        },
        {
          role: "secondary",
          key: secondaryKey,
          source: "offscreen",
          viewId: 1,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "right-target-preview-center",
          displayQuad: {
            role: "secondary",
            renderTargetKey: secondaryKey,
            sampleId: "right-target-preview-center",
            vertexCount: 6,
            widthNdc: 0.7,
            heightNdc: 1.16,
          },
        },
      ],
      views: [
        {
          viewId: 0,
          priority: 0,
          layerMask: 1,
          target: "offscreen",
          renderTargetKey: primaryKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          viewId: 1,
          priority: 1,
          layerMask: 2,
          target: "offscreen",
          renderTargetKey: secondaryKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
      ],
      passOrder: [
        {
          index: 0,
          viewId: 0,
          source: "offscreen",
          renderTargetKey: primaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
        },
        {
          index: 1,
          viewId: 1,
          source: "offscreen",
          renderTargetKey: secondaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
        },
      ],
      displayPass: {
        loadOp: "clear",
        drawCalls: 2,
        samples: {
          leftPreview: "left-target-preview-center",
          rightPreview: "right-target-preview-center",
          screenClear: "screen-clear-corner",
        },
      },
    },
    counts: {
      views: 2,
      meshDraws: 2,
      drawCalls: 2,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 2,
      loadOp: "clear",
      samples: {
        leftPreview: "left-target-preview-center",
        rightPreview: "right-target-preview-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey: primaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
    {
      source: "offscreen",
      renderTargetKey: secondaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus("multi-render-targets-rendered-status", status);

  if (!status.readback?.ok) {
    test.skip(
      true,
      "Multiple render-target pixel assertion requires readback.",
    );
    return;
  }

  const leftSample = status.readback.samples?.find(
    (entry) => entry.id === "left-target-preview-center",
  );
  const rightSample = status.readback.samples?.find(
    (entry) => entry.id === "right-target-preview-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(
    leftSample,
    "expected primary render-target preview sample",
  ).toBeDefined();
  expect(
    rightSample,
    "expected secondary render-target preview sample",
  ).toBeDefined();
  expect(screenClearSample, "expected screen clear sample").toBeDefined();

  if (
    leftSample === undefined ||
    rightSample === undefined ||
    screenClearSample === undefined
  ) {
    return;
  }

  expect(
    pixelDistance(
      leftSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "left preview should sample the primary off-screen render target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      rightSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCanvasColor ?? {
          r: 0.1,
          g: 0.42,
          b: 0.95,
          a: 1,
        },
      ),
    ),
    "right preview should sample the secondary off-screen render target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "screen clear sample should stay outside both preview quads",
  ).toBeLessThan(12);
  expect(
    pixelDistance(leftSample.pixel, rightSample.pixel),
    "two displayed off-screen render targets should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(leftSample.pixel, screenClearSample.pixel),
    "left preview should differ from the main-canvas clear region",
  ).toBeGreaterThan(40);
  expect(
    pixelDistance(rightSample.pixel, screenClearSample.pixel),
    "right preview should differ from the main-canvas clear region",
  ).toBeGreaterThan(40);
});

test("mixed multi render-target route displays current and two off-screen targets", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/mixed-multi-render-targets.html",
    "mixed-multi-render-targets-status",
  );

  if (status === undefined) {
    return;
  }

  const primaryKey = status.renderTarget?.key ?? "__missing-primary__";
  const secondaryKey =
    status.scene?.secondaryRenderTargetKey ?? "__missing-secondary__";

  expect(primaryKey).not.toBe("__missing-primary__");
  expect(secondaryKey).not.toBe("__missing-secondary__");
  expect(primaryKey).not.toBe(secondaryKey);

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "mixed-multi-render-targets",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      key: primaryKey,
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey: primaryKey,
      expectedRenderTargetKey: primaryKey,
      renderTargetMatches: true,
    },
    mixedMultiRenderTargets: {
      mode: "current-texture-plus-two-offscreen-render-targets",
      source: "ViewPacket.renderTarget",
      renderTargets: [
        {
          role: "primary",
          target: "offscreen",
          key: primaryKey,
          source: "offscreen",
          viewId: 0,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "left-target-preview-center",
          displayQuad: {
            role: "primary",
            renderTargetKey: primaryKey,
            sampleId: "left-target-preview-center",
            vertexCount: 6,
            widthNdc: 0.7,
            heightNdc: 1.16,
          },
        },
        {
          role: "secondary",
          target: "offscreen",
          key: secondaryKey,
          source: "offscreen",
          viewId: 1,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "right-target-preview-center",
          displayQuad: {
            role: "secondary",
            renderTargetKey: secondaryKey,
            sampleId: "right-target-preview-center",
            vertexCount: 6,
            widthNdc: 0.7,
            heightNdc: 1.16,
          },
        },
        {
          role: "current",
          target: "current-texture",
          key: null,
          source: "swapchain",
          viewId: 2,
          width: 960,
          height: 540,
          ok: true,
          drawCalls: 1,
          readbackSample: "current-texture-direct-left",
        },
      ],
      views: [
        {
          viewId: 0,
          priority: 0,
          layerMask: 1,
          target: "offscreen",
          renderTargetKey: primaryKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          viewId: 1,
          priority: 1,
          layerMask: 2,
          target: "offscreen",
          renderTargetKey: secondaryKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          viewId: 2,
          priority: 2,
          layerMask: 4,
          target: "current-texture",
          renderTargetKey: null,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
      ],
      passOrder: [
        {
          index: 0,
          viewId: 0,
          source: "offscreen",
          target: "offscreen",
          renderTargetKey: primaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
        },
        {
          index: 1,
          viewId: 1,
          source: "offscreen",
          target: "offscreen",
          renderTargetKey: secondaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
        },
        {
          index: 2,
          viewId: 2,
          source: "swapchain",
          target: "current-texture",
          renderTargetKey: null,
          width: 960,
          height: 540,
          drawCalls: 1,
          ok: true,
        },
      ],
      displayPass: {
        loadOp: "clear",
        drawCalls: 2,
        samples: {
          leftPreview: "left-target-preview-center",
          rightPreview: "right-target-preview-center",
          screenClear: "screen-clear-corner",
        },
      },
    },
    counts: {
      views: 3,
      meshDraws: 3,
      drawCalls: 3,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 2,
      loadOp: "clear",
      samples: {
        leftPreview: "left-target-preview-center",
        rightPreview: "right-target-preview-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey: primaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
    {
      source: "offscreen",
      renderTargetKey: secondaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
    {
      source: "swapchain",
      renderTargetKey: null,
      width: 960,
      height: 540,
      ok: true,
      drawCalls: 1,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus(
    "mixed-multi-render-targets-rendered-status",
    status,
  );

  if (
    !status.readback?.ok ||
    !status.mixedMultiRenderTargets?.currentTextureReadback?.ok
  ) {
    test.skip(
      true,
      "Mixed multi render-target pixel assertion requires readback.",
    );
    return;
  }

  const currentSample =
    status.mixedMultiRenderTargets.currentTextureReadback.samples?.find(
      (entry) => entry.id === "current-texture-direct-left",
    );
  const leftSample = status.readback.samples?.find(
    (entry) => entry.id === "left-target-preview-center",
  );
  const rightSample = status.readback.samples?.find(
    (entry) => entry.id === "right-target-preview-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(currentSample, "expected current-texture sample").toBeDefined();
  expect(
    leftSample,
    "expected primary render-target preview sample",
  ).toBeDefined();
  expect(
    rightSample,
    "expected secondary render-target preview sample",
  ).toBeDefined();
  expect(screenClearSample, "expected screen clear sample").toBeDefined();

  if (
    currentSample === undefined ||
    leftSample === undefined ||
    rightSample === undefined ||
    screenClearSample === undefined
  ) {
    return;
  }

  expect(
    pixelDistance(
      currentSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCurrentColor ?? {
          r: 0.95,
          g: 0.28,
          b: 0.08,
          a: 1,
        },
      ),
    ),
    "current-texture camera sample should come from the direct swapchain pass",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      leftSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "left preview should sample the primary off-screen render target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      rightSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCanvasColor ?? {
          r: 0.1,
          g: 0.42,
          b: 0.95,
          a: 1,
        },
      ),
    ),
    "right preview should sample the secondary off-screen render target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "screen clear sample should stay outside both off-screen preview quads",
  ).toBeLessThan(12);
  expect(
    pixelDistance(currentSample.pixel, leftSample.pixel),
    "current-texture sample and primary preview should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(currentSample.pixel, rightSample.pixel),
    "current-texture sample and secondary preview should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(leftSample.pixel, rightSample.pixel),
    "two displayed off-screen render targets should be visually distinct",
  ).toBeGreaterThan(80);
});

test("mixed dual-size render-target route displays current and aspect-preserved off-screen targets", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/mixed-dual-size-render-targets.html",
    "mixed-dual-size-render-targets-status",
  );

  if (status === undefined) {
    return;
  }

  const primaryKey = status.renderTarget?.key ?? "__missing-primary__";
  const secondaryKey =
    status.scene?.secondaryRenderTargetKey ?? "__missing-secondary__";

  expect(primaryKey).not.toBe("__missing-primary__");
  expect(secondaryKey).not.toBe("__missing-secondary__");
  expect(primaryKey).not.toBe(secondaryKey);

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "mixed-dual-size-render-targets",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      key: primaryKey,
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey: primaryKey,
      expectedRenderTargetKey: primaryKey,
      renderTargetMatches: true,
    },
    mixedDualSizeRenderTargets: {
      mode: "current-texture-plus-dual-size-offscreen-render-targets",
      source: "ViewPacket.renderTarget",
      renderTargets: [
        {
          role: "primary",
          target: "offscreen",
          key: primaryKey,
          source: "offscreen",
          viewId: 0,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "left-target-preview-center",
          displayQuad: {
            role: "primary",
            renderTargetKey: primaryKey,
            sampleId: "left-target-preview-center",
            vertexCount: 6,
            aspect: {
              targetWidth: 256,
              targetHeight: 256,
              targetAspectRatio: 1,
              preservesAspect: true,
              mapping: "preserve-target-aspect",
            },
          },
          aspect: {
            targetWidth: 256,
            targetHeight: 256,
            targetAspectRatio: 1,
            preservesAspect: true,
            mapping: "preserve-target-aspect",
          },
        },
        {
          role: "secondary",
          target: "offscreen",
          key: secondaryKey,
          source: "offscreen",
          viewId: 1,
          width: 384,
          height: 192,
          ok: true,
          drawCalls: 1,
          displaySample: "right-target-preview-center",
          aspect: {
            targetWidth: 384,
            targetHeight: 192,
            targetAspectRatio: 2,
            displayAspectRatio: 2,
            preservesAspect: true,
            mapping: "preserve-target-aspect",
          },
        },
        {
          role: "current",
          target: "current-texture",
          key: null,
          source: "swapchain",
          viewId: 2,
          width: 960,
          height: 540,
          ok: true,
          drawCalls: 1,
          readbackSample: "current-texture-direct-left",
        },
      ],
      views: [
        {
          viewId: 0,
          priority: 0,
          layerMask: 1,
          target: "offscreen",
          renderTargetKey: primaryKey,
        },
        {
          viewId: 1,
          priority: 1,
          layerMask: 2,
          target: "offscreen",
          renderTargetKey: secondaryKey,
        },
        {
          viewId: 2,
          priority: 2,
          layerMask: 4,
          target: "current-texture",
          renderTargetKey: null,
        },
      ],
      passOrder: [
        {
          index: 0,
          viewId: 0,
          source: "offscreen",
          target: "offscreen",
          renderTargetKey: primaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
        },
        {
          index: 1,
          viewId: 1,
          source: "offscreen",
          target: "offscreen",
          renderTargetKey: secondaryKey,
          width: 384,
          height: 192,
          drawCalls: 1,
          ok: true,
        },
        {
          index: 2,
          viewId: 2,
          source: "swapchain",
          target: "current-texture",
          renderTargetKey: null,
          width: 960,
          height: 540,
          drawCalls: 1,
          ok: true,
        },
      ],
      displayPass: {
        loadOp: "clear",
        drawCalls: 2,
        samples: {
          leftPreview: "left-target-preview-center",
          rightPreview: "right-target-preview-center",
          screenClear: "screen-clear-corner",
        },
      },
      currentTextureReadback: {
        ok: true,
      },
    },
    counts: {
      views: 3,
      meshDraws: 3,
      drawCalls: 3,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 2,
      loadOp: "clear",
      samples: {
        leftPreview: "left-target-preview-center",
        rightPreview: "right-target-preview-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey: primaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
    {
      source: "offscreen",
      renderTargetKey: secondaryKey,
      width: 384,
      height: 192,
      ok: true,
      drawCalls: 1,
    },
    {
      source: "swapchain",
      renderTargetKey: null,
      width: 960,
      height: 540,
      ok: true,
      drawCalls: 1,
    },
  ]);
  guard.expectNoWarnings();

  const primaryAspect =
    status.mixedDualSizeRenderTargets?.renderTargets?.find(
      (target) => target.role === "primary",
    )?.aspect ?? null;
  const secondaryAspect =
    status.mixedDualSizeRenderTargets?.renderTargets?.find(
      (target) => target.role === "secondary",
    )?.aspect ?? null;

  expect(primaryAspect?.displayAspectRatio).toBeCloseTo(1, 2);
  expect(secondaryAspect?.displayAspectRatio).toBeCloseTo(2, 2);
  expect(primaryAspect?.preservesAspect).toBe(true);
  expect(secondaryAspect?.preservesAspect).toBe(true);

  await attachExampleStatus(
    "mixed-dual-size-render-targets-rendered-status",
    status,
  );

  if (
    !status.readback?.ok ||
    !status.mixedDualSizeRenderTargets?.currentTextureReadback?.ok
  ) {
    test.skip(
      true,
      "Mixed dual-size render-target pixel assertion requires readback.",
    );
    return;
  }

  const currentSample =
    status.mixedDualSizeRenderTargets.currentTextureReadback.samples?.find(
      (entry) => entry.id === "current-texture-direct-left",
    );
  const leftSample = status.readback.samples?.find(
    (entry) => entry.id === "left-target-preview-center",
  );
  const rightSample = status.readback.samples?.find(
    (entry) => entry.id === "right-target-preview-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(currentSample, "expected current-texture sample").toBeDefined();
  expect(
    leftSample,
    "expected primary render-target preview sample",
  ).toBeDefined();
  expect(
    rightSample,
    "expected secondary render-target preview sample",
  ).toBeDefined();
  expect(screenClearSample, "expected screen clear sample").toBeDefined();

  if (
    currentSample === undefined ||
    leftSample === undefined ||
    rightSample === undefined ||
    screenClearSample === undefined
  ) {
    return;
  }

  expect(
    pixelDistance(
      currentSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCurrentColor ?? {
          r: 0.95,
          g: 0.28,
          b: 0.08,
          a: 1,
        },
      ),
    ),
    "current-texture camera sample should come from the direct swapchain pass",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      leftSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "left preview should sample the square primary off-screen render target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      rightSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCanvasColor ?? {
          r: 0.1,
          g: 0.42,
          b: 0.95,
          a: 1,
        },
      ),
    ),
    "right preview should sample the wide secondary off-screen render target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "screen clear sample should stay outside both off-screen preview quads",
  ).toBeLessThan(12);
  expect(
    pixelDistance(currentSample.pixel, leftSample.pixel),
    "current-texture sample and square preview should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(currentSample.pixel, rightSample.pixel),
    "current-texture sample and wide preview should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(leftSample.pixel, rightSample.pixel),
    "dual-size off-screen previews should be visually distinct",
  ).toBeGreaterThan(80);
});

test("mixed cropped secondary render-target route displays current and cropped off-screen targets", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/mixed-secondary-crop-render-targets.html",
    "mixed-secondary-crop-render-targets-status",
  );

  if (status === undefined) {
    return;
  }

  const primaryKey = status.renderTarget?.key ?? "__missing-primary__";
  const secondaryKey =
    status.scene?.secondaryRenderTargetKey ?? "__missing-secondary__";

  expect(primaryKey).not.toBe("__missing-primary__");
  expect(secondaryKey).not.toBe("__missing-secondary__");
  expect(primaryKey).not.toBe(secondaryKey);

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "mixed-secondary-crop-render-targets",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      key: primaryKey,
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey: primaryKey,
      expectedRenderTargetKey: primaryKey,
      renderTargetMatches: true,
    },
    mixedCroppedSecondaryRenderTargets: {
      mode: "current-texture-plus-cropped-secondary-offscreen-render-targets",
      source: "ViewPacket.renderTarget",
      renderTargets: [
        {
          role: "primary",
          target: "offscreen",
          key: primaryKey,
          source: "offscreen",
          viewId: 0,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "left-target-preview-center",
          displayQuad: {
            role: "primary",
            renderTargetKey: primaryKey,
            sampleId: "left-target-preview-center",
            vertexCount: 6,
            widthNdc: 0.7,
            heightNdc: 1.16,
          },
        },
        {
          role: "secondary",
          target: "offscreen",
          key: secondaryKey,
          source: "offscreen",
          viewId: 1,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "secondary-crop-inside",
          displayQuad: {
            role: "secondary",
            renderTargetKey: secondaryKey,
            sampleId: "secondary-crop-inside",
            vertexCount: 6,
            widthNdc: 0.7,
            heightNdc: 1.16,
          },
        },
        {
          role: "current",
          target: "current-texture",
          key: null,
          source: "swapchain",
          viewId: 2,
          width: 960,
          height: 540,
          ok: true,
          drawCalls: 1,
          readbackSample: "current-texture-direct-left",
        },
      ],
      views: [
        {
          role: "primary",
          viewId: 0,
          priority: 0,
          layerMask: 1,
          target: "offscreen",
          renderTargetKey: primaryKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          role: "secondary",
          viewId: 1,
          priority: 1,
          layerMask: 2,
          target: "offscreen",
          renderTargetKey: secondaryKey,
        },
        {
          role: "current",
          viewId: 2,
          priority: 2,
          layerMask: 4,
          target: "current-texture",
          renderTargetKey: null,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
      ],
      secondaryCrop: {
        renderTargetKey: secondaryKey,
        expectedNormalizedRect: [0.3, 0.25, 0.4, 0.5],
        viewportPixels: {
          x: 77,
          y: 64,
          width: 102,
          height: 128,
        },
        scissorPixels: {
          x: 77,
          y: 64,
          width: 102,
          height: 128,
        },
        diagnostics: [],
        insideSample: "secondary-crop-inside",
        outsideSample: "secondary-crop-outside",
      },
      passOrder: [
        {
          index: 0,
          viewId: 0,
          source: "offscreen",
          target: "offscreen",
          renderTargetKey: primaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
        },
        {
          index: 1,
          viewId: 1,
          source: "offscreen",
          target: "offscreen",
          renderTargetKey: secondaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
        },
        {
          index: 2,
          viewId: 2,
          source: "swapchain",
          target: "current-texture",
          renderTargetKey: null,
          width: 960,
          height: 540,
          drawCalls: 1,
          ok: true,
        },
      ],
      displayPass: {
        loadOp: "clear",
        drawCalls: 2,
        samples: {
          leftPreview: "left-target-preview-center",
          secondaryInside: "secondary-crop-inside",
          secondaryOutside: "secondary-crop-outside",
          screenClear: "screen-clear-corner",
        },
      },
      currentTextureReadback: {
        ok: true,
      },
    },
    counts: {
      views: 3,
      meshDraws: 3,
      drawCalls: 3,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 2,
      loadOp: "clear",
      samples: {
        leftPreview: "left-target-preview-center",
        secondaryInside: "secondary-crop-inside",
        secondaryOutside: "secondary-crop-outside",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey: primaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
    {
      source: "offscreen",
      renderTargetKey: secondaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
    {
      source: "swapchain",
      renderTargetKey: null,
      width: 960,
      height: 540,
      ok: true,
      drawCalls: 1,
    },
  ]);
  const secondaryView =
    status.mixedCroppedSecondaryRenderTargets?.views?.find(
      (view) => view.role === "secondary",
    ) ?? null;

  expectNormalizedRect(secondaryView?.viewport, [0.3, 0.25, 0.4, 0.5]);
  expectNormalizedRect(secondaryView?.scissor, [0.3, 0.25, 0.4, 0.5]);
  expectNormalizedRect(
    status.mixedCroppedSecondaryRenderTargets?.secondaryCrop
      ?.expectedNormalizedRect,
    [0.3, 0.25, 0.4, 0.5],
  );
  guard.expectNoWarnings();

  await attachExampleStatus(
    "mixed-secondary-crop-render-targets-rendered-status",
    status,
  );

  if (
    !status.readback?.ok ||
    !status.mixedCroppedSecondaryRenderTargets?.currentTextureReadback?.ok
  ) {
    test.skip(
      true,
      "Mixed cropped secondary render-target pixel assertion requires readback.",
    );
    return;
  }

  const currentSample =
    status.mixedCroppedSecondaryRenderTargets.currentTextureReadback.samples?.find(
      (entry) => entry.id === "current-texture-direct-left",
    );
  const leftSample = status.readback.samples?.find(
    (entry) => entry.id === "left-target-preview-center",
  );
  const secondaryInsideSample = status.readback.samples?.find(
    (entry) => entry.id === "secondary-crop-inside",
  );
  const secondaryOutsideSample = status.readback.samples?.find(
    (entry) => entry.id === "secondary-crop-outside",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(currentSample, "expected current-texture sample").toBeDefined();
  expect(
    leftSample,
    "expected primary render-target preview sample",
  ).toBeDefined();
  expect(
    secondaryInsideSample,
    "expected secondary inside-crop preview sample",
  ).toBeDefined();
  expect(
    secondaryOutsideSample,
    "expected secondary outside-crop preview sample",
  ).toBeDefined();
  expect(screenClearSample, "expected screen clear sample").toBeDefined();

  if (
    currentSample === undefined ||
    leftSample === undefined ||
    secondaryInsideSample === undefined ||
    secondaryOutsideSample === undefined ||
    screenClearSample === undefined
  ) {
    return;
  }

  expect(
    pixelDistance(
      currentSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCurrentColor ?? {
          r: 0.95,
          g: 0.28,
          b: 0.08,
          a: 1,
        },
      ),
    ),
    "current-texture camera sample should come from the direct swapchain pass",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      leftSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "left preview should sample the primary off-screen render target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      secondaryInsideSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCanvasColor ?? {
          r: 0.1,
          g: 0.42,
          b: 0.95,
          a: 1,
        },
      ),
    ),
    "secondary inside-crop sample should come from the secondary camera",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      secondaryOutsideSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.offscreen ?? {
          r: 0.02,
          g: 0.035,
          b: 0.07,
          a: 1,
        },
      ),
    ),
    "secondary outside-crop sample should remain the target clear color",
  ).toBeLessThan(12);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "screen clear sample should stay outside both off-screen preview quads",
  ).toBeLessThan(12);
  expect(
    pixelDistance(currentSample.pixel, leftSample.pixel),
    "current-texture sample and primary preview should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(currentSample.pixel, secondaryInsideSample.pixel),
    "current-texture sample and secondary inside-crop preview should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(leftSample.pixel, secondaryInsideSample.pixel),
    "primary and secondary cropped previews should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(secondaryInsideSample.pixel, secondaryOutsideSample.pixel),
    "secondary cropped render target should differ inside and outside the viewport",
  ).toBeGreaterThan(40);
});

test("mixed MSAA two-target route displays current and resolved off-screen targets", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/mixed-msaa-two-targets.html",
    "mixed-msaa-two-targets-status",
  );

  if (status === undefined) {
    return;
  }

  const primaryKey = status.renderTarget?.key ?? "__missing-primary__";
  const secondaryKey =
    status.scene?.secondaryRenderTargetKey ?? "__missing-secondary__";

  expect(primaryKey).not.toBe("__missing-primary__");
  expect(secondaryKey).not.toBe("__missing-secondary__");
  expect(primaryKey).not.toBe(secondaryKey);

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "mixed-msaa-two-targets",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      key: primaryKey,
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey: primaryKey,
      expectedRenderTargetKey: primaryKey,
      renderTargetMatches: true,
    },
    mixedMsaaMultiRenderTargets: {
      mode: "current-texture-plus-msaa-two-offscreen-render-targets",
      source: "ViewPacket.renderTarget",
      requestedSampleCount: 8,
      sampleCount: 4,
      enabled: true,
      clamped: true,
      supportedSampleCounts: [1, 4],
      colorTargets: 3,
      colorTexturesCreated: 3,
      colorTexturesReused: 0,
      renderTargets: [
        {
          role: "primary",
          target: "offscreen",
          key: primaryKey,
          source: "offscreen",
          viewId: 0,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "left-target-preview-center",
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
          displayQuad: {
            role: "primary",
            renderTargetKey: primaryKey,
            sampleId: "left-target-preview-center",
            vertexCount: 6,
            widthNdc: 0.7,
            heightNdc: 1.16,
          },
        },
        {
          role: "secondary",
          target: "offscreen",
          key: secondaryKey,
          source: "offscreen",
          viewId: 1,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "right-target-preview-center",
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
          displayQuad: {
            role: "secondary",
            renderTargetKey: secondaryKey,
            sampleId: "right-target-preview-center",
            vertexCount: 6,
            widthNdc: 0.7,
            heightNdc: 1.16,
          },
        },
        {
          role: "current",
          target: "current-texture",
          key: null,
          source: "swapchain",
          viewId: 2,
          width: 960,
          height: 540,
          ok: true,
          drawCalls: 1,
          readbackSample: "current-texture-direct-left",
          msaaSampleCount: 4,
        },
      ],
      views: [
        {
          role: "primary",
          viewId: 0,
          priority: 0,
          layerMask: 1,
          target: "offscreen",
          renderTargetKey: primaryKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          role: "secondary",
          viewId: 1,
          priority: 1,
          layerMask: 2,
          target: "offscreen",
          renderTargetKey: secondaryKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          role: "current",
          viewId: 2,
          priority: 2,
          layerMask: 4,
          target: "current-texture",
          renderTargetKey: null,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
      ],
      passOrder: [
        {
          index: 0,
          viewId: 0,
          source: "offscreen",
          target: "offscreen",
          renderTargetKey: primaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
        },
        {
          index: 1,
          viewId: 1,
          source: "offscreen",
          target: "offscreen",
          renderTargetKey: secondaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
        },
        {
          index: 2,
          viewId: 2,
          source: "swapchain",
          target: "current-texture",
          renderTargetKey: null,
          width: 960,
          height: 540,
          drawCalls: 1,
          ok: true,
          msaaSampleCount: 4,
        },
      ],
      displayPass: {
        loadOp: "clear",
        drawCalls: 2,
        samples: {
          leftPreview: "left-target-preview-center",
          rightPreview: "right-target-preview-center",
          screenClear: "screen-clear-corner",
        },
      },
      currentTextureReadback: {
        ok: true,
      },
    },
    counts: {
      views: 3,
      meshDraws: 3,
      drawCalls: 3,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 2,
      loadOp: "clear",
      samples: {
        leftPreview: "left-target-preview-center",
        rightPreview: "right-target-preview-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey: primaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
    {
      source: "offscreen",
      renderTargetKey: secondaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
    {
      source: "swapchain",
      renderTargetKey: null,
      width: 960,
      height: 540,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus("mixed-msaa-two-targets-rendered-status", status);

  if (
    !status.readback?.ok ||
    !status.mixedMsaaMultiRenderTargets?.currentTextureReadback?.ok
  ) {
    test.skip(true, "Mixed MSAA target pixel assertion requires readback.");
    return;
  }

  const currentSample =
    status.mixedMsaaMultiRenderTargets.currentTextureReadback.samples?.find(
      (entry) => entry.id === "current-texture-direct-left",
    );
  const leftSample = status.readback.samples?.find(
    (entry) => entry.id === "left-target-preview-center",
  );
  const rightSample = status.readback.samples?.find(
    (entry) => entry.id === "right-target-preview-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(currentSample, "expected current-texture sample").toBeDefined();
  expect(
    leftSample,
    "expected primary resolved render-target preview sample",
  ).toBeDefined();
  expect(
    rightSample,
    "expected secondary resolved render-target preview sample",
  ).toBeDefined();
  expect(screenClearSample, "expected screen clear sample").toBeDefined();

  if (
    currentSample === undefined ||
    leftSample === undefined ||
    rightSample === undefined ||
    screenClearSample === undefined
  ) {
    return;
  }

  expect(
    pixelDistance(
      currentSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCurrentColor ?? {
          r: 0.95,
          g: 0.28,
          b: 0.08,
          a: 1,
        },
      ),
    ),
    "current-texture camera sample should come from the direct swapchain pass",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      leftSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "left preview should sample the resolved primary MSAA target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      rightSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCanvasColor ?? {
          r: 0.1,
          g: 0.42,
          b: 0.95,
          a: 1,
        },
      ),
    ),
    "right preview should sample the resolved secondary MSAA target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "screen clear sample should stay outside both resolved preview quads",
  ).toBeLessThan(12);
  expect(
    pixelDistance(currentSample.pixel, leftSample.pixel),
    "current-texture sample and resolved primary preview should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(currentSample.pixel, rightSample.pixel),
    "current-texture sample and resolved secondary preview should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(leftSample.pixel, rightSample.pixel),
    "resolved MSAA off-screen previews should be visually distinct",
  ).toBeGreaterThan(80);
});

test("mixed MSAA cropped secondary route displays current and resolved cropped off-screen targets", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/mixed-msaa-secondary-crop.html",
    "mixed-msaa-secondary-crop-status",
  );

  if (status === undefined) {
    return;
  }

  const primaryKey = status.renderTarget?.key ?? "__missing-primary__";
  const secondaryKey =
    status.scene?.secondaryRenderTargetKey ?? "__missing-secondary__";

  expect(primaryKey).not.toBe("__missing-primary__");
  expect(secondaryKey).not.toBe("__missing-secondary__");
  expect(primaryKey).not.toBe(secondaryKey);

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "mixed-msaa-secondary-crop",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      key: primaryKey,
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey: primaryKey,
      expectedRenderTargetKey: primaryKey,
      renderTargetMatches: true,
    },
    mixedMsaaCroppedSecondaryRenderTargets: {
      mode: "current-texture-plus-msaa-cropped-secondary-offscreen-render-targets",
      source: "ViewPacket.renderTarget",
      requestedSampleCount: 8,
      sampleCount: 4,
      enabled: true,
      clamped: true,
      supportedSampleCounts: [1, 4],
      colorTargets: 3,
      colorTexturesCreated: 3,
      colorTexturesReused: 0,
      renderTargets: [
        {
          role: "primary",
          target: "offscreen",
          key: primaryKey,
          source: "offscreen",
          viewId: 0,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "left-target-preview-center",
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
          displayQuad: {
            role: "primary",
            renderTargetKey: primaryKey,
            sampleId: "left-target-preview-center",
            vertexCount: 6,
            widthNdc: 0.7,
            heightNdc: 1.16,
          },
        },
        {
          role: "secondary",
          target: "offscreen",
          key: secondaryKey,
          source: "offscreen",
          viewId: 1,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "secondary-crop-inside",
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
          displayQuad: {
            role: "secondary",
            renderTargetKey: secondaryKey,
            sampleId: "secondary-crop-inside",
            vertexCount: 6,
            widthNdc: 0.7,
            heightNdc: 1.16,
          },
        },
        {
          role: "current",
          target: "current-texture",
          key: null,
          source: "swapchain",
          viewId: 2,
          width: 960,
          height: 540,
          ok: true,
          drawCalls: 1,
          readbackSample: "current-texture-direct-left",
          msaaSampleCount: 4,
        },
      ],
      views: [
        {
          role: "primary",
          viewId: 0,
          priority: 0,
          layerMask: 1,
          target: "offscreen",
          renderTargetKey: primaryKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          role: "secondary",
          viewId: 1,
          priority: 1,
          layerMask: 2,
          target: "offscreen",
          renderTargetKey: secondaryKey,
        },
        {
          role: "current",
          viewId: 2,
          priority: 2,
          layerMask: 4,
          target: "current-texture",
          renderTargetKey: null,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
      ],
      secondaryCrop: {
        renderTargetKey: secondaryKey,
        expectedNormalizedRect: [0.3, 0.25, 0.4, 0.5],
        viewportPixels: {
          x: 77,
          y: 64,
          width: 102,
          height: 128,
        },
        scissorPixels: {
          x: 77,
          y: 64,
          width: 102,
          height: 128,
        },
        diagnostics: [],
        insideSample: "secondary-crop-inside",
        outsideSample: "secondary-crop-outside",
      },
      passOrder: [
        {
          index: 0,
          viewId: 0,
          source: "offscreen",
          target: "offscreen",
          renderTargetKey: primaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
        },
        {
          index: 1,
          viewId: 1,
          source: "offscreen",
          target: "offscreen",
          renderTargetKey: secondaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
        },
        {
          index: 2,
          viewId: 2,
          source: "swapchain",
          target: "current-texture",
          renderTargetKey: null,
          width: 960,
          height: 540,
          drawCalls: 1,
          ok: true,
          msaaSampleCount: 4,
        },
      ],
      displayPass: {
        loadOp: "clear",
        drawCalls: 2,
        samples: {
          leftPreview: "left-target-preview-center",
          secondaryInside: "secondary-crop-inside",
          secondaryOutside: "secondary-crop-outside",
          screenClear: "screen-clear-corner",
        },
      },
      currentTextureReadback: {
        ok: true,
      },
    },
    counts: {
      views: 3,
      meshDraws: 3,
      drawCalls: 3,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 2,
      loadOp: "clear",
      samples: {
        leftPreview: "left-target-preview-center",
        secondaryInside: "secondary-crop-inside",
        secondaryOutside: "secondary-crop-outside",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey: primaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
    {
      source: "offscreen",
      renderTargetKey: secondaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
    {
      source: "swapchain",
      renderTargetKey: null,
      width: 960,
      height: 540,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
  ]);
  const secondaryView =
    status.mixedMsaaCroppedSecondaryRenderTargets?.views?.find(
      (view) => view.role === "secondary",
    ) ?? null;

  expectNormalizedRect(secondaryView?.viewport, [0.3, 0.25, 0.4, 0.5]);
  expectNormalizedRect(secondaryView?.scissor, [0.3, 0.25, 0.4, 0.5]);
  expectNormalizedRect(
    status.mixedMsaaCroppedSecondaryRenderTargets?.secondaryCrop
      ?.expectedNormalizedRect,
    [0.3, 0.25, 0.4, 0.5],
  );
  guard.expectNoWarnings();

  await attachExampleStatus(
    "mixed-msaa-secondary-crop-rendered-status",
    status,
  );

  if (
    !status.readback?.ok ||
    !status.mixedMsaaCroppedSecondaryRenderTargets?.currentTextureReadback?.ok
  ) {
    test.skip(
      true,
      "Mixed MSAA cropped secondary pixel assertion requires readback.",
    );
    return;
  }

  const currentSample =
    status.mixedMsaaCroppedSecondaryRenderTargets.currentTextureReadback.samples?.find(
      (entry) => entry.id === "current-texture-direct-left",
    );
  const leftSample = status.readback.samples?.find(
    (entry) => entry.id === "left-target-preview-center",
  );
  const secondaryInsideSample = status.readback.samples?.find(
    (entry) => entry.id === "secondary-crop-inside",
  );
  const secondaryOutsideSample = status.readback.samples?.find(
    (entry) => entry.id === "secondary-crop-outside",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(currentSample, "expected current-texture sample").toBeDefined();
  expect(
    leftSample,
    "expected primary resolved render-target preview sample",
  ).toBeDefined();
  expect(
    secondaryInsideSample,
    "expected resolved secondary inside-crop sample",
  ).toBeDefined();
  expect(
    secondaryOutsideSample,
    "expected resolved secondary outside-crop sample",
  ).toBeDefined();
  expect(screenClearSample, "expected screen clear sample").toBeDefined();

  if (
    currentSample === undefined ||
    leftSample === undefined ||
    secondaryInsideSample === undefined ||
    secondaryOutsideSample === undefined ||
    screenClearSample === undefined
  ) {
    return;
  }

  expect(
    pixelDistance(
      currentSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCurrentColor ?? {
          r: 0.95,
          g: 0.28,
          b: 0.08,
          a: 1,
        },
      ),
    ),
    "current-texture camera sample should come from the direct swapchain pass",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      leftSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "left preview should sample the resolved primary MSAA target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      secondaryInsideSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCanvasColor ?? {
          r: 0.1,
          g: 0.42,
          b: 0.95,
          a: 1,
        },
      ),
    ),
    "secondary inside-crop sample should come from the resolved secondary MSAA target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      secondaryOutsideSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.offscreen ?? {
          r: 0.02,
          g: 0.035,
          b: 0.07,
          a: 1,
        },
      ),
    ),
    "secondary outside-crop sample should remain the resolved target clear color",
  ).toBeLessThan(12);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "screen clear sample should stay outside both resolved preview quads",
  ).toBeLessThan(12);
  expect(
    pixelDistance(currentSample.pixel, leftSample.pixel),
    "current-texture sample and resolved primary preview should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(currentSample.pixel, secondaryInsideSample.pixel),
    "current-texture sample and resolved secondary inside-crop preview should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(leftSample.pixel, secondaryInsideSample.pixel),
    "resolved primary and secondary cropped previews should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(secondaryInsideSample.pixel, secondaryOutsideSample.pixel),
    "resolved secondary cropped render target should differ inside and outside the viewport",
  ).toBeGreaterThan(40);
});

test("mixed MSAA resize route displays current and resized resolved off-screen target", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/mixed-msaa-resize.html",
    "mixed-msaa-resize-status",
  );

  if (status === undefined) {
    return;
  }

  const renderTargetKey = status.renderTarget?.key;

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "mixed-msaa-resize",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 384,
      height: 384,
      source: "ViewPacket.renderTarget",
      key: renderTargetKey,
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey,
      expectedRenderTargetKey: renderTargetKey,
      renderTargetMatches: true,
    },
    renderTargetResize: {
      mode: "renderer-owned-render-target-resize",
      reason: "route-config-canvas-resize-simulation",
      renderTargetKey,
      before: {
        width: 128,
        height: 128,
      },
      after: {
        width: 384,
        height: 384,
      },
      reusedHandle: true,
      textureRecreated: true,
      previousTextureDestroyed: true,
      staleSizeGuard: "source-assets-markReady-before-render",
      stableRenderTargetKey: true,
      msaaSampleCount: 4,
      attachment: {
        colorLoadOp: "clear",
        colorStoreOp: "discard",
        resolveTarget: true,
        behavior: "resolve-to-render-target-texture",
      },
      msaa: {
        mode: "msaa-resized-offscreen-render-target",
        requestedSampleCount: 8,
        sampleCount: 4,
        enabled: true,
        clamped: true,
        supportedSampleCounts: [1, 4],
        colorTargets: 2,
        colorTexturesCreated: 2,
        colorTexturesReused: 0,
        target: {
          source: "offscreen",
          width: 384,
          height: 384,
          drawCalls: 1,
          msaaSampleCount: 4,
          ok: true,
        },
      },
    },
    mixedMsaaRenderTargetResize: {
      mode: "current-texture-plus-msaa-resized-offscreen-render-target",
      source: "ViewPacket.renderTarget",
      renderTargetKey,
      requestedSampleCount: 8,
      sampleCount: 4,
      enabled: true,
      clamped: true,
      supportedSampleCounts: [1, 4],
      colorTargets: 2,
      colorTexturesCreated: 2,
      colorTexturesReused: 0,
      resize: {
        renderTargetKey,
        before: {
          width: 128,
          height: 128,
        },
        after: {
          width: 384,
          height: 384,
        },
        stableRenderTargetKey: true,
        msaaSampleCount: 4,
      },
      renderTargets: [
        {
          role: "offscreen",
          target: "offscreen",
          key: renderTargetKey,
          source: "offscreen",
          viewId: 0,
          width: 384,
          height: 384,
          ok: true,
          drawCalls: 1,
          displaySample: "offscreen-preview-center",
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
        },
        {
          role: "current",
          target: "current-texture",
          key: null,
          source: "swapchain",
          viewId: 1,
          width: 960,
          height: 540,
          ok: true,
          drawCalls: 1,
          readbackSample: "canvas-direct-left",
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
        },
      ],
      views: [
        {
          role: "offscreen",
          viewId: 0,
          priority: 0,
          layerMask: 1,
          target: "offscreen",
          renderTargetKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          role: "current",
          viewId: 1,
          priority: 1,
          layerMask: 2,
          target: "current-texture",
          renderTargetKey: null,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
      ],
      passOrder: [
        {
          index: 0,
          viewId: 0,
          source: "offscreen",
          target: "offscreen",
          renderTargetKey,
          width: 384,
          height: 384,
          drawCalls: 1,
          ok: true,
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
        },
        {
          index: 1,
          viewId: 1,
          source: "swapchain",
          target: "current-texture",
          renderTargetKey: null,
          width: 960,
          height: 540,
          drawCalls: 1,
          ok: true,
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
        },
      ],
      displayPass: {
        loadOp: "clear",
        drawCalls: 1,
        samples: {
          preview: "offscreen-preview-center",
          screenClear: "screen-clear-corner",
        },
      },
      currentTextureReadback: {
        ok: true,
      },
    },
    counts: {
      views: 2,
      meshDraws: 2,
      drawCalls: 2,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 1,
      loadOp: "clear",
      samples: {
        preview: "offscreen-preview-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey,
      width: 384,
      height: 384,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
    {
      source: "swapchain",
      renderTargetKey: null,
      width: 960,
      height: 540,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus("mixed-msaa-resize-rendered-status", status);

  if (
    !status.readback?.ok ||
    !status.mixedMsaaRenderTargetResize?.currentTextureReadback?.ok
  ) {
    test.skip(true, "Mixed MSAA resize pixel assertion requires readback.");
    return;
  }

  const currentSample =
    status.mixedMsaaRenderTargetResize.currentTextureReadback.samples?.find(
      (entry) => entry.id === "canvas-direct-left",
    );
  const previewSample = status.readback.samples?.find(
    (entry) => entry.id === "offscreen-preview-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(currentSample, "expected current-texture sample").toBeDefined();
  expect(
    previewSample,
    "expected resized resolved render-target preview sample",
  ).toBeDefined();
  expect(screenClearSample, "expected screen clear sample").toBeDefined();

  if (
    currentSample === undefined ||
    previewSample === undefined ||
    screenClearSample === undefined
  ) {
    return;
  }

  expect(
    pixelDistance(
      currentSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCanvasColor ?? {
          r: 0.1,
          g: 0.42,
          b: 0.95,
          a: 1,
        },
      ),
    ),
    "current-texture camera sample should come from the direct MSAA swapchain pass",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      previewSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "preview should sample the resized resolved MSAA target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "screen clear sample should stay outside the resized resolved preview quad",
  ).toBeLessThan(12);
  expect(
    pixelDistance(currentSample.pixel, previewSample.pixel),
    "current-texture sample and resized resolved preview should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(previewSample.pixel, screenClearSample.pixel),
    "resized resolved preview should differ from the screen clear color",
  ).toBeGreaterThan(40);
});

test("dual-size render-target route preserves distinct preview aspect", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/render-target-dual-size.html",
    "render-target-dual-size-status",
  );

  if (status === undefined) {
    return;
  }

  const primaryKey = status.renderTarget?.key ?? "__missing-primary__";
  const secondaryKey =
    status.scene?.secondaryRenderTargetKey ?? "__missing-secondary__";

  expect(primaryKey).not.toBe("__missing-primary__");
  expect(secondaryKey).not.toBe("__missing-secondary__");
  expect(primaryKey).not.toBe(secondaryKey);

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-target-dual-size",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      key: primaryKey,
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey: primaryKey,
      expectedRenderTargetKey: primaryKey,
      renderTargetMatches: true,
    },
    dualSizeRenderTargets: {
      mode: "dual-size-offscreen-render-target-previews",
      source: "ViewPacket.renderTarget",
      renderTargets: [
        {
          role: "primary",
          key: primaryKey,
          source: "offscreen",
          viewId: 0,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "left-target-preview-center",
          displayQuad: {
            role: "primary",
            renderTargetKey: primaryKey,
            sampleId: "left-target-preview-center",
            vertexCount: 6,
            widthNdc: 0.585,
            heightNdc: 1.04,
            aspect: {
              targetWidth: 256,
              targetHeight: 256,
              targetAspectRatio: 1,
              preservesAspect: true,
              mapping: "preserve-target-aspect",
            },
          },
          aspect: {
            targetWidth: 256,
            targetHeight: 256,
            targetAspectRatio: 1,
            preservesAspect: true,
            mapping: "preserve-target-aspect",
          },
        },
        {
          role: "secondary",
          key: secondaryKey,
          source: "offscreen",
          viewId: 1,
          width: 384,
          height: 192,
          ok: true,
          drawCalls: 1,
          displaySample: "right-target-preview-center",
          displayQuad: {
            role: "secondary",
            renderTargetKey: secondaryKey,
            sampleId: "right-target-preview-center",
            vertexCount: 6,
            widthNdc: 0.9,
            heightNdc: 0.8,
            aspect: {
              targetWidth: 384,
              targetHeight: 192,
              targetAspectRatio: 2,
              displayAspectRatio: 2,
              preservesAspect: true,
              mapping: "preserve-target-aspect",
            },
          },
          aspect: {
            targetWidth: 384,
            targetHeight: 192,
            targetAspectRatio: 2,
            displayAspectRatio: 2,
            preservesAspect: true,
            mapping: "preserve-target-aspect",
          },
        },
      ],
      views: [
        {
          viewId: 0,
          priority: 0,
          layerMask: 1,
          target: "offscreen",
          renderTargetKey: primaryKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          viewId: 1,
          priority: 1,
          layerMask: 2,
          target: "offscreen",
          renderTargetKey: secondaryKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
      ],
      passOrder: [
        {
          index: 0,
          viewId: 0,
          source: "offscreen",
          renderTargetKey: primaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
        },
        {
          index: 1,
          viewId: 1,
          source: "offscreen",
          renderTargetKey: secondaryKey,
          width: 384,
          height: 192,
          drawCalls: 1,
          ok: true,
        },
      ],
      displayPass: {
        loadOp: "clear",
        drawCalls: 2,
        samples: {
          leftPreview: "left-target-preview-center",
          rightPreview: "right-target-preview-center",
          screenClear: "screen-clear-corner",
        },
      },
    },
    counts: {
      views: 2,
      meshDraws: 2,
      drawCalls: 2,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 2,
      loadOp: "clear",
      samples: {
        leftPreview: "left-target-preview-center",
        rightPreview: "right-target-preview-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey: primaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
    {
      source: "offscreen",
      renderTargetKey: secondaryKey,
      width: 384,
      height: 192,
      ok: true,
      drawCalls: 1,
    },
  ]);
  guard.expectNoWarnings();

  const primaryAspect =
    status.dualSizeRenderTargets?.renderTargets?.find(
      (target) => target.role === "primary",
    )?.aspect ?? null;
  const secondaryAspect =
    status.dualSizeRenderTargets?.renderTargets?.find(
      (target) => target.role === "secondary",
    )?.aspect ?? null;

  expect(primaryAspect?.displayAspectRatio).toBeCloseTo(1, 2);
  expect(secondaryAspect?.displayAspectRatio).toBeCloseTo(2, 2);
  expect(primaryAspect?.preservesAspect).toBe(true);
  expect(secondaryAspect?.preservesAspect).toBe(true);

  await attachExampleStatus("render-target-dual-size-rendered-status", status);

  if (!status.readback?.ok) {
    test.skip(
      true,
      "Dual-size render-target pixel assertion requires readback.",
    );
    return;
  }

  const leftSample = status.readback.samples?.find(
    (entry) => entry.id === "left-target-preview-center",
  );
  const rightSample = status.readback.samples?.find(
    (entry) => entry.id === "right-target-preview-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(
    leftSample,
    "expected primary render-target preview sample",
  ).toBeDefined();
  expect(
    rightSample,
    "expected secondary render-target preview sample",
  ).toBeDefined();
  expect(screenClearSample, "expected screen clear sample").toBeDefined();

  if (
    leftSample === undefined ||
    rightSample === undefined ||
    screenClearSample === undefined
  ) {
    return;
  }

  expect(
    pixelDistance(
      leftSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "left preview should sample the square primary off-screen render target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      rightSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCanvasColor ?? {
          r: 0.1,
          g: 0.42,
          b: 0.95,
          a: 1,
        },
      ),
    ),
    "right preview should sample the wide secondary off-screen render target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "screen clear sample should stay outside both preview quads",
  ).toBeLessThan(12);
  expect(
    pixelDistance(leftSample.pixel, rightSample.pixel),
    "dual-size previews should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(leftSample.pixel, screenClearSample.pixel),
    "square preview should differ from the main-canvas clear region",
  ).toBeGreaterThan(40);
  expect(
    pixelDistance(rightSample.pixel, screenClearSample.pixel),
    "wide preview should differ from the main-canvas clear region",
  ).toBeGreaterThan(40);
});

test("MSAA render-target route resolves the off-screen preview texture", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/render-target-msaa.html",
    "render-target-msaa-status",
  );

  if (status === undefined) {
    return;
  }

  const renderTargetKey = status.renderTarget?.key;

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-target-msaa",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey,
      expectedRenderTargetKey: renderTargetKey,
      renderTargetMatches: true,
    },
    msaaRenderTarget: {
      mode: "msaa-offscreen-render-target-preview",
      source: "ViewPacket.renderTarget",
      renderTargetKey,
      requestedSampleCount: 8,
      sampleCount: 4,
      enabled: true,
      clamped: true,
      supportedSampleCounts: [1, 4],
      colorTargets: 1,
      colorTexturesCreated: 1,
      colorTexturesReused: 0,
      target: {
        source: "offscreen",
        width: 256,
        height: 256,
        drawCalls: 1,
        msaaSampleCount: 4,
        ok: true,
      },
      attachment: {
        colorLoadOp: "clear",
        colorStoreOp: "discard",
        resolveTarget: true,
      },
      displayPass: {
        loadOp: "clear",
        drawCalls: 1,
        samples: {
          preview: "quad-center",
          screenClear: "screen-clear-corner",
        },
      },
    },
    counts: {
      views: 1,
      meshDraws: 1,
      drawCalls: 1,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 1,
      loadOp: "clear",
      samples: {
        preview: "quad-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus("render-target-msaa-rendered-status", status);

  if (!status.readback?.ok) {
    test.skip(true, "MSAA render-target pixel assertion requires readback.");
    return;
  }

  const previewSample = status.readback.samples?.find(
    (entry) => entry.id === "quad-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(
    previewSample,
    "expected resolved render-target preview sample",
  ).toBeDefined();
  expect(screenClearSample, "expected screen clear sample").toBeDefined();

  if (previewSample === undefined || screenClearSample === undefined) {
    return;
  }

  expect(
    pixelDistance(
      previewSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "MSAA preview should sample the resolved off-screen render target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "screen clear sample should stay outside the displayed preview quad",
  ).toBeLessThan(12);
  expect(
    pixelDistance(previewSample.pixel, screenClearSample.pixel),
    "resolved MSAA preview should differ from the main-canvas clear region",
  ).toBeGreaterThan(40);
});

test("MSAA two-target render-target route resolves both off-screen previews", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/render-target-msaa-two-targets.html",
    "render-target-msaa-two-targets-status",
  );

  if (status === undefined) {
    return;
  }

  const primaryKey = status.renderTarget?.key ?? "__missing-primary__";
  const secondaryKey =
    status.scene?.secondaryRenderTargetKey ?? "__missing-secondary__";

  expect(primaryKey).not.toBe("__missing-primary__");
  expect(secondaryKey).not.toBe("__missing-secondary__");
  expect(primaryKey).not.toBe(secondaryKey);

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-target-msaa-two-targets",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      key: primaryKey,
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey: primaryKey,
      expectedRenderTargetKey: primaryKey,
      renderTargetMatches: true,
    },
    msaaMultiRenderTargets: {
      mode: "msaa-two-offscreen-render-target-previews",
      source: "ViewPacket.renderTarget",
      requestedSampleCount: 8,
      sampleCount: 4,
      enabled: true,
      clamped: true,
      supportedSampleCounts: [1, 4],
      colorTargets: 2,
      colorTexturesCreated: 2,
      colorTexturesReused: 0,
      renderTargets: [
        {
          role: "primary",
          key: primaryKey,
          source: "offscreen",
          viewId: 0,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "left-target-preview-center",
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
          displayQuad: {
            role: "primary",
            renderTargetKey: primaryKey,
            sampleId: "left-target-preview-center",
            vertexCount: 6,
          },
        },
        {
          role: "secondary",
          key: secondaryKey,
          source: "offscreen",
          viewId: 1,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "right-target-preview-center",
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
          displayQuad: {
            role: "secondary",
            renderTargetKey: secondaryKey,
            sampleId: "right-target-preview-center",
            vertexCount: 6,
          },
        },
      ],
      views: [
        {
          viewId: 0,
          priority: 0,
          layerMask: 1,
          target: "offscreen",
          renderTargetKey: primaryKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          viewId: 1,
          priority: 1,
          layerMask: 2,
          target: "offscreen",
          renderTargetKey: secondaryKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
      ],
      passOrder: [
        {
          index: 0,
          viewId: 0,
          source: "offscreen",
          renderTargetKey: primaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
        },
        {
          index: 1,
          viewId: 1,
          source: "offscreen",
          renderTargetKey: secondaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
        },
      ],
      displayPass: {
        loadOp: "clear",
        drawCalls: 2,
        samples: {
          leftPreview: "left-target-preview-center",
          rightPreview: "right-target-preview-center",
          screenClear: "screen-clear-corner",
        },
      },
    },
    counts: {
      views: 2,
      meshDraws: 2,
      drawCalls: 2,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 2,
      loadOp: "clear",
      samples: {
        leftPreview: "left-target-preview-center",
        rightPreview: "right-target-preview-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey: primaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
    {
      source: "offscreen",
      renderTargetKey: secondaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus(
    "render-target-msaa-two-targets-rendered-status",
    status,
  );

  if (!status.readback?.ok) {
    test.skip(
      true,
      "MSAA two-target render-target pixel assertion requires readback.",
    );
    return;
  }

  const leftSample = status.readback.samples?.find(
    (entry) => entry.id === "left-target-preview-center",
  );
  const rightSample = status.readback.samples?.find(
    (entry) => entry.id === "right-target-preview-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(
    leftSample,
    "expected primary resolved render-target preview sample",
  ).toBeDefined();
  expect(
    rightSample,
    "expected secondary resolved render-target preview sample",
  ).toBeDefined();
  expect(screenClearSample, "expected screen clear sample").toBeDefined();

  if (
    leftSample === undefined ||
    rightSample === undefined ||
    screenClearSample === undefined
  ) {
    return;
  }

  expect(
    pixelDistance(
      leftSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "left preview should sample the resolved primary MSAA target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      rightSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCanvasColor ?? {
          r: 0.1,
          g: 0.42,
          b: 0.95,
          a: 1,
        },
      ),
    ),
    "right preview should sample the resolved secondary MSAA target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "screen clear sample should stay outside both resolved preview quads",
  ).toBeLessThan(12);
  expect(
    pixelDistance(leftSample.pixel, rightSample.pixel),
    "resolved MSAA target previews should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(leftSample.pixel, screenClearSample.pixel),
    "primary resolved preview should differ from the main-canvas clear region",
  ).toBeGreaterThan(40);
  expect(
    pixelDistance(rightSample.pixel, screenClearSample.pixel),
    "secondary resolved preview should differ from the main-canvas clear region",
  ).toBeGreaterThan(40);
});

test("MSAA cropped secondary render-target route resolves primary and cropped secondary regions", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/render-target-msaa-secondary-crop.html",
    "render-target-msaa-secondary-crop-status",
  );

  if (status === undefined) {
    return;
  }

  const primaryKey = status.renderTarget?.key ?? "__missing-primary__";
  const secondaryKey =
    status.scene?.secondaryRenderTargetKey ?? "__missing-secondary__";

  expect(primaryKey).not.toBe("__missing-primary__");
  expect(secondaryKey).not.toBe("__missing-secondary__");
  expect(primaryKey).not.toBe(secondaryKey);

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-target-msaa-secondary-crop",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      key: primaryKey,
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey: primaryKey,
      expectedRenderTargetKey: primaryKey,
      renderTargetMatches: true,
    },
    msaaCroppedSecondaryRenderTargets: {
      mode: "msaa-cropped-secondary-offscreen-render-target-previews",
      source: "ViewPacket.renderTarget",
      requestedSampleCount: 8,
      sampleCount: 4,
      enabled: true,
      clamped: true,
      supportedSampleCounts: [1, 4],
      colorTargets: 2,
      colorTexturesCreated: 2,
      colorTexturesReused: 0,
      renderTargets: [
        {
          role: "primary",
          key: primaryKey,
          source: "offscreen",
          viewId: 0,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "left-target-preview-center",
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
          displayQuad: {
            role: "primary",
            renderTargetKey: primaryKey,
            sampleId: "left-target-preview-center",
            vertexCount: 6,
            widthNdc: 0.7,
            heightNdc: 1.16,
          },
        },
        {
          role: "secondary",
          key: secondaryKey,
          source: "offscreen",
          viewId: 1,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "secondary-crop-inside",
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
          displayQuad: {
            role: "secondary",
            renderTargetKey: secondaryKey,
            sampleId: "secondary-crop-inside",
            vertexCount: 6,
            widthNdc: 0.7,
            heightNdc: 1.16,
          },
        },
      ],
      views: [
        {
          role: "primary",
          viewId: 0,
          priority: 0,
          layerMask: 1,
          target: "offscreen",
          renderTargetKey: primaryKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          role: "secondary",
          viewId: 1,
          priority: 1,
          layerMask: 2,
          target: "offscreen",
          renderTargetKey: secondaryKey,
        },
      ],
      secondaryCrop: {
        renderTargetKey: secondaryKey,
        expectedNormalizedRect: [0.3, 0.25, 0.4, 0.5],
        viewportPixels: {
          x: 77,
          y: 64,
          width: 102,
          height: 128,
        },
        scissorPixels: {
          x: 77,
          y: 64,
          width: 102,
          height: 128,
        },
        diagnostics: [],
        insideSample: "secondary-crop-inside",
        outsideSample: "secondary-crop-outside",
      },
      passOrder: [
        {
          index: 0,
          viewId: 0,
          source: "offscreen",
          renderTargetKey: primaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
        },
        {
          index: 1,
          viewId: 1,
          source: "offscreen",
          renderTargetKey: secondaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
        },
      ],
      displayPass: {
        loadOp: "clear",
        drawCalls: 2,
        samples: {
          leftPreview: "left-target-preview-center",
          secondaryInside: "secondary-crop-inside",
          secondaryOutside: "secondary-crop-outside",
          screenClear: "screen-clear-corner",
        },
      },
    },
    counts: {
      views: 2,
      meshDraws: 2,
      drawCalls: 2,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 2,
      loadOp: "clear",
      samples: {
        leftPreview: "left-target-preview-center",
        secondaryInside: "secondary-crop-inside",
        secondaryOutside: "secondary-crop-outside",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey: primaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
    {
      source: "offscreen",
      renderTargetKey: secondaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
  ]);
  const secondaryView =
    status.msaaCroppedSecondaryRenderTargets?.views?.find(
      (view) => view.role === "secondary",
    ) ?? null;

  expectNormalizedRect(secondaryView?.viewport, [0.3, 0.25, 0.4, 0.5]);
  expectNormalizedRect(secondaryView?.scissor, [0.3, 0.25, 0.4, 0.5]);
  expectNormalizedRect(
    status.msaaCroppedSecondaryRenderTargets?.secondaryCrop
      ?.expectedNormalizedRect,
    [0.3, 0.25, 0.4, 0.5],
  );
  guard.expectNoWarnings();

  await attachExampleStatus(
    "render-target-msaa-secondary-crop-rendered-status",
    status,
  );

  if (!status.readback?.ok) {
    test.skip(
      true,
      "MSAA cropped secondary render-target pixel assertion requires readback.",
    );
    return;
  }

  const leftSample = status.readback.samples?.find(
    (entry) => entry.id === "left-target-preview-center",
  );
  const secondaryInsideSample = status.readback.samples?.find(
    (entry) => entry.id === "secondary-crop-inside",
  );
  const secondaryOutsideSample = status.readback.samples?.find(
    (entry) => entry.id === "secondary-crop-outside",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(
    leftSample,
    "expected primary resolved render-target preview sample",
  ).toBeDefined();
  expect(
    secondaryInsideSample,
    "expected resolved secondary inside-crop preview sample",
  ).toBeDefined();
  expect(
    secondaryOutsideSample,
    "expected resolved secondary outside-crop preview sample",
  ).toBeDefined();
  expect(screenClearSample, "expected screen clear sample").toBeDefined();

  if (
    leftSample === undefined ||
    secondaryInsideSample === undefined ||
    secondaryOutsideSample === undefined ||
    screenClearSample === undefined
  ) {
    return;
  }

  expect(
    pixelDistance(
      leftSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "primary preview should sample the resolved full off-screen MSAA target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      secondaryInsideSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCanvasColor ?? {
          r: 0.1,
          g: 0.42,
          b: 0.95,
          a: 1,
        },
      ),
    ),
    "secondary inside-crop sample should come from the resolved secondary MSAA target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      secondaryOutsideSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.offscreen ?? {
          r: 0.02,
          g: 0.035,
          b: 0.07,
          a: 1,
        },
      ),
    ),
    "secondary outside-crop sample should remain the resolved target clear color",
  ).toBeLessThan(12);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "screen clear sample should stay outside both resolved preview quads",
  ).toBeLessThan(12);
  expect(
    pixelDistance(leftSample.pixel, secondaryInsideSample.pixel),
    "resolved primary and secondary cropped previews should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(secondaryInsideSample.pixel, secondaryOutsideSample.pixel),
    "resolved secondary cropped render target should differ inside and outside the viewport",
  ).toBeGreaterThan(40);
});

test("cropped secondary render-target route preserves primary and secondary target regions", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/render-target-secondary-crop.html",
    "render-target-secondary-crop-status",
  );

  if (status === undefined) {
    return;
  }

  const primaryKey = status.renderTarget?.key ?? "__missing-primary__";
  const secondaryKey =
    status.scene?.secondaryRenderTargetKey ?? "__missing-secondary__";

  expect(primaryKey).not.toBe("__missing-primary__");
  expect(secondaryKey).not.toBe("__missing-secondary__");
  expect(primaryKey).not.toBe(secondaryKey);

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-target-secondary-crop",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      key: primaryKey,
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey: primaryKey,
      expectedRenderTargetKey: primaryKey,
      renderTargetMatches: true,
    },
    croppedSecondaryRenderTargets: {
      mode: "cropped-secondary-offscreen-render-target-previews",
      source: "ViewPacket.renderTarget",
      renderTargets: [
        {
          role: "primary",
          key: primaryKey,
          source: "offscreen",
          viewId: 0,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "left-target-preview-center",
          displayQuad: {
            role: "primary",
            renderTargetKey: primaryKey,
            sampleId: "left-target-preview-center",
            vertexCount: 6,
            widthNdc: 0.7,
            heightNdc: 1.16,
          },
        },
        {
          role: "secondary",
          key: secondaryKey,
          source: "offscreen",
          viewId: 1,
          width: 256,
          height: 256,
          ok: true,
          drawCalls: 1,
          displaySample: "secondary-crop-inside",
          displayQuad: {
            role: "secondary",
            renderTargetKey: secondaryKey,
            sampleId: "secondary-crop-inside",
            vertexCount: 6,
            widthNdc: 0.7,
            heightNdc: 1.16,
          },
        },
      ],
      views: [
        {
          role: "primary",
          viewId: 0,
          priority: 0,
          layerMask: 1,
          target: "offscreen",
          renderTargetKey: primaryKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          role: "secondary",
          viewId: 1,
          priority: 1,
          layerMask: 2,
          target: "offscreen",
          renderTargetKey: secondaryKey,
        },
      ],
      secondaryCrop: {
        renderTargetKey: secondaryKey,
        expectedNormalizedRect: [0.3, 0.25, 0.4, 0.5],
        viewportPixels: {
          x: 77,
          y: 64,
          width: 102,
          height: 128,
        },
        scissorPixels: {
          x: 77,
          y: 64,
          width: 102,
          height: 128,
        },
        diagnostics: [],
        insideSample: "secondary-crop-inside",
        outsideSample: "secondary-crop-outside",
      },
      passOrder: [
        {
          index: 0,
          viewId: 0,
          source: "offscreen",
          renderTargetKey: primaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
        },
        {
          index: 1,
          viewId: 1,
          source: "offscreen",
          renderTargetKey: secondaryKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
        },
      ],
      displayPass: {
        loadOp: "clear",
        drawCalls: 2,
        samples: {
          leftPreview: "left-target-preview-center",
          secondaryInside: "secondary-crop-inside",
          secondaryOutside: "secondary-crop-outside",
          screenClear: "screen-clear-corner",
        },
      },
    },
    counts: {
      views: 2,
      meshDraws: 2,
      drawCalls: 2,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 2,
      loadOp: "clear",
      samples: {
        leftPreview: "left-target-preview-center",
        secondaryInside: "secondary-crop-inside",
        secondaryOutside: "secondary-crop-outside",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey: primaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
    {
      source: "offscreen",
      renderTargetKey: secondaryKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
  ]);
  const secondaryView =
    status.croppedSecondaryRenderTargets?.views?.find(
      (view) => view.role === "secondary",
    ) ?? null;

  expectNormalizedRect(secondaryView?.viewport, [0.3, 0.25, 0.4, 0.5]);
  expectNormalizedRect(secondaryView?.scissor, [0.3, 0.25, 0.4, 0.5]);
  expectNormalizedRect(
    status.croppedSecondaryRenderTargets?.secondaryCrop?.expectedNormalizedRect,
    [0.3, 0.25, 0.4, 0.5],
  );
  guard.expectNoWarnings();

  await attachExampleStatus(
    "render-target-secondary-crop-rendered-status",
    status,
  );

  if (!status.readback?.ok) {
    test.skip(
      true,
      "Cropped secondary render-target pixel assertion requires readback.",
    );
    return;
  }

  const leftSample = status.readback.samples?.find(
    (entry) => entry.id === "left-target-preview-center",
  );
  const secondaryInsideSample = status.readback.samples?.find(
    (entry) => entry.id === "secondary-crop-inside",
  );
  const secondaryOutsideSample = status.readback.samples?.find(
    (entry) => entry.id === "secondary-crop-outside",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(
    leftSample,
    "expected primary render-target preview sample",
  ).toBeDefined();
  expect(
    secondaryInsideSample,
    "expected secondary inside-crop preview sample",
  ).toBeDefined();
  expect(
    secondaryOutsideSample,
    "expected secondary outside-crop preview sample",
  ).toBeDefined();
  expect(screenClearSample, "expected screen clear sample").toBeDefined();

  if (
    leftSample === undefined ||
    secondaryInsideSample === undefined ||
    secondaryOutsideSample === undefined ||
    screenClearSample === undefined
  ) {
    return;
  }

  expect(
    pixelDistance(
      leftSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "primary preview should sample the full off-screen render target",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      secondaryInsideSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCanvasColor ?? {
          r: 0.1,
          g: 0.42,
          b: 0.95,
          a: 1,
        },
      ),
    ),
    "secondary inside-crop sample should come from the secondary camera",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      secondaryOutsideSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.offscreen ?? {
          r: 0.02,
          g: 0.035,
          b: 0.07,
          a: 1,
        },
      ),
    ),
    "secondary outside-crop sample should remain the target clear color",
  ).toBeLessThan(12);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "screen clear sample should stay outside both preview quads",
  ).toBeLessThan(12);
  expect(
    pixelDistance(leftSample.pixel, secondaryInsideSample.pixel),
    "primary and secondary cropped previews should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(secondaryInsideSample.pixel, secondaryOutsideSample.pixel),
    "secondary cropped render target should differ inside and outside the viewport",
  ).toBeGreaterThan(40);
});

test("render-target viewport crop route keeps outside target pixels clear", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/render-target-viewport-crop.html",
    "render-target-viewport-crop-status",
  );

  if (status === undefined) {
    return;
  }

  const renderTargetKey = status.renderTarget?.key;

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-target-viewport-crop",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey,
      expectedRenderTargetKey: renderTargetKey,
      renderTargetMatches: true,
    },
    offscreenTargetCrop: {
      mode: "offscreen-render-target-viewport-crop",
      source: "ViewPacket.renderTarget",
      renderTargetKey,
      target: {
        source: "offscreen",
        width: 256,
        height: 256,
        drawCalls: 1,
        ok: true,
      },
      view: {
        viewId: 0,
        priority: 0,
        layerMask: 1,
        expectedNormalizedRect: [0.3, 0.25, 0.4, 0.5],
      },
      viewportPixels: {
        x: 77,
        y: 64,
        width: 102,
        height: 128,
      },
      scissorPixels: {
        x: 77,
        y: 64,
        width: 102,
        height: 128,
      },
      diagnostics: [],
      displayPass: {
        loadOp: "clear",
        drawCalls: 1,
        samples: {
          insideTarget: "offscreen-crop-inside",
          outsideTarget: "offscreen-crop-outside",
          screenClear: "screen-clear-corner",
        },
      },
    },
    counts: {
      views: 1,
      meshDraws: 1,
      drawCalls: 1,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 1,
      loadOp: "clear",
      samples: {
        insideTarget: "offscreen-crop-inside",
        outsideTarget: "offscreen-crop-outside",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
  ]);
  expectNormalizedRect(status.sourceView?.viewport, [0.3, 0.25, 0.4, 0.5]);
  expectNormalizedRect(status.sourceView?.scissor, [0.3, 0.25, 0.4, 0.5]);
  expectNormalizedRect(
    status.offscreenTargetCrop?.view?.viewport,
    [0.3, 0.25, 0.4, 0.5],
  );
  expectNormalizedRect(
    status.offscreenTargetCrop?.view?.scissor,
    [0.3, 0.25, 0.4, 0.5],
  );
  guard.expectNoWarnings();

  await attachExampleStatus(
    "render-target-viewport-crop-rendered-status",
    status,
  );

  if (!status.readback?.ok) {
    test.skip(
      true,
      "Render-target viewport crop pixel assertion requires readback.",
    );
    return;
  }

  const insideSample = status.readback.samples?.find(
    (entry) => entry.id === "offscreen-crop-inside",
  );
  const outsideSample = status.readback.samples?.find(
    (entry) => entry.id === "offscreen-crop-outside",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(insideSample, "expected inside cropped-target sample").toBeDefined();
  expect(outsideSample, "expected outside cropped-target sample").toBeDefined();
  expect(screenClearSample, "expected screen clear sample").toBeDefined();

  if (
    insideSample === undefined ||
    outsideSample === undefined ||
    screenClearSample === undefined
  ) {
    return;
  }

  expect(
    pixelDistance(
      insideSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "inside crop sample should come from the rendered off-screen viewport",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      outsideSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.offscreen ?? {
          r: 0.02,
          g: 0.035,
          b: 0.07,
          a: 1,
        },
      ),
    ),
    "outside crop sample should remain the off-screen target clear color",
  ).toBeLessThan(12);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "screen clear sample should stay outside the displayed preview quad",
  ).toBeLessThan(12);
  expect(
    pixelDistance(insideSample.pixel, outsideSample.pixel),
    "cropped render target should differ inside and outside the viewport",
  ).toBeGreaterThan(40);
});

test("MSAA render-target viewport crop route keeps outside target pixels clear", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/render-target-msaa-viewport-crop.html",
    "render-target-msaa-viewport-crop-status",
  );

  if (status === undefined) {
    return;
  }

  const renderTargetKey = status.renderTarget?.key;

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-target-msaa-viewport-crop",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey,
      expectedRenderTargetKey: renderTargetKey,
      renderTargetMatches: true,
    },
    offscreenTargetCrop: {
      mode: "offscreen-render-target-viewport-crop",
      source: "ViewPacket.renderTarget",
      renderTargetKey,
      target: {
        source: "offscreen",
        width: 256,
        height: 256,
        drawCalls: 1,
        msaaSampleCount: 4,
        ok: true,
      },
      requestedSampleCount: 8,
      sampleCount: 4,
      enabled: true,
      clamped: true,
      supportedSampleCounts: [1, 4],
      colorTargets: 1,
      colorTexturesCreated: 1,
      colorTexturesReused: 0,
      attachment: {
        colorLoadOp: "clear",
        colorStoreOp: "discard",
        resolveTarget: true,
        behavior: "resolve-to-render-target-texture",
      },
      view: {
        viewId: 0,
        priority: 0,
        layerMask: 1,
        expectedNormalizedRect: [0.3, 0.25, 0.4, 0.5],
      },
      viewportPixels: {
        x: 77,
        y: 64,
        width: 102,
        height: 128,
      },
      scissorPixels: {
        x: 77,
        y: 64,
        width: 102,
        height: 128,
      },
      diagnostics: [],
      displayPass: {
        loadOp: "clear",
        drawCalls: 1,
        samples: {
          insideTarget: "offscreen-crop-inside",
          outsideTarget: "offscreen-crop-outside",
          screenClear: "screen-clear-corner",
        },
      },
    },
    counts: {
      views: 1,
      meshDraws: 1,
      drawCalls: 1,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 1,
      loadOp: "clear",
      samples: {
        insideTarget: "offscreen-crop-inside",
        outsideTarget: "offscreen-crop-outside",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
  ]);
  expectNormalizedRect(status.sourceView?.viewport, [0.3, 0.25, 0.4, 0.5]);
  expectNormalizedRect(status.sourceView?.scissor, [0.3, 0.25, 0.4, 0.5]);
  expectNormalizedRect(
    status.offscreenTargetCrop?.view?.viewport,
    [0.3, 0.25, 0.4, 0.5],
  );
  expectNormalizedRect(
    status.offscreenTargetCrop?.view?.scissor,
    [0.3, 0.25, 0.4, 0.5],
  );
  guard.expectNoWarnings();

  await attachExampleStatus(
    "render-target-msaa-viewport-crop-rendered-status",
    status,
  );

  if (!status.readback?.ok) {
    test.skip(
      true,
      "MSAA render-target viewport crop pixel assertion requires readback.",
    );
    return;
  }

  const insideSample = status.readback.samples?.find(
    (entry) => entry.id === "offscreen-crop-inside",
  );
  const outsideSample = status.readback.samples?.find(
    (entry) => entry.id === "offscreen-crop-outside",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(
    insideSample,
    "expected MSAA inside cropped-target sample",
  ).toBeDefined();
  expect(
    outsideSample,
    "expected MSAA outside cropped-target sample",
  ).toBeDefined();
  expect(screenClearSample, "expected MSAA screen clear sample").toBeDefined();

  if (
    insideSample === undefined ||
    outsideSample === undefined ||
    screenClearSample === undefined
  ) {
    return;
  }

  expect(
    pixelDistance(
      insideSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "MSAA inside crop sample should come from the rendered off-screen viewport",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      outsideSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.offscreen ?? {
          r: 0.02,
          g: 0.035,
          b: 0.07,
          a: 1,
        },
      ),
    ),
    "MSAA outside crop sample should remain the off-screen target clear color",
  ).toBeLessThan(12);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "MSAA screen clear sample should stay outside the displayed preview quad",
  ).toBeLessThan(12);
  expect(
    pixelDistance(insideSample.pixel, outsideSample.pixel),
    "MSAA cropped render target should differ inside and outside the viewport",
  ).toBeGreaterThan(40);
});

test("same render-target clear/load route preserves base and overlay regions", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/render-target-clear-load.html",
    "render-target-clear-load-status",
  );

  if (status === undefined) {
    return;
  }

  const renderTargetKey = status.renderTarget?.key;

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-target-clear-load",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey,
      expectedRenderTargetKey: renderTargetKey,
      renderTargetMatches: true,
    },
    sameRenderTargetClearLoad: {
      mode: "same-offscreen-render-target-clear-load",
      source: "ViewPacket.renderTarget",
      renderTargetKey,
      views: [
        {
          index: 0,
          role: "base",
          viewId: 0,
          priority: 0,
          layerMask: 1,
          target: "offscreen",
          renderTargetKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          index: 1,
          role: "overlay",
          viewId: 1,
          priority: 1,
          layerMask: 2,
          target: "offscreen",
          renderTargetKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
      ],
      passOrder: [
        {
          index: 0,
          role: "base",
          viewId: 0,
          source: "offscreen",
          renderTargetKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
          colorLoadOp: "clear",
          depthLoadOp: "clear",
          clearBehavior: "target-cleared-before-view",
        },
        {
          index: 1,
          role: "overlay",
          viewId: 1,
          source: "offscreen",
          renderTargetKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
          colorLoadOp: "load",
          depthLoadOp: "load",
          clearBehavior: "load-existing-target",
        },
      ],
      targetKeyReuse: {
        expectedRenderTargetKey: renderTargetKey,
        uniqueTargetKeys: [renderTargetKey],
        allPassesShareTargetKey: true,
        passCount: 2,
      },
      displayPass: {
        loadOp: "clear",
        drawCalls: 1,
        samples: {
          clearOnly: "offscreen-clear-only",
          basePreserved: "offscreen-base-preserved",
          overlay: "offscreen-overlay-center",
          screenClear: "screen-clear-corner",
        },
      },
    },
    counts: {
      views: 2,
      meshDraws: 2,
      drawCalls: 2,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 1,
      loadOp: "clear",
      samples: {
        clearOnly: "offscreen-clear-only",
        basePreserved: "offscreen-base-preserved",
        overlay: "offscreen-overlay-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
    {
      source: "offscreen",
      renderTargetKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus("render-target-clear-load-rendered-status", status);

  if (!status.readback?.ok) {
    test.skip(
      true,
      "Render-target clear/load pixel assertion requires readback.",
    );
    return;
  }

  const clearSample = status.readback.samples?.find(
    (entry) => entry.id === "offscreen-clear-only",
  );
  const baseSample = status.readback.samples?.find(
    (entry) => entry.id === "offscreen-base-preserved",
  );
  const overlaySample = status.readback.samples?.find(
    (entry) => entry.id === "offscreen-overlay-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(clearSample, "expected target clear-only sample").toBeDefined();
  expect(baseSample, "expected preserved base sample").toBeDefined();
  expect(overlaySample, "expected overlay sample").toBeDefined();
  expect(screenClearSample, "expected screen clear sample").toBeDefined();

  if (
    clearSample === undefined ||
    baseSample === undefined ||
    overlaySample === undefined ||
    screenClearSample === undefined
  ) {
    return;
  }

  expect(
    pixelDistance(
      clearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.offscreen ?? {
          r: 0.02,
          g: 0.035,
          b: 0.07,
          a: 1,
        },
      ),
    ),
    "clear-only sample should remain the off-screen target clear color",
  ).toBeLessThan(12);
  expect(
    pixelDistance(
      baseSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "base sample should survive the overlay camera load pass",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      overlaySample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCanvasColor ?? {
          r: 0.1,
          g: 0.42,
          b: 0.95,
          a: 1,
        },
      ),
    ),
    "overlay sample should come from the second same-target camera",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "screen clear sample should stay outside the displayed preview quad",
  ).toBeLessThan(12);
  expect(
    pixelDistance(baseSample.pixel, overlaySample.pixel),
    "base and overlay samples should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(baseSample.pixel, clearSample.pixel),
    "base sample should differ from target clear",
  ).toBeGreaterThan(40);
  expect(
    pixelDistance(overlaySample.pixel, clearSample.pixel),
    "overlay sample should differ from target clear",
  ).toBeGreaterThan(40);
});

test("MSAA same render-target clear/load route preserves resolved base and overlay regions", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/render-target-msaa-clear-load.html",
    "render-target-msaa-clear-load-status",
  );

  if (status === undefined) {
    return;
  }

  const renderTargetKey = status.renderTarget?.key;

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-target-msaa-clear-load",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey,
      expectedRenderTargetKey: renderTargetKey,
      renderTargetMatches: true,
    },
    sameRenderTargetClearLoad: {
      mode: "same-offscreen-render-target-clear-load",
      source: "ViewPacket.renderTarget",
      renderTargetKey,
      requestedSampleCount: 8,
      sampleCount: 4,
      enabled: true,
      clamped: true,
      supportedSampleCounts: [1, 4],
      colorTargets: 2,
      views: [
        {
          index: 0,
          role: "base",
          viewId: 0,
          priority: 0,
          layerMask: 1,
          target: "offscreen",
          renderTargetKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          index: 1,
          role: "overlay",
          viewId: 1,
          priority: 1,
          layerMask: 2,
          target: "offscreen",
          renderTargetKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
      ],
      passOrder: [
        {
          index: 0,
          role: "base",
          viewId: 0,
          source: "offscreen",
          renderTargetKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
          colorLoadOp: "clear",
          depthLoadOp: "clear",
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "store",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
          clearBehavior: "target-cleared-before-view",
        },
        {
          index: 1,
          role: "overlay",
          viewId: 1,
          source: "offscreen",
          renderTargetKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
          colorLoadOp: "load",
          depthLoadOp: "load",
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "load",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
          clearBehavior: "load-existing-target",
        },
      ],
      targetKeyReuse: {
        expectedRenderTargetKey: renderTargetKey,
        uniqueTargetKeys: [renderTargetKey],
        allPassesShareTargetKey: true,
        passCount: 2,
      },
      displayPass: {
        loadOp: "clear",
        drawCalls: 1,
        samples: {
          clearOnly: "offscreen-clear-only",
          basePreserved: "offscreen-base-preserved",
          overlay: "offscreen-overlay-center",
          screenClear: "screen-clear-corner",
        },
      },
    },
    counts: {
      views: 2,
      meshDraws: 2,
      drawCalls: 2,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 1,
      loadOp: "clear",
      samples: {
        clearOnly: "offscreen-clear-only",
        basePreserved: "offscreen-base-preserved",
        overlay: "offscreen-overlay-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
    {
      source: "offscreen",
      renderTargetKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus(
    "render-target-msaa-clear-load-rendered-status",
    status,
  );

  if (!status.readback?.ok) {
    test.skip(
      true,
      "MSAA render-target clear/load pixel assertion requires readback.",
    );
    return;
  }

  const clearSample = status.readback.samples?.find(
    (entry) => entry.id === "offscreen-clear-only",
  );
  const baseSample = status.readback.samples?.find(
    (entry) => entry.id === "offscreen-base-preserved",
  );
  const overlaySample = status.readback.samples?.find(
    (entry) => entry.id === "offscreen-overlay-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(clearSample, "expected MSAA target clear-only sample").toBeDefined();
  expect(baseSample, "expected MSAA preserved base sample").toBeDefined();
  expect(overlaySample, "expected MSAA overlay sample").toBeDefined();
  expect(screenClearSample, "expected MSAA screen clear sample").toBeDefined();

  if (
    clearSample === undefined ||
    baseSample === undefined ||
    overlaySample === undefined ||
    screenClearSample === undefined
  ) {
    return;
  }

  expect(
    pixelDistance(
      clearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.offscreen ?? {
          r: 0.02,
          g: 0.035,
          b: 0.07,
          a: 1,
        },
      ),
    ),
    "MSAA clear-only sample should remain the off-screen target clear color",
  ).toBeLessThan(12);
  expect(
    pixelDistance(
      baseSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "MSAA base sample should survive the overlay camera load pass",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      overlaySample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCanvasColor ?? {
          r: 0.1,
          g: 0.42,
          b: 0.95,
          a: 1,
        },
      ),
    ),
    "MSAA overlay sample should come from the second same-target camera",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "MSAA screen clear sample should stay outside the displayed preview quad",
  ).toBeLessThan(12);
  expect(
    pixelDistance(baseSample.pixel, overlaySample.pixel),
    "MSAA base and overlay samples should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(baseSample.pixel, clearSample.pixel),
    "MSAA base sample should differ from target clear",
  ).toBeGreaterThan(40);
  expect(
    pixelDistance(overlaySample.pixel, clearSample.pixel),
    "MSAA overlay sample should differ from target clear",
  ).toBeGreaterThan(40);
});

test("mixed MSAA same render-target clear/load route preserves current and resolved regions", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/mixed-msaa-clear-load.html",
    "mixed-msaa-clear-load-status",
  );

  if (status === undefined) {
    return;
  }

  const renderTargetKey = status.renderTarget?.key;

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "mixed-msaa-clear-load",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    sourceView: {
      ok: true,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      renderTargetKey,
      expectedRenderTargetKey: renderTargetKey,
      renderTargetMatches: true,
    },
    mixedMsaaSameTargetClearLoad: {
      mode: "current-texture-plus-msaa-same-offscreen-render-target-clear-load",
      source: "ViewPacket.renderTarget",
      renderTargetKey,
      requestedSampleCount: 8,
      sampleCount: 4,
      enabled: true,
      clamped: true,
      supportedSampleCounts: [1, 4],
      colorTargets: 3,
      colorTexturesCreated: 3,
      colorTexturesReused: 0,
      views: [
        {
          index: 0,
          role: "base",
          viewId: 0,
          priority: 0,
          layerMask: 1,
          target: "offscreen",
          renderTargetKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          index: 1,
          role: "overlay",
          viewId: 1,
          priority: 1,
          layerMask: 2,
          target: "offscreen",
          renderTargetKey,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
        {
          index: 2,
          role: "current",
          viewId: 2,
          priority: 2,
          layerMask: 4,
          target: "current-texture",
          renderTargetKey: null,
          viewport: [0, 0, 1, 1],
          scissor: [0, 0, 1, 1],
        },
      ],
      passOrder: [
        {
          index: 0,
          role: "base",
          viewId: 0,
          source: "offscreen",
          target: "offscreen",
          renderTargetKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
          colorLoadOp: "clear",
          depthLoadOp: "clear",
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "store",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
          clearBehavior: "target-cleared-before-view",
        },
        {
          index: 1,
          role: "overlay",
          viewId: 1,
          source: "offscreen",
          target: "offscreen",
          renderTargetKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          ok: true,
          colorLoadOp: "load",
          depthLoadOp: "load",
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "load",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
          clearBehavior: "load-existing-target",
        },
        {
          index: 2,
          role: "current",
          viewId: 2,
          source: "swapchain",
          target: "current-texture",
          renderTargetKey: null,
          width: 960,
          height: 540,
          drawCalls: 1,
          ok: true,
          colorLoadOp: "clear",
          depthLoadOp: "clear",
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
          clearBehavior: "current-texture-clear",
        },
      ],
      targetKeyReuse: {
        expectedRenderTargetKey: renderTargetKey,
        uniqueTargetKeys: [renderTargetKey],
        allPassesShareTargetKey: true,
        passCount: 2,
      },
      displayPass: {
        loadOp: "clear",
        drawCalls: 1,
        samples: {
          clearOnly: "offscreen-clear-only",
          basePreserved: "offscreen-base-preserved",
          overlay: "offscreen-overlay-center",
          screenClear: "screen-clear-corner",
        },
      },
      currentTextureReadback: {
        ok: true,
      },
    },
    counts: {
      views: 3,
      meshDraws: 3,
      drawCalls: 3,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 1,
      loadOp: "clear",
      samples: {
        clearOnly: "offscreen-clear-only",
        basePreserved: "offscreen-base-preserved",
        overlay: "offscreen-overlay-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
    {
      source: "offscreen",
      renderTargetKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
    {
      source: "swapchain",
      renderTargetKey: null,
      width: 960,
      height: 540,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus("mixed-msaa-clear-load-rendered-status", status);

  if (
    !status.readback?.ok ||
    !status.mixedMsaaSameTargetClearLoad?.currentTextureReadback?.ok
  ) {
    test.skip(true, "Mixed MSAA clear/load pixel assertion requires readback.");
    return;
  }

  const currentSample =
    status.mixedMsaaSameTargetClearLoad.currentTextureReadback.samples?.find(
      (entry) => entry.id === "current-texture-direct-left",
    );
  const clearSample = status.readback.samples?.find(
    (entry) => entry.id === "offscreen-clear-only",
  );
  const baseSample = status.readback.samples?.find(
    (entry) => entry.id === "offscreen-base-preserved",
  );
  const overlaySample = status.readback.samples?.find(
    (entry) => entry.id === "offscreen-overlay-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(currentSample, "expected current-texture sample").toBeDefined();
  expect(clearSample, "expected MSAA target clear-only sample").toBeDefined();
  expect(baseSample, "expected MSAA preserved base sample").toBeDefined();
  expect(overlaySample, "expected MSAA overlay sample").toBeDefined();
  expect(screenClearSample, "expected MSAA screen clear sample").toBeDefined();

  if (
    currentSample === undefined ||
    clearSample === undefined ||
    baseSample === undefined ||
    overlaySample === undefined ||
    screenClearSample === undefined
  ) {
    return;
  }

  expect(
    pixelDistance(
      currentSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCurrentColor ?? {
          r: 0.95,
          g: 0.28,
          b: 0.08,
          a: 1,
        },
      ),
    ),
    "current-texture sample should come from the direct MSAA swapchain pass",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      clearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.offscreen ?? {
          r: 0.02,
          g: 0.035,
          b: 0.07,
          a: 1,
        },
      ),
    ),
    "mixed MSAA clear-only sample should remain the off-screen target clear color",
  ).toBeLessThan(12);
  expect(
    pixelDistance(
      baseSample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "mixed MSAA base sample should survive the overlay load pass",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      overlaySample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCanvasColor ?? {
          r: 0.1,
          g: 0.42,
          b: 0.95,
          a: 1,
        },
      ),
    ),
    "mixed MSAA overlay sample should come from the second same-target camera",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      screenClearSample.pixel,
      rgbaColorToPixel(
        status.clearColors?.screen ?? {
          r: 0.015,
          g: 0.018,
          b: 0.023,
          a: 1,
        },
      ),
    ),
    "mixed MSAA screen clear sample should stay outside the displayed preview quad",
  ).toBeLessThan(12);
  expect(
    pixelDistance(currentSample.pixel, baseSample.pixel),
    "current-texture sample and preserved base sample should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(currentSample.pixel, overlaySample.pixel),
    "current-texture sample and overlay sample should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(baseSample.pixel, overlaySample.pixel),
    "mixed MSAA base and overlay samples should be visually distinct",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(baseSample.pixel, clearSample.pixel),
    "mixed MSAA base sample should differ from target clear",
  ).toBeGreaterThan(40);
  expect(
    pixelDistance(overlaySample.pixel, clearSample.pixel),
    "mixed MSAA overlay sample should differ from target clear",
  ).toBeGreaterThan(40);
});

test("render-target resize route displays the resized off-screen pass", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/render-target-resize.html",
    "render-target-resize-status",
  );

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-target-resize",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 384,
      height: 384,
      source: "ViewPacket.renderTarget",
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    renderTargetResize: {
      mode: "renderer-owned-render-target-resize",
      reason: "route-config-canvas-resize-simulation",
      renderTargetKey: status.renderTarget?.key,
      before: { width: 128, height: 128 },
      after: { width: 384, height: 384 },
      reusedHandle: true,
      textureRecreated: true,
      previousTextureDestroyed: true,
      staleSizeGuard: "source-assets-markReady-before-render",
    },
    sourceView: {
      ok: true,
      renderTargetKey: status.renderTarget?.key,
      expectedRenderTargetKey: status.renderTarget?.key,
      renderTargetMatches: true,
    },
    counts: {
      views: 1,
      meshDraws: 1,
      drawCalls: 1,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 1,
      samples: {
        preview: "quad-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey: status.renderTarget?.key,
      width: 384,
      height: 384,
      ok: true,
      drawCalls: 1,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus("render-target-resize-rendered-status", status);

  if (!status.readback?.ok) {
    test.skip(true, "Render-target resize pixel assertion requires readback.");
    return;
  }

  const sample = status.readback.samples?.find(
    (entry) => entry.id === "quad-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(sample, "expected resized render-target preview sample").toBeDefined();
  expect(
    screenClearSample,
    "expected resized route screen clear sample",
  ).toBeDefined();

  if (sample === undefined || screenClearSample === undefined) {
    return;
  }

  expect(
    pixelDistance(
      sample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "resized target preview should retain the rendered plane color",
  ).toBeLessThan(80);
  expect(
    pixelDistance(sample.pixel, screenClearSample.pixel),
    "resized target preview should differ from the main-canvas clear region",
  ).toBeGreaterThan(40);
});

test("MSAA render-target resize route resolves the resized off-screen pass", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/render-target-msaa-resize.html",
    "render-target-msaa-resize-status",
  );

  if (status === undefined) {
    return;
  }

  const renderTargetKey = status.renderTarget?.key;

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-target-msaa-resize",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 384,
      height: 384,
      source: "ViewPacket.renderTarget",
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    renderTargetResize: {
      mode: "renderer-owned-render-target-resize",
      reason: "route-config-canvas-resize-simulation",
      renderTargetKey,
      before: { width: 128, height: 128 },
      after: { width: 384, height: 384 },
      reusedHandle: true,
      textureRecreated: true,
      previousTextureDestroyed: true,
      staleSizeGuard: "source-assets-markReady-before-render",
      stableRenderTargetKey: true,
      msaaSampleCount: 4,
      attachment: {
        colorLoadOp: "clear",
        colorStoreOp: "discard",
        resolveTarget: true,
        behavior: "resolve-to-render-target-texture",
      },
      msaa: {
        mode: "msaa-resized-offscreen-render-target",
        requestedSampleCount: 8,
        sampleCount: 4,
        enabled: true,
        clamped: true,
        supportedSampleCounts: [1, 4],
        colorTargets: 1,
        colorTexturesCreated: 1,
        colorTexturesReused: 0,
        target: {
          source: "offscreen",
          width: 384,
          height: 384,
          drawCalls: 1,
          msaaSampleCount: 4,
          ok: true,
        },
        attachment: {
          colorLoadOp: "clear",
          colorStoreOp: "discard",
          resolveTarget: true,
          behavior: "resolve-to-render-target-texture",
        },
      },
    },
    sourceView: {
      ok: true,
      renderTargetKey,
      expectedRenderTargetKey: renderTargetKey,
      renderTargetMatches: true,
    },
    msaaRenderTarget: {
      mode: "msaa-offscreen-render-target-preview",
      source: "ViewPacket.renderTarget",
      renderTargetKey,
      requestedSampleCount: 8,
      sampleCount: 4,
      enabled: true,
      clamped: true,
      supportedSampleCounts: [1, 4],
      colorTargets: 1,
      colorTexturesCreated: 1,
      colorTexturesReused: 0,
      target: {
        source: "offscreen",
        width: 384,
        height: 384,
        drawCalls: 1,
        msaaSampleCount: 4,
        ok: true,
      },
      attachment: {
        colorLoadOp: "clear",
        colorStoreOp: "discard",
        resolveTarget: true,
      },
      displayPass: {
        loadOp: "clear",
        drawCalls: 1,
        samples: {
          preview: "quad-center",
          screenClear: "screen-clear-corner",
        },
      },
    },
    counts: {
      views: 1,
      meshDraws: 1,
      drawCalls: 1,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 1,
      samples: {
        preview: "quad-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey,
      width: 384,
      height: 384,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus(
    "render-target-msaa-resize-rendered-status",
    status,
  );

  if (!status.readback?.ok) {
    test.skip(
      true,
      "MSAA render-target resize pixel assertion requires readback.",
    );
    return;
  }

  const sample = status.readback.samples?.find(
    (entry) => entry.id === "quad-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(
    sample,
    "expected resolved resized render-target preview sample",
  ).toBeDefined();
  expect(
    screenClearSample,
    "expected MSAA resized route screen clear sample",
  ).toBeDefined();

  if (sample === undefined || screenClearSample === undefined) {
    return;
  }

  expect(
    pixelDistance(
      sample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "resolved resized target preview should retain the rendered plane color",
  ).toBeLessThan(80);
  expect(
    pixelDistance(sample.pixel, screenClearSample.pixel),
    "resolved resized target preview should differ from the main-canvas clear region",
  ).toBeGreaterThan(40);
});

test("render-target reuse route displays the second snapshot through one off-screen target", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/render-target-reuse.html",
    "render-target-reuse-status",
  );

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-target-reuse",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    renderTargetReuseStress: {
      mode: "same-render-target-two-worker-snapshots",
      renderTargetKey: status.renderTarget?.key,
      framesRequested: 2,
      framesRendered: 2,
      displayedFrame: 2,
      reusedHandle: true,
      textureRecreated: false,
      targetResourcePressure: {
        createdTextures: 1,
        reusedTextures: 1,
        stableDimensions: true,
      },
      frames: [
        {
          frame: 1,
          workerVariant: "clear-material-center",
          centerExpectation: "offscreen-clear",
          renderTargetKey: status.renderTarget?.key,
          width: 256,
          height: 256,
          drawCalls: 1,
          diagnostics: 0,
        },
        {
          frame: 2,
          workerVariant: "center-plane",
          centerExpectation: "plane",
          renderTargetKey: status.renderTarget?.key,
          width: 256,
          height: 256,
          drawCalls: 1,
          diagnostics: 0,
        },
      ],
      staleFirstFrameStatus: false,
    },
    sourceView: {
      ok: true,
      renderTargetKey: status.renderTarget?.key,
      expectedRenderTargetKey: status.renderTarget?.key,
      renderTargetMatches: true,
    },
    counts: {
      views: 1,
      meshDraws: 1,
      drawCalls: 1,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 1,
      samples: {
        preview: "quad-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey: status.renderTarget?.key,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus("render-target-reuse-rendered-status", status);

  if (!status.readback?.ok) {
    test.skip(true, "Render-target reuse pixel assertion requires readback.");
    return;
  }

  const sample = status.readback.samples?.find(
    (entry) => entry.id === "quad-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(sample, "expected reused render-target preview sample").toBeDefined();
  expect(
    screenClearSample,
    "expected reuse route screen clear sample",
  ).toBeDefined();

  if (sample === undefined || screenClearSample === undefined) {
    return;
  }

  expect(
    pixelDistance(
      sample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "reused target preview should show the second centered snapshot",
  ).toBeLessThan(80);
  expect(
    pixelDistance(sample.pixel, screenClearSample.pixel),
    "reused target preview should differ from the main-canvas clear region",
  ).toBeGreaterThan(40);
});

test("MSAA render-target reuse route resolves the second snapshot through one stable off-screen target", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<RenderToTextureStatus>(
    page,
    "/examples/render-target-msaa-reuse.html",
    "render-target-msaa-reuse-status",
  );

  if (status === undefined) {
    return;
  }

  const renderTargetKey = status.renderTarget?.key;

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "render-target-msaa-reuse",
    ok: true,
    phase: "display",
    renderingBackend: "webgpu-explicit",
    renderTarget: {
      width: 256,
      height: 256,
      source: "ViewPacket.renderTarget",
      textureUsage: {
        renderAttachment: true,
        textureBinding: true,
        copySource: true,
      },
    },
    renderTargetReuseStress: {
      mode: "same-render-target-two-worker-snapshots",
      renderTargetKey,
      stableRenderTargetKey: true,
      framesRequested: 2,
      framesRendered: 2,
      displayedFrame: 2,
      reusedHandle: true,
      textureRecreated: false,
      targetResourcePressure: {
        createdTextures: 1,
        reusedTextures: 1,
        stableDimensions: true,
      },
      msaa: {
        mode: "msaa-offscreen-render-target-reuse",
        requestedSampleCount: 8,
        sampleCount: 4,
        enabled: true,
        clamped: true,
        supportedSampleCounts: [1, 4],
        stableSampleCount: true,
        colorTargets: 1,
        colorTexturesCreated: 1,
        colorTexturesReused: 1,
        resourcePressure: {
          framesRendered: 2,
          colorTargets: 2,
          colorTexturesCreated: 1,
          colorTexturesReused: 1,
        },
        resolveAttachments: [
          {
            frame: 1,
            msaaSampleCount: 4,
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
          {
            frame: 2,
            msaaSampleCount: 4,
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
        ],
      },
      frames: [
        {
          frame: 1,
          workerVariant: "msaa-clear-material-center",
          centerExpectation: "msaa-resolved-offscreen-clear",
          renderTargetKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
          msaa: {
            requestedSampleCount: 8,
            sampleCount: 4,
            enabled: true,
            clamped: true,
            supportedSampleCounts: [1, 4],
            colorTargets: 1,
            colorTexturesCreated: 1,
            colorTexturesReused: 0,
          },
          diagnostics: 0,
        },
        {
          frame: 2,
          workerVariant: "msaa-center-plane",
          centerExpectation: "msaa-resolved-plane",
          renderTargetKey,
          width: 256,
          height: 256,
          drawCalls: 1,
          msaaSampleCount: 4,
          attachment: {
            colorLoadOp: "clear",
            colorStoreOp: "discard",
            resolveTarget: true,
            behavior: "resolve-to-render-target-texture",
          },
          msaa: {
            requestedSampleCount: 8,
            sampleCount: 4,
            enabled: true,
            clamped: true,
            supportedSampleCounts: [1, 4],
            colorTargets: 1,
            colorTexturesCreated: 0,
            colorTexturesReused: 1,
          },
          diagnostics: 0,
        },
      ],
      staleFirstFrameStatus: false,
    },
    sourceView: {
      ok: true,
      renderTargetKey,
      expectedRenderTargetKey: renderTargetKey,
      renderTargetMatches: true,
    },
    msaaRenderTarget: {
      mode: "msaa-offscreen-render-target-preview",
      source: "ViewPacket.renderTarget",
      renderTargetKey,
      requestedSampleCount: 8,
      sampleCount: 4,
      enabled: true,
      clamped: true,
      supportedSampleCounts: [1, 4],
      colorTargets: 1,
      colorTexturesCreated: 0,
      colorTexturesReused: 1,
      target: {
        source: "offscreen",
        width: 256,
        height: 256,
        drawCalls: 1,
        msaaSampleCount: 4,
        ok: true,
      },
      attachment: {
        colorLoadOp: "clear",
        colorStoreOp: "discard",
        resolveTarget: true,
      },
      displayPass: {
        loadOp: "clear",
        drawCalls: 1,
        samples: {
          preview: "quad-center",
          screenClear: "screen-clear-corner",
        },
      },
    },
    counts: {
      views: 1,
      meshDraws: 1,
      drawCalls: 1,
      diagnostics: 0,
    },
    screenPass: {
      phase: "screen-pass",
      drawCalls: 1,
      samples: {
        preview: "quad-center",
        screenClear: "screen-clear-corner",
      },
    },
  });
  expect(status.report?.renderTargets).toMatchObject([
    {
      source: "offscreen",
      renderTargetKey,
      width: 256,
      height: 256,
      ok: true,
      drawCalls: 1,
      msaaSampleCount: 4,
    },
  ]);
  guard.expectNoWarnings();

  await attachExampleStatus("render-target-msaa-reuse-rendered-status", status);

  if (!status.readback?.ok) {
    test.skip(
      true,
      "MSAA render-target reuse pixel assertion requires readback.",
    );
    return;
  }

  const sample = status.readback.samples?.find(
    (entry) => entry.id === "quad-center",
  );
  const screenClearSample = status.readback.samples?.find(
    (entry) => entry.id === "screen-clear-corner",
  );

  expect(
    sample,
    "expected resolved reused render-target preview sample",
  ).toBeDefined();
  expect(
    screenClearSample,
    "expected MSAA reuse route screen clear sample",
  ).toBeDefined();

  if (sample === undefined || screenClearSample === undefined) {
    return;
  }

  expect(
    pixelDistance(
      sample.pixel,
      rgbaColorToPixel(
        status.scene?.expectedCenterColor ?? {
          r: 0.06,
          g: 0.88,
          b: 0.22,
          a: 1,
        },
      ),
    ),
    "resolved reused target preview should show the second centered snapshot",
  ).toBeLessThan(80);
  expect(
    pixelDistance(
      sample.pixel,
      rgbaColorToPixel(
        status.clearColors?.offscreen ?? {
          r: 1,
          g: 1,
          b: 1,
          a: 1,
        },
      ),
    ),
    "resolved reused target preview should not expose the stale first-frame clear pixel",
  ).toBeGreaterThan(80);
  expect(
    pixelDistance(sample.pixel, screenClearSample.pixel),
    "resolved reused target preview should differ from the main-canvas clear region",
  ).toBeGreaterThan(40);
});

function expectNormalizedRect(
  actual: readonly number[] | null | undefined,
  expected: readonly [number, number, number, number],
): void {
  expect(actual).toBeDefined();

  if (actual === null || actual === undefined) {
    return;
  }

  expect(actual).toHaveLength(4);

  for (const [index, value] of expected.entries()) {
    expect(actual[index]).toBeCloseTo(value, 5);
  }
}
