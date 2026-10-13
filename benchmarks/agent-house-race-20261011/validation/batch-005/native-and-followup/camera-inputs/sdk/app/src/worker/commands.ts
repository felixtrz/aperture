import type { ApertureApp } from "../advanced.js";
import type { ApertureGeneratedCommandMessage } from "../commands.js";
import type { GeneratedEntityToolBridge } from "../devtools/entities.js";
import { applyViewportResizeCommand } from "./viewport.js";

export function applyGeneratedCommand(
  app: ApertureApp,
  entityTools: GeneratedEntityToolBridge,
  message: ApertureGeneratedCommandMessage,
): void {
  if (applyViewportResizeCommand(app, message.command)) {
    return;
  }

  if (entityTools.handle(message.command)) {
    return;
  }

  app.context.commands.queue(message.command.channel, message.command.payload);
}
