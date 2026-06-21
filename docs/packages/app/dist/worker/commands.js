import { applyViewportResizeCommand } from "./viewport.js";
export function applyGeneratedCommand(app, entityTools, message) {
    if (applyViewportResizeCommand(app, message.command)) {
        return;
    }
    if (entityTools.handle(message.command)) {
        return;
    }
    app.context.commands.queue(message.command.channel, message.command.payload);
}
//# sourceMappingURL=commands.js.map