#!/usr/bin/env python3
"""Explicit reviewed pressure retirement of pinned flat Chromium caches only.

Ordinary 24-hour cleanup and the runtime wrapper's 2-GiB floor are unchanged.
A completed job remains completed: only its retired download cache registration
is removed, with explicit provenance and immutable external before/after copies.
"""
from __future__ import annotations

import argparse
import contextlib
import dataclasses
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
import time
import uuid

import cleanup as c

SCHEMA = "aperture.pressure-cache-retirement.v1"
ROOT = c.RECOVERY_ROOT
RUNTIME_ROOT = "/workspace/aperture/.aperture-env/render-runtime"
MAX_CACHES = 40
TARGET_FREE_BYTES = 8 * 1024**3
PLAN_LIFETIME_NS = 60 * 60 * 1_000_000_000
NAME = "chromium"
KIND = "download-cache"
SIZE = 209022176
SHA256 = "53a15d6c3a3d27dfb54c4ba60278b1683136f70cf1e67e989da7dfbd3d451ef0"
SOURCE_SHA256 = "38e1e1649db20fa4ea644bf5987688ce81a4c9eb10e7eae8380b74fc0d699fea"


@dataclasses.dataclass(frozen=True)
class Pin:
    """Synthetic tests inject their own pins internally; the CLI never accepts them."""
    size: int = SIZE
    sha256: str = SHA256
    source_sha256: str = SOURCE_SHA256


def digest(data):
    return hashlib.sha256(data).hexdigest()


def disk_free(fd):
    value = os.fstatvfs(fd)
    return value.f_bavail * value.f_frsize


def immutable(fd, name, data):
    c.create_file(fd, name, data)
    opened = os.open(name, c.FILE_FLAGS, dir_fd=fd)
    try:
        os.fchmod(opened, 0o444)
        os.fsync(opened)
    finally:
        os.close(opened)
    os.fsync(fd)
    return {"path": name, "bytes": len(data), "sha256": digest(data)}


@contextlib.contextmanager
def output_directory(path, root):
    path = os.fspath(path)
    c.require(os.path.isabs(path) and os.path.normpath(path) == path, "normalized absolute evidence directory required")
    c.require(os.path.commonpath((path, root)) != root, "evidence must survive outside scratch")
    parent, name = os.path.split(path)
    with c.PinnedDirectory(parent) as pin:
        pin.verify()
        os.mkdir(name, 0o700, dir_fd=pin.fd)  # Never adopt or overwrite evidence.
        os.fsync(pin.fd)
    with c.PinnedDirectory(path) as pin:
        yield pin


def source_pin(runtime_root, pin):
    package = (Path(runtime_root) / "node_modules/@sparticuz/chromium").resolve(strict=True)
    c.require(os.path.commonpath((str(package), str(Path(runtime_root).resolve(strict=True)))) == str(Path(runtime_root).resolve(strict=True)), "compressed source outside selected runtime")
    with c.PinnedDirectory(str(package)) as parent:
        value, _, package_sha = c.read_json(parent.fd, "package.json")
        c.require(value.get("version") == "153.0.0", "unapproved compressed runtime package")
        parent.verify()
    with c.PinnedDirectory(str(package / "bin")) as parent:
        _, st, sha = c.read_file(parent.fd, "chromium.br")
        c.require(sha == pin.source_sha256, "compressed runtime source SHA mismatch")
        parent.verify()
    return {"runtimeRoot": runtime_root, "package": str(package), "packageJsonSha256": package_sha,
            "path": str(package / "bin/chromium.br"), "size": st.st_size,
            "fingerprint": list(c.fingerprint(st)), "sha256": sha}


def shallow_inventory(fd):
    """Metadata only: do not traverse/open/hash any unknown or nested entry."""
    return {name: list(c.fingerprint(os.stat(name, dir_fd=fd, follow_symlinks=False)))
            for name in sorted(os.listdir(fd)) if name not in (c.MANIFEST, c.REGISTER_LOCK, NAME)}


def candidate(store, run, fd, pin, now_ns):
    directory = os.fstat(fd)
    c.check_dir(directory)
    raw, mst, manifest_sha = c.read_file(fd, c.MANIFEST, c.MAX_JSON)
    m = json.loads(raw, object_pairs_hook=c.unique_pairs,
                   parse_constant=lambda _: (_ for _ in ()).throw(c.Unsafe("non-finite JSON")))
    c.require(isinstance(m, dict), "manifest must be an object")
    c.validate_manifest(m, run)
    c.require(m["state"] == "completed", "job is not observed completed/quiescent")
    c.require(type(m.get("exitcode")) is int, "job completion exit code missing")
    c.require(m["created_ns"] <= m["completed_ns"] <= now_ns, "future/inconsistent job completion")
    c.require(isinstance(m.get("cache_retirements", []), list), "invalid prior retirement provenance")
    item = m["files"].get(NAME)
    c.require(item is not None and item.get("kind") == KIND and item.get("size") == pin.size and item.get("sha256") == pin.sha256,
              "cache is not the exact registered pinned Chromium download")
    _, rst, _ = c.read_file(fd, c.REGISTER_LOCK, c.MAX_JSON)
    c.require(rst.st_size == 0, "registration lock has unexpected contents")
    untouched = shallow_inventory(fd)
    _, st, actual_sha = c.read_file(fd, NAME)
    expected = {"device": st.st_dev, "inode": st.st_ino, "size": st.st_size,
                "mtime_ns": st.st_mtime_ns, "ctime_ns": st.st_ctime_ns, "sha256": actual_sha}
    c.require(st.st_dev == directory.st_dev and all(item[key] == value for key, value in expected.items()), "registered cache inode/size/SHA changed")
    c.require(actual_sha == pin.sha256 and st.st_size == pin.size, "actual cache pin mismatch")
    c.require(shallow_inventory(fd) == untouched and c.fingerprint(os.fstat(fd)) == c.fingerprint(directory), "run changed while planning")
    c.require(c.identity(os.stat(run, dir_fd=store.fd, follow_symlinks=False)) == c.identity(directory), "run directory replaced")
    store.verify()
    return {"run": run, "name": NAME, "kind": KIND, "bytes": st.st_size, "sha256": actual_sha,
            "directoryFingerprint": list(c.fingerprint(directory)), "manifestFingerprint": list(c.fingerprint(mst)),
            "registryFingerprint": list(c.fingerprint(rst)), "fileFingerprint": list(c.fingerprint(st)),
            "manifestSha256": manifest_sha, "completed_ns": m["completed_ns"], "job": m["job"],
            "untouchedTopLevelEntries": untouched}, raw, m


def validate_plan(value, cfg, pin, now_ns):
    c.require(value.get("schema") == SCHEMA and value.get("mode") == "explicit-pressure-pinned-chromium-only", "unrecognized pressure plan")
    c.require(value.get("root") == cfg.root and value.get("targetFreeBytes") == TARGET_FREE_BYTES and value.get("maxCaches") == MAX_CACHES, "pressure plan bounds/root differ")
    c.require(value.get("pin") == dataclasses.asdict(pin), "pressure plan runtime pin differs")
    c.require(type(value.get("created_ns")) is int and type(value.get("expires_ns")) is int and value["created_ns"] <= now_ns <= value["expires_ns"] and value["expires_ns"] - value["created_ns"] == PLAN_LIFETIME_NS, "expired/future pressure plan")
    entries = value.get("entries")
    c.require(isinstance(entries, list) and 0 < len(entries) <= MAX_CACHES, "pressure plan has no bounded selected caches")
    names = [v.get("run") for v in entries]
    c.require(len(set(names)) == len(names) and all(isinstance(name, str) and c.RUN_RE.fullmatch(name) for name in names), "invalid/duplicate selected run")
    c.require(all(v.get("name") == NAME and v.get("kind") == KIND and v.get("bytes") == pin.size and v.get("sha256") == pin.sha256 for v in entries), "unapproved selected file")


def prepare(cfg, runtime_root, output, pin=Pin()):
    """Read/hash-only dry run against scratch, producing a create-only bounded plan."""
    now = time.time_ns()
    source = source_pin(runtime_root, pin)
    with output_directory(output, cfg.root) as evidence, c.Store(cfg) as store, store.locked(exclusive=True):
        choices, skipped = [], []
        for run in sorted(os.listdir(store.fd)):
            if not c.RUN_RE.fullmatch(run):
                continue
            fd = None
            try:
                fd = c.open_run(store, run)
                with c.registry_lock(fd):
                    m, _, _ = c.read_json(fd, c.MANIFEST)
                    c.validate_manifest(m, run)
                    item = m["files"].get(NAME, {})
                    if m["state"] == "completed" and item.get("kind") == KIND and item.get("size") == pin.size and item.get("sha256") == pin.sha256:
                        choices.append((m["completed_ns"], run))
            except (c.Unsafe, OSError, ValueError) as exc:
                skipped.append({"run": run, "reason": str(exc)})
            finally:
                if fd is not None: os.close(fd)
        entries = []
        for _, run in sorted(choices)[:MAX_CACHES]:
            fd = c.open_run(store, run)
            try:
                with c.registry_lock(fd):
                    entry, raw, _ = candidate(store, run, fd, pin, now)
                    entry["beforeManifest"] = immutable(evidence.fd, run + ".before-manifest.json", raw)
                    entries.append(entry)
            finally:
                os.close(fd)
        c.require(entries, "no exact completed registered cache candidates")
        value = {"schema": SCHEMA, "mode": "explicit-pressure-pinned-chromium-only", "root": cfg.root,
                 "rootMarker": store.marker, "created_ns": now, "expires_ns": now + PLAN_LIFETIME_NS,
                 "pin": dataclasses.asdict(pin), "source": source, "maxCaches": MAX_CACHES,
                 "targetFreeBytes": TARGET_FREE_BYTES, "freeBytesAtDryRun": disk_free(store.fd),
                 "entries": entries, "skipped": skipped,
                 "completionBasis": "Trusted completed manifests are persisted only after cleanup.run_command observes subreaper descendant exit; lifecycle exclusive lock excludes live adopted jobs",
                 "preservation": "Only listed flat chromium registrations may retire; unknown/nested/source/evidence/other files are never removed"}
        immutable(evidence.fd, "plan.json", c.json_bytes(value))
        return value


def load_plan(path, approved_sha, cfg, pin):
    parent, name = os.path.split(os.fspath(path))
    c.require(os.path.commonpath((os.fspath(path), cfg.root)) != cfg.root, "reviewed plan must be outside scratch")
    with c.PinnedDirectory(parent) as directory:
        value, st, sha = c.read_json(directory.fd, name)
        c.require(not st.st_mode & 0o222, "reviewed plan must be readonly")
        c.require(sha == approved_sha, "reviewed plan SHA acknowledgement differs")
        validate_plan(value, cfg, pin, time.time_ns())
        for entry in value["entries"]:
            recorded = entry["beforeManifest"]
            c.require(recorded["path"] == entry["run"] + ".before-manifest.json", "before manifest path differs")
            raw, before, before_sha = c.read_file(directory.fd, recorded["path"], c.MAX_JSON)
            c.require(not before.st_mode & 0o222 and len(raw) == recorded["bytes"] and before_sha == recorded["sha256"] == entry["manifestSha256"], "immutable old manifest copy mismatch")
        return value


def retire_one(store, fd, entry, audit, evidence, plan_sha, pin):
    fresh, raw, manifest = candidate(store, entry["run"], fd, pin, time.time_ns())
    expected = {key: value for key, value in entry.items() if key != "beforeManifest"}
    c.require(fresh == expected, "selected run changed since reviewed dry run")
    immutable(evidence.fd, entry["run"] + ".before-manifest.json", raw)
    audit.emit("pressure-cache-retire-intent", plan_sha256=plan_sha, selected=entry, original_manifest=manifest)
    # Audit must be durable before capture. Recheck all original identities.
    fresh, _, _ = candidate(store, entry["run"], fd, pin, time.time_ns())
    c.require(fresh == expected, "selected cache changed before capture")
    stage = ".pressure-cache-" + uuid.uuid4().hex
    os.mkdir(stage, 0o700, dir_fd=store.fd)
    os.fsync(store.fd)
    sfd = os.open(stage, c.DIR_FLAGS, dir_fd=store.fd)
    stage_identity = c.identity(os.fstat(sfd))
    captured = removed = False
    def verify():
        store.verify()
        c.require(c.identity(os.stat(stage, dir_fd=store.fd, follow_symlinks=False)) == stage_identity, "capture directory replaced")
        c.check_dir(os.fstat(sfd))
        c.require(c.identity(os.stat(entry["run"], dir_fd=store.fd, follow_symlinks=False)) == tuple(entry["directoryFingerprint"][:2]), "source run replaced")
        _, st, sha = c.read_file(fd, c.MANIFEST, c.MAX_JSON)
        _, lock, _ = c.read_file(fd, c.REGISTER_LOCK, c.MAX_JSON)
        c.require(list(c.fingerprint(st)) == entry["manifestFingerprint"] and sha == entry["manifestSha256"] and list(c.fingerprint(lock)) == entry["registryFingerprint"], "run metadata changed during capture")
        c.require(shallow_inventory(fd) == entry["untouchedTopLevelEntries"], "unrelated entries changed during capture")
    try:
        verify()
        c.rename_noreplace(fd, NAME, sfd, NAME)
        captured = True
        os.fsync(fd); os.fsync(sfd)
        verify()
        _, st, sha = c.read_file(sfd, NAME)
        c.require(c.capture_matches(st, tuple(entry["fileFingerprint"])) and sha == pin.sha256 and st.st_size == pin.size, "captured cache inode/SHA mismatch")
        post_capture = c.fingerprint(st)
        audit.emit("pressure-cache-captured", run=entry["run"], staging=stage, sha256=sha, bytes=st.st_size)
        verify()
        _, st, sha = c.read_file(sfd, NAME)
        c.require(c.fingerprint(st) == post_capture and sha == pin.sha256, "captured cache changed immediately before unlink")
        c.require(set(os.listdir(sfd)) == {NAME} and not os.path.lexists(os.path.join(store.cfg.root, entry["run"], NAME)), "unexpected capture/original entry")
        os.unlink(NAME, dir_fd=sfd)
        removed = True
        os.fsync(sfd)
        audit.emit("pressure-cache-deleted", run=entry["run"], name=NAME, bytes=pin.size, sha256=pin.sha256)
        updated = dict(manifest)
        updated["files"] = dict(manifest["files"])
        retired_registration = updated["files"].pop(NAME)
        retirement = {"name": NAME, "reason": "reviewed explicit pressure retirement", "retired_ns": time.time_ns(),
                      "plan_sha256": plan_sha, "original_manifest_sha256": entry["manifestSha256"],
                      "retired_registration": retired_registration, "evidence_directory": evidence.path}
        prior = updated.get("cache_retirements", [])
        c.require(isinstance(prior, list), "invalid prior retirement provenance")
        updated["cache_retirements"] = [*prior, retirement]
        verify()
        c.replace_json(fd, c.MANIFEST, updated)
        after, _, after_sha = c.read_file(fd, c.MANIFEST, c.MAX_JSON)
        receipt = immutable(evidence.fd, entry["run"] + ".after-manifest.json", after)
        audit.emit("pressure-cache-retired", run=entry["run"], original_state=manifest["state"], current_state=updated["state"], after_manifest=receipt)
        return {"run": entry["run"], "name": NAME, "status": "cache-retired", "bytes": pin.size,
                "originalManifestSha256": entry["manifestSha256"], "afterManifestSha256": after_sha,
                "beforeManifest": entry["run"] + ".before-manifest.json", "afterManifest": receipt}
    except BaseException as exc:
        restored = False
        if captured and not removed:
            with contextlib.suppress(c.Unsafe, OSError):
                verify()
                c.rename_noreplace(sfd, NAME, fd, NAME)
                os.fsync(fd); os.fsync(sfd)
                restored = True
        with contextlib.suppress(c.Unsafe, OSError):
            audit.emit("pressure-cache-stopped", run=entry["run"], deleted=removed, restored=restored, staging=stage, reason=str(exc))
        raise c.RetirementInterrupted(str(exc), [NAME] if removed else [], stage) from exc
    finally:
        with contextlib.suppress(c.Unsafe, OSError):
            store.verify()
            if c.identity(os.stat(stage, dir_fd=store.fd, follow_symlinks=False)) == stage_identity and not os.listdir(sfd):
                os.rmdir(stage, dir_fd=store.fd); os.fsync(store.fd)
        os.close(sfd)


def apply(cfg, runtime_root, reviewed_path, approved_sha, output, pin=Pin()):
    value = load_plan(reviewed_path, approved_sha, cfg, pin)
    c.require(source_pin(runtime_root, pin) == value["source"], "compressed runtime source/provenance changed")
    with output_directory(output, cfg.root) as evidence, c.Store(cfg) as store, store.locked(exclusive=True):
        c.require(store.marker == value["rootMarker"], "root marker differs from reviewed plan")
        audit_cfg = dataclasses.replace(cfg, audit_dir=os.path.join(output, "audits"))
        with c.Audit(audit_cfg) as audit:
            audit.emit("pressure-plan-start", plan_sha256=approved_sha, selected_runs=[v["run"] for v in value["entries"]], maximum_files=MAX_CACHES, target_free_bytes=TARGET_FREE_BYTES)
            results = []
            try:
                # Whole selected set is revalidated before the first deletion.
                for entry in value["entries"]:
                    fd = c.open_run(store, entry["run"])
                    try:
                        with c.registry_lock(fd):
                            fresh, _, _ = candidate(store, entry["run"], fd, pin, time.time_ns())
                            c.require(fresh == {k:v for k,v in entry.items() if k != "beforeManifest"}, "reviewed cache set changed")
                    finally: os.close(fd)
                for entry in value["entries"]:
                    if disk_free(store.fd) >= TARGET_FREE_BYTES: break
                    fd = c.open_run(store, entry["run"])
                    try:
                        with c.registry_lock(fd):
                            results.append(retire_one(store, fd, entry, audit, evidence, approved_sha, pin))
                    finally: os.close(fd)
                status = "completed-target-reached" if disk_free(store.fd) >= TARGET_FREE_BYTES else "completed-bounded-plan-exhausted"
            except BaseException as exc:
                status = "stopped-reconciliation-required"
                summary = {"schema":SCHEMA,"status":status,"planSha256":approved_sha,"results":results,"freeBytesAfter":disk_free(store.fd),"error":str(exc)}
                immutable(evidence.fd,"outcome.json",c.json_bytes(summary))
                audit.emit("pressure-plan-stopped", **summary)
                raise
            summary = {"schema":SCHEMA,"status":status,"planSha256":approved_sha,"results":results,"freeBytesAfter":disk_free(store.fd),"retiredBytes":sum(v["bytes"] for v in results)}
            immutable(evidence.fd,"outcome.json",c.json_bytes(summary))
            audit.emit("pressure-plan-completed", **summary)
            return summary


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root",required=True)
    parser.add_argument("--runtime-root",required=True)
    parser.add_argument("--output",required=True)
    parser.add_argument("--pressure",action="store_true")
    sub=parser.add_subparsers(dest="action",required=True)
    sub.add_parser("plan")
    commit=sub.add_parser("apply")
    commit.add_argument("--plan",required=True)
    commit.add_argument("--approved-sha256",required=True)
    args=parser.parse_args(argv)
    c.require(args.pressure,"explicit pressure mode required")
    c.require(args.root==ROOT and args.runtime_root==RUNTIME_ROOT,"CLI root/runtime must match reviewed physical installations")
    cfg=c.Config(args.root,os.path.join(args.output,"audits"))
    if args.action=="plan": value=prepare(cfg,args.runtime_root,args.output)
    else: value=apply(cfg,args.runtime_root,args.plan,args.approved_sha256,args.output)
    print(json.dumps(value,indent=2))
    return 0

if __name__=="__main__":
    try: raise SystemExit(main())
    except (c.Unsafe,OSError,ValueError,KeyError,TypeError) as exc:
        print(json.dumps({"error":str(exc),"no_global_cleanup":True,"inspect_external_audit_before_retry":True}),file=sys.stderr)
        raise SystemExit(2)
