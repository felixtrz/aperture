---
"@aperture-engine/cli": patch
---

Render sessions retry headed when a headless render comes back blank on
Linux. Some GPU-less hosts silently discard every WebGPU submission in
headless Chrome (queue waits reject with the "external Instance"
OperationError and frames come back flat) while a headed window under the
auto-provisioned Xvfb renders the same bundle correctly. The swap is sticky
for the session, so long-lived hosts such as the MCP render slot pay the
relaunch once, and the result metadata records `fallbackFromHeadlessBlank`.
