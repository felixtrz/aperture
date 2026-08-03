---
"@aperture-engine/app": minor
---

Multi-touch pointer ownership in the generated browser input forwarder, and
pre-deadzone gamepad stick axes.

The browser forwarder used to forward every `pointermove`/`pointerdown`/
`pointerup` as the same named worker pointer with no `pointerId` tracking, so
with two fingers down the worker-side "primary" position flickered between
contacts and lifting either finger released the press. The forwarder now
tracks one owning `pointerId` per pointer button: the newest `pointerdown`
takes ownership (forwarded as a fresh press, so worker apps observe a re-grab
edge through `pressedThisFrame` at the new contact's position), moves and
lifts from superseded contacts are ignored, and only the owner's
up/cancel/leave/lostpointercapture releases the button. A cancel with no
owners anywhere keeps the legacy release-everything behavior as a stuck-press
safety net, and window blur / document-hidden resets clear ownership.

`StatefulGamepadStickState` additionally exposes the pre-deadzone axis
samples as `rawX`/`rawY` and `readRaw(out)` (clamped to [-1, 1], never
zeroed): consumers that apply their own response curve — for example a radial
dead zone with rescale — could previously only read values already quantized
by the per-axis 0.12 default deadzone, which snapped small cross-axis
components to zero and double-filtered the downstream model. `read()` and
action bindings are unchanged.
