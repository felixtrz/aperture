export type RenderPassAttachmentLoadOp = "clear" | "load";
export type RenderPassAttachmentStoreOp = "store" | "discard";

export type RenderPassAttachmentDiagnosticCode =
  | "renderPassAttachment.missingColorTarget"
  | "renderPassAttachment.invalidClearColor"
  | "renderPassAttachment.invalidDepthClear";

export interface RenderPassAttachmentDiagnostic {
  readonly code: RenderPassAttachmentDiagnosticCode;
  readonly message: string;
  readonly targetIndex?: number;
}

export type RenderPassClearColorTuple = readonly [
  number,
  number,
  number,
  number,
];

export interface RenderPassColorAttachmentInput {
  readonly view: unknown | null;
  readonly resolveTarget?: unknown | null;
  readonly clearColor?: readonly number[];
  readonly loadOp?: RenderPassAttachmentLoadOp;
  readonly storeOp?: RenderPassAttachmentStoreOp;
}

export interface RenderPassDepthAttachmentInput {
  readonly view: unknown | null;
  readonly depthClearValue?: number;
  readonly depthLoadOp?: RenderPassAttachmentLoadOp;
  readonly depthStoreOp?: RenderPassAttachmentStoreOp;
  readonly depthReadOnly?: boolean;
}

export interface PlannedRenderPassColorAttachment {
  readonly view: unknown;
  readonly clearValue?: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
  readonly resolveTarget?: unknown;
  readonly loadOp: RenderPassAttachmentLoadOp;
  readonly storeOp: RenderPassAttachmentStoreOp;
}

export interface PlannedRenderPassDepthStencilAttachment {
  readonly view: unknown;
  readonly depthClearValue?: number;
  readonly depthLoadOp: RenderPassAttachmentLoadOp;
  readonly depthStoreOp: RenderPassAttachmentStoreOp;
  readonly depthReadOnly?: boolean;
}

export interface RenderPassAttachmentDescriptorPlan {
  readonly colorAttachments: readonly PlannedRenderPassColorAttachment[];
  readonly depthStencilAttachment?: PlannedRenderPassDepthStencilAttachment;
  readonly occlusionQuerySet?: unknown;
}

export interface CreateRenderPassAttachmentPlanOptions {
  readonly colorTargets: readonly RenderPassColorAttachmentInput[];
  readonly depthTarget?: RenderPassDepthAttachmentInput | null;
  readonly occlusionQuerySet?: unknown;
}

export interface CreateRenderPassAttachmentPlanResult {
  readonly valid: boolean;
  readonly plan: RenderPassAttachmentDescriptorPlan | null;
  readonly diagnostics: readonly RenderPassAttachmentDiagnostic[];
}

export function createRenderPassAttachmentPlan(
  options: CreateRenderPassAttachmentPlanOptions,
): CreateRenderPassAttachmentPlanResult {
  const diagnostics: RenderPassAttachmentDiagnostic[] = [];
  const colorAttachments = options.colorTargets.flatMap((target, index) =>
    createColorAttachment(target, index, diagnostics),
  );
  const depthStencilAttachment =
    options.depthTarget === undefined || options.depthTarget === null
      ? undefined
      : createDepthAttachment(options.depthTarget, diagnostics);

  if (options.colorTargets.length === 0) {
    diagnostics.push({
      code: "renderPassAttachment.missingColorTarget",
      message:
        "Render pass attachment planning requires at least one color target.",
    });
  }

  if (diagnostics.length > 0) {
    return { valid: false, plan: null, diagnostics };
  }

  const plan: RenderPassAttachmentDescriptorPlan = {
    colorAttachments,
    ...(options.occlusionQuerySet === undefined
      ? {}
      : { occlusionQuerySet: options.occlusionQuerySet }),
  };

  if (depthStencilAttachment !== undefined) {
    return {
      valid: true,
      plan: { ...plan, depthStencilAttachment },
      diagnostics,
    };
  }

  return { valid: true, plan, diagnostics };
}

function createColorAttachment(
  target: RenderPassColorAttachmentInput,
  targetIndex: number,
  diagnostics: RenderPassAttachmentDiagnostic[],
): readonly PlannedRenderPassColorAttachment[] {
  if (target.view === null) {
    diagnostics.push({
      code: "renderPassAttachment.missingColorTarget",
      targetIndex,
      message: `Render pass color target ${targetIndex} is missing a texture view.`,
    });
    return [];
  }

  const clearValue =
    target.clearColor === undefined
      ? undefined
      : createClearColor(target.clearColor, targetIndex, diagnostics);

  if (target.clearColor !== undefined && clearValue === undefined) {
    return [];
  }

  const attachment: PlannedRenderPassColorAttachment = {
    view: target.view,
    loadOp: target.loadOp ?? (clearValue === undefined ? "load" : "clear"),
    storeOp:
      target.storeOp ??
      (target.resolveTarget === undefined ? "store" : "discard"),
  };
  const resolvedAttachment =
    target.resolveTarget === undefined || target.resolveTarget === null
      ? attachment
      : { ...attachment, resolveTarget: target.resolveTarget };

  if (clearValue !== undefined) {
    return [{ ...resolvedAttachment, clearValue }];
  }

  return [resolvedAttachment];
}

function createDepthAttachment(
  target: RenderPassDepthAttachmentInput,
  diagnostics: RenderPassAttachmentDiagnostic[],
): PlannedRenderPassDepthStencilAttachment | undefined {
  if (target.view === null) {
    return undefined;
  }

  if (
    target.depthClearValue !== undefined &&
    !isValidDepthClear(target.depthClearValue)
  ) {
    diagnostics.push({
      code: "renderPassAttachment.invalidDepthClear",
      message: `Depth clear value must be a finite number in [0, 1], not '${String(target.depthClearValue)}'.`,
    });
    return undefined;
  }

  const attachment: PlannedRenderPassDepthStencilAttachment = {
    view: target.view,
    depthLoadOp:
      target.depthLoadOp ??
      (target.depthClearValue === undefined ? "load" : "clear"),
    depthStoreOp: target.depthStoreOp ?? "store",
    ...(target.depthReadOnly === true ? { depthReadOnly: true } : {}),
  };

  if (target.depthClearValue !== undefined) {
    return { ...attachment, depthClearValue: target.depthClearValue };
  }

  return attachment;
}

function createClearColor(
  value: readonly number[],
  targetIndex: number,
  diagnostics: RenderPassAttachmentDiagnostic[],
): PlannedRenderPassColorAttachment["clearValue"] | undefined {
  if (!isClearColorTuple(value)) {
    diagnostics.push({
      code: "renderPassAttachment.invalidClearColor",
      targetIndex,
      message: `Render pass color target ${targetIndex} clear color must be a finite [r, g, b, a] tuple.`,
    });
    return undefined;
  }

  return { r: value[0], g: value[1], b: value[2], a: value[3] };
}

function isClearColorTuple(
  value: readonly number[],
): value is RenderPassClearColorTuple {
  return (
    value.length === 4 && value.every((component) => Number.isFinite(component))
  );
}

function isValidDepthClear(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
