import type { RenderWorldDrawPackage } from "../rendering/index.js";
import type { MeshGpuBufferResource } from "./mesh-buffer-resources.js";

export type DrawCommandDescriptorDiagnosticCode =
  "drawCommand.missingMeshResource";

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

export function createDrawCommandDescriptors(
  packages: readonly RenderWorldDrawPackage[],
  meshResources: readonly MeshGpuBufferResource[],
): DrawCommandDescriptorPlan {
  const meshes = new Map(
    meshResources.map((resource) => [resource.resourceKey, resource]),
  );
  const diagnostics: DrawCommandDescriptorDiagnostic[] = [];
  const descriptors: DrawCommandDescriptor[] = [];

  for (const drawPackage of packages) {
    const mesh = meshes.get(drawPackage.meshResourceKey);

    if (mesh === undefined) {
      diagnostics.push({
        code: "drawCommand.missingMeshResource",
        renderId: drawPackage.renderId,
        resourceKey: drawPackage.meshResourceKey,
        message: `Missing mesh resource '${drawPackage.meshResourceKey}' for render id ${drawPackage.renderId}.`,
      });
      continue;
    }

    descriptors.push({
      renderId: drawPackage.renderId,
      pipelineKey: drawPackage.batchKey.pipelineKey,
      topology: drawPackage.batchKey.topology,
      meshResourceKey: drawPackage.meshResourceKey,
      materialResourceKey: drawPackage.materialResourceKey,
      vertexBufferKeys: mesh.vertexBuffers.map((buffer) => buffer.resourceKey),
      vertexCount: mesh.vertexCount,
      indexBufferKey: mesh.indexBuffer?.resourceKey ?? null,
      indexCount: mesh.indexBuffer?.indexCount ?? null,
      transformPackedOffset: drawPackage.transformPackedOffset,
    });
  }

  return { descriptors, diagnostics };
}
