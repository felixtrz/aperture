import type { DracoMeshDecoder } from "./draco-decoder.js";
import type { MeshoptBufferDecoder } from "./meshopt-decoder.js";

export async function resolveDracoDecoder(input: {
  readonly root: Record<string, unknown> | null;
  readonly provided: DracoMeshDecoder | undefined;
  readonly create: (() => PromiseLike<DracoMeshDecoder>) | undefined;
}): Promise<DracoMeshDecoder | undefined> {
  if (input.provided !== undefined || !gltfUsesDraco(input.root)) {
    return input.provided;
  }

  return input.create?.();
}

export async function resolveMeshoptDecoder(input: {
  readonly root: Record<string, unknown> | null;
  readonly provided: MeshoptBufferDecoder | undefined;
  readonly create: (() => PromiseLike<MeshoptBufferDecoder>) | undefined;
}): Promise<MeshoptBufferDecoder | undefined> {
  if (input.provided !== undefined || !gltfUsesMeshopt(input.root)) {
    return input.provided;
  }

  return input.create?.();
}

function gltfUsesDraco(root: Record<string, unknown> | null): boolean {
  return (
    root !== null &&
    (stringArray(root.extensionsUsed).includes("KHR_draco_mesh_compression") ||
      stringArray(root.extensionsRequired).includes(
        "KHR_draco_mesh_compression",
      ))
  );
}

function gltfUsesMeshopt(root: Record<string, unknown> | null): boolean {
  if (root === null) {
    return false;
  }

  const used = stringArray(root.extensionsUsed);
  const required = stringArray(root.extensionsRequired);

  return (
    used.includes("EXT_meshopt_compression") ||
    used.includes("KHR_meshopt_compression") ||
    required.includes("EXT_meshopt_compression") ||
    required.includes("KHR_meshopt_compression")
  );
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
