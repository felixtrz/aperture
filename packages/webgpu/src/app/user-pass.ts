// Public user-pass insertion API (M3-T7). Lets a library user inject custom
// render / compute passes into the frame graph via app.addRenderPass /
// app.addComputePass / app.removePass. The signed-off shape is M3 §Design
// decisions D1: a pass is a plain, JSON-describable node (name / kind / reads /
// writes / before / after) whose GPU work lives in an `encode(ctx)` callback
// that is NEVER serialized; resources are referenced by string id and ordering
// is driven by declared reads/writes edges (before/after is sugar that compiles
// to edges).
//
// encode(ctx) is invoked at graph-build time: ctx is a command recorder
// (setPipeline/draw → RenderPassCommand[]; setComputePipeline/dispatchWorkgroups
// → ComputePassCommand[]) plus a resource resolver (view / buffer / bindings).
// The recorded commands feed the existing single-encoder executor unchanged — so
// the callback model is a thin authoring layer over RenderPassCommand /
// ComputePassCommand, not a second execution path. This keeps the graph model
// GPU-free (resolvers are injected by the route layer; this module is headless).
//
// The before/after insertion points let a user pass slot itself relative to
// existing passes, which is what makes custom passes composable with the built-in
// graph.

import type {
  ComputeKernelAsset,
  ComputeKernelWorkgroups,
} from "@aperture-engine/render";
import type {
  PassWrite,
  RenderPassNodeInput,
  ComputePassNodeInput,
} from "../render/graph/frame-graph.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { ComputePassCommand } from "../render/passes/compute-pass-commands.js";
import type { ComputeKernelDispatchRealization } from "./compute-kernel-resources.js";

/**
 * A write target for a user pass: a handle id, optionally with attachment
 * intent. A bare string defaults to `attachment: "load"` (augment existing
 * contents — the safe default for an injected pass) for render targets; the
 * intent is ignored for buffer handles.
 */
export type WebGpuAppPassWriteInput =
  | string
  | {
      readonly handle: string;
      readonly attachment?: "clear" | "load";
      readonly clearColor?: readonly [number, number, number, number];
      readonly clearDepth?: number;
    };

/**
 * The command sink + resource resolver passed to a user pass's encode(). Method
 * names are shared between render and compute; the pass `kind` selects which
 * command list each call records into (calling a render method inside a compute
 * pass, or vice versa, throws so authoring mistakes surface immediately).
 */
export interface WebGpuAppPassEncodeContext {
  /** Resolve a declared read handle to a sampleable GPU texture view. */
  view(handle: string): unknown;
  /** Resolve a declared buffer handle to its GPU buffer. */
  buffer(handle: string): unknown;
  /** Build an opaque bind group from named resources (never serialized). */
  bindings(entries: Readonly<Record<string, unknown>>): unknown;

  // --- render command sink ---
  setPipeline(pipeline: unknown): void;
  setBindGroup(index: number, bindGroup: unknown): void;
  setVertexBuffer(slot: number, buffer: unknown): void;
  setIndexBuffer(buffer: unknown, format: string): void;
  draw(
    vertexCount: number,
    instanceCount?: number,
    firstVertex?: number,
    firstInstance?: number,
  ): void;
  drawIndexed(
    indexCount: number,
    instanceCount?: number,
    firstIndex?: number,
    baseVertex?: number,
    firstInstance?: number,
  ): void;
  /**
   * C2 (GPU-driven indirect rendering): record a non-indexed indirect draw
   * whose vertex/instance counts are read on the GPU from an indirect-argument
   * region — typically a WRITABLE `BufferAsset` a compute pass populated the
   * same frame (`ctx.buffer(id)` resolves it; the buffer realizes with
   * `INDIRECT` usage). The 4x u32 record at `indirectOffset` is
   * `[vertexCount, instanceCount, firstVertex, firstInstance]`. This is the
   * three.js WebGPU `IndirectStorageBufferAttribute` / indirect-draw analog: the
   * drawn instance count lives on the GPU (never the CPU) and surfaces in the
   * frame report's indirect-draws section via a readback. A degraded path (the
   * buffer did not resolve, or the offset is not 4-byte aligned) is dropped with
   * a structured `IndirectDrawFallbackReason` on the report instead of encoding
   * a device error.
   */
  drawIndirect(indirectBuffer: unknown, indirectOffset?: number): void;
  /**
   * C2: record an indexed indirect draw. The 5x u32 record at `indirectOffset`
   * is `[indexCount, instanceCount, firstIndex, baseVertex, firstInstance]`. An
   * index buffer must be bound (`ctx.setIndexBuffer(...)`) as for `drawIndexed`.
   */
  drawIndexedIndirect(indirectBuffer: unknown, indirectOffset?: number): void;

  // --- compute command sink ---
  setComputePipeline(pipeline: unknown): void;
  dispatchWorkgroups(x: number, y?: number, z?: number): void;
}

interface WebGpuAppPassDescriptorBase {
  readonly name: string;
  /** Handle ids this pass samples/consumes — drives ordering + load/store. */
  readonly reads?: readonly string[];
  /** Optional ordering sugar; compiles to an edge. Edges remain the truth. */
  readonly before?: string;
  readonly after?: string;
  readonly enabled?: boolean;
  encode(ctx: WebGpuAppPassEncodeContext): void;
}

export interface WebGpuAppRenderPassDescriptor extends WebGpuAppPassDescriptorBase {
  readonly kind?: "render";
  /**
   * Render targets declared by this pass. Writing `"scene-color"` draws over
   * the presented scene with LOAD (depth-tested against scene depth). Writing
   * one or more facade render-target ids (B3) attaches those realized
   * textures as the pass's color targets in declaration order — clear/load
   * per write intent, always stored, no depth attachment — which is what
   * enables ping-pong between two user targets across frames. A pass writes
   * either scene-color or its own targets (not both); unavailable targets
   * skip the pass with a structured diagnostic.
   */
  readonly writes: readonly WebGpuAppPassWriteInput[];
}

export interface WebGpuAppComputePassDescriptor extends WebGpuAppPassDescriptorBase {
  // Optional in the public input (addComputePass implies compute and stamps it);
  // include it for D1-style symmetry if you like. The registry normalizes it.
  readonly kind?: "compute";
  /** Buffers/textures written this pass (typically a declared transient buffer). */
  readonly writes?: readonly WebGpuAppPassWriteInput[];
}

/**
 * C3: a DATA-DESCRIBED compute-kernel dispatch (the compute sibling of a custom
 * material). Instead of an `encode(ctx)` callback that hand-builds a pipeline +
 * bind group, the pass carries a {@link ComputeKernelAsset} (WGSL + typed
 * bindings) and `workgroups`; the route realizes the compute pipeline + bind
 * group from the data and records the dispatch. The user touches no
 * `GPUDevice`. A kernel's WRITABLE (`usage: "storage"`) buffer bindings are
 * auto-declared as pass writes (compute-before-draw ordering), so `writes` is
 * usually only needed for extra ordering handles. The raw `addComputePass`
 * encode path remains for full control.
 */
export interface WebGpuAppComputeKernelPassDescriptor {
  readonly name: string;
  readonly kind?: "compute";
  readonly kernel: ComputeKernelAsset;
  readonly workgroups: ComputeKernelWorkgroups;
  /** Handle ids this pass reads — drives ordering. */
  readonly reads?: readonly string[];
  /** Extra write handles beyond the kernel's auto-declared storage outputs. */
  readonly writes?: readonly WebGpuAppPassWriteInput[];
  readonly before?: string;
  readonly after?: string;
  readonly enabled?: boolean;
}

export type WebGpuAppPassDescriptor =
  | WebGpuAppRenderPassDescriptor
  | WebGpuAppComputePassDescriptor
  | WebGpuAppComputeKernelPassDescriptor;

/** True when a descriptor is a data-described compute-kernel dispatch (C3). */
export function isComputeKernelPassDescriptor(
  descriptor: WebGpuAppPassDescriptor,
): descriptor is WebGpuAppComputeKernelPassDescriptor {
  return "kernel" in descriptor && descriptor.kernel !== undefined;
}

/**
 * A graph-ready node built from a user descriptor: a RenderPassNodeInput or
 * ComputePassNodeInput with `commands` populated and `kind` REQUIRED, so the
 * route layer (and tests) can discriminate on `kind` without a cast.
 */
export type WebGpuAppBuiltPassNode =
  | (RenderPassNodeInput & { readonly kind: "render" })
  | (ComputePassNodeInput & { readonly kind: "compute" });

/** Injected resolvers that turn string handle ids into concrete GPU resources. */
export interface WebGpuAppPassResolvers {
  view(handle: string): unknown;
  buffer(handle: string): unknown;
  createBindGroup(entries: Readonly<Record<string, unknown>>): unknown;
  /**
   * C3: realize a data-described compute-kernel dispatch into a pipeline + bind
   * group (the route injects a GPU realizer; a headless caller/test may omit
   * it). A `null` return means the dispatch degraded — the realizer pushed a
   * structured diagnostic — and the kernel pass records no commands.
   */
  realizeComputeKernel?(
    kernel: ComputeKernelAsset,
    workgroups: ComputeKernelWorkgroups,
    passName: string,
  ): ComputeKernelDispatchRealization | null;
}

/**
 * The registry backing app.addRenderPass / addComputePass / removePass. Holds
 * user pass descriptors in insertion order (the deterministic topo tiebreaker);
 * the route layer calls buildUserPassNodes() each frame to turn them into
 * graph-ready PassNodes.
 */
export interface WebGpuAppUserPassRegistry {
  addRenderPass(descriptor: WebGpuAppRenderPassDescriptor): void;
  addComputePass(descriptor: WebGpuAppComputePassDescriptor): void;
  /** C3: register a data-described compute-kernel dispatch pass. */
  addComputeKernelPass(descriptor: WebGpuAppComputeKernelPassDescriptor): void;
  /** Remove a pass by name; returns true if one was removed. */
  removePass(name: string): boolean;
  has(name: string): boolean;
  /** Descriptors in insertion order. */
  list(): readonly WebGpuAppPassDescriptor[];
  readonly size: number;
}

export function createWebGpuAppUserPassRegistry(): WebGpuAppUserPassRegistry {
  // Insertion-ordered map keyed by name; re-adding a name replaces in place.
  const passes = new Map<string, WebGpuAppPassDescriptor>();

  const add = (descriptor: WebGpuAppPassDescriptor): void => {
    if (descriptor.name.length === 0) {
      throw new Error("A user pass requires a non-empty name.");
    }
    passes.set(descriptor.name, descriptor);
  };

  return {
    addRenderPass(descriptor) {
      add({ ...descriptor, kind: "render" });
    },
    addComputePass(descriptor) {
      add({ ...descriptor, kind: "compute" });
    },
    addComputeKernelPass(descriptor) {
      add({ ...descriptor, kind: "compute" });
    },
    removePass(name) {
      return passes.delete(name);
    },
    has(name) {
      return passes.has(name);
    },
    list() {
      return [...passes.values()];
    },
    get size() {
      return passes.size;
    },
  };
}

/**
 * Normalize the public write inputs (bare strings default to LOAD) into
 * graph-ready PassWrites. Exported so the routes can resolve a pass's write
 * targets BEFORE invoking its encode() callback (B3).
 */
export function normalizeUserPassWrites(
  writes: readonly WebGpuAppPassWriteInput[] | undefined,
): PassWrite[] {
  return (writes ?? []).map((write) =>
    typeof write === "string"
      ? { handle: write, attachment: "load" }
      : {
          handle: write.handle,
          attachment: write.attachment ?? "load",
          ...(write.clearColor === undefined
            ? {}
            : { clearColor: write.clearColor }),
          ...(write.clearDepth === undefined
            ? {}
            : { clearDepth: write.clearDepth }),
        },
  );
}

function createRecorderContext(
  name: string,
  kind: "render" | "compute",
  resolvers: WebGpuAppPassResolvers,
): {
  readonly ctx: WebGpuAppPassEncodeContext;
  readonly renderCommands: RenderPassCommand[];
  readonly computeCommands: ComputePassCommand[];
} {
  const renderCommands: RenderPassCommand[] = [];
  const computeCommands: ComputePassCommand[] = [];
  let seq = 0;
  const key = (suffix: string): string => `user:${name}:${suffix}:${seq++}`;
  const renderOnly = (method: string): never => {
    throw new Error(
      `Compute pass '${name}' called render method ctx.${method}() — use setComputePipeline/dispatchWorkgroups in a compute pass.`,
    );
  };
  const computeOnly = (method: string): never => {
    throw new Error(
      `Render pass '${name}' called compute method ctx.${method}() — use setPipeline/draw in a render pass.`,
    );
  };

  const ctx: WebGpuAppPassEncodeContext = {
    view: (handle) => resolvers.view(handle),
    buffer: (handle) => resolvers.buffer(handle),
    bindings: (entries) => resolvers.createBindGroup(entries),
    setPipeline(pipeline) {
      if (kind !== "render") {
        renderOnly("setPipeline");
      }
      renderCommands.push({
        kind: "setPipeline",
        renderId: 0,
        pipelineKey: key("pipeline"),
        pipeline,
      });
    },
    setBindGroup(index, bindGroup) {
      if (kind === "render") {
        renderCommands.push({
          kind: "setBindGroup",
          renderId: 0,
          index,
          resourceKey: key("bind"),
          bindGroup,
        });
      } else {
        computeCommands.push({
          kind: "setComputeBindGroup",
          index,
          resourceKey: key("bind"),
          bindGroup,
        });
      }
    },
    setVertexBuffer(slot, buffer) {
      if (kind !== "render") {
        renderOnly("setVertexBuffer");
      }
      renderCommands.push({
        kind: "setVertexBuffer",
        renderId: 0,
        slot,
        resourceKey: key("vbuf"),
        buffer,
      });
    },
    setIndexBuffer(buffer, format) {
      if (kind !== "render") {
        renderOnly("setIndexBuffer");
      }
      renderCommands.push({
        kind: "setIndexBuffer",
        renderId: 0,
        resourceKey: key("ibuf"),
        buffer,
        format,
      });
    },
    draw(vertexCount, instanceCount = 1, firstVertex = 0, firstInstance = 0) {
      if (kind !== "render") {
        renderOnly("draw");
      }
      renderCommands.push({
        kind: "draw",
        renderId: 0,
        vertexCount,
        instanceCount,
        firstVertex,
        firstInstance,
      });
    },
    drawIndexed(
      indexCount,
      instanceCount = 1,
      firstIndex = 0,
      baseVertex = 0,
      firstInstance = 0,
    ) {
      if (kind !== "render") {
        renderOnly("drawIndexed");
      }
      renderCommands.push({
        kind: "drawIndexed",
        renderId: 0,
        indexCount,
        instanceCount,
        firstIndex,
        baseVertex,
        firstInstance,
      });
    },
    drawIndirect(indirectBuffer, indirectOffset = 0) {
      if (kind !== "render") {
        renderOnly("drawIndirect");
      }
      // The vertex/instance counts live in the GPU-side argument record; the
      // recorded fields are placeholders the executor never reads (it dispatches
      // passEncoder.drawIndirect(buffer, offset)). Validity (buffer resolved,
      // offset aligned) is checked by the route so a degraded path reports a
      // fallback reason instead of encoding a device error.
      renderCommands.push({
        kind: "drawIndirect",
        renderId: 0,
        resourceKey: key("indirect"),
        buffer: indirectBuffer,
        offset: indirectOffset,
        vertexCount: 0,
        instanceCount: 0,
        firstVertex: 0,
        firstInstance: 0,
      });
    },
    drawIndexedIndirect(indirectBuffer, indirectOffset = 0) {
      if (kind !== "render") {
        renderOnly("drawIndexedIndirect");
      }
      renderCommands.push({
        kind: "drawIndexedIndirect",
        renderId: 0,
        resourceKey: key("indexed-indirect"),
        buffer: indirectBuffer,
        offset: indirectOffset,
        indexCount: 0,
        instanceCount: 0,
        firstIndex: 0,
        baseVertex: 0,
        firstInstance: 0,
      });
    },
    setComputePipeline(pipeline) {
      if (kind !== "compute") {
        computeOnly("setComputePipeline");
      }
      computeCommands.push({
        kind: "setComputePipeline",
        pipelineKey: key("compute-pipeline"),
        pipeline,
      });
    },
    dispatchWorkgroups(x, y = 1, z = 1) {
      if (kind !== "compute") {
        computeOnly("dispatchWorkgroups");
      }
      computeCommands.push({
        kind: "dispatchWorkgroups",
        workgroupCountX: x,
        workgroupCountY: y,
        workgroupCountZ: z,
      });
    },
  };

  return { ctx, renderCommands, computeCommands };
}

/**
 * Turn one user pass descriptor into a graph-ready node by invoking its
 * encode(ctx) with a command recorder. Returns a RenderPassNodeInput or
 * ComputePassNodeInput (commands populated) ready for graph.addRenderPass /
 * addComputePass. Pure given the resolvers — the route layer supplies GPU
 * resolvers; tests supply fakes.
 */
export function buildUserPassNode(
  descriptor: WebGpuAppPassDescriptor,
  resolvers: WebGpuAppPassResolvers,
): WebGpuAppBuiltPassNode {
  if (isComputeKernelPassDescriptor(descriptor)) {
    return buildComputeKernelPassNode(descriptor, resolvers);
  }

  const kind = descriptor.kind === "compute" ? "compute" : "render";
  const recorder = createRecorderContext(descriptor.name, kind, resolvers);
  descriptor.encode(recorder.ctx);

  const shared = {
    name: descriptor.name,
    reads: descriptor.reads ?? [],
    writes: normalizeUserPassWrites(descriptor.writes),
    ...(descriptor.before === undefined ? {} : { before: descriptor.before }),
    ...(descriptor.after === undefined ? {} : { after: descriptor.after }),
    ...(descriptor.enabled === undefined
      ? {}
      : { enabled: descriptor.enabled }),
  };

  if (kind === "compute") {
    return { ...shared, kind: "compute", commands: recorder.computeCommands };
  }
  return { ...shared, kind: "render", commands: recorder.renderCommands };
}

/**
 * C3: build a graph-ready compute node from a data-described kernel dispatch.
 * Realizes the pipeline + bind group via the injected `realizeComputeKernel`
 * resolver and records setComputePipeline / setBindGroup(0) / dispatchWorkgroups
 * — the exact commands the raw encode path records, but from data. A degraded
 * realization (resolver absent or returned null) yields an empty command list;
 * the pass reports as "did not run" and the realizer's diagnostic explains why.
 * The kernel's WRITABLE storage outputs are merged into the node writes so a
 * draw reading the same id is ordered after the dispatch.
 */
function buildComputeKernelPassNode(
  descriptor: WebGpuAppComputeKernelPassDescriptor,
  resolvers: WebGpuAppPassResolvers,
): WebGpuAppBuiltPassNode {
  const realization =
    resolvers.realizeComputeKernel?.(
      descriptor.kernel,
      descriptor.workgroups,
      descriptor.name,
    ) ?? null;

  const commands: ComputePassCommand[] = [];
  const autoWrites: PassWrite[] = [];

  if (realization !== null) {
    commands.push({
      kind: "setComputePipeline",
      pipelineKey: `user:${descriptor.name}:kernel-pipeline`,
      pipeline: realization.pipeline,
    });
    commands.push({
      kind: "setComputeBindGroup",
      index: 0,
      resourceKey: `user:${descriptor.name}:kernel-bind`,
      bindGroup: realization.bindGroup,
    });
    const [x, y, z] = realization.workgroups;
    commands.push({
      kind: "dispatchWorkgroups",
      workgroupCountX: x,
      workgroupCountY: y,
      workgroupCountZ: z,
    });
    for (const bufferId of realization.writableBufferIds) {
      autoWrites.push({ handle: bufferId, attachment: "load" });
    }
  }

  const declaredWrites = normalizeUserPassWrites(descriptor.writes);
  const writes = [...declaredWrites];
  for (const autoWrite of autoWrites) {
    if (!writes.some((write) => write.handle === autoWrite.handle)) {
      writes.push(autoWrite);
    }
  }

  return {
    name: descriptor.name,
    kind: "compute",
    reads: descriptor.reads ?? [],
    writes,
    ...(descriptor.before === undefined ? {} : { before: descriptor.before }),
    ...(descriptor.after === undefined ? {} : { after: descriptor.after }),
    ...(descriptor.enabled === undefined
      ? {}
      : { enabled: descriptor.enabled }),
    commands,
  };
}

/** Build graph-ready nodes for every enabled pass in the registry, in order. */
export function buildUserPassNodes(
  registry: WebGpuAppUserPassRegistry,
  resolvers: WebGpuAppPassResolvers,
): WebGpuAppBuiltPassNode[] {
  return registry
    .list()
    .filter((descriptor) => descriptor.enabled !== false)
    .map((descriptor) => buildUserPassNode(descriptor, resolvers));
}

/**
 * AI-12: the shared "registered user passes cannot run on the legacy
 * multi-submit route" diagnostic — emitted by the legacy forward route
 * (frame-boundaries.ts) and the legacy post fallback (post-processing.ts) so a
 * pass that does not run is loud rather than a silent no-op. The FrameGraph
 * routes (forward no-post graph + post-effect graph) are the only routes that
 * execute user passes.
 */
export function createUserPassSkippedOnLegacyRouteDiagnostic(
  passes: readonly string[],
): {
  readonly code: "webgpu.userPass.skippedOnLegacyRoute";
  readonly severity: "warning";
  readonly message: string;
  readonly data: { readonly passes: readonly string[] };
} {
  return {
    code: "webgpu.userPass.skippedOnLegacyRoute",
    severity: "warning",
    message: `Registered user passes ${JSON.stringify(passes)} run only on the FrameGraph routes (forward graph or post-effect graph); the legacy multi-submit route skipped them. Enable useFrameGraph to run them.`,
    data: { passes },
  };
}
