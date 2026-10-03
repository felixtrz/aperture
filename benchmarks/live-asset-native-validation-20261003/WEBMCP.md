# Browser-control investigation, verified 2026-10-03

[Chrome documentation](https://developer.chrome.com/docs/ai/webmcp), updated2026-10-01, describes a Chrome149+ origin trial, a local testing flag, imperative/declarative page tools and the tools Permissions Policy. It emphasizes local human-in-the-loop workflows and headless limitations.

The [2026-10-02 community draft](https://webmachinelearning.github.io/webmcp/) exposes Document.modelContext for application tool registration/execution and explicitly is not a W3C Standard.

Inference: WebMCP could expose structured scene operations, but its interface does not establish native renderer launch permission, GPU correctness, equal author settings or complete authentic transcript capture. No WebMCP installation, flag change, origin-trial enrollment or browser probe was performed. Aperture tests remain restricted to the approved runVerifiedScene/render:cloud route. WebMCP is not a substitute for that renderer/evidence protocol and no new feature is justified merely by API availability.
