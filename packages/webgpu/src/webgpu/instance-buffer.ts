export const INSTANCE_TRANSFORM_FLOATS = 16;
export const INSTANCE_TRANSFORM_BYTES = INSTANCE_TRANSFORM_FLOATS * 4;

export interface InstanceTransformVertexBufferLayoutOptions {
  readonly shaderLocationStart?: number;
}

export function createInstanceTransformData(
  matrices: readonly ArrayLike<number>[],
): Float32Array {
  const data = new Float32Array(matrices.length * INSTANCE_TRANSFORM_FLOATS);

  matrices.forEach((matrix, index) => {
    if (matrix.length !== INSTANCE_TRANSFORM_FLOATS) {
      throw new Error(
        `Instance transform ${index} must contain ${INSTANCE_TRANSFORM_FLOATS} floats.`,
      );
    }

    data.set(Array.from(matrix), index * INSTANCE_TRANSFORM_FLOATS);
  });

  return data;
}

export function createInstanceTransformVertexBufferLayout(
  options: InstanceTransformVertexBufferLayoutOptions = {},
): GPUVertexBufferLayout {
  const shaderLocationStart = options.shaderLocationStart ?? 4;

  return {
    arrayStride: INSTANCE_TRANSFORM_BYTES,
    stepMode: "instance",
    attributes: [0, 1, 2, 3].map((column) => ({
      shaderLocation: shaderLocationStart + column,
      offset: column * 16,
      format: "float32x4" as GPUVertexFormat,
    })),
  };
}
