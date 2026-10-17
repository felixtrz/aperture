export type RenderPassCommandKind =
  | "setPipeline"
  | "setBindGroup"
  | "setVertexBuffer"
  | "setIndexBuffer"
  | "beginOcclusionQuery"
  | "endOcclusionQuery"
  | "draw"
  | "drawIndexed"
  | "drawIndirect"
  | "drawIndexedIndirect";

export type RenderPassStateCommandKind =
  | "setPipeline"
  | "setBindGroup"
  | "setVertexBuffer"
  | "setIndexBuffer";

export type RenderPassCommandDiagnosticCode =
  | "renderPassCommand.invalidVertexCount"
  | "renderPassCommand.invalidIndexCount"
  | "renderPassCommand.invalidTransformOffset";

export interface RenderPassCommandDiagnostic {
  readonly code: RenderPassCommandDiagnosticCode;
  readonly message: string;
  readonly renderId: number;
}

export interface SetPipelineCommand {
  readonly kind: "setPipeline";
  readonly renderId: number;
  readonly pipelineKey: string;
  readonly pipeline: unknown;
}

export interface SetBindGroupCommand {
  readonly kind: "setBindGroup";
  readonly renderId: number;
  readonly index: number;
  readonly resourceKey: string;
  readonly bindGroup: unknown;
}

export interface SetVertexBufferCommand {
  readonly kind: "setVertexBuffer";
  readonly renderId: number;
  readonly slot: number;
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly offset?: number;
  readonly size?: number;
}

export interface SetIndexBufferCommand {
  readonly kind: "setIndexBuffer";
  readonly renderId: number;
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly format: string;
  readonly offset?: number;
  readonly size?: number;
}

export interface BeginOcclusionQueryCommand {
  readonly kind: "beginOcclusionQuery";
  readonly renderId: number;
  readonly queryIndex: number;
}

export interface EndOcclusionQueryCommand {
  readonly kind: "endOcclusionQuery";
  readonly renderId: number;
  readonly queryIndex: number;
}

export interface DrawCommand {
  readonly kind: "draw";
  readonly renderId: number;
  readonly vertexCount: number;
  readonly instanceCount: number;
  readonly firstVertex: number;
  readonly firstInstance: number;
}

export interface DrawIndexedCommand {
  readonly kind: "drawIndexed";
  readonly renderId: number;
  readonly indexCount: number;
  readonly instanceCount: number;
  readonly firstIndex: number;
  readonly baseVertex: number;
  readonly firstInstance: number;
}

export interface DrawIndirectCommand {
  readonly kind: "drawIndirect";
  readonly renderId: number;
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly offset: number;
  readonly vertexCount: number;
  readonly instanceCount: number;
  readonly firstVertex: number;
  readonly firstInstance: number;
}

export interface DrawIndexedIndirectCommand {
  readonly kind: "drawIndexedIndirect";
  readonly renderId: number;
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly offset: number;
  readonly indexCount: number;
  readonly instanceCount: number;
  readonly firstIndex: number;
  readonly baseVertex: number;
  readonly firstInstance: number;
}

export type RenderPassCommand =
  | SetPipelineCommand
  | SetBindGroupCommand
  | SetVertexBufferCommand
  | SetIndexBufferCommand
  | BeginOcclusionQueryCommand
  | EndOcclusionQueryCommand
  | DrawCommand
  | DrawIndexedCommand
  | DrawIndirectCommand
  | DrawIndexedIndirectCommand;
