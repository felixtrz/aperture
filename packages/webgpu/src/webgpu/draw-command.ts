import type { RenderWorldDrawPackage } from "@aperture-engine/render";
import type { InstanceTintGpuBufferResource } from "./instance-tint-buffer.js";
import type { MeshGpuBufferResource } from "./mesh-buffer-resources.js";

export type DrawCommandDescriptorDiagnosticCode =
  | "drawCommand.missingMeshResource"
  | "drawCommand.missingInstanceTintResource"
  | "drawCommand.missingInstanceTintOffset";

export interface DrawCommandDescriptorDiagnostic {
  readonly code: DrawCommandDescriptorDiagnosticCode;
  readonly message: string;
  readonly renderId: number;
  readonly resourceKey: string;
}

export interface DrawCommandDescriptor {
  readonly renderId: number;
  readonly pipelineKey: string;
  readonly topology: RenderWorldDrawPackage["batchKey"]["topology"];
  readonly meshResourceKey: string;
  readonly materialResourceKey: string;
  readonly vertexBufferKeys: readonly string[];
  readonly vertexCount: number;
  readonly indexBufferKey: string | null;
  readonly indexCount: number | null;
  readonly transformPackedOffset: number;
}

export interface DrawCommandDescriptorPlan {
  readonly descriptors: readonly DrawCommandDescriptor[];
  readonly diagnostics: readonly DrawCommandDescriptorDiagnostic[];
}

export interface CreateDrawCommandDescriptorOptions {
  readonly instanceTintResources?: readonly InstanceTintGpuBufferResource[];
}

export interface DrawCommandDescriptorScratch {
  readonly descriptors: DrawCommandDescriptor[];
  readonly diagnostics: DrawCommandDescriptorDiagnostic[];
  readonly descriptorPool: DrawCommandDescriptor[];
  readonly meshByResourceKey: Map<string, MeshGpuBufferResource>;
  readonly plan: DrawCommandDescriptorPlan;
}

interface MutableDrawCommandDescriptor {
  renderId: number;
  pipelineKey: string;
  topology: RenderWorldDrawPackage["batchKey"]["topology"];
  meshResourceKey: string;
  materialResourceKey: string;
  vertexBufferKeys: string[];
  vertexCount: number;
  indexBufferKey: string | null;
  indexCount: number | null;
  transformPackedOffset: number;
}

export function createDrawCommandDescriptors(
  packages: readonly RenderWorldDrawPackage[],
  meshResources: readonly MeshGpuBufferResource[],
  options: CreateDrawCommandDescriptorOptions = {},
): DrawCommandDescriptorPlan {
  const scratch = createDrawCommandDescriptorScratch();

  writeDrawCommandDescriptors(packages, meshResources, scratch, options);

  return scratch.plan;
}

export function createDrawCommandDescriptorScratch(
  capacity = 0,
): DrawCommandDescriptorScratch {
  const descriptors: DrawCommandDescriptor[] = [];
  const diagnostics: DrawCommandDescriptorDiagnostic[] = [];
  const descriptorPool: DrawCommandDescriptor[] = [];

  for (let i = 0; i < capacity; i += 1) {
    descriptorPool.push(createEmptyDescriptor());
  }

  return {
    descriptors,
    diagnostics,
    descriptorPool,
    meshByResourceKey: new Map(),
    plan: { descriptors, diagnostics },
  };
}

export function writeDrawCommandDescriptors(
  packages: readonly RenderWorldDrawPackage[],
  meshResources: readonly MeshGpuBufferResource[],
  scratch: DrawCommandDescriptorScratch,
  options: CreateDrawCommandDescriptorOptions = {},
): DrawCommandDescriptorPlan {
  scratch.descriptors.length = 0;
  scratch.diagnostics.length = 0;
  scratch.meshByResourceKey.clear();

  for (const resource of meshResources) {
    scratch.meshByResourceKey.set(resource.resourceKey, resource);
  }

  for (const drawPackage of packages) {
    const mesh = scratch.meshByResourceKey.get(drawPackage.meshResourceKey);

    if (mesh === undefined) {
      scratch.diagnostics.push({
        code: "drawCommand.missingMeshResource",
        renderId: drawPackage.renderId,
        resourceKey: drawPackage.meshResourceKey,
        message: `Missing mesh resource '${drawPackage.meshResourceKey}' for render id ${drawPackage.renderId}.`,
      });
      continue;
    }

    const descriptor = descriptorAt(scratch, scratch.descriptors.length);

    descriptor.renderId = drawPackage.renderId;
    descriptor.pipelineKey = drawPackage.batchKey.pipelineKey;
    descriptor.topology = drawPackage.batchKey.topology;
    descriptor.meshResourceKey = drawPackage.meshResourceKey;
    descriptor.materialResourceKey = drawPackage.materialResourceKey;
    descriptor.vertexBufferKeys.length = 0;

    for (const buffer of mesh.vertexBuffers) {
      descriptor.vertexBufferKeys.push(buffer.resourceKey);
    }

    if (
      hasPipelineFeature(drawPackage.batchKey.pipelineKey, "instance-tint") &&
      appendInstanceTintBufferKey(drawPackage, descriptor, options, scratch) ===
        false
    ) {
      continue;
    }

    descriptor.vertexCount = mesh.vertexCount;
    descriptor.indexBufferKey = mesh.indexBuffer?.resourceKey ?? null;
    descriptor.indexCount = mesh.indexBuffer?.indexCount ?? null;
    descriptor.transformPackedOffset = drawPackage.transformPackedOffset;
    scratch.descriptors.push(descriptor);
  }

  return scratch.plan;
}

function appendInstanceTintBufferKey(
  drawPackage: RenderWorldDrawPackage,
  descriptor: MutableDrawCommandDescriptor,
  options: CreateDrawCommandDescriptorOptions,
  scratch: DrawCommandDescriptorScratch,
): boolean {
  const instanceTint = options.instanceTintResources?.[0];

  if (drawPackage.packet.instanceTintOffset === undefined) {
    scratch.diagnostics.push({
      code: "drawCommand.missingInstanceTintOffset",
      renderId: drawPackage.renderId,
      resourceKey: drawPackage.materialResourceKey,
      message: `Render id ${drawPackage.renderId} uses an instance-tint pipeline but has no instance tint packet offset.`,
    });
    return false;
  }

  if (instanceTint === undefined) {
    scratch.diagnostics.push({
      code: "drawCommand.missingInstanceTintResource",
      renderId: drawPackage.renderId,
      resourceKey: drawPackage.materialResourceKey,
      message: `Render id ${drawPackage.renderId} uses an instance-tint pipeline but no instance tint vertex buffer is available.`,
    });
    return false;
  }

  descriptor.vertexBufferKeys.push(instanceTint.resourceKey);
  return true;
}

function hasPipelineFeature(pipelineKey: string, feature: string): boolean {
  return pipelineKey.split("|").includes(feature);
}

function descriptorAt(
  scratch: DrawCommandDescriptorScratch,
  index: number,
): MutableDrawCommandDescriptor {
  const existing = scratch.descriptorPool[index] as
    | MutableDrawCommandDescriptor
    | undefined;

  if (existing !== undefined) {
    return existing;
  }

  const descriptor = createEmptyDescriptor();

  scratch.descriptorPool.push(descriptor);
  return descriptor;
}

function createEmptyDescriptor(): MutableDrawCommandDescriptor {
  return {
    renderId: 0,
    pipelineKey: "",
    topology: "triangle-list",
    meshResourceKey: "",
    materialResourceKey: "",
    vertexBufferKeys: [],
    vertexCount: 0,
    indexBufferKey: null,
    indexCount: null,
    transformPackedOffset: 0,
  };
}
