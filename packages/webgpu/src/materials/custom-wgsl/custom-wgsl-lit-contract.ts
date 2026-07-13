// A1 (three.js parity plan): WebGPU-side realization metadata for the custom
// WGSL lit contract (`@group(3)`, `CustomWgslMaterialAsset.lighting: "lit"`).
// The contract itself (binding table, WGSL header, version) is defined
// renderer-independently in @aperture-engine/render (materials/lit-contract);
// this module derives the explicit bind group layout descriptors the backend
// creates once per device. Lit pipelines use an EXPLICIT pipeline layout
// (groups 0-3) instead of `layout: "auto"` so ONE renderer-owned group(3)
// bind group is shareable across every lit custom pipeline (auto layouts are
// exclusive to their pipeline); unlit materials keep `"auto"` untouched.

import {
  APERTURE_LIT_BINDING_METADATA,
  APERTURE_LIT_CONTRACT_VERSION,
} from "@aperture-engine/render";

const WEBGPU_SHADER_STAGE_VERTEX = 1;
const WEBGPU_SHADER_STAGE_FRAGMENT = 2;

export const CUSTOM_WGSL_LIT_BIND_GROUP_LAYOUT_KEY = `custom-wgsl/lit/group-3@v${APERTURE_LIT_CONTRACT_VERSION}`;
export const CUSTOM_WGSL_LIT_VIEW_BIND_GROUP_LAYOUT_KEY = `custom-wgsl/lit/group-0@v${APERTURE_LIT_CONTRACT_VERSION}`;
export const CUSTOM_WGSL_LIT_TRANSFORM_BIND_GROUP_LAYOUT_KEY = `custom-wgsl/lit/group-1@v${APERTURE_LIT_CONTRACT_VERSION}`;

/**
 * The shared group(3) lit bind group, shaped like the frame-plan bind group
 * resources so the draw-list binder can select it per lit pipeline (its
 * entryResourceKeys gain each lit pipeline's cache key).
 */
export interface CustomWgslLitBindGroupResource {
  readonly group: 3;
  readonly resourceKey: string;
  readonly layoutKey: string;
  readonly bindGroup: unknown;
  readonly entryResourceKeys: readonly string[];
}

export interface CustomWgslLitBindGroupLayoutEntryDescriptor {
  readonly binding: number;
  readonly visibility: number;
  readonly buffer?: { readonly type: "uniform" | "read-only-storage" };
  readonly texture?: {
    readonly sampleType: "float" | "depth";
    readonly viewDimension: "2d" | "cube";
    readonly multisampled: false;
  };
  readonly sampler?: { readonly type: "filtering" | "comparison" };
}

export interface CustomWgslLitBindGroupLayoutDescriptor {
  readonly label: string;
  readonly entries: readonly CustomWgslLitBindGroupLayoutEntryDescriptor[];
}

/**
 * The fixed group(3) lit layout (all bindings fragment-visible, always
 * present — absent frame resources bind fallbacks, so one layout works every
 * frame). Derived from `APERTURE_LIT_BINDING_METADATA` so the render-package
 * contract table stays the single source of truth.
 */
export function createCustomWgslLitBindGroupLayoutDescriptor(): CustomWgslLitBindGroupLayoutDescriptor {
  return {
    label: CUSTOM_WGSL_LIT_BIND_GROUP_LAYOUT_KEY,
    entries: APERTURE_LIT_BINDING_METADATA.map((binding) => {
      const base = {
        binding: binding.binding,
        visibility: WEBGPU_SHADER_STAGE_FRAGMENT,
      };

      switch (binding.kind) {
        case "read-only-storage-buffer":
          return { ...base, buffer: { type: "read-only-storage" as const } };
        case "uniform-buffer":
          return { ...base, buffer: { type: "uniform" as const } };
        case "depth-texture-2d":
          return {
            ...base,
            texture: {
              sampleType: "depth" as const,
              viewDimension: "2d" as const,
              multisampled: false as const,
            },
          };
        case "comparison-sampler":
          return { ...base, sampler: { type: "comparison" as const } };
        case "float-texture-cube":
          return {
            ...base,
            texture: {
              sampleType: "float" as const,
              viewDimension: "cube" as const,
              multisampled: false as const,
            },
          };
        case "float-texture-2d":
          return {
            ...base,
            texture: {
              sampleType: "float" as const,
              viewDimension: "2d" as const,
              multisampled: false as const,
            },
          };
        case "filtering-sampler":
          return { ...base, sampler: { type: "filtering" as const } };
      }
    }),
  };
}

/**
 * Explicit group(0) layout for lit pipelines: the renderer-owned view
 * uniform. Visibility covers both stages so user shaders may read camera
 * data from either entry point (extra visibility over shader usage is valid).
 */
export function createCustomWgslLitViewBindGroupLayoutDescriptor(): CustomWgslLitBindGroupLayoutDescriptor {
  return {
    label: CUSTOM_WGSL_LIT_VIEW_BIND_GROUP_LAYOUT_KEY,
    entries: [
      {
        binding: 0,
        visibility: WEBGPU_SHADER_STAGE_VERTEX | WEBGPU_SHADER_STAGE_FRAGMENT,
        buffer: { type: "uniform" },
      },
    ],
  };
}

/**
 * Explicit group(1) layout for lit pipelines: the renderer-owned world
 * transform storage array indexed by instance_index.
 */
export function createCustomWgslLitTransformBindGroupLayoutDescriptor(): CustomWgslLitBindGroupLayoutDescriptor {
  return {
    label: CUSTOM_WGSL_LIT_TRANSFORM_BIND_GROUP_LAYOUT_KEY,
    entries: [
      {
        binding: 0,
        visibility: WEBGPU_SHADER_STAGE_VERTEX | WEBGPU_SHADER_STAGE_FRAGMENT,
        buffer: { type: "read-only-storage" },
      },
    ],
  };
}
