---
"@aperture-engine/cli": patch
---

Close the managed development browser when page creation, initialization, or navigation fails before session startup hands ownership to the daemon. Await cleanup while preserving the startup error.
