import type { RenderWorldDrawPackage } from "@aperture-engine/render";
import type { InstanceAttributeGpuBufferResource } from "../../resources/attributes/instance-attribute-buffer.js";
import type { InstanceTintGpuBufferResource } from "../../resources/attributes/instance-tint-buffer.js";
import { requiredBindGroupGroupsForPipelineKey } from "../../materials/core/material-pipeline-selection.js";
import type { MeshGpuBufferResource } from "../../resources/meshes/mesh-buffer-resources.js";

export type DrawCommandDescriptorDiagnosticCode =
  | "drawCommand.missingMeshResource"
  | "drawCommand.missingInstanceAttributeResource"
  | "drawCommand.missingInstanceAttributePacket"
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
  readonly requiredBindGroupGroups?: readonly number[];
  readonly topology: RenderWorldDrawPackage["batchKey"]["topology"];
  readonly meshResourceKey: string;
  readonly materialResourceKey: string;
  readonly vertexBufferKeys: readonly string[];
  readonly vertexCount: number;
  readonly vertexStart?: number;
  readonly indexBufferKey: string | null;
  readonly indexCount: number | null;
  readonly indexStart?: number | null;
  readonly transformPackedOffset: number;
  readonly occlusionQuery?: boolean;
}

export interface DrawCommandDescriptorPlan {
  readonly descriptors: readonly DrawCommandDescriptor[];
  readonly diagnostics: readonly DrawCommandDescriptorDiagnostic[];
}

export interface CreateDrawCommandDescriptorOptions {
  readonly instanceTintResources?: readonly InstanceTintGpuBufferResource[];
  readonly instanceAttributeResources?: readonly InstanceAttributeGpuBufferResource[];
  readonly pipelineKeysByRenderId?: ReadonlyMap<number, string>;
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
  requiredBindGroupGroups?: readonly number[];
  topology: RenderWorldDrawPackage["batchKey"]["topology"];
  meshResourceKey: string;
  materialResourceKey: string;
  vertexBufferKeys: string[];
  vertexCount: number;
  vertexStart: number;
  indexBufferKey: string | null;
  indexCount: number | null;
  indexStart: number | null;
  transformPackedOffset: number;
  occlusionQuery?: boolean;
}

/**
 * The canonical pipeline key carried by a draw's render-pass commands. When a
 * prepared GPU pipeline exists for the draw, frame preparation records its
 * resolved cache key in `pipelineKeysByRenderId`; otherwise commands fall back
 * to the authored batch pipeline key. Every consumer that needs to match a
 * draw's `setPipeline` command key (e.g. ID-buffer pick pipeline preparation)
 * must derive it through this helper so creation and lookup cannot drift.
 */
export function resolveDrawCommandPipelineKey(
  renderId: number,
  authoredPipelineKey: string,
  pipelineKeysByRenderId?: ReadonlyMap<number, string>,
): string {
  return pipelineKeysByRenderId?.get(renderId) ?? authoredPipelineKey;
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
    const authoredPipelineKey = drawPackage.batchKey.pipelineKey;
    const resolvedPipelineKey = resolveDrawCommandPipelineKey(
      drawPackage.renderId,
      authoredPipelineKey,
      options.pipelineKeysByRenderId,
    );

    descriptor.renderId = drawPackage.renderId;
    descriptor.pipelineKey = resolvedPipelineKey;
    if (resolvedPipelineKey === authoredPipelineKey) {
      delete descriptor.requiredBindGroupGroups;
    } else {
      descriptor.requiredBindGroupGroups =
        requiredBindGroupGroupsForPipelineKey(authoredPipelineKey);
    }
    descriptor.topology = drawPackage.batchKey.topology;
    descriptor.meshResourceKey = drawPackage.meshResourceKey;
    descriptor.materialResourceKey = drawPackage.materialResourceKey;
    descriptor.vertexBufferKeys.length = 0;

    for (const buffer of mesh.vertexBuffers) {
      descriptor.vertexBufferKeys.push(buffer.resourceKey);
    }

    if (
      hasPipelineFeature(authoredPipelineKey, "instance-tint") &&
      appendInstanceTintBufferKey(drawPackage, descriptor, options, scratch) ===
        false
    ) {
      continue;
    }

    if (
      pipelineUsesInstanceAttributes(authoredPipelineKey) &&
      appendInstanceAttributeBufferKey(
        drawPackage,
        descriptor,
        options,
        scratch,
      ) === false
    ) {
      continue;
    }

    descriptor.vertexCount = drawPackage.packet.vertexCount ?? mesh.vertexCount;
    descriptor.vertexStart = drawPackage.packet.vertexStart ?? 0;
    descriptor.indexBufferKey = mesh.indexBuffer?.resourceKey ?? null;
    descriptor.indexCount =
      mesh.indexBuffer === undefined
        ? null
        : (drawPackage.packet.indexCount ?? mesh.indexBuffer.indexCount);
    descriptor.indexStart =
      mesh.indexBuffer === undefined
        ? null
        : (drawPackage.packet.indexStart ?? 0);
    descriptor.transformPackedOffset = drawPackage.transformPackedOffset;
    if (drawPackage.packet.occlusionQuery === true) {
      descriptor.occlusionQuery = true;
    } else {
      delete descriptor.occlusionQuery;
    }
    scratch.descriptors.push(descriptor);
  }

  return scratch.plan;
}

function appendInstanceAttributeBufferKey(
  drawPackage: RenderWorldDrawPackage,
  descriptor: MutableDrawCommandDescriptor,
  options: CreateDrawCommandDescriptorOptions,
  scratch: DrawCommandDescriptorScratch,
): boolean {
  const instanceAttributes = options.instanceAttributeResources?.[0];

  if (drawPackage.packet.instanceAttributePacketIndex === undefined) {
    scratch.diagnostics.push({
      code: "drawCommand.missingInstanceAttributePacket",
      renderId: drawPackage.renderId,
      resourceKey: drawPackage.materialResourceKey,
      message: `Render id ${drawPackage.renderId} uses an instance-attribute pipeline but has no instance attribute packet.`,
    });
    return false;
  }

  if (instanceAttributes === undefined) {
    scratch.diagnostics.push({
      code: "drawCommand.missingInstanceAttributeResource",
      renderId: drawPackage.renderId,
      resourceKey: drawPackage.materialResourceKey,
      message: `Render id ${drawPackage.renderId} uses an instance-attribute pipeline but no instance attribute vertex buffer is available.`,
    });
    return false;
  }

  descriptor.vertexBufferKeys.push(instanceAttributes.resourceKey);
  return true;
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

function pipelineUsesInstanceAttributes(pipelineKey: string): boolean {
  const prefix = "instance-attributes:";

  return pipelineKey
    .split("|")
    .some(
      (feature) => feature.startsWith(prefix) && feature !== `${prefix}none`,
    );
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
    vertexStart: 0,
    indexBufferKey: null,
    indexCount: null,
    indexStart: null,
    transformPackedOffset: 0,
  };
}
