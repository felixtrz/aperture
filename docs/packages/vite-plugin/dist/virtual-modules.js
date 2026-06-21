import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveConfigFile, toModuleUrl } from "./file-utils.js";
import { writeApertureGeneratedActionTypes } from "./generated-action-types.js";
import { createApertureSystemManifest, } from "./system-discovery.js";
const VIRTUAL_CONFIG = "virtual:aperture/config";
const VIRTUAL_SYSTEM_MANIFEST = "virtual:aperture/system-manifest";
const VIRTUAL_WORKER_SYSTEMS = "virtual:aperture/worker-systems";
const VIRTUAL_WORKER_ENTRY = "virtual:aperture/worker-entry";
const VIRTUAL_BROWSER_ENTRY = "virtual:aperture/browser-entry";
const RESOLVED_PREFIX = "\0";
export const APERTURE_VIRTUAL_MODULE_IDS = [
    VIRTUAL_CONFIG,
    VIRTUAL_SYSTEM_MANIFEST,
    VIRTUAL_WORKER_SYSTEMS,
    VIRTUAL_WORKER_ENTRY,
    VIRTUAL_BROWSER_ENTRY,
];
export function resolveApertureVirtualId(id) {
    if (isVirtualId(virtualBaseId(id))) {
        return `${RESOLVED_PREFIX}${id}`;
    }
    return null;
}
export async function loadApertureVirtualModule(id, options) {
    const rawVirtualId = id.startsWith(RESOLVED_PREFIX) ? id.slice(1) : id;
    const virtualId = virtualBaseId(rawVirtualId);
    const configFile = resolveConfigFile(options.root, options.configFile);
    await writeApertureGeneratedActionTypes({ root: options.root, configFile });
    if (virtualId === VIRTUAL_CONFIG) {
        return `export { default } from ${JSON.stringify(toModuleUrl(configFile))};`;
    }
    if (virtualId === VIRTUAL_SYSTEM_MANIFEST) {
        const manifest = await createApertureSystemManifest({
            root: options.root,
            configFile,
        });
        return `export default ${JSON.stringify(manifest.systems, null, 2)};\nexport const diagnostics = ${JSON.stringify(manifest.diagnostics, null, 2)};`;
    }
    if (virtualId === VIRTUAL_WORKER_SYSTEMS) {
        const manifest = await createApertureSystemManifest({
            root: options.root,
            configFile,
        });
        return workerSystemsModule(manifest);
    }
    if (virtualId === VIRTUAL_WORKER_ENTRY) {
        return [
            `import config from ${JSON.stringify(VIRTUAL_CONFIG)};`,
            `import { systems } from ${JSON.stringify(VIRTUAL_WORKER_SYSTEMS)};`,
            `import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";`,
            `startGeneratedSimulationWorker({ config, systems });`,
            "",
        ].join("\n");
    }
    if (virtualId === VIRTUAL_BROWSER_ENTRY) {
        const workerEntryFile = await writeApertureGeneratedWorkerEntry({
            root: options.root,
            configFile,
        });
        return [
            `import config from ${JSON.stringify(VIRTUAL_CONFIG)};`,
            `import systemManifest from ${JSON.stringify(VIRTUAL_SYSTEM_MANIFEST)};`,
            `import ApertureSimulationWorker from ${JSON.stringify(`${toModuleUrl(workerEntryFile)}?worker`)};`,
            `import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";`,
            `const worker = new ApertureSimulationWorker();`,
            `const apertureDevtoolsEnabled = ${JSON.stringify(options.aiDevtoolsEnabled)} && import.meta.env.DEV;`,
            // The page URL is only readable on the main thread (worker scope has no
            // location.search). Forward every search param to the simulation worker
            // start options so systems can read app-specific values (e.g. ?map=<codec>).
            `const apertureUrlParams = typeof location === "undefined" ? {} : Object.fromEntries(new URLSearchParams(location.search));`,
            `startGeneratedBrowserApp({`,
            `  config,`,
            `  systemManifest,`,
            `  workerEntry: worker,`,
            `  devtools: { enabled: apertureDevtoolsEnabled },`,
            `  workerStartOptions: apertureUrlParams,`,
            `});`,
            "",
        ].join("\n");
    }
    return null;
}
export function apertureGeneratedWorkerEntryFile(root) {
    return path.join(root, ".aperture", "generated", "aperture-worker-entry.js");
}
export async function writeApertureGeneratedWorkerEntry(options) {
    const manifest = await createApertureSystemManifest({
        root: options.root,
        configFile: options.configFile,
    });
    const systemImports = manifest.systems
        .map((system, index) => `import * as SystemModule${index} from ${JSON.stringify(system.moduleUrl)};`)
        .join("\n");
    const systems = manifest.systems
        .map((_system, index) => `{ default: SystemModule${index}.default }`)
        .join(",\n  ");
    const file = apertureGeneratedWorkerEntryFile(options.root);
    const directory = path.dirname(file);
    const contents = [
        `import config from ${JSON.stringify(toModuleUrl(options.configFile))};`,
        systemImports,
        `import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";`,
        `const systems = [`,
        `  ${systems}`,
        `];`,
        `startGeneratedSimulationWorker({ config, systems });`,
        "",
    ].join("\n");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(file, contents, "utf8");
    return file;
}
export function injectApertureBrowserEntry(html) {
    if (html.includes(VIRTUAL_BROWSER_ENTRY)) {
        return html;
    }
    const script = `<script type="module">import ${JSON.stringify(VIRTUAL_BROWSER_ENTRY)};</script>`;
    if (html.includes("</body>")) {
        return html.replace("</body>", `  ${script}\n</body>`);
    }
    return `${html}\n${script}\n`;
}
function workerSystemsModule(manifest) {
    const imports = manifest.systems
        .map((system, index) => `import * as SystemModule${index} from ${JSON.stringify(system.moduleUrl)};`)
        .join("\n");
    const systems = manifest.systems
        .map((_system, index) => `{ default: SystemModule${index}.default }`)
        .join(",\n  ");
    return [imports, `export const systems = [`, `  ${systems}`, `];`, ""].join("\n");
}
function isVirtualId(id) {
    return (id === VIRTUAL_CONFIG ||
        id === VIRTUAL_SYSTEM_MANIFEST ||
        id === VIRTUAL_WORKER_SYSTEMS ||
        id === VIRTUAL_WORKER_ENTRY ||
        id === VIRTUAL_BROWSER_ENTRY);
}
function virtualBaseId(id) {
    const queryIndex = id.indexOf("?");
    return queryIndex === -1 ? id : id.slice(0, queryIndex);
}
//# sourceMappingURL=virtual-modules.js.map