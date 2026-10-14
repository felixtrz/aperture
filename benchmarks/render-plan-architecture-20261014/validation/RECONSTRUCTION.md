# Final correctness evidence

This addendum preserves the unattempted safety007 preparation, failed safety008
witness, complete safety009 native runs and independent review, final repository
check, and completed cache retirement009. It makes no timing claim.

`manifest.json` maps 17,430 original regular files to 2,145 unique payloads in six
archives (70,812,521 compressed bytes). Every archive and payload was read back
and checked for exact SHA-256 and size. Source absolute paths are provenance,
not extraction destinations. Recorded symlinks are metadata and are never
created by the restoration tool. Installed `node_modules` trees are excluded.

From any checkout, verify all archived bytes and alias mappings:

```sh
python3 -B benchmarks/render-plan-architecture-20261014/validation/verify-and-restore.py
```

To reconstruct the regular files under original root labels, add
`--restore /absolute/path/to/a-new-directory`. The destination must not exist;
allow about 770 MB. Original permissions are recorded but are not applied.
The tool does not follow archive links, run restored scripts, or write the
original source paths. A restore interrupted by failure must be inspected and
a new destination used for another attempt.

The readable `native-summary.json`, `native-independent-review.json` and
`full-check-outcome.json` are exact copies of archived records. The final native
review verifies all four closed children, all 50 paired images, both canonical
restorations, buffer words, binding/resource joins and disposal. The safety008
failure is retained: its witness wrongly required positive direct draws for
every transmission consumer, although nine were indirect and one was direct.
Safety009 fixes that witness, without changing renderer source. Indirect draw
counts remain unobserved by that transmission witness.

Repository validation passed all pre-test stages and 5,345 tests. Four CLI render
tests failed before rendering because `/opt/google/chrome/chrome` is absent.
The approved SwiftShader native verification is separate from those CLI tests.
