import type { MeshGpuBufferResource } from "./mesh-buffer-resources.js";
import type { GetOrCreateRenderPipelineResult } from "./pipeline-cache-integration.js";
import type {
  RenderPassDrawListDiagnostic,
  RenderPassDrawListRecord,
} from "./render-pass-draw-list.js";
import type {
  UnlitBindGroupResource,
  UnlitBindGroupResourceDiagnostic,
} from "./unlit-bind-group.js";

export type RenderPassResourceDiagnosticCode =
  | "renderPassResource.missingPipeline"
  | "renderPassResource.missingBindGroup"
  | "renderPassResource.missingVertexBuffer"
  | "renderPassResource.missingIndexBuffer";

export interface RenderPassResourceDiagnostic {
  readonly code: RenderPassResourceDiagnosticCode;
  readonly message: string;
  readonly renderId: number;
  readonly resourceKey: string;
}

export interface ResolvedRenderPassBindGroup {
  readonly group: number;
  readonly resourceKey: string;
  readonly bindGroup: unknown;
}

export interface ResolvedRenderPassVertexBuffer {
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly vertexCount: number;
}

export interface ResolvedRenderPassIndexBuffer {
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly format: string;
  readonly indexCount: number;
}

export interface ResolvedRenderPassDraw {
  readonly renderId: number;
  readonly pipelineKey: string;
  readonly pipeline: unknown;
  readonly bindGroups: readonly ResolvedRenderPassBindGroup[];
  readonly vertexBuffers: readonly ResolvedRenderPassVertexBuffer[];
  readonly vertexCount: number;
  readonly indexBuffer: ResolvedRenderPassIndexBuffer | null;
  readonly indexCount: number | null;
  readonly instanceCount: number;
  readonly transformPackedOffset: number;
}

export interface ResolveRenderPassResourcesOptions {
  readonly drawList: readonly RenderPassDrawListRecord[];
  readonly pipelines: readonly GetOrCreateRenderPipelineResult[];
  readonly bindGroups: readonly UnlitBindGroupResource[];
  readonly meshResources: readonly MeshGpuBufferResource[];
}

export interface ResolveRenderPassResourcesResult {
  readonly valid: boolean;
  readonly draws: readonly ResolvedRenderPassDraw[];
  readonly diagnostics: readonly (
    | RenderPassDrawListDiagnostic
    | UnlitBindGroupResourceDiagnostic
    | RenderPassResourceDiagnostic
  )[];
}

export function resolveRenderPassResources(
  options: ResolveRenderPassResourcesOptions,
): ResolveRenderPassResourcesResult {
  const pipelines = new Map(
    options.pipelines.flatMap((pipeline) =>
      pipeline.ok ? [[pipeline.key, pipeline.pipeline] as const] : [],
    ),
  );
  const bindGroups = new Map(
    options.bindGroups.map((bindGroup) => [bindGroup.resourceKey, bindGroup]),
  );
  const vertexBuffers = new Map(
    options.meshResources.flatMap((mesh) =>
      mesh.vertexBuffers.map((buffer) => [buffer.resourceKey, buffer] as const),
    ),
  );
  const indexBuffers = new Map(
    options.meshResources.flatMap((mesh) =>
      mesh.indexBuffer === undefined
        ? []
        : [[mesh.indexBuffer.resourceKey, mesh.indexBuffer] as const],
    ),
  );
  const diagnostics: RenderPassResourceDiagnostic[] = [];
  const draws: ResolvedRenderPassDraw[] = [];

  for (const draw of [...options.drawList].sort(
    (a, b) => a.renderId - b.renderId,
  )) {
    const pipeline = pipelines.get(draw.pipelineKey);
    const resolvedBindGroups = resolveBindGroups(draw, bindGroups, diagnostics);
    const resolvedVertexBuffers = resolveVertexBuffers(
      draw,
      vertexBuffers,
      diagnostics,
    );
    const resolvedIndexBuffer = resolveIndexBuffer(
      draw,
      indexBuffers,
      diagnostics,
    );

    if (
      pipeline === undefined ||
      resolvedBindGroups.length !== draw.bindGroupKeys.length ||
      resolvedVertexBuffers.length !== draw.vertexBufferKeys.length ||
      (draw.indexBufferKey !== null && resolvedIndexBuffer === null)
    ) {
      if (pipeline === undefined) {
        diagnostics.push({
          code: "renderPassResource.missingPipeline",
          renderId: draw.renderId,
          resourceKey: draw.pipelineKey,
          message: `Missing render pipeline handle '${draw.pipelineKey}' for render id ${draw.renderId}.`,
        });
      }

      continue;
    }

    draws.push({
      renderId: draw.renderId,
      pipelineKey: draw.pipelineKey,
      pipeline,
      bindGroups: resolvedBindGroups,
      vertexBuffers: resolvedVertexBuffers,
      vertexCount: draw.vertexCount,
      indexBuffer: resolvedIndexBuffer,
      indexCount: draw.indexCount,
      instanceCount: draw.instanceCount,
      transformPackedOffset: draw.transformPackedOffset,
    });
  }

  return {
    valid: diagnostics.length === 0,
    draws,
    diagnostics,
  };
}

function resolveBindGroups(
  draw: RenderPassDrawListRecord,
  bindGroups: ReadonlyMap<string, UnlitBindGroupResource>,
  diagnostics: RenderPassResourceDiagnostic[],
): readonly ResolvedRenderPassBindGroup[] {
  return draw.bindGroupKeys.flatMap((resourceKey) => {
    const bindGroup = bindGroups.get(resourceKey);

    if (bindGroup === undefined) {
      diagnostics.push({
        code: "renderPassResource.missingBindGroup",
        renderId: draw.renderId,
        resourceKey,
        message: `Missing bind group handle '${resourceKey}' for render id ${draw.renderId}.`,
      });
      return [];
    }

    return [
      {
        group: bindGroup.group,
        resourceKey: bindGroup.resourceKey,
        bindGroup: bindGroup.bindGroup,
      },
    ];
  });
}

function resolveVertexBuffers(
  draw: RenderPassDrawListRecord,
  vertexBuffers: ReadonlyMap<
    string,
    MeshGpuBufferResource["vertexBuffers"][number]
  >,
  diagnostics: RenderPassResourceDiagnostic[],
): readonly ResolvedRenderPassVertexBuffer[] {
  return draw.vertexBufferKeys.flatMap((resourceKey) => {
    const vertexBuffer = vertexBuffers.get(resourceKey);

    if (vertexBuffer === undefined) {
      diagnostics.push({
        code: "renderPassResource.missingVertexBuffer",
        renderId: draw.renderId,
        resourceKey,
        message: `Missing vertex buffer handle '${resourceKey}' for render id ${draw.renderId}.`,
      });
      return [];
    }

    return [
      {
        resourceKey: vertexBuffer.resourceKey,
        buffer: vertexBuffer.buffer,
        vertexCount: vertexBuffer.vertexCount,
      },
    ];
  });
}

function resolveIndexBuffer(
  draw: RenderPassDrawListRecord,
  indexBuffers: ReadonlyMap<
    string,
    NonNullable<MeshGpuBufferResource["indexBuffer"]>
  >,
  diagnostics: RenderPassResourceDiagnostic[],
): ResolvedRenderPassIndexBuffer | null {
  if (draw.indexBufferKey === null) {
    return null;
  }

  const indexBuffer = indexBuffers.get(draw.indexBufferKey);

  if (indexBuffer === undefined) {
    diagnostics.push({
      code: "renderPassResource.missingIndexBuffer",
      renderId: draw.renderId,
      resourceKey: draw.indexBufferKey,
      message: `Missing index buffer handle '${draw.indexBufferKey}' for render id ${draw.renderId}.`,
    });
    return null;
  }

  return {
    resourceKey: indexBuffer.resourceKey,
    buffer: indexBuffer.buffer,
    format: indexBuffer.format,
    indexCount: indexBuffer.indexCount,
  };
}
