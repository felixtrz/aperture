// FrameGraph: the pure, headless-safe data model for a single rendered frame (M3).
//
// A frame is described as a list of named PassNodes (render AND compute) that
// declare which string-named resource handles they read and write. The handles
// plus their descriptors live in a handle map keyed by stable id (mirroring
// PlayCanvas FrameGraph's renderTargetMap keyed by RenderTarget — see
// references/engine/src/scene/frame-graph.js — and three.js PassNode's
// _previousTextures history model in references/three.js/src/nodes/display/PassNode.js;
// concepts borrowed, not code).
//
// This layer has NO GPU side effects: no device, no encoder, no texture
// allocation. It only accumulates JSON-describable metadata + opaque command
// lists. compileFrameGraph (frame-graph-compile.ts) turns it into an ordered,
// load/store-annotated plan. The executor (M3-T2) is the only layer that touches
// the GPU. Keeping this split is an architectural invariant: the graph model
// stays worker/headless-safe.

import type { RenderPassCommand } from "../passes/render-pass-commands.js";
import type { ComputePassCommand } from "../passes/compute-pass-commands.js";

/** Resource categories the v1 graph models. Buffers exist for compute outputs. */
export type ResourceHandleKind =
  | "color-texture"
  | "depth-texture"
  | "history-texture"
  | "swapchain"
  | "buffer";

/**
 * Ownership/lifetime of a handle's backing GPU resource:
 * - `transient`: allocated from the per-frame pool, may alias another transient.
 * - `persistent`: lives across frames (e.g. a history buffer's physical pair).
 * - `imported`: owned outside the graph (the swapchain texture, an external depth).
 */
export type ResourceLifetime = "transient" | "persistent" | "imported";

export interface ResourceHandleDescriptor {
  readonly kind: ResourceHandleKind;
  readonly lifetime: ResourceLifetime;
  readonly width?: number;
  readonly height?: number;
  readonly format?: string;
  readonly sampleCount?: number;
  /** True for double-buffered history handles (current vs previous). */
  readonly history?: boolean;
}

export interface ResourceHandle {
  readonly id: string;
  readonly descriptor: ResourceHandleDescriptor;
}

/** Whether a write clears its attachment first or loads existing contents. */
export type AttachmentIntent = "clear" | "load";

export interface PassWrite {
  /** Stable id of the resource handle being written. */
  readonly handle: string;
  readonly attachment: AttachmentIntent;
  readonly clearColor?: readonly [number, number, number, number];
  readonly clearDepth?: number;
}

export interface PassViewport {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly minDepth?: number;
  readonly maxDepth?: number;
}

export interface PassScissor {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface BasePassNode {
  readonly name: string;
  /** Handle ids this node reads (samples / consumes). Drives ordering edges. */
  readonly reads: readonly string[];
  /** Handle writes with per-write attachment intent. Drives ordering + load/store. */
  readonly writes: readonly PassWrite[];
  /** Optional ordering sugar — compiles down to edges; edges remain the truth. */
  readonly before?: string;
  readonly after?: string;
  readonly enabled?: boolean;
}

export interface RenderPassNode extends BasePassNode {
  readonly kind: "render";
  readonly commands: readonly RenderPassCommand[];
  readonly viewport?: PassViewport;
  readonly scissor?: PassScissor;
}

export interface ComputePassNode extends BasePassNode {
  readonly kind: "compute";
  readonly commands: readonly ComputePassCommand[];
}

export type PassNode = RenderPassNode | ComputePassNode;

/** Inputs accepted by addRenderPass — `enabled` defaults to true. */
export type RenderPassNodeInput = Omit<RenderPassNode, "kind"> & {
  readonly kind?: "render";
};

export type ComputePassNodeInput = Omit<ComputePassNode, "kind"> & {
  readonly kind?: "compute";
};

/**
 * The mutable frame-graph builder. Accumulates handles + nodes for one frame.
 * Construction has no GPU dependency; reuse one instance per app and `reset()`
 * each frame, or build a fresh one — both are headless-safe.
 */
export interface FrameGraph {
  /** Registered handles keyed by id (the renderTargetMap-equivalent). */
  readonly handles: ReadonlyMap<string, ResourceHandle>;
  /** Pass nodes in insertion order (the deterministic topo-sort tiebreaker). */
  readonly nodes: readonly PassNode[];

  addRenderPass(node: RenderPassNodeInput): RenderPassNode;
  addComputePass(node: ComputePassNodeInput): ComputePassNode;

  /** Declare a per-frame transient texture handle (poolable / aliasable). */
  declareTransient(
    id: string,
    descriptor: TransientTextureDescriptor,
  ): ResourceHandle;
  /** Declare a double-buffered history texture (current write / previous read). */
  declareHistory(
    id: string,
    descriptor: HistoryTextureDescriptor,
  ): ResourceHandle;
  /** Import the externally-owned swapchain target. */
  importSwapchain(id?: string): ResourceHandle;
  /** Import an externally-owned depth texture. */
  importDepth(id: string, descriptor?: ImportedDepthDescriptor): ResourceHandle;
  /** Register an arbitrary handle (e.g. a compute output buffer). */
  declareResource(handle: ResourceHandle): ResourceHandle;

  /** Look up a previously declared handle by id. */
  handle(id: string): ResourceHandle | undefined;

  /** Clear nodes + handles for the next frame. */
  reset(): void;
}

export type TransientTextureDescriptor = Omit<
  ResourceHandleDescriptor,
  "lifetime" | "history"
>;

export type HistoryTextureDescriptor = Omit<
  ResourceHandleDescriptor,
  "lifetime" | "history" | "kind"
> & {
  readonly kind?: "history-texture";
};

export type ImportedDepthDescriptor = Omit<
  ResourceHandleDescriptor,
  "lifetime" | "history" | "kind"
> & {
  readonly kind?: "depth-texture";
};

export const SWAPCHAIN_HANDLE_ID = "swapchain";

export function createFrameGraph(): FrameGraph {
  const handles = new Map<string, ResourceHandle>();
  const nodes: PassNode[] = [];

  function declareResource(handle: ResourceHandle): ResourceHandle {
    handles.set(handle.id, handle);
    return handle;
  }

  function addRenderPass(node: RenderPassNodeInput): RenderPassNode {
    const resolved: RenderPassNode = {
      ...node,
      kind: "render",
      enabled: node.enabled ?? true,
    };
    nodes.push(resolved);
    return resolved;
  }

  function addComputePass(node: ComputePassNodeInput): ComputePassNode {
    const resolved: ComputePassNode = {
      ...node,
      kind: "compute",
      enabled: node.enabled ?? true,
    };
    nodes.push(resolved);
    return resolved;
  }

  return {
    handles,
    nodes,

    addRenderPass,
    addComputePass,
    declareResource,

    declareTransient(id, descriptor) {
      return declareResource({
        id,
        descriptor: { ...descriptor, lifetime: "transient" },
      });
    },

    declareHistory(id, descriptor) {
      return declareResource({
        id,
        descriptor: {
          ...descriptor,
          kind: "history-texture",
          lifetime: "persistent",
          history: true,
        },
      });
    },

    importSwapchain(id = SWAPCHAIN_HANDLE_ID) {
      return declareResource({
        id,
        descriptor: { kind: "swapchain", lifetime: "imported" },
      });
    },

    importDepth(id, descriptor) {
      return declareResource({
        id,
        descriptor: {
          ...descriptor,
          kind: "depth-texture",
          lifetime: "imported",
        },
      });
    },

    handle(id) {
      return handles.get(id);
    },

    reset() {
      handles.clear();
      nodes.length = 0;
    },
  };
}
