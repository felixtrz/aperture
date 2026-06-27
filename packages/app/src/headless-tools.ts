// In-process devtools routing for the warm headless server: the same ECS and
// input tool contracts exposed over MCP, but driven against an in-process
// createApertureHeadlessRunner instead of a browser/worker. No worker or
// message-port machinery is pulled in.
export {
  createGeneratedEntityToolBridge,
  type GeneratedEntityToolBridge,
} from "./worker/devtools/entities.js";
export { callInputDevtoolsTool } from "./worker/devtools/input.js";
export type { GeneratedDevtoolsToolResult } from "./worker/devtools/types.js";
