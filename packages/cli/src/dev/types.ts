import type {
  ApertureDevSession,
  ApertureDevSessionLogFiles,
} from "../session.js";

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 5173;
export const DEFAULT_TIMEOUT_MS = 30_000;
export const VITE_CONFIG_FILE = "vite.config.ts";

/**
 * WebGPU rendering backend for the managed browser. `auto` detects whether the
 * host has a GPU and falls back to SwiftShader (`software`) when it does not.
 */
export type ApertureGpuMode = "auto" | "hardware" | "software";

export class ApertureDevSessionError extends Error {
  readonly code: string;
  readonly exitCode: number;

  constructor(code: string, message: string, exitCode = 1) {
    super(message);
    this.name = "ApertureDevSessionError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

export interface ApertureDevUpOptions {
  readonly cwd: string;
  readonly entryPoint: string;
  readonly host?: string;
  readonly port?: number;
  readonly open?: boolean;
  readonly headless?: boolean;
  readonly strictPort?: boolean;
  readonly gpu?: ApertureGpuMode;
  readonly timeoutMs?: number;
}

export interface ApertureDevDaemonOptions {
  readonly cwd: string;
  readonly host?: string;
  readonly port?: number;
  readonly open?: boolean;
  readonly headless?: boolean;
  readonly strictPort?: boolean;
  readonly gpu?: ApertureGpuMode;
}

export interface ApertureDevDownOptions {
  readonly cwd: string;
  readonly timeoutMs?: number;
}

export interface ApertureDevLogsOptions {
  readonly cwd: string;
  readonly lines?: number;
}

export interface ApertureDevUpReport {
  readonly session: ApertureDevSession;
  readonly reused: boolean;
}

export interface ApertureDevDownReport {
  readonly hadSession: boolean;
  readonly stopped: boolean;
}

export interface ApertureDevLogsReport {
  readonly session: ApertureDevSession | null;
  readonly logs: readonly {
    readonly name: keyof ApertureDevSessionLogFiles;
    readonly file: string;
    readonly text: string;
  }[];
}

export interface ResolveApertureDevServerPortOptions {
  readonly host: string;
  readonly port: number;
  readonly strictPort: boolean;
}

export interface ManagedBrowser {
  readonly pid: number | null;
  readonly close: () => Promise<void>;
}
