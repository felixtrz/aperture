# `@aperture-engine/reference-assets`

Versioned reference corpus payloads for `@aperture-engine/cli`.

This package is not an application runtime dependency. It owns the producer
workflow that generates precomputed reference embeddings and source snippets for
the CLI/MCP reference tools and docs-site browser search. Published package
versions expose the compressed `dist/data.tgz` payload, compact
`dist/browser-search.json` browser-search payload, and `dist/manifest.json`.

The matching embedding model files are not bundled in this package. During
`aperture reference warmup`, `@aperture-engine/cli` downloads this data payload
from the package CDN and then downloads the pinned local Transformers.js model
files recorded in the CLI model contract.

The browser-search payload keeps the same source chunks but quantizes normalized
embedding vectors to int8 so static docs pages can perform similarity search
without loading the full producer JSON.

Useful producer commands:

```sh
pnpm --filter @aperture-engine/reference-assets run build:payload
pnpm --filter @aperture-engine/reference-assets run ingest
pnpm --filter @aperture-engine/reference-assets run build
```

For local development, build the payload and point the CLI at the generated
package dist directory:

```sh
pnpm --filter @aperture-engine/reference-assets run build:payload
pnpm exec aperture reference warmup --from packages/reference-assets/dist
```

Public users normally run:

```sh
pnpm exec aperture reference warmup
```
