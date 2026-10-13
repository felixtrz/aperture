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
  PassWrite,
  RenderPassNodeInput,
  ComputePassNodeInput,
} from "../render/graph/frame-graph.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import type { ComputePassCommand } from "../render/passes/compute-pass-commands.js";

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
   * Render targets declared by this pass. M3-T7 scope: a render pass is currently
   * drawn over the `"scene-color"` overlay target with LOAD (depth-tested against
   * scene depth); a declared write to a transient/history/swapchain is NOT yet
   * honored for render passes and is reported as a diagnostic. Use a compute pass
   * for arbitrary writable targets (those DO honor their declared writes).
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

export type WebGpuAppPassDescriptor =
  | WebGpuAppRenderPassDescriptor
  | WebGpuAppComputePassDescriptor;

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

function normalizeWrites(
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
  const kind = descriptor.kind === "compute" ? "compute" : "render";
  const recorder = createRecorderContext(descriptor.name, kind, resolvers);
  descriptor.encode(recorder.ctx);

  const shared = {
    name: descriptor.name,
    reads: descriptor.reads ?? [],
    writes: normalizeWrites(descriptor.writes),
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
