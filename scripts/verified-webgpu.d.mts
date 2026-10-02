export interface VerifiedSceneOptions {
  runtimeRoot: string;
  url: string;
  scratchRoot: string;
  outputPath: string;
  screenshotPath?: string;
  readyGlobal?: string;
  bundlePath?: string;
  timeout?: number;
  viewport?: { width: number; height: number };
}

export interface VerifiedSceneReport {
  schema: number;
  status: "passed" | "failed";
  browserVersion?: string;
  launch?: { actualArgv: string[] };
  sceneStatus?: unknown;
}

export function runVerifiedScene(
  options: VerifiedSceneOptions,
): Promise<VerifiedSceneReport>;
export function validateViewport(viewport: { width: number; height: number }): {
  width: number;
  height: number;
};
