---
"@aperture-engine/simulation": patch
"@aperture-engine/app": patch
---

Resolve hierarchy children from authoritative Parent relationships, including
parented spawns and imported subtrees that do not populate the derived Children
index. Retain indexed child order, cache unchanged-world scans, and prevent stale
Children entries from deleting entities that were reparented elsewhere. Honor
reparenting performed by destruction subscribers during subtree teardown.
