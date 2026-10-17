import type {
  NodeDeviceMetadata,
  NodeDeviceOptions,
} from "@aperture-engine/adapter-node";
import type {
  ApertureRenderSessionRenderOptions,
  RenderBundleResult,
} from "./types.js";

export type DawnWorkerRequest =
  | {
      readonly id: number;
      readonly kind: "initialize";
      readonly options: NodeDeviceOptions;
    }
  | {
      readonly id: number;
      readonly kind: "render";
      readonly options: ApertureRenderSessionRenderOptions;
    }
  | { readonly id: number; readonly kind: "dispose" };

export type DawnWorkerResponse =
  | {
      readonly id: number;
      readonly ok: true;
      readonly result: NodeDeviceMetadata | RenderBundleResult | null;
    }
  | {
      readonly id: number;
      readonly ok: false;
      readonly error: string;
      readonly code: string;
    };
