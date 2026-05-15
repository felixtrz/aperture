import type {
  MeshDrawPacket,
  RenderDiagnostic,
  RenderSnapshot,
} from "./snapshot.js";

export type RenderWorldObjectStatus = "active";

export interface RenderWorldGpuPlaceholders {
  readonly meshResourceKey: string | null;
  readonly materialResourceKey: string | null;
}

export interface RenderWorldObject {
  readonly renderId: number;
  readonly status: RenderWorldObjectStatus;
  readonly packet: MeshDrawPacket;
  readonly gpu: RenderWorldGpuPlaceholders;
}

export interface RenderWorldResourceBindingUpdate {
  readonly meshResourceKey?: string | null;
  readonly materialResourceKey?: string | null;
}

export type RenderWorldDrawBlockReason =
  | "missing-mesh-resource"
  | "missing-material-resource";

export interface RenderWorldReadyDraw {
  readonly renderId: number;
  readonly packet: MeshDrawPacket;
  readonly meshResourceKey: string;
  readonly materialResourceKey: string;
  readonly batchKey: MeshDrawPacket["batchKey"];
}

export interface RenderWorldBlockedDraw {
  readonly renderId: number;
  readonly packet: MeshDrawPacket;
  readonly missing: readonly RenderWorldDrawBlockReason[];
}

export interface RenderWorldDrawReadinessReport {
  readonly ready: readonly RenderWorldReadyDraw[];
  readonly blocked: readonly RenderWorldBlockedDraw[];
  readonly diagnostics: readonly RenderDiagnostic[];
}

export interface RenderWorldResourceBindingSuccess {
  readonly ok: true;
  readonly object: RenderWorldObject;
}

export interface RenderWorldResourceBindingFailure {
  readonly ok: false;
  readonly reason: "missing-render-id";
  readonly diagnostics: readonly RenderDiagnostic[];
}

export type RenderWorldResourceBindingResult =
  | RenderWorldResourceBindingSuccess
  | RenderWorldResourceBindingFailure;

export interface RenderWorldApplyReport {
  readonly created: number;
  readonly updated: number;
  readonly removed: number;
  readonly active: number;
  readonly diagnostics: readonly RenderDiagnostic[];
}

export class RenderWorld {
  readonly #objects = new Map<number, RenderWorldObject>();

  get size(): number {
    return this.#objects.size;
  }

  getObject(renderId: number): RenderWorldObject | undefined {
    return this.#objects.get(renderId);
  }

  listObjects(): RenderWorldObject[] {
    return [...this.#objects.values()].sort((a, b) => a.renderId - b.renderId);
  }

  createDrawReadinessReport(): RenderWorldDrawReadinessReport {
    return planRenderWorldDrawReadiness(this.listObjects());
  }

  updateResourceBindings(
    renderId: number,
    update: RenderWorldResourceBindingUpdate,
  ): RenderWorldResourceBindingResult {
    const existing = this.#objects.get(renderId);

    if (existing === undefined) {
      return {
        ok: false,
        reason: "missing-render-id",
        diagnostics: [
          {
            code: "renderWorld.missingRenderId",
            message: `Cannot update resource bindings for missing render id ${renderId}.`,
            severity: "warning",
          },
        ],
      };
    }

    const object: RenderWorldObject = {
      ...existing,
      gpu: {
        meshResourceKey:
          update.meshResourceKey === undefined
            ? existing.gpu.meshResourceKey
            : update.meshResourceKey,
        materialResourceKey:
          update.materialResourceKey === undefined
            ? existing.gpu.materialResourceKey
            : update.materialResourceKey,
      },
    };

    this.#objects.set(renderId, object);
    return { ok: true, object };
  }

  applySnapshot(snapshot: RenderSnapshot): RenderWorldApplyReport {
    const diagnostics: RenderDiagnostic[] = [];
    const seen = new Set<number>();
    const next = new Map<number, RenderWorldObject>();
    let created = 0;
    let updated = 0;

    for (const packet of snapshot.meshDraws) {
      if (seen.has(packet.renderId)) {
        diagnostics.push({
          code: "renderWorld.duplicateRenderId",
          message: `Duplicate render id ${packet.renderId} in snapshot.`,
          severity: "error",
        });
        continue;
      }

      seen.add(packet.renderId);

      const existing = this.#objects.get(packet.renderId);

      if (existing === undefined) {
        created += 1;
      } else {
        updated += 1;
      }

      next.set(packet.renderId, {
        renderId: packet.renderId,
        status: "active",
        packet,
        gpu: existing?.gpu ?? {
          meshResourceKey: null,
          materialResourceKey: null,
        },
      });
    }

    const removed = [...this.#objects.keys()].filter(
      (renderId) => !seen.has(renderId),
    ).length;

    this.#objects.clear();

    for (const [renderId, object] of next) {
      this.#objects.set(renderId, object);
    }

    return {
      created,
      updated,
      removed,
      active: this.#objects.size,
      diagnostics,
    };
  }
}

export function planRenderWorldDrawReadiness(
  objects: readonly RenderWorldObject[],
): RenderWorldDrawReadinessReport {
  const ready: RenderWorldReadyDraw[] = [];
  const blocked: RenderWorldBlockedDraw[] = [];
  const diagnostics: RenderDiagnostic[] = [];

  if (objects.length === 0) {
    diagnostics.push({
      code: "renderWorld.empty",
      message: "Render world has no active draw objects.",
      severity: "info",
    });
  }

  for (const object of objects) {
    const meshResourceKey = object.gpu.meshResourceKey;
    const materialResourceKey = object.gpu.materialResourceKey;
    const missing: RenderWorldDrawBlockReason[] = [];

    if (meshResourceKey === null) {
      missing.push("missing-mesh-resource");
      diagnostics.push({
        code: "renderWorld.missingMeshResource",
        message: `Render object ${object.renderId} is missing a mesh resource binding.`,
        severity: "warning",
        entity: object.packet.entity,
      });
    }

    if (materialResourceKey === null) {
      missing.push("missing-material-resource");
      diagnostics.push({
        code: "renderWorld.missingMaterialResource",
        message: `Render object ${object.renderId} is missing a material resource binding.`,
        severity: "warning",
        entity: object.packet.entity,
      });
    }

    if (meshResourceKey === null || materialResourceKey === null) {
      blocked.push({
        renderId: object.renderId,
        packet: object.packet,
        missing,
      });
      continue;
    }

    ready.push({
      renderId: object.renderId,
      packet: object.packet,
      meshResourceKey,
      materialResourceKey,
      batchKey: object.packet.batchKey,
    });
  }

  return { ready, blocked, diagnostics };
}
