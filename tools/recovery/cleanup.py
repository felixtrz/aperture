#!/usr/bin/env python3
"""Fail-closed, explicitly registered disposable artifacts. See README.md.

Replacement implementation, not a byte-identical recovery of the lost helper.
Linux/POSIX; Python standard library only. No recursive deletion, glob deletion,
symlink following, stale-active override, force flag, or automatic root fallback.
"""
from __future__ import annotations

import argparse
import contextlib
import ctypes
import dataclasses
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import time
import uuid

VERSION = "2.2.0-recovery-lifecycle"
SCHEMA = "aperture.disposable-run.v2"
ROOT_SCHEMA = "aperture.disposable-root.v2"
MIN_AGE_NS = 24 * 60 * 60 * 1_000_000_000
DEFAULT_ROOT = "/workspace/shared/aperture-tmp"
RECOVERY_ROOT = "/workspace/scratch/0190a8c72f8a/aperture-tmp"
ALLOWED_ROOTS = frozenset((DEFAULT_ROOT, RECOVERY_ROOT))
MARKER = ".aperture-disposable-root.json"
LOCK = ".lifecycle.lock"
MANIFEST = ".manifest.json"
REGISTER_LOCK = ".registration.lock"
META = frozenset((MANIFEST, REGISTER_LOCK))
RUN_RE = re.compile(r"run-[0-9a-f]{32}\Z")
NAME_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,199}\Z")
PROTECTED = re.compile(r"(source|patch|backlog|ledger|reference|transcript|judge[-_]?evidence|deliverable)", re.I)
PROTECTED_SUFFIXES = (".patch", ".diff", ".py", ".js", ".ts", ".tsx", ".jsx", ".rs", ".go", ".c", ".cpp", ".h", ".glb", ".blend")
KINDS = frozenset(("render-intermediate", "build-intermediate", "download-cache", "scratch"))
DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
FILE_FLAGS = os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK
MAX_JSON = 4 * 1024 * 1024


class Unsafe(RuntimeError):
    pass


class Busy(Unsafe):
    pass


class RetirementInterrupted(Unsafe):
    def __init__(self, reason, deleted, staging):
        super().__init__(reason)
        self.deleted = list(deleted)
        self.staging = staging


def require(ok, why):
    if not ok:
        raise Unsafe(why)


def identity(s):
    return s.st_dev, s.st_ino


def fingerprint(s):
    return (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns,
            s.st_nlink, s.st_mode, s.st_uid)


def check_regular(s):
    require(stat.S_ISREG(s.st_mode) and s.st_nlink == 1, "not a private regular file (symlink/hardlink/special file)")
    require(s.st_uid == os.getuid() and not s.st_mode & 0o022, "file ownership or write permissions are unsafe")


def check_dir(s):
    require(stat.S_ISDIR(s.st_mode), "not a directory")
    require(s.st_uid == os.getuid() and not s.st_mode & 0o022, "directory ownership or write permissions are unsafe")


def safe_name(name):
    require(isinstance(name, str) and NAME_RE.fullmatch(name) is not None, "artifact must have one flat safe basename")
    require(not PROTECTED.search(name) and not name.lower().endswith(PROTECTED_SUFFIXES), "protected work must remain outside disposable storage")
    return name


def text_field(value, name):
    require(isinstance(value, str) and bool(value.strip()) and len(value) <= 4096, f"missing/invalid {name}")
    return value


def timestamp(value):
    require(type(value) is int and value > 0, "invalid timestamp")
    return value


def json_bytes(value):
    return (json.dumps(value, sort_keys=True, allow_nan=False) + "\n").encode()


def unique_pairs(pairs):
    d = {}
    for k, v in pairs:
        require(k not in d, "duplicate JSON key")
        d[k] = v
    return d


def read_file(dfd, name, limit=None):
    fd = os.open(name, FILE_FLAGS, dir_fd=dfd)
    try:
        before = os.fstat(fd)
        check_regular(before)
        require(limit is None or before.st_size <= limit, "metadata too large")
        chunks = []
        digest = hashlib.sha256()
        total = 0
        while chunk := os.read(fd, 1024 * 1024):
            total += len(chunk)
            require(limit is None or total <= limit, "metadata too large")
            digest.update(chunk)
            if limit is not None:
                chunks.append(chunk)
        after = os.fstat(fd)
        named = os.stat(name, dir_fd=dfd, follow_symlinks=False)
        require(fingerprint(before) == fingerprint(after) == fingerprint(named), "file changed while reading")
        return (b"".join(chunks) if limit is not None else None), after, digest.hexdigest()
    finally:
        os.close(fd)


def read_json(dfd, name):
    raw, st, digest = read_file(dfd, name, MAX_JSON)
    try:
        value = json.loads(raw, object_pairs_hook=unique_pairs,
                           parse_constant=lambda x: (_ for _ in ()).throw(Unsafe("non-finite JSON")))
    except (ValueError, UnicodeError) as e:
        raise Unsafe("invalid JSON metadata") from e
    require(isinstance(value, dict), "metadata must be an object")
    return value, st, digest


def create_file(dfd, name, value):
    fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600, dir_fd=dfd)
    try:
        with os.fdopen(fd, "wb", closefd=False) as f:
            f.write(value)
            f.flush()
            os.fsync(fd)
    finally:
        os.close(fd)
    os.fsync(dfd)


def replace_json(dfd, name, value):
    # Unexpected interrupted .pending files are intentionally preserved by scan.
    staging = ".pending-" + uuid.uuid4().hex
    create_file(dfd, staging, json_bytes(value))
    os.replace(staging, name, src_dir_fd=dfd, dst_dir_fd=dfd)
    os.fsync(dfd)


class PinnedDirectory:
    """Open every absolute path component without following any symlink."""
    def __init__(self, path):
        self.path = os.fspath(path)
        require(os.path.isabs(self.path) and os.path.normpath(self.path) == self.path,
                "directory path must be normalized and absolute")
        self.chain = []
        self.fd = os.open("/", DIR_FLAGS)
        try:
            for name in self.path.split("/")[1:]:
                if not name:
                    continue
                parent = self.fd
                child = os.open(name, DIR_FLAGS, dir_fd=parent)
                self.chain.append((parent, name, child, identity(os.fstat(child))))
                self.fd = child
            check_dir(os.fstat(self.fd))
        except BaseException:
            self.close()
            raise

    def verify(self):
        for parent, name, fd, expected in self.chain:
            current = os.stat(name, dir_fd=parent, follow_symlinks=False)
            require(stat.S_ISDIR(current.st_mode) and identity(current) == expected == identity(os.fstat(fd)),
                    "directory path changed or was replaced")
        check_dir(os.fstat(self.fd))

    def close(self):
        for fd in {self.fd, *(p for p, _, _, _ in self.chain)}:
            with contextlib.suppress(OSError):
                os.close(fd)
        self.chain = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


@dataclasses.dataclass(frozen=True)
class Config:
    root: str = DEFAULT_ROOT
    audit_dir: str = str(Path(__file__).absolute().parent / "audits")
    allowed_roots: frozenset = dataclasses.field(default_factory=lambda: ALLOWED_ROOTS)

    def validate(self):
        require(self.root in self.allowed_roots, "root is outside the explicit disposable allowlist")
        require(os.path.isabs(self.audit_dir) and os.path.normpath(self.audit_dir) == self.audit_dir, "invalid audit directory")
        require(os.path.commonpath((self.audit_dir, self.root)) != self.root, "audits must be outside disposable root")


class Store:
    def __init__(self, cfg):
        cfg.validate()
        self.cfg = cfg
        self.pin = PinnedDirectory(cfg.root)
        self.fd = self.pin.fd
        try:
            marker, _, _ = read_json(self.fd, MARKER)
            s = os.fstat(self.fd)
            require(marker == {"schema": ROOT_SCHEMA, "path": cfg.root,
                               "device": s.st_dev, "inode": s.st_ino}, "unrecognized or relocated root marker")
            self.marker = marker
            self.lock_fd = os.open(LOCK, os.O_RDWR | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK, dir_fd=self.fd)
            check_regular(os.fstat(self.lock_fd))
            self.lock_identity = identity(os.fstat(self.lock_fd))
            self.verify()
        except BaseException:
            if hasattr(self, "lock_fd"):
                os.close(self.lock_fd)
            self.pin.close()
            raise

    def verify(self):
        self.pin.verify()
        marker, _, _ = read_json(self.fd, MARKER)
        require(marker == self.marker, "root marker changed")
        lock_st = os.stat(LOCK, dir_fd=self.fd, follow_symlinks=False)
        check_regular(lock_st)
        require(identity(lock_st) == self.lock_identity == identity(os.fstat(self.lock_fd)), "lifecycle lock inode replaced")

    @contextlib.contextmanager
    def locked(self, exclusive=False):
        try:
            fcntl.flock(self.lock_fd, (fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH) | fcntl.LOCK_NB)
        except BlockingIOError as e:
            raise Busy("lifecycle lock busy; preserve all runs") from e
        try:
            self.verify()
            yield
        finally:
            fcntl.flock(self.lock_fd, fcntl.LOCK_UN)

    def close(self):
        os.close(self.lock_fd)
        self.pin.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


def initialize(cfg):
    cfg.validate()
    parent, name = os.path.split(cfg.root)
    with PinnedDirectory(parent) as p:
        p.verify()
        # Never adopt an existing directory, including an empty one.
        os.mkdir(name, mode=0o700, dir_fd=p.fd)
        fd = os.open(name, DIR_FLAGS, dir_fd=p.fd)
        try:
            s = os.fstat(fd)
            create_file(fd, LOCK, b"")
            create_file(fd, MARKER, json_bytes({"schema": ROOT_SCHEMA, "path": cfg.root,
                                               "device": s.st_dev, "inode": s.st_ino}))
            p.verify()
            os.fsync(p.fd)
        finally:
            os.close(fd)


class Audit:
    def __init__(self, cfg):
        cfg.validate()
        parent, name = os.path.split(cfg.audit_dir)
        with PinnedDirectory(parent) as p:
            p.verify()
            try:
                os.mkdir(name, mode=0o700, dir_fd=p.fd)
            except FileExistsError:
                pass
            # Persist the directory entry, not just records inside the child.
            # If this fails, no run/capture/deletion may begin.
            p.verify()
            os.fsync(p.fd)
        self.pin = PinnedDirectory(cfg.audit_dir)
        try:
            self.name = "cleanup-" + time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()) + "-" + uuid.uuid4().hex + ".jsonl"
            self.fd = os.open(self.name, os.O_WRONLY | os.O_APPEND | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600, dir_fd=self.pin.fd)
            self.inode = identity(os.fstat(self.fd))
        except BaseException:
            self.pin.close()
            raise
        self.cfg = cfg

    def emit(self, event, **fields):
        self.pin.verify()
        require(identity(os.stat(self.name, dir_fd=self.pin.fd, follow_symlinks=False)) == self.inode, "audit file replaced")
        check_regular(os.fstat(self.fd))
        raw = json_bytes({"at_ns": time.time_ns(), "event": event, "version": VERSION,
                          "root": self.cfg.root, **fields})
        offset = 0
        while offset < len(raw):
            offset += os.write(self.fd, raw[offset:])
        os.fsync(self.fd)
        os.fsync(self.pin.fd)

    def close(self):
        os.close(self.fd)
        self.pin.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


def open_run(store, run):
    require(RUN_RE.fullmatch(run) is not None, "invalid run id")
    fd = os.open(run, DIR_FLAGS, dir_fd=store.fd)
    try:
        check_dir(os.fstat(fd))
        require(os.fstat(fd).st_dev == os.fstat(store.fd).st_dev, "run is on another filesystem")
        require(identity(os.stat(run, dir_fd=store.fd, follow_symlinks=False)) == identity(os.fstat(fd)), "run directory changed")
        return fd
    except BaseException:
        os.close(fd)
        raise


def validate_manifest(m, run):
    require(m.get("schema") == SCHEMA and m.get("run_id") == run, "unrecognized manifest")
    text_field(m.get("job"), "job")
    text_field(m.get("recreation"), "recreation instructions")
    timestamp(m.get("created_ns"))
    require(m.get("state") in ("active", "completed", "retired"), "unknown lifecycle state")
    require(isinstance(m.get("files"), dict), "invalid explicit file registry")
    for name, item in m["files"].items():
        safe_name(name)
        require(isinstance(item, dict) and item.get("kind") in KINDS, "invalid regenerable file kind")
        text_field(item.get("recreation"), "artifact recreation instructions")
        require(isinstance(item.get("sha256"), str) and re.fullmatch(r"[0-9a-f]{64}", item["sha256"]), "invalid sha256")
        for field in ("device", "inode", "size", "mtime_ns", "ctime_ns"):
            require(type(item.get(field)) is int and item[field] >= 0, "invalid registered inode/fingerprint")
    if m["state"] != "active":
        timestamp(m.get("completed_ns"))
        require(m["completed_ns"] >= m["created_ns"], "completion predates creation")


@contextlib.contextmanager
def registry_lock(fd):
    lock = os.open(REGISTER_LOCK, os.O_RDWR | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK, dir_fd=fd)
    try:
        check_regular(os.fstat(lock))
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        require(identity(os.stat(REGISTER_LOCK, dir_fd=fd, follow_symlinks=False)) == identity(os.fstat(lock)), "registry lock changed")
        yield
    finally:
        os.close(lock)


def new_run(store, job, recreation):
    text_field(job, "job")
    text_field(recreation, "recreation instructions")
    store.verify()
    run = "run-" + uuid.uuid4().hex
    os.mkdir(run, mode=0o700, dir_fd=store.fd)
    fd = open_run(store, run)
    try:
        create_file(fd, REGISTER_LOCK, b"")
        create_file(fd, MANIFEST, json_bytes({"schema": SCHEMA, "run_id": run,
                    "job": job, "recreation": recreation, "created_ns": time.time_ns(),
                    "state": "active", "files": {}}))
    finally:
        os.close(fd)
    os.fsync(store.fd)
    return run


def register(cfg, run, name, kind, recreation):
    safe_name(name)
    require(kind in KINDS, "invalid regenerable kind")
    text_field(recreation, "recreation instructions")
    with Store(cfg) as store, store.locked():
        fd = open_run(store, run)
        try:
            with registry_lock(fd):
                m, _, _ = read_json(fd, MANIFEST)
                validate_manifest(m, run)
                require(m["state"] == "active", "registration requires an active run")
                require(name not in m["files"], "already registered; changes require a new run")
                _, st, digest = read_file(fd, name)
                m["files"][name] = {"kind": kind, "recreation": recreation, "sha256": digest,
                                      "device": st.st_dev, "inode": st.st_ino, "size": st.st_size,
                                      "mtime_ns": st.st_mtime_ns, "ctime_ns": st.st_ctime_ns}
                store.verify()
                require(identity(os.stat(run, dir_fd=store.fd, follow_symlinks=False)) == identity(os.fstat(fd)), "run replaced")
                replace_json(fd, MANIFEST, m)
        finally:
            os.close(fd)


def complete_run(store, run, exitcode):
    fd = open_run(store, run)
    try:
        with registry_lock(fd):
            m, _, _ = read_json(fd, MANIFEST)
            validate_manifest(m, run)
            require(m["state"] == "active", "run already completed")
            m.update(state="completed", completed_ns=time.time_ns(), exitcode=exitcode)
            store.verify()
            replace_json(fd, MANIFEST, m)
    finally:
        os.close(fd)


def run_command(cfg, job, recreation, command, after_quiescence=None):
    require(bool(command), "command is required after --")
    require(sys.platform.startswith("linux"), "descendant-safe run wrapper requires Linux subreaper")
    libc = ctypes.CDLL(None, use_errno=True)
    require(libc.prctl(36, 1, 0, 0, 0) == 0, "cannot enable Linux child subreaper")
    with Store(cfg) as store, store.locked(), Audit(cfg) as audit:
        run = new_run(store, job, recreation)
        env = os.environ.copy()
        run_path = os.path.join(cfg.root, run)
        env.update(APERTURE_TMP_ROOT=cfg.root, APERTURE_TMP_RUN=run_path,
                   APERTURE_TMP_RUN_ID=run, APERTURE_TMP_LOCK_FD=str(store.lock_fd),
                   TMPDIR=run_path, TMP=run_path, TEMP=run_path)
        audit.emit("run-start", run=run, job=job, recreation=recreation)
        print(json.dumps({"run": run, "temporary_directory": env["APERTURE_TMP_RUN"]}), flush=True)
        # Children inherit the shared flock as an additional safety net. The
        # subreaper also waits for descendants that close inherited descriptors,
        # double-fork, or start a new session. No force-stale completion exists.
        completion_persisted = False
        phase = "launch"
        try:
            child = subprocess.Popen(command, env=env, pass_fds=(store.lock_fd,), start_new_session=True)
            phase = "waiting"
            exitcode = child.wait()
            while True:
                try:
                    os.waitpid(-1, 0)
                except InterruptedError:
                    continue
                except ChildProcessError:
                    break
            phase = "post-quiescence-registration"
            if after_quiescence is not None:
                after_quiescence(cfg, run, run_path)
            phase = "persisting-completion"
            complete_run(store, run, exitcode)
            completion_persisted = True
            phase = "completion-audit"
            audit.emit("run-completed", run=run, exitcode=exitcode)
            return exitcode if exitcode >= 0 else 128 - exitcode
        except BaseException as e:
            # Never force a failed/interrupted command tree complete. If the
            # final audit failed AFTER completion persisted, do not falsely
            # report an active run. A failed completion write is ambiguous.
            event = "run-completion-audit-failed" if completion_persisted else "run-error"
            with contextlib.suppress(Unsafe, OSError):
                audit.emit(event, run=run, reason=type(e).__name__, phase=phase,
                           completion_persisted=completion_persisted)
            raise


@dataclasses.dataclass
class Plan:
    run: str
    directory: tuple
    directory_fingerprint: tuple
    manifest: dict
    manifest_fingerprint: tuple
    registry_fingerprint: tuple
    files: dict
    bytes: int


def plan_run(store, run, fd, now_ns):
    dst = os.fstat(fd)
    check_dir(dst)
    m, mst, _ = read_json(fd, MANIFEST)
    validate_manifest(m, run)
    require(m["state"] == "completed", "run is active or already retired; preserve")
    completed = timestamp(m.get("completed_ns"))
    require(completed <= now_ns and m["created_ns"] <= completed, "future/inconsistent lifecycle timestamp")
    expected = META | set(m["files"])
    require(set(os.listdir(fd)) == expected, "unknown, unregistered, nested, or missing entry; preserve entire run")
    _, rst, _ = read_file(fd, REGISTER_LOCK, MAX_JSON)
    require(rst.st_size == 0, "registry lock has unexpected contents")
    latest = max(completed, dst.st_mtime_ns, dst.st_ctime_ns,
                 mst.st_mtime_ns, mst.st_ctime_ns, rst.st_mtime_ns, rst.st_ctime_ns)
    files = {}
    total = 0
    for name, recorded in sorted(m["files"].items()):
        _, st, digest = read_file(fd, name)
        require(st.st_dev == os.fstat(fd).st_dev, "artifact crosses filesystem")
        observed = {"device": st.st_dev, "inode": st.st_ino, "size": st.st_size,
                    "mtime_ns": st.st_mtime_ns, "ctime_ns": st.st_ctime_ns, "sha256": digest}
        require(all(recorded[k] == v for k, v in observed.items()), "registered artifact hash or inode changed")
        latest = max(latest, st.st_mtime_ns, st.st_ctime_ns)
        files[name] = fingerprint(st)
        total += st.st_size
    require(latest <= now_ns and now_ns - latest >= MIN_AGE_NS, "completed run is not inactive for at least 24 hours")
    require(set(os.listdir(fd)) == expected, "run changed during validation")
    require(identity(os.stat(run, dir_fd=store.fd, follow_symlinks=False)) == identity(dst), "run directory changed")
    current_dir = os.fstat(fd)
    check_dir(current_dir)
    require(fingerprint(current_dir) == fingerprint(dst), "run directory changed during validation")
    store.verify()
    return Plan(run, identity(dst), fingerprint(dst), m, fingerprint(mst), fingerprint(rst), files, total)


def verify_plan(store, fd, plan, now_ns):
    fresh = plan_run(store, plan.run, fd, now_ns)
    require(fresh == plan, "run changed since planning; preserve entire run")


def rename_noreplace(src_fd, src, dst_fd, dst):
    """Atomic capture without overwriting a concurrent replacement."""
    require(sys.platform.startswith("linux"), "safe retirement requires Linux renameat2")
    libc = ctypes.CDLL(None, use_errno=True)
    require(hasattr(libc, "renameat2"), "safe retirement requires renameat2 support")
    fn = libc.renameat2
    fn.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    fn.restype = ctypes.c_int
    if fn(src_fd, os.fsencode(src), dst_fd, os.fsencode(dst), 1) != 0:
        code = ctypes.get_errno()
        raise OSError(code, os.strerror(code))


def capture_matches(st, expected):
    # rename changes ctime. All other registered properties must remain equal.
    actual = fingerprint(st)
    return actual[:4] == expected[:4] and actual[5:] == expected[5:]


def apply_plan(store, fd, plan, audit, now_ns):
    """Capture every artifact atomically before any unlink, under exclusive lock.

    Original-path substitutions are captured then checked, never blindly
    unlinked. A failed capture preserves/restores all captured bytes. See README
    for the advisory-lock boundary against malicious same-UID processes.
    """
    verify_plan(store, fd, plan, now_ns)
    audit.emit("delete-intent", run=plan.run, manifest=plan.manifest, bytes=plan.bytes)
    verify_plan(store, fd, plan, now_ns)
    stage = ".retiring-" + uuid.uuid4().hex
    os.mkdir(stage, mode=0o700, dir_fd=store.fd)
    # Captured files need a durably reachable parent BEFORE the first rename.
    # A failure here leaves originals untouched and an unknown empty directory.
    store.verify()
    os.fsync(store.fd)
    sfd = os.open(stage, DIR_FLAGS, dir_fd=store.fd)
    stage_inode = identity(os.fstat(sfd))
    captured, removed = [], []

    def check_stage():
        store.verify()
        require(identity(os.stat(stage, dir_fd=store.fd, follow_symlinks=False)) == stage_inode,
                "retirement directory replaced")
        check_dir(os.fstat(sfd))
        check_dir(os.fstat(fd))
        require(identity(os.stat(plan.run, dir_fd=store.fd, follow_symlinks=False)) == plan.directory,
                "source run directory replaced")
        _, mst, _ = read_json(fd, MANIFEST)
        _, rst, _ = read_file(fd, REGISTER_LOCK, MAX_JSON)
        require(fingerprint(mst) == plan.manifest_fingerprint and
                fingerprint(rst) == plan.registry_fingerprint, "run metadata changed during retirement")

    def restore():
        # Never overwrite a file that appeared in the original path. Anything
        # conflicting remains in the private staging directory, recorded outside.
        restored, retained = [], []
        for name in reversed(captured):
            if name in removed:
                continue
            try:
                check_stage()
                rename_noreplace(sfd, name, fd, name)
                restored.append(name)
            except (Unsafe, OSError):
                retained.append(name)
        os.fsync(fd)
        os.fsync(sfd)
        audit.emit("capture-restored", run=plan.run, staging=stage,
                   restored=restored, retained=retained, already_deleted=removed)

    try:
        for name, expected in plan.files.items():
            check_stage()
            require(set(os.listdir(fd)) == META | (set(plan.files) - set(captured)),
                    "run inventory changed before capture")
            rename_noreplace(fd, name, sfd, name)
            captured.append(name)
            _, st, digest = read_file(sfd, name)
            require(capture_matches(st, expected) and digest == plan.manifest["files"][name]["sha256"],
                    "captured file is not the registered inode/hash")
        os.fsync(fd)
        os.fsync(sfd)
        audit.emit("captured-files", run=plan.run, staging=stage, names=captured)
        check_stage()
        require(set(os.listdir(fd)) == META and set(os.listdir(sfd)) == set(plan.files),
                "unknown entry appeared during capture; preserve entire run")
        staged_fingerprints = {}
        # Full post-capture validation before the FIRST unlink.
        for name, expected in plan.files.items():
            _, st, digest = read_file(sfd, name)
            require(capture_matches(st, expected) and digest == plan.manifest["files"][name]["sha256"],
                    "captured artifact changed; preserve entire run")
            staged_fingerprints[name] = fingerprint(st)
        for name, expected in staged_fingerprints.items():
            check_stage()
            require(set(os.listdir(fd)) == META and
                    set(os.listdir(sfd)) == set(plan.files) - set(removed), "inventory changed before deletion")
            _, st, digest = read_file(sfd, name)
            require(fingerprint(st) == expected and digest == plan.manifest["files"][name]["sha256"],
                    "captured artifact changed immediately before deletion")
            os.unlink(name, dir_fd=sfd)
            removed.append(name)  # Record before fsync: a flush error is partial.
            os.fsync(sfd)
            audit.emit("deleted-file", run=plan.run, name=name, sha256=digest, size=st.st_size)
        m = dict(plan.manifest)
        m.update(state="retired", retired_ns=time.time_ns(), deleted_files=removed)
        replace_json(fd, MANIFEST, m)
        audit.emit("retired-run", run=plan.run, deleted=removed, bytes=plan.bytes)
        return {"run": plan.run, "status": "deleted", "files": len(removed), "bytes": plan.bytes}
    except BaseException as e:
        # A failed audit cannot justify continuing deletion. Best-effort restore
        # is non-destructive and never overwrites a newly arrived original path.
        with contextlib.suppress(Unsafe, OSError):
            restore()
        with contextlib.suppress(Unsafe, OSError):
            audit.emit("deletion-stopped", run=plan.run, staging=stage, deleted=removed, reason=str(e))
        raise RetirementInterrupted(str(e), removed, stage) from e
    finally:
        # Remove only our freshly created EMPTY staging directory, never a run.
        # Crash debris or unexpected entries remain untouched for inspection.
        try:
            store.verify()
            if identity(os.stat(stage, dir_fd=store.fd, follow_symlinks=False)) == stage_inode and not os.listdir(sfd):
                os.rmdir(stage, dir_fd=store.fd)
                os.fsync(store.fd)
        except (Unsafe, OSError):
            pass
        os.close(sfd)


def scan(cfg, apply=False, now_ns=None):
    now_ns = time.time_ns() if now_ns is None else now_ns
    timestamp(now_ns)
    results = []
    with Store(cfg) as store, Audit(cfg) as audit:
        audit.emit("scan-start", apply=apply, minimum_age_hours=24)
        try:
            with store.locked(exclusive=True):
                for run in sorted(os.listdir(store.fd)):
                    if run in (MARKER, LOCK):
                        continue
                    fd = None
                    try:
                        require(RUN_RE.fullmatch(run) is not None, "unknown root entry; preserved")
                        fd = open_run(store, run)
                        plan = plan_run(store, run, fd, now_ns)
                        if apply:
                            result = apply_plan(store, fd, plan, audit, now_ns)
                        else:
                            result = {"run": run, "status": "would-delete", "files": len(plan.files), "bytes": plan.bytes}
                    except RetirementInterrupted as e:
                        result = {"run": run, "status": "stopped-partial" if e.deleted else "preserved",
                                  "reason": str(e), "deleted_files": e.deleted, "staging": e.staging}
                    except (Unsafe, OSError, ValueError) as e:
                        result = {"run": run, "status": "preserved", "reason": str(e)}
                    finally:
                        if fd is not None:
                            os.close(fd)
                    audit.emit("run-result", **result)
                    results.append(result)
                    if result["status"] == "stopped-partial":
                        break  # A potentially failing filesystem stops this scan.
        except Busy as e:
            results.append({"status": "busy", "reason": str(e)})
            audit.emit("scan-busy", reason=str(e))
        audit.emit("scan-complete", results=results)
    return results


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", action="version", version=VERSION)
    parser.add_argument("--root", default=DEFAULT_ROOT, help="explicit allowlisted root; never falls back automatically")
    parser.add_argument("--audit-dir", default=str(Path(__file__).absolute().parent / "audits"))
    sub = parser.add_subparsers(dest="action", required=True)
    sub.add_parser("init", help="create a NEW marked root, never adopt existing data")
    clean = sub.add_parser("scan", help="dry run unless --apply is explicitly provided")
    clean.add_argument("--apply", action="store_true")
    run = sub.add_parser("run", help="shared-locked wrapper; wait for all descendant processes")
    run.add_argument("--job", required=True)
    run.add_argument("--recreation", required=True)
    run.add_argument("command", nargs=argparse.REMAINDER)
    reg = sub.add_parser("register", help="explicitly hash-register one already-written flat regenerable artifact")
    reg.add_argument("--run", required=True)
    reg.add_argument("--file", required=True)
    reg.add_argument("--kind", required=True, choices=sorted(KINDS))
    reg.add_argument("--recreation", required=True)
    args = parser.parse_args(argv)
    cfg = Config(args.root, args.audit_dir)
    try:
        if args.action == "init":
            initialize(cfg)
            print(json.dumps({"initialized": cfg.root, "version": VERSION}))
        elif args.action == "scan":
            results = scan(cfg, apply=args.apply)
            print(json.dumps(results, indent=2))
            if any(r["status"] == "stopped-partial" for r in results):
                return 3
        elif args.action == "register":
            register(cfg, args.run, args.file, args.kind, args.recreation)
        else:
            command = args.command[1:] if args.command[:1] == ["--"] else args.command
            return run_command(cfg, args.job, args.recreation, command)
        return 0
    except (Unsafe, OSError, ValueError) as e:
        print(f"Stopped: {e}. Inspect the external audit for any prior progress. No broad or fallback cleanup was attempted.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
