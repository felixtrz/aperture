# Durable benchmark evidence

This directory stores reviewed, per-run Git archives. See the
[archive tool and protocol](../../tools/benchmark-evidence/README.md) for sealing,
validation, content review, size limits, publication and fresh-machine recovery.

Run directories are create-only. Their manifests inventory actual file bytes with
SHA-256 hashes and explicit missing-evidence gaps. A complete source/reference/render
archive must contain the files themselves. A surviving report or local path is not
recovered source or image evidence.

## Historical recovery, 2026-10-02

`runs/recovery-advanced-qualitative-20261002/` preserves two surviving frozen blind
qualitative reports byte-for-byte and a new provenance record. The archive is
**exploratory and incomplete**. Original scene source, reference/candidate images,
settings, environment pins, diagnostics, edit checks, attempt inventory and visible
transcripts were not recovered in this archive. The original source commit and
candidate identity mapping are unverified. No numerical scores were present in
these reports; none have been created.

The reports' statements about previously viewing images are historical claims by
their authors, not proof that those images are currently recoverable. Their text
remains useful qualitative evidence within the limits stated in each report.

```sh
python3 tools/benchmark-evidence/archive.py verify \
  benchmarks/evidence/runs/recovery-advanced-qualitative-20261002
```

Adding `--require-scored` must fail for this historical recovery.
