This is a private, create-only retention proposal. Root must review it before
materialization. No files are copied into the public destination by preparation.
The existing public README and all earlier archives remain untouched.

Materialization writes only new files under the approved `evidence/` directory.
Store each unique raw SHA-256 payload once as `blobs/<sha256>` inside deterministic
USTAR gzip archives. Preserve the raw byte size and SHA of every member; preserve
all original file aliases in `origins.jsonl.gz`, including failures and partial
builds. Keep the original, unmodified manifest/source bytes as payloads. Do not
regenerate or reformat historical JSON. Public `summary.json` and the two exact
independent-review JSON files are proposed directly readable copies.

The metadata files are gzip-compressed JSONL. The public manifest schema is
`aperture.render-plan-architecture-retention.v1`, with `sourceRoots`, `archives`,
`visibleCopies`, and `inventories` entries named `origins`, `members`, `symlinks`,
and `runtimePinJoins`. Each archive/visible descriptor records relative `path`,
actual `bytes` and `sha256`. Each inventory additionally records
`uncompressedBytes` and `uncompressedSha256`. Members record their archive name,
`blobs/<sha256>` member name, original raw size and hash. All manifest hashes are
computed after create-only writes and verified before release. Each archive has
a planned uncompressed tar stream below80,000,000bytes, giving a conservative
gzip upper bound below90,000,000bytes; actual archive size must still be checked.

After authorized materialization:

```sh
python reconstruct-evidence.py verify /chosen/path/to/evidence
python reconstruct-evidence.py restore /chosen/path/to/evidence /new/restoration/root
```

Restoration writes only `/new/restoration/root/<source-root-id>/<relative-path>`.
It fails if that destination already exists. It never extracts tar paths or
writes original absolute source paths. Symlink definitions are preserved as
metadata and written to `recorded-symlinks.json`; no symlinks are automatically
created and no target is dereferenced. To rerun in a chosen new workspace, rebase
private SDK package links inside that workspace and separately install the exact
dependencies from retained version/lock/integrity metadata. The original shared
Three.js installation and extracted Chromium caches are not copied. Actual Three
WGSL, retained resolved import-source bytes, approved native runner/version pins,
and cleanup/lifecycle evidence remain available for independent review.

Historical helpers contain original absolute analysis paths. Keep retained bytes
exact for audit. A replay should use a separate writable copy, fresh declarations
pointing to restored inputs, and the approved browser lifecycle route. A replay
does not rewrite historical hashes or substitute results in closed attempts.
The proposal does not install packages, launch a browser, register evidence or
seal a public tree. Safety008 and the final repository check are later addenda
after their actual processes close.
