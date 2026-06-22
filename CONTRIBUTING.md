# Contributing

Thanks for your interest in Aperture — a WebGPU-only, ECS-native 3D runtime.

## Issues welcome — pull requests are not accepted

Aperture is **developed and maintained mostly by AI coding agents**, and the
human maintainer has limited bandwidth to review outside contributions. To keep
that sustainable:

- **Please do not open pull requests.** They will not be reviewed or merged.
- **Issues are very welcome** — bug reports, feature requests, questions, and
  design feedback are all read and appreciated. Open one from the
  [issue templates](../../issues/new/choose).

If you want to change something for your own use, fork the repository and build
on it under the MIT license — there's no need to upstream anything.

## Filing a good issue

Include what you expected, what actually happened, and the smallest steps or
snippet that reproduces it. The engine version, browser/OS, and any console
output help a lot. Suspected security vulnerabilities should go through the
private channel in [`SECURITY.md`](SECURITY.md), not a public issue.

## Working in the code (forks and local exploration)

```sh
pnpm install
pnpm run build
pnpm test
pnpm run check   # full local gate: boundaries, types, examples, docs, lint, format, tests
```

If you fork, preserve the architectural invariants: ECS state stays
authoritative, rendering stays a derived view, WebGPU is the only backend, and
there is no mutable scene graph as core architecture. See [`AGENTS.md`](AGENTS.md)
and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full picture.
