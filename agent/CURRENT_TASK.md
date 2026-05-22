# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3077` — Outdoor scene example with CSM + area light.

Status: ready. Dependencies `task-3074` and `task-3076` are complete:
RectAreaLight/LTC, area-light shape metadata, and executable directional CSM
receiver sampling now exist.

Next step: add an outdoor-style worker-authored example combining a directional
sun with 1-4 CSM cascades and a RectAreaLight contribution, then add Playwright
proof for shadows at multiple distances plus visible area-light illumination.
