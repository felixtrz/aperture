import {
  createMeshBvh,
  deserializeMeshBvh,
  type MeshBvh,
  type MeshBvhBuildOptions,
  type SerializedMeshBvh,
  type SpatialDiagnostic,
  type SpatialTriangleMesh,
} from "./mesh-bvh.js";

export const MESH_BVH_WORKER_BUILD = "aperture.mesh-bvh.build" as const;
export const MESH_BVH_WORKER_BUILT = "aperture.mesh-bvh.built" as const;

export interface MeshBvhWorkerBuildMessage {
  readonly type: typeof MESH_BVH_WORKER_BUILD;
  readonly id: string;
  readonly mesh: SpatialTriangleMesh;
  readonly options?: MeshBvhBuildOptions;
}

export interface MeshBvhWorkerBuiltMessage {
  readonly type: typeof MESH_BVH_WORKER_BUILT;
  readonly id: string;
  readonly serialized: SerializedMeshBvh | null;
  readonly diagnostics: readonly SpatialDiagnostic[];
}

export interface MeshBvhWorkerLike {
  postMessage(
    message: MeshBvhWorkerBuildMessage,
    transfer?: Transferable[],
  ): void;
  addEventListener?(
    type: "message",
    listener: (event: { readonly data: unknown }) => void,
  ): void;
  removeEventListener?(
    type: "message",
    listener: (event: { readonly data: unknown }) => void,
  ): void;
  onmessage?: ((event: { readonly data: unknown }) => void) | null;
}

let nextWorkerBuildId = 1;

export function createMeshBvhWorkerBuildMessage(
  mesh: SpatialTriangleMesh,
  options: MeshBvhBuildOptions = {},
  id = `mesh-bvh-build-${nextWorkerBuildId++}`,
): MeshBvhWorkerBuildMessage {
  return { type: MESH_BVH_WORKER_BUILD, id, mesh, options };
}

export function createMeshBvhWorkerBuiltMessage(
  message: MeshBvhWorkerBuildMessage,
): MeshBvhWorkerBuiltMessage {
  try {
    return {
      type: MESH_BVH_WORKER_BUILT,
      id: message.id,
      serialized: createMeshBvh(message.mesh, message.options).serialize(),
      diagnostics: [],
    };
  } catch (error) {
    return {
      type: MESH_BVH_WORKER_BUILT,
      id: message.id,
      serialized: null,
      diagnostics: [
        {
          code: "spatial.mesh-bvh.build-failed",
          severity: "error",
          message: "Worker mesh BVH build failed.",
          suggestedFix:
            "Validate mesh CPU buffers and retry with supported triangle-list data.",
          data: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
      ],
    };
  }
}

export function buildMeshBvhWithWorker(
  worker: MeshBvhWorkerLike,
  mesh: SpatialTriangleMesh,
  options: MeshBvhBuildOptions = {},
): Promise<MeshBvh> {
  const message = createMeshBvhWorkerBuildMessage(mesh, options);

  return new Promise((resolve, reject) => {
    const onMessage = (event: { readonly data: unknown }) => {
      const data = event.data;

      if (!isBuiltMessage(data) || data.id !== message.id) {
        return;
      }

      removeWorkerListener(worker, onMessage);

      if (data.serialized === null) {
        reject(
          new Error(
            data.diagnostics[0]?.message ?? "Worker mesh BVH build failed.",
          ),
        );
        return;
      }

      resolve(deserializeMeshBvh(mesh, data.serialized));
    };

    addWorkerListener(worker, onMessage);
    worker.postMessage(message);
  });
}

export function collectMeshBvhBuildTransferables(
  mesh: SpatialTriangleMesh,
): Transferable[] {
  const transfer = new Set<Transferable>();

  collectTransferableBuffer(mesh.positions.data, transfer);

  if (mesh.indices !== undefined) {
    collectTransferableBuffer(mesh.indices, transfer);
  }

  if (mesh.normals !== undefined) {
    collectTransferableBuffer(mesh.normals.data, transfer);
  }

  if (mesh.uvs !== undefined) {
    collectTransferableBuffer(mesh.uvs.data, transfer);
  }

  return [...transfer];
}

function addWorkerListener(
  worker: MeshBvhWorkerLike,
  listener: (event: { readonly data: unknown }) => void,
): void {
  if (worker.addEventListener !== undefined) {
    worker.addEventListener("message", listener);
    return;
  }

  worker.onmessage = listener;
}

function removeWorkerListener(
  worker: MeshBvhWorkerLike,
  listener: (event: { readonly data: unknown }) => void,
): void {
  if (worker.removeEventListener !== undefined) {
    worker.removeEventListener("message", listener);
    return;
  }

  if (worker.onmessage === listener) {
    worker.onmessage = null;
  }
}

function isBuiltMessage(value: unknown): value is MeshBvhWorkerBuiltMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly type?: unknown }).type === MESH_BVH_WORKER_BUILT &&
    typeof (value as { readonly id?: unknown }).id === "string"
  );
}

function collectTransferableBuffer(
  values: ArrayLike<number>,
  transfer: Set<Transferable>,
): void {
  if (!ArrayBuffer.isView(values)) {
    return;
  }

  const buffer = values.buffer;

  if (buffer instanceof ArrayBuffer) {
    transfer.add(buffer);
  }
}
