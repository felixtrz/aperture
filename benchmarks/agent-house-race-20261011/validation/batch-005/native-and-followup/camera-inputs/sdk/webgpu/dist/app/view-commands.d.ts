import type { RenderSnapshot } from "@aperture-engine/render";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
export declare function writeCommandsForView(commands: readonly RenderPassCommand[], snapshot: RenderSnapshot, view: RenderSnapshot["views"][number], target: RenderPassCommand[], prefixCommands?: readonly RenderPassCommand[]): readonly RenderPassCommand[];
export declare function countDrawCommands(commands: readonly RenderPassCommand[]): number;
export declare function isRenderPassDrawCommand(command: RenderPassCommand): boolean;
//# sourceMappingURL=view-commands.d.ts.map