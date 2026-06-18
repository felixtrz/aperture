import {
  APERTURE_MCP_RUNTIME_GLOBAL,
  APERTURE_STATUS_GLOBAL,
} from "../session.js";

export const STATUS_GLOBAL = APERTURE_STATUS_GLOBAL;
export const RUNTIME_GLOBAL = APERTURE_MCP_RUNTIME_GLOBAL;
export const RENDER_DIAGNOSTICS_PROPERTY = "__apertureRenderDiagnostics";

export interface ApertureToolCallOptions {
  readonly cwd: string;
  readonly name: string;
  readonly arguments?: Record<string, unknown>;
}

export interface GeneratedStatusLike {
  readonly status?: string;
  readonly snapshots?: number;
  readonly lastFrame?: number | null;
  readonly lastFailure?: unknown;
  readonly diagnostics?: {
    readonly lastFrame?: {
      readonly frame?: number;
      readonly counts?: unknown;
      readonly diagnostics?: readonly unknown[];
      readonly renderChangeSet?: {
        readonly views?: unknown;
        readonly meshDraws?: unknown;
        readonly lights?: unknown;
        readonly environments?: unknown;
        readonly shadowRequests?: unknown;
        readonly bounds?: unknown;
        readonly total?: unknown;
        readonly keys?: {
          readonly meshDraws?: {
            readonly changed?: readonly string[];
            readonly unchanged?: readonly string[];
          };
          readonly views?: unknown;
          readonly lights?: unknown;
          readonly environments?: unknown;
          readonly shadowRequests?: unknown;
          readonly bounds?: {
            readonly changed?: readonly string[];
            readonly unchanged?: readonly string[];
          };
        };
      };
    };
  };
  readonly lastWorkerSummary?: {
    readonly diagnostics?: readonly unknown[];
    readonly particles?: unknown;
    readonly entities?: {
      readonly summaries?: readonly unknown[];
    };
  };
}
