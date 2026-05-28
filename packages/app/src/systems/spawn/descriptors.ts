import type { Vec3Like } from "@aperture-engine/simulation";
import type {
  PrimitiveMeshDescriptor,
  StandardMaterialDescriptor,
  StandardMaterialOptions,
} from "./types.js";

export const mesh = Object.freeze({
  box(
    options: {
      readonly size?: number | Vec3Like;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("box", options);
  },
  sphere(
    options: {
      readonly radius?: number;
      readonly segments?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("sphere", options);
  },
  capsule(
    options: {
      readonly radius?: number;
      readonly depth?: number;
      readonly segments?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("capsule", options);
  },
  plane(
    options: {
      readonly size?: number | readonly [number, number];
      readonly subdivisions?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("plane", options);
  },
  cylinder(
    options: {
      readonly radius?: number;
      readonly depth?: number;
      readonly segments?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("cylinder", options);
  },
  cone(
    options: {
      readonly radius?: number;
      readonly depth?: number;
      readonly segments?: number;
    } = {},
  ): PrimitiveMeshDescriptor {
    return descriptor("cone", options);
  },
});

export const material = Object.freeze({
  standard(options: StandardMaterialOptions = {}): StandardMaterialDescriptor {
    return Object.freeze({ kind: "standard", options: { ...options } });
  },
});

function descriptor(
  kind: PrimitiveMeshDescriptor["kind"],
  options: Record<string, unknown>,
): PrimitiveMeshDescriptor {
  return Object.freeze({ kind, options: { ...options } });
}
