import type * as RealmClient from "../../packages/cli/src/headless/realm-client.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

// The host remains under Vitest for spies; its execution realm is the actual
// built Node Worker, whose imports must never inherit Vitest engine aliases.
const root = fileURLToPath(new URL("../../", import.meta.url));
const file = path.join(root, "packages/cli/dist/headless/realm-client.js");
const realm = (await import(pathToFileURL(file).href)) as typeof RealmClient;
export const prepareHeadlessSessionClient = realm.prepareHeadlessSessionClient;
export const createHeadlessSessionClient = realm.createHeadlessSessionClient;
export const runHeadlessCommandInRealm = realm.runHeadlessCommandInRealm;
