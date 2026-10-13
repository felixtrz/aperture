export declare const APERTURE_VIRTUAL_MODULE_IDS: readonly ["virtual:aperture/config", "virtual:aperture/system-manifest", "virtual:aperture/worker-systems", "virtual:aperture/worker-entry", "virtual:aperture/browser-entry"];
export declare function resolveApertureVirtualId(id: string): string | null;
export declare function loadApertureVirtualModule(id: string, options: {
    readonly root: string;
    readonly configFile?: string;
    readonly aiDevtoolsEnabled: boolean;
}): Promise<string | null>;
export declare function apertureGeneratedWorkerEntryFile(root: string): string;
export declare function writeApertureGeneratedWorkerEntry(options: {
    readonly root: string;
    readonly configFile: string;
}): Promise<string>;
export declare function injectApertureBrowserEntry(html: string): string;
//# sourceMappingURL=virtual-modules.d.ts.map