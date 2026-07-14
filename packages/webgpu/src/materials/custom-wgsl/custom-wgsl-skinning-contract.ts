// F3 (three.js parity plan): WebGPU-side realization metadata for the custom
// WGSL skinning contract (`@group(1) @binding(1)`,
// `CustomWgslMaterialAsset.skinned: true`). The contract itself (group/binding,
// WGSL header, version, vertex-attribute locations) is defined
// renderer-independently in @aperture-engine/render (materials/skinning-contract);
// this module derives the group(1) skin binding metadata the backend uses to
// (a) add the joint palette to the shared group(1) transforms bind group and
// (b) extend the explicit group(1) layout for the lit+skinned pipeline layout.
//
// The palette buffer is the SAME renderer-owned skinning-joint buffer the
// standard skinned path binds (snapshot bones ->
// resources/attributes/skinning-joint-buffer), bound at group(1) binding(1) —
// the StandardMaterial skinned convention. A skinned custom pipeline uses either
// `layout: "auto"` (unlit+skinned — the shader statically declares the group(1)
// binding(1), so the auto layout exposes it via getBindGroupLayout(1)) or, for
// lit+skinned, an EXPLICIT pipeline layout whose group(1) layout adds binding 1.

import {
  APERTURE_SKINNED_BINDING,
  APERTURE_SKINNED_CONTRACT_VERSION,
} from "@aperture-engine/render";

const WEBGPU_SHADER_STAGE_VERTEX = 1;

/**
 * The world-transform buffer binding (@group(1) @binding(0)) the skinned
 * transforms group shares with the unlit/lit layout.
 */
export const CUSTOM_WGSL_WORLD_TRANSFORM_BINDING = 0;

export const CUSTOM_WGSL_SKINNED_TRANSFORM_BIND_GROUP_LAYOUT_KEY = `custom-wgsl/skinned/group-1@v${APERTURE_SKINNED_CONTRACT_VERSION}`;

export interface CustomWgslSkinnedTransformBindGroupLayoutEntryDescriptor {
  readonly binding: number;
  readonly visibility: number;
  readonly buffer: { readonly type: "read-only-storage" };
}

export interface CustomWgslSkinnedTransformBindGroupLayoutDescriptor {
  readonly label: string;
  readonly entries: readonly CustomWgslSkinnedTransformBindGroupLayoutEntryDescriptor[];
}

/**
 * The explicit group(1) layout for a lit+skinned pipeline: the renderer-owned
 * world transforms (@binding 0) PLUS the joint palette (@binding 1). Both are
 * vertex-visible read-only storage buffers. A lit-only pipeline uses the
 * single-binding transform layout instead (this one adds binding 1).
 */
export function createCustomWgslSkinnedTransformBindGroupLayoutDescriptor(): CustomWgslSkinnedTransformBindGroupLayoutDescriptor {
  return {
    label: CUSTOM_WGSL_SKINNED_TRANSFORM_BIND_GROUP_LAYOUT_KEY,
    entries: [
      {
        binding: CUSTOM_WGSL_WORLD_TRANSFORM_BINDING,
        visibility: WEBGPU_SHADER_STAGE_VERTEX,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: APERTURE_SKINNED_BINDING,
        visibility: WEBGPU_SHADER_STAGE_VERTEX,
        buffer: { type: "read-only-storage" },
      },
    ],
  };
}
