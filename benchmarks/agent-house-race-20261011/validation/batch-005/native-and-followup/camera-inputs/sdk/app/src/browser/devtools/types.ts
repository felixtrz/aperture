export interface GeneratedBrowserDevtoolsToolResult {
  readonly ok: boolean;
  readonly result?: unknown;
  readonly diagnostics?: readonly unknown[];
}

export interface CanvasReadbackResult {
  readonly ok: boolean;
  readonly width: number;
  readonly height: number;
  readonly samples: readonly {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly pixel: {
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly a: number;
    };
  }[];
  readonly diagnostics: readonly unknown[];
}
