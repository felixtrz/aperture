import type { FrameGraphRenderNodeBoundary } from "../render/graph/frame-graph-execute.js";
import {
  type GpuResources,
  resourceRangesOverlap,
  type GpuResourceRef,
} from "@aperture-engine/gpu/internal/resources.js";
import { canonicalUserPassHandle } from "./user-pass.js";
import type { FrameGraph } from "../render/graph/frame-graph.js";
import { createRenderPassAttachmentPlan } from "../render/passes/render-pass-attachments.js";
import type {
  WebGpuAppUserPassRegistry,
  WebGpuAppPassDescriptor,
  WebGpuAppPassWriteInput,
} from "./user-pass.js";
import type { buildFrameBoundaryTargetPlan } from "../render/frame/frame-boundary.js";

const registries = new WeakMap<WebGpuAppUserPassRegistry, GpuResources>();
export function registerUserPassResources(
  registry: WebGpuAppUserPassRegistry,
  resources: GpuResources,
): void {
  registries.set(registry, resources);
}
function ref(handle: string): GpuResourceRef {
  return handle.endsWith("@previous")
    ? { resource: handle.slice(0, -9), history: "previous" }
    : handle.endsWith("@current")
      ? { resource: handle.slice(0, -8), history: "current" }
      : { resource: handle };
}
export function userPassView(
  registry: WebGpuAppUserPassRegistry,
  handle: string,
): unknown {
  return registries.get(registry)?.view(ref(handle), "sampled");
}
export function userPassBuffer(
  registry: WebGpuAppUserPassRegistry,
  handle: string,
): unknown {
  return registries.get(registry)?.buffer(ref(handle)).buffer;
}
export function declareUserPassResources(
  graph: FrameGraph,
  registry: WebGpuAppUserPassRegistry,
  descriptor: WebGpuAppPassDescriptor,
): void {
  const resources = registries.get(registry);
  for (const rawHandle of [
    ...(descriptor.reads ?? []),
    ...(descriptor.writes ?? []).flatMap((write) =>
      typeof write === "string"
        ? [write]
        : [
            write.handle,
            ...(write.resolveTarget === undefined ? [] : [write.resolveTarget]),
          ],
    ),
  ]) {
    const handle = canonicalUserPassHandle(rawHandle);
    if (
      handle === "scene-color" ||
      handle === "depth" ||
      graph.handle(handle) !== undefined
    )
      continue;
    if (resources === undefined)
      throw new Error(
        `User pass '${descriptor.name}' references undeclared resource '${handle}'.`,
      );
    const source = resources.source(ref(handle).resource);
    if (source.kind === "sampler")
      throw new Error("Samplers cannot be graph read/write handles.");
    graph.declareResource({
      id: handle,
      descriptor:
        source.kind === "buffer"
          ? { kind: "buffer", lifetime: "persistent" }
          : {
              kind: source.format.startsWith("depth")
                ? "depth-texture"
                : source.lifetime === "history"
                  ? "history-texture"
                  : "color-texture",
              lifetime:
                source.lifetime === "transient" ? "transient" : "persistent",
              initialized: source.lifetime !== "transient",
              format: source.format,
              sampleCount: source.sampleCount ?? 1,
              ...(source.lifetime === "history" ? { history: true } : {}),
            },
    });
  }
}
/** Both app routes resolve authored attachments through this shared contract. */
export function userPassTargetPlan(options: {
  readonly registry: WebGpuAppUserPassRegistry;
  readonly descriptor: WebGpuAppPassDescriptor;
  readonly base: ReturnType<typeof buildFrameBoundaryTargetPlan>;
  readonly depthView: unknown;
}): ReturnType<typeof buildFrameBoundaryTargetPlan> {
  const { descriptor, base } = options;
  const resources = registries.get(options.registry);
  const writes = (descriptor.writes ?? []).map(
    (write): Exclude<WebGpuAppPassWriteInput, string> =>
      typeof write === "string" ? { handle: write, attachment: "load" } : write,
  );
  const colors: Parameters<
    typeof createRenderPassAttachmentPlan
  >[0]["colorTargets"][number][] = [];
  let depth: Parameters<
    typeof createRenderPassAttachmentPlan
  >[0]["depthTarget"];
  let texture = base.texture;
  const attachmentShapes: { width: number; height: number; samples: number }[] =
    [];
  const resolveRefs: GpuResourceRef[] = [];
  const refs = writes.map((write) => ({
    ...ref(write.handle),
    ...write.subresource,
  }));
  for (let index = 0; index < writes.length; index++) {
    const write = writes[index]!,
      reference = refs[index]!;
    if ((descriptor.reads ?? []).includes(write.handle))
      throw new Error(
        `User pass '${descriptor.name}' reads and writes '${write.handle}' in the same pass. Use history ping-pong.`,
      );
    if (write.handle === "depth") {
      depth = {
        view: options.depthView,
        depthLoadOp: write.attachment ?? "load",
        depthStoreOp: write.store ?? "store",
        depthClearValue: write.clearDepth ?? 1,
      };
      continue;
    }
    if (write.handle === "scene-color") {
      if (base.texture.target === null)
        throw new Error("The scene color attachment is unavailable.");
      const attachment = base.attachments?.plan?.colorAttachments[0];
      colors.push({
        ...(attachment === undefined ? base.texture.target : attachment),
        loadOp: write.attachment ?? "load",
        storeOp: write.store ?? "store",
        ...(write.clearColor === undefined
          ? {}
          : { clearColor: write.clearColor }),
      });
      continue;
    }
    if (resources === undefined)
      throw new Error(`User pass resource '${write.handle}' is unavailable.`);
    for (const read of descriptor.reads ?? []) {
      const input = ref(read);
      if (
        input.resource === reference.resource &&
        resourceRangesOverlap(
          input,
          reference,
          resources.source(reference.resource),
        )
      )
        throw new Error(
          `User pass '${descriptor.name}' reads and writes overlapping '${reference.resource}' subresources.`,
        );
    }
    const source = resources.source(reference.resource),
      target = resources.texture(reference, "attachment"),
      view = resources.view(reference, "attachment");
    if ((reference.layerCount ?? 1) !== 1)
      throw new Error("A render attachment selects exactly one array layer.");
    const width = Math.max(1, target.width >> (reference.mipLevel ?? 0));
    const height = Math.max(1, target.height >> (reference.mipLevel ?? 0));
    if (target.width !== undefined && target.height !== undefined) {
      if (
        attachmentShapes.some(
          (shape) =>
            shape.width !== width ||
            shape.height !== height ||
            shape.samples !== target.sampleCount,
        )
      )
        throw new Error(
          `User pass '${descriptor.name}' attachments must have matching dimensions and sample counts.`,
        );
      attachmentShapes.push({ width, height, samples: target.sampleCount });
    }
    if (write.resolveTarget !== undefined) {
      const destination = ref(write.resolveTarget),
        resolved = resources.texture(destination, "attachment");
      if (
        target.sampleCount <= 1 ||
        resolved.sampleCount !== 1 ||
        resolved.format !== target.format ||
        resolved.width !== width ||
        resolved.height !== height
      )
        throw new Error(
          `User pass '${descriptor.name}' resolve target must match source extent and format, resolve multisampling, and be single-sampled.`,
        );
      if (
        [...refs, ...resolveRefs, ...(descriptor.reads ?? []).map(ref)].some(
          (other) =>
            resourceRangesOverlap(
              destination,
              other,
              resources.source(destination.resource),
            ),
        )
      )
        throw new Error(
          `User pass '${descriptor.name}' resolve target overlaps another attachment or read.`,
        );
      resolveRefs.push(destination);
    }
    for (let other = 0; other < index; other++)
      if (resourceRangesOverlap(reference, refs[other]!, source))
        throw new Error(
          `Overlapping render attachments for '${write.handle}'.`,
        );
    if (source.kind === "texture" && source.format.startsWith("depth"))
      depth = {
        view,
        depthLoadOp: write.attachment ?? "clear",
        depthStoreOp: write.store ?? "store",
        depthClearValue: write.clearDepth ?? 1,
      };
    else {
      const color = {
        view,
        loadOp: write.attachment ?? "clear",
        storeOp: write.store ?? "store",
        clearColor: write.clearColor ?? [0, 0, 0, 0],
        ...(write.resolveTarget === undefined
          ? {}
          : {
              resolveTarget: resources.view(
                ref(write.resolveTarget),
                "attachment",
              ),
            }),
      };
      colors.push(color);
      if (colors.length === 1)
        texture = {
          valid: true,
          texture: target,
          target: color,
          diagnostics: [],
        };
    }
  }
  if (writes.length === 1 && writes[0]!.handle === "scene-color")
    depth = {
      view: options.depthView,
      depthLoadOp: "load",
      depthStoreOp: "store",
    };
  return {
    ...base,
    texture,
    attachments: createRenderPassAttachmentPlan({
      colorTargets: colors,
      ...(depth === undefined ? {} : { depthTarget: depth }),
    }),
  };
}

export function preserveUserPassSceneAttachments(
  payloads: Map<string, FrameGraphRenderNodeBoundary>,
  name: string,
): void {
  const scene = payloads.get(name);
  if (
    scene?.attachments?.plan !== null &&
    scene?.attachments?.plan !== undefined
  )
    payloads.set(name, {
      ...scene,
      attachments: {
        ...scene.attachments,
        plan: {
          ...scene.attachments.plan,
          colorAttachments: scene.attachments.plan.colorAttachments.map(
            (attachment) => ({ ...attachment, storeOp: "store" }),
          ),
        },
      },
    });
}
