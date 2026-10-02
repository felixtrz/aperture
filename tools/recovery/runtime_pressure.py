#!/usr/bin/env python3
"""Reviewed recovery lifecycle: pin registration only; no pressure deletion."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import sys

import cleanup

RUNTIME_SIZE = 209022176
RUNTIME_SHA256 = "53a15d6c3a3d27dfb54c4ba60278b1683136f70cf1e67e989da7dfbd3d451ef0"
SOURCE_SHA256 = "38e1e1649db20fa4ea644bf5987688ce81a4c9eb10e7eae8380b74fc0d699fea"
LOW_FREE_BYTES = 2147483648


def file_hash(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before = os.fstat(fd)
        cleanup.require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1,
                        "runtime/source must be regular and not hardlinked")
        digest = hashlib.sha256()
        while True:
            block = os.read(fd, 1024 * 1024)
            if not block:
                break
            digest.update(block)
        after = os.fstat(fd)
        cleanup.require(cleanup.fingerprint(before) == cleanup.fingerprint(after),
                        "runtime/source changed while hashing")
        cleanup.require(cleanup.identity(os.stat(path, follow_symlinks=False)) ==
                        cleanup.identity(after), "runtime/source replaced")
        return after.st_size, digest.hexdigest()
    finally:
        os.close(fd)


def register_runtime(cfg, run, run_path, runtime_root):
    # Called while the lifecycle shared lock is still held and only after the
    # subreaper has reaped every descendant. Unknown nested entries stay intact.
    target = Path(run_path) / "chromium"
    if not os.path.lexists(target):
        return
    package = (Path(runtime_root) / "node_modules/@sparticuz/chromium").resolve(strict=True)
    cleanup.require(json.loads((package / "package.json").read_text())["version"] == "153.0.0",
                    "unapproved Chromium package")
    cleanup.require(file_hash(package / "bin/chromium.br")[1] == SOURCE_SHA256,
                    "compressed Chromium provenance mismatch")
    cleanup.require(file_hash(target) == (RUNTIME_SIZE, RUNTIME_SHA256),
                    "decompressed Chromium pin mismatch")
    cleanup.register(cfg, run, "chromium", "download-cache",
                     "Regenerate using pinned @sparticuz/chromium@153.0.0 chromium.br through the approved verified WebGPU runner")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True)
    parser.add_argument("--audit-dir", default=str(Path(__file__).absolute().parent / "audits"))
    sub = parser.add_subparsers(dest="action", required=True)
    run = sub.add_parser("run")
    run.add_argument("--job", required=True)
    run.add_argument("--recreation", required=True)
    run.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args(argv)
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    cleanup.require(bool(command), "missing approved render command")
    runtime_root = os.environ.get("APERTURE_WEBGPU_RUNTIME")
    cleanup.require(runtime_root is not None and os.path.isabs(runtime_root),
                    "set absolute APERTURE_WEBGPU_RUNTIME")
    free = shutil.disk_usage(args.root).free
    cleanup.require(free >= LOW_FREE_BYTES,
                    "low disk: pressure retirement is not reconstructed; preserve files and stop")
    cfg = cleanup.Config(args.root, args.audit_dir)
    try:
        return cleanup.run_command(cfg, args.job, args.recreation, command,
            after_quiescence=lambda c, r, p: register_runtime(c, r, p, runtime_root))
    finally:
        print(json.dumps({"free_bytes_after": shutil.disk_usage(args.root).free}), flush=True)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (cleanup.Unsafe, OSError, ValueError, KeyError) as exc:
        print(json.dumps({"error": str(exc), "files_preserved": True}), file=sys.stderr)
        raise SystemExit(2)
