import {
  createMergedMeshAsset,
  MergeMeshError,
  type MergeMeshPart,
  type MeshAsset,
  type TriangleListColor,
} from "@aperture-engine/render";
import { composeTrsMatrix } from "@aperture-engine/simulation";
import { ApertureSystemError } from "../errors.js";
import { quatFromEulerDegrees } from "./transforms.js";
import type {
  MergeMeshDescriptorOptions,
  PrimitiveMeshDescriptor,
} from "./types.js";

/**
 * Resolve `mesh.merge()` parts into owned mesh assets and bake them. The
 * descriptor-to-asset converter is passed in so nested merges recurse through
 * the same path as `spawn.mesh`.
 */
export function createMergedPrimitiveMeshAsset(
  options: MergeMeshDescriptorOptions,
  toMeshAsset: (descriptor: PrimitiveMeshDescriptor) => MeshAsset,
): MeshAsset {
  if (!Array.isArray(options.parts) || options.parts.length === 0) {
    throw invalidMerge(
      "parts",
      "must be a non-empty array of { mesh, transform?, color? } parts.",
    );
  }

  const parts = options.parts.map((part, index): MergeMeshPart => {
    const path = `parts[${index}]`;
    const kind: unknown = part?.mesh?.kind;
    if (typeof kind !== "string") {
      throw invalidMerge(
        `${path}.mesh`,
        "must be a primitive descriptor such as mesh.box({ size: 1 }).",
      );
    }
    if (kind === "line-list") {
      throw invalidMerge(
        `${path}.mesh`,
        "is a line list; only triangle primitives can be merged.",
      );
    }
    const transform = part.transform ?? {};
    const rotation =
      transform.rotation ??
      (transform.rotationEulerDegrees === undefined
        ? undefined
        : quatFromEulerDegrees(transform.rotationEulerDegrees));
    return {
      mesh: toMeshAsset(part.mesh),
      matrix: composeTrsMatrix(
        transform.translation,
        rotation,
        transform.scale,
      ),
      ...(part.color === undefined ? {} : { color: readColor(part.color) }),
    };
  });

  try {
    return createMergedMeshAsset(parts, {
      label: options.label ?? "Merged",
      ...(options.flatShading === undefined
        ? {}
        : { flatShading: options.flatShading }),
    });
  } catch (error) {
    if (!(error instanceof MergeMeshError)) throw error;
    throw invalidMerge(error.path, error.message.slice(error.path.length + 1));
  }
}

function readColor(value: ArrayLike<number>): TriangleListColor {
  const values = Array.from(value);
  return values.length >= 4
    ? [values[0]!, values[1]!, values[2]!, values[3]!]
    : [values[0]!, values[1]!, values[2]!];
}

function invalidMerge(path: string, reason: string): ApertureSystemError {
  const diagnostic = {
    code: "aperture.spawn.invalidMergeMesh",
    message: `mesh.merge() ${path} ${reason}`,
    suggestedFix:
      "Pass triangle primitive descriptors (mesh.box, mesh.cylinder, mesh.triangleList, ...) with finite, invertible transforms and [r, g, b] or [r, g, b, a] colors.",
  };
  return new ApertureSystemError(
    diagnostic.code,
    diagnostic.message,
    diagnostic.suggestedFix,
    { path },
  );
}
