import type {
  RenderPassAttachmentLoadOp,
  RenderPassAttachmentStoreOp,
  RenderPassColorAttachmentInput,
} from "./render-pass-attachments.js";

export type CurrentTextureViewDiagnosticCode =
  | "currentTextureView.missingCurrentTexture"
  | "currentTextureView.missingTexture"
  | "currentTextureView.missingTextureView";

export interface CurrentTextureViewDiagnostic {
  readonly code: CurrentTextureViewDiagnosticCode;
  readonly message: string;
  readonly targetIndex?: number;
}

export interface CurrentTextureContextLike {
  getCurrentTexture?: () => CurrentTextureLike | null;
}

export interface CurrentTextureLike {
  createView?: () => unknown;
}

export interface CreateCurrentTextureColorTargetOptions {
  readonly context: CurrentTextureContextLike;
  readonly clearColor?: readonly number[];
  readonly loadOp?: RenderPassAttachmentLoadOp;
  readonly storeOp?: RenderPassAttachmentStoreOp;
}

export interface CreateOffscreenColorTargetOptions {
  readonly texture: CurrentTextureLike | null | undefined;
  readonly clearColor?: readonly number[];
  readonly loadOp?: RenderPassAttachmentLoadOp;
  readonly storeOp?: RenderPassAttachmentStoreOp;
}

export interface CreateOffscreenColorTargetsOptions {
  readonly textures: readonly (CurrentTextureLike | null | undefined)[];
  readonly clearColor?: readonly number[];
  readonly clearColors?: readonly (readonly number[] | undefined)[];
  readonly loadOp?: RenderPassAttachmentLoadOp;
  readonly loadOps?: readonly (RenderPassAttachmentLoadOp | undefined)[];
  readonly storeOp?: RenderPassAttachmentStoreOp;
  readonly storeOps?: readonly (RenderPassAttachmentStoreOp | undefined)[];
}

export interface CreateCurrentTextureColorTargetResult {
  readonly valid: boolean;
  readonly texture?: CurrentTextureLike | null;
  readonly target: RenderPassColorAttachmentInput | null;
  readonly diagnostics: readonly CurrentTextureViewDiagnostic[];
}

export interface CreateOffscreenColorTargetsResult {
  readonly valid: boolean;
  readonly textures: readonly (CurrentTextureLike | null)[];
  readonly targets: readonly RenderPassColorAttachmentInput[];
  readonly diagnostics: readonly CurrentTextureViewDiagnostic[];
}

export function createCurrentTextureColorTarget(
  options: CreateCurrentTextureColorTargetOptions,
): CreateCurrentTextureColorTargetResult {
  const texture = options.context.getCurrentTexture?.() ?? null;

  if (texture === null) {
    return {
      valid: false,
      texture: null,
      target: null,
      diagnostics: [
        {
          code: "currentTextureView.missingCurrentTexture",
          message: "WebGPU context did not provide a current texture.",
        },
      ],
    };
  }

  const view = texture.createView?.();

  if (view === undefined) {
    return {
      valid: false,
      texture,
      target: null,
      diagnostics: [
        {
          code: "currentTextureView.missingTextureView",
          message: "WebGPU current texture did not provide a texture view.",
        },
      ],
    };
  }

  const target: RenderPassColorAttachmentInput = { view };

  return {
    valid: true,
    texture,
    target: createColorTargetInput(target, options),
    diagnostics: [],
  };
}

export function createOffscreenColorTarget(
  options: CreateOffscreenColorTargetOptions,
): CreateCurrentTextureColorTargetResult {
  const texture = options.texture ?? null;

  if (texture === null) {
    return {
      valid: false,
      texture: null,
      target: null,
      diagnostics: [
        {
          code: "currentTextureView.missingTexture",
          message: "Off-screen color target requires a texture.",
        },
      ],
    };
  }

  const view = texture.createView?.();

  if (view === undefined) {
    return {
      valid: false,
      texture,
      target: null,
      diagnostics: [
        {
          code: "currentTextureView.missingTextureView",
          message:
            "Off-screen color target texture did not provide a texture view.",
        },
      ],
    };
  }

  return {
    valid: true,
    texture,
    target: createColorTargetInput({ view }, options),
    diagnostics: [],
  };
}

export function createOffscreenColorTargets(
  options: CreateOffscreenColorTargetsOptions,
): CreateOffscreenColorTargetsResult {
  const textures: (CurrentTextureLike | null)[] = [];
  const targets: RenderPassColorAttachmentInput[] = [];
  const diagnostics: CurrentTextureViewDiagnostic[] = [];

  for (let i = 0; i < options.textures.length; i += 1) {
    const clearColor = colorOptionAt(
      options.clearColors,
      i,
      options.clearColor,
    );
    const loadOp = attachmentOptionAt(options.loadOps, i, options.loadOp);
    const storeOp = attachmentOptionAt(options.storeOps, i, options.storeOp);
    const targetOptions: CreateOffscreenColorTargetOptions = {
      texture: options.textures[i],
      ...(clearColor === undefined ? {} : { clearColor }),
      ...(loadOp === undefined ? {} : { loadOp }),
      ...(storeOp === undefined ? {} : { storeOp }),
    };

    const result = createOffscreenColorTarget(targetOptions);

    textures.push(result.texture ?? null);

    if (result.target !== null) {
      targets.push(result.target);
    }

    for (const diagnostic of result.diagnostics) {
      diagnostics.push({ ...diagnostic, targetIndex: i });
    }
  }

  return {
    valid:
      diagnostics.length === 0 && targets.length === options.textures.length,
    textures,
    targets,
    diagnostics,
  };
}

function createColorTargetInput(
  target: RenderPassColorAttachmentInput,
  options: {
    readonly clearColor?: readonly number[];
    readonly loadOp?: RenderPassAttachmentLoadOp;
    readonly storeOp?: RenderPassAttachmentStoreOp;
  },
): RenderPassColorAttachmentInput {
  return {
    ...target,
    ...(options.clearColor === undefined
      ? {}
      : { clearColor: options.clearColor }),
    ...(options.loadOp === undefined ? {} : { loadOp: options.loadOp }),
    ...(options.storeOp === undefined ? {} : { storeOp: options.storeOp }),
  };
}

function colorOptionAt(
  values: readonly (readonly number[] | undefined)[] | undefined,
  index: number,
  fallback: readonly number[] | undefined,
): readonly number[] | undefined {
  return values?.[index] ?? fallback;
}

function attachmentOptionAt<
  T extends RenderPassAttachmentLoadOp | RenderPassAttachmentStoreOp,
>(
  values: readonly (T | undefined)[] | undefined,
  index: number,
  fallback: T | undefined,
): T | undefined {
  return values?.[index] ?? fallback;
}
