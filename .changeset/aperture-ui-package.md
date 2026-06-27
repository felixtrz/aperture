---
"@aperture-engine/ui": minor
---

Add the `@aperture-engine/ui` package. It provides a Yoga-backed flexbox
`LayoutEngine` with a framework-agnostic style model (the full flexbox property
set), a retained node model with dirty-gated incremental relayout and freeze
support, and a measure-function bridge for content-driven sizing. This is the
foundation for replacing Aperture's custom absolute/row/column UI layout with a
real flexbox engine (see `docs/UI_PACKAGE_PLAN.md`).
