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

export interface CreateCurrentTextureColorTargetResult {
  readonly valid: boolean;
  readonly texture?: CurrentTextureLike | null;
  readonly target: RenderPassColorAttachmentInput | null;
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
