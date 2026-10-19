---
"@aperture-engine/render": minor
"@aperture-engine/cli": minor
---

Add optional CPU inspection of positive-area coplanar overlaps between selected static mesh draws. The public render helper and offline `aperture inspect coplanar` command use resolved snapshot matrices and source draw ranges, exclude shared edges, and report tolerances, bounded work, and incomplete coverage. Findings remain geometric evidence with unknown visibility; rendering and scene acceptance are unchanged.
