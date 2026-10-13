import {
  createRenderResourceInspectionReport,
  type RenderResourceInspectionRecord,
  type RenderResourceInspectionReport,
  type RenderResourceInspectionStatus,
} from "../../resources/core/resource-lifecycle.js";
import type { StandardMaterialGpuBufferResource } from "./standard-material-buffer-resource.js";

export interface StandardMaterialResourceInspectionInput {
  readonly assetKey: string;
  readonly expectedResourceKey: string;
  readonly resource: StandardMaterialGpuBufferResource | null;
  readonly version?: number | string;
  readonly expectedVersion?: number | string;
  readonly pendingDestroy?: boolean;
}

export function createStandardMaterialResourceInspectionRecords(
  inputs: readonly StandardMaterialResourceInspectionInput[],
): readonly RenderResourceInspectionRecord[] {
  return inputs.map((input) => {
    const status = standardMaterialResourceStatus(input);

    return {
      kind: "material",
      assetKey: input.assetKey,
      resourceKey: input.resource?.resourceKey ?? input.expectedResourceKey,
      ...(input.version === undefined ? {} : { version: input.version }),
      ...(input.expectedVersion === undefined
        ? {}
        : { expectedVersion: input.expectedVersion }),
      status,
      pendingDestroy: input.pendingDestroy ?? status === "pending-destroy",
    };
  });
}

export function createStandardMaterialResourceInspectionReport(
  inputs: readonly StandardMaterialResourceInspectionInput[],
): RenderResourceInspectionReport {
  return createRenderResourceInspectionReport(
    createStandardMaterialResourceInspectionRecords(inputs),
  );
}

function standardMaterialResourceStatus(
  input: StandardMaterialResourceInspectionInput,
): RenderResourceInspectionStatus {
  if (input.pendingDestroy === true) {
    return "pending-destroy";
  }

  if (input.resource === null) {
    return "missing";
  }

  if (
    input.version !== undefined &&
    input.expectedVersion !== undefined &&
    input.version !== input.expectedVersion
  ) {
    return "stale";
  }

  return "live";
}
