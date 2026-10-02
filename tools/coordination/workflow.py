#!/usr/bin/env python3
"""Cooperative, single-host authority. Python stdlib; POSIX filesystem required."""
import argparse
import contextlib
import copy
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import stat
import subprocess
import sys


MAX_STATE_BYTES = 4_000_000
MAX_REVISION = 2**63 - 1
UNFINISHED = ("prepared", "pending", "observed", "unknown")
UNKNOWN_SCOPE = "historical-unknown-scope"


class Closed(RuntimeError):
    """No dispatch is authorized after any error, including uncertain persistence."""


def require(ok):
    if not ok:
        raise Closed("invalid, unavailable, unauthorized, or unreconciled state")


def identifier(value):
    require(type(value) is str and re.fullmatch(r"[a-zA-Z0-9_./:-]{1,160}", value))
    require(".." not in value and "//" not in value)
    return value


def digest(value):
    require(type(value) is str and re.fullmatch(r"[0-9a-f]{64}", value))
    return value


def encoded(value):
    return (json.dumps(value, sort_keys=True, indent=2) + "\n").encode()


def sha(value):
    return hashlib.sha256(value).hexdigest()


def keys(value, expected):
    require(type(value) is dict and set(value) == set(expected.split()))


def proof(value):
    keys(value, "workers descendants tools effects evidence")
    require(all(value[k] is True for k in ("workers", "descendants", "tools", "effects")))
    digest(value["evidence"])
    return copy.deepcopy(value)


def identity(provider, task, incarnation):
    require(provider in ("native", "cloud"))
    identifier(task)
    identifier(incarnation)
    require(task.startswith("/") if provider == "native" else "/" not in task)


def local_scope(value):
    keys(value, "coordinator_epoch boot_id root_id")
    digest(value["coordinator_epoch"])
    require(type(value["boot_id"]) is str and re.fullmatch(
        r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", value["boot_id"]))
    identifier(value["root_id"])
    require("/" not in value["root_id"])
    return copy.deepcopy(value)


def current_boot_id():
    # A local kernel observation, never proof of uniquely fenced VM ownership.
    return Path("/proc/sys/kernel/random/boot_id").read_text().strip()


def local_incarnation(scope, task):
    """Derived cooperative identity, explicitly not a provider-issued generation."""
    local_scope(scope)
    identifier(task)
    require(task.startswith("/"))
    return "local:" + sha(encoded(dict(scheme="native-local-v1", scope=scope, task=task)))


def native_observation(scope, task, evidence):
    return observation(dict(provider="native", task=task, evidence=evidence,
                            incarnation=local_incarnation(scope, task),
                            local_execution=local_scope(scope)))


def check_local_scope(s, scope, root_id=None):
    local_scope(scope)
    require(s["native_execution"] is not None)
    require(scope == s["native_execution"]["scope"])
    require(scope["coordinator_epoch"] == s["epoch"] and scope["boot_id"] == current_boot_id())
    if root_id is not None:
        require(root_id == scope["root_id"])


def unused_native_path(s, scope, task):
    """Never create a second instance at a used root-namespace path."""
    def same(other, other_task):
        return (other is not None and other["root_id"] == scope["root_id"] and other_task == task)
    for claim in s["claims"].values():
        binding = claim["binding"]
        require(binding is None or not same(binding.get("local_execution"), binding["task"]))
        for op in claim["operations"].values():
            if op["kind"] == "spawn":
                spec = op["specification"]
                require(not same(spec.get("local_execution"), spec["requested_task"]))


def spawn_specification(value):
    keys(value, "provider parent requested_task request_sha256" +
         (" local_execution" if "local_execution" in value else ""))
    if "local_execution" in value:
        require(value["provider"] == "native")
        local_scope(value["local_execution"])
    require(value["provider"] in ("native", "cloud"))
    identifier(value["parent"])
    digest(value["request_sha256"])
    if value["provider"] == "native":
        identifier(value["requested_task"])
        require(value["requested_task"].startswith("/"))
    else:
        require(value["requested_task"] is None)
    return copy.deepcopy(value)


def spawn_payload(correlation, specification):
    digest(correlation)
    spawn_specification(specification)
    return sha(encoded(dict(correlation=correlation, specification=specification)))


def observation(value):
    keys(value, "provider task incarnation evidence" +
         (" local_execution" if "local_execution" in value else ""))
    if "local_execution" in value:
        require(value["provider"] == "native")
        require(value["incarnation"] == local_incarnation(
            value["local_execution"], value["task"]))
    identity(value["provider"], value["task"], value["incarnation"])
    require("local_execution" in value or not value["incarnation"].startswith("local:"))
    digest(value["evidence"])
    return copy.deepcopy(value)


def validate(s, private=True):
    keys(s, "version epoch revision barrier admission native_execution claims" + (" authority" if private else ""))
    require(type(s["version"]) is int and s["version"] == 3)
    digest(s["epoch"])
    require(type(s["revision"]) is int and 0 <= s["revision"] <= MAX_REVISION)
    require(type(s["barrier"]) is bool and type(s["claims"]) is dict)
    if private:
        digest(s["authority"])
    if s["admission"] is not None:
        keys(s["admission"], "single_vm evidence")
        require(s["admission"]["single_vm"] is True)
        digest(s["admission"]["evidence"])
    require(s["barrier"] or s["admission"] is not None)
    if s["native_execution"] is not None:
        keys(s["native_execution"], "scope evidence")
        local_scope(s["native_execution"]["scope"])
        digest(s["native_execution"]["evidence"])
        require(s["native_execution"]["scope"]["coordinator_epoch"] == s["epoch"])
    active_domains, quarantined_domains, correlations = set(), set(), set()
    for cid, c in s["claims"].items():
        identifier(cid)
        keys(c, "owner domains status binding operations proof scope_proof" + (" token" if private else ""))
        identifier(c["owner"])
        require(type(c["domains"]) is list and len(c["domains"]) > 0)
        require(len(set(c["domains"])) == len(c["domains"]))
        for domain in c["domains"]:
            identifier(domain)
        require(c["status"] in ("active", "quarantined", "released"))
        if c["scope_proof"] is not None:
            keys(c["scope_proof"], "previous_domains evidence")
            previous = c["scope_proof"]["previous_domains"]
            require(type(previous) is list and previous and len(set(previous)) == len(previous))
            require(UNKNOWN_SCOPE in previous or set(c["domains"]).issubset(previous))
            for domain in c["scope_proof"]["previous_domains"]:
                identifier(domain)
            digest(c["scope_proof"]["evidence"])
        if c["status"] == "active":
            require(not active_domains.intersection(c["domains"]))
            active_domains.update(c["domains"])
        elif c["status"] == "quarantined":
            quarantined_domains.update(c["domains"])
        if private:
            digest(c["token"])
        if c["proof"] is not None:
            proof(c["proof"])
        if c["binding"] is not None:
            keys(c["binding"], "source provider task incarnation evidence" +
                 (" local_execution" if "local_execution" in c["binding"] else ""))
            require(c["binding"]["source"] in ("spawn", "adopted"))
            observation({k: v for k, v in c["binding"].items() if k != "source"})
        require(type(c["operations"]) is dict)
        pending = 0
        for oid, op in c["operations"].items():
            identifier(oid)
            require(type(op) is dict and op.get("kind") in ("spawn", "write"))
            common = "kind payload status proof"
            if op["kind"] == "spawn":
                keys(op, common + " correlation specification observation")
                require(op["payload"] == spawn_payload(op["correlation"], op["specification"]))
                require(op["correlation"] not in correlations)
                correlations.add(op["correlation"])
                if op["observation"] is not None:
                    observed = observation(op["observation"])
                    require(observed["provider"] == op["specification"]["provider"])
                    require(observed.get("local_execution") == op["specification"].get("local_execution"))
                    expected = op["specification"]["requested_task"]
                    require(expected is None or expected == observed["task"])
                if op["status"] in ("observed", "bound"):
                    require(op["observation"] is not None)
                if op["status"] in ("prepared", "pending"):
                    require(op["observation"] is None)
                if op["status"] == "bound":
                    require(c["binding"] == dict(source="spawn", **op["observation"]))
            else:
                keys(op, common + " task incarnation")
                identifier(op["task"])
                identifier(op["incarnation"])
                require(op["status"] not in ("observed", "bound"))
                if not s["barrier"] and c["status"] == "active":
                    require(c["binding"] is not None)
                    require(all(c["binding"][k] == op[k] for k in ("task", "incarnation")))
            digest(op["payload"])
            require(op["status"] in UNFINISHED + ("resolved", "bound"))
            if op["proof"] is not None:
                proof(op["proof"])
            if op["status"] == "resolved":
                require(op["proof"] is not None)
            pending += op["status"] in UNFINISHED
        require(pending <= 1)
        if c["status"] == "released":
            require(pending == 0 and c["proof"] is not None)
    require(not active_domains.intersection(quarantined_domains))
    require(not active_domains or UNKNOWN_SCOPE not in quarantined_domains)
    return s


def capacity_bytes(s):
    """Upper bound for closing current claims, including observation and binding.

    Reserve concrete maximum-size schema fields, not an arbitrary percentage.
    Historical records are never silently truncated to make new work fit.
    """
    closing = copy.deepcopy(s)
    evidence = dict(workers=True, descendants=True, tools=True, effects=True, evidence="f" * 64)
    observed = dict(provider="native", task="/" + "x" * 159,
                    incarnation="x" * 160, evidence="f" * 64,
                    local_execution=dict(coordinator_epoch="f" * 64,
                        boot_id="ffffffff-ffff-ffff-ffff-ffffffffffff", root_id="x" * 160))
    if closing["barrier"]:
        closing["admission"] = dict(single_vm=True, evidence="f" * 64)
    closing["barrier"] = False  # JSON false is one byte longer than true.
    for c in closing["claims"].values():
        if c["status"] == "released":
            continue
        c["status"] = "quarantined"  # Longest status, including active -> released growth.
        c["proof"] = evidence
        if c["binding"] is None:
            c["binding"] = dict(source="adopted", **observed)
        for op in c["operations"].values():
            if op["status"] not in UNFINISHED:
                continue
            op["status"] = "resolved"
            op["proof"] = evidence
            if op["kind"] == "spawn" and op["observation"] is None:
                op["observation"] = observed
    # Fixed digit width: observing/binding must never move a decimal threshold.
    closing["revision"] = MAX_REVISION
    return max(len(encoded(s)), len(encoded(closing)))


def closing_mutations(s):
    """Enough revision numbers to resolve every outstanding intent and release claims."""
    return int(s["barrier"]) + sum(
        1 + sum(op["status"] in UNFINISHED for op in c["operations"].values())
        for c in s["claims"].values() if c["status"] != "released"
    )


def decode(raw, private=True):
    def unique(pairs):
        out = {}
        for key, value in pairs:
            require(key not in out)
            out[key] = value
        return out
    try:
        return validate(json.loads(raw, object_pairs_hook=unique), private)
    except (ValueError, TypeError, KeyError, RecursionError) as exc:
        raise Closed("malformed state") from exc


def forbid_git(fd):
    try:
        marker = os.stat(".git", dir_fd=fd, follow_symlinks=False)
    except FileNotFoundError:
        return
    require(stat.S_ISDIR(marker.st_mode))
    gitfd = os.open(".git", os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
    try:
        # Managed sandboxes mount empty read-only .git placeholders at /tmp and
        # /workspace. They are not repositories. Reject any nonempty marker.
        require(not os.listdir(gitfd))
    finally:
        os.close(gitfd)


@contextlib.contextmanager
def directory(path):
    """Walk with directory fds: no symlinks, traversal, or Git-owned authority."""
    p = Path(path)
    require(p.is_absolute() and ".." not in p.parts)
    fd = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
    try:
        for part in p.parts[1:]:
            forbid_git(fd)
            nxt = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = nxt
        forbid_git(fd)
        info = os.fstat(fd)
        require(info.st_uid == os.getuid() and stat.S_IMODE(info.st_mode) == 0o700)
        yield fd
    finally:
        os.close(fd)


def readfile(fd, name):
    f = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=fd)
    try:
        info = os.fstat(f)
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1)
        require(info.st_uid == os.getuid() and stat.S_IMODE(info.st_mode) == 0o600)
        require(info.st_size <= MAX_STATE_BYTES)
        with os.fdopen(os.dup(f), "rb") as stream:
            raw = stream.read(MAX_STATE_BYTES + 1)
            require(len(raw) <= MAX_STATE_BYTES)
            return raw
    finally:
        os.close(f)


def save(fd, s):
    validate(s)
    raw = encoded(s)
    require(len(raw) <= MAX_STATE_BYTES and capacity_bytes(s) <= MAX_STATE_BYTES)
    require(s["revision"] + closing_mutations(s) <= MAX_REVISION)
    name = ".pending-" + secrets.token_hex(16)
    f = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=fd)
    try:
        with os.fdopen(f, "wb") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, "state.json", src_dir_fd=fd, dst_dir_fd=fd)
        os.fsync(fd)
    finally:
        # A killed process may leave a harmless private temp file. Never adopt it.
        try:
            os.unlink(name, dir_fd=fd)
        except FileNotFoundError:
            pass


def secret():
    return secrets.token_hex(32)


def matches(token, hashed):
    require(type(token) is str and secrets.compare_digest(sha(token.encode()), hashed))


class Coordinator:
    def __init__(self, path):
        self.path = str(path)

    @classmethod
    def bootstrap(cls, path, snapshot):
        """Explicit recovery only; destination must not exist. Always quarantines."""
        s = decode(encoded(snapshot), private=False)
        authority = secret()
        s.update(epoch=secret(), authority=sha(authority.encode()), barrier=True, admission=None, native_execution=None, revision=0)
        for c in s["claims"].values():
            c["token"] = sha(secret().encode())
            if c["status"] != "released":
                c["status"] = "quarantined"
        require(capacity_bytes(s) <= MAX_STATE_BYTES)
        p = Path(path)
        require(p.is_absolute() and ".." not in p.parts)
        # Check ancestors without demanding they be private; mkdir is exclusive.
        fd = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
        try:
            for part in p.parts[1:-1]:
                forbid_git(fd)
                nxt = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                os.close(fd)
                fd = nxt
            forbid_git(fd)
            os.mkdir(p.name, mode=0o700, dir_fd=fd)
            os.fsync(fd)
        finally:
            os.close(fd)
        with directory(path) as fd:
            lock = os.open("lock", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=fd)
            os.close(lock)
            save(fd, s)
        return cls(path), authority

    @contextlib.contextmanager
    def transaction(self, write=True):
        with directory(self.path) as fd:
            lock = os.open("lock", os.O_RDWR | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=fd)
            try:
                info = os.fstat(lock)
                require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1)
                require(info.st_uid == os.getuid() and stat.S_IMODE(info.st_mode) == 0o600)
                try:
                    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError as exc:
                    raise Closed("busy; dispatch denied") from exc
                s = decode(readfile(fd, "state.json"))
                before = copy.deepcopy(s)
                yield s
                if write and s != before:
                    s["revision"] += 1
                    save(fd, s)
            finally:
                os.close(lock)

    def tick(self):
        with self.transaction(False) as s:
            return self.public(s)

    @staticmethod
    def public(s):
        out = copy.deepcopy(s)
        del out["authority"]
        for c in out["claims"].values():
            del c["token"]
        validate(out, False)
        return out

    def checkpoint(self):
        return {"durability": "local-only", "snapshot": self.tick()}

    def reconcile_recovery(self, authority, evidence, admission):
        proof(evidence)
        keys(admission, "single_vm evidence")
        require(admission["single_vm"] is True)
        digest(admission["evidence"])
        with self.transaction() as s:
            matches(authority, s["authority"])
            require(s["barrier"])
            for c in s["claims"].values():
                if c["status"] != "released":
                    c["status"], c["proof"] = "released", evidence
                    for op in c["operations"].values():
                        if op["status"] in UNFINISHED:
                            op["status"], op["proof"] = "resolved", evidence
            s["barrier"] = False
            s["admission"] = copy.deepcopy(admission)
            # Recovery rotates even bootstrap authority; never reuses an old token.
            new = secret()
            s["authority"] = sha(new.encode())
        return {"authority": new, "dispatch_authorized": False}

    def admit_recovery(self, authority, admission):
        """Admit this VM without asserting historical effects resolved."""
        keys(admission, "single_vm evidence")
        require(admission["single_vm"] is True)
        digest(admission["evidence"])
        with self.transaction() as s:
            matches(authority, s["authority"])
            require(s["barrier"])
            s["barrier"], s["admission"] = False, copy.deepcopy(admission)
            new = secret()
            s["authority"] = sha(new.encode())
        return {"authority": new, "dispatch_authorized": False}

    def bound_recovery_scope(self, authority, claim_id, domains, evidence):
        """One reviewed narrowing of uncertainty, never an assertion of quiescence."""
        keys(evidence, "complete_scope evidence")
        require(evidence["complete_scope"] is True)
        digest(evidence["evidence"])
        require(type(domains) is list and domains and len(set(domains)) == len(domains))
        for domain in domains:
            identifier(domain)
        require(UNKNOWN_SCOPE not in domains)
        with self.transaction() as s:
            matches(authority, s["authority"])
            require(claim_id in s["claims"])
            c = s["claims"][claim_id]
            require(c["status"] == "quarantined" and c["scope_proof"] is None)
            require(UNKNOWN_SCOPE in c["domains"] or set(domains).issubset(c["domains"]))
            c["scope_proof"] = dict(previous_domains=c["domains"], evidence=evidence["evidence"])
            c["domains"] = copy.deepcopy(domains)
        return {"dispatch_authorized": False}

    def reconcile_claim(self, authority, claim_id, evidence):
        """Release only the historical claim covered by actual reconciliation."""
        evidence = proof(evidence)
        with self.transaction() as s:
            matches(authority, s["authority"])
            require(claim_id in s["claims"])
            c = s["claims"][claim_id]
            require(c["status"] == "quarantined")
            c["status"], c["proof"] = "released", evidence
            for op in c["operations"].values():
                if op["status"] in UNFINISHED:
                    op["status"], op["proof"] = "resolved", evidence
        return {"dispatch_authorized": False}

    def register_native_execution(self, authority, root_id, evidence):
        """Record one observed local namespace; no provider generation is invented."""
        identifier(root_id)
        keys(evidence, "scope_observed unique_task_paths evidence")
        require(evidence["scope_observed"] is True and evidence["unique_task_paths"] is True)
        digest(evidence["evidence"])
        with self.transaction() as s:
            matches(authority, s["authority"])
            require(not s["barrier"] and s["native_execution"] is None)
            scope = local_scope(dict(coordinator_epoch=s["epoch"],
                                     boot_id=current_boot_id(), root_id=root_id))
            s["native_execution"] = dict(scope=scope, evidence=evidence["evidence"])
        return {"dispatch_authorized": False, "scope": scope}

    def claim(self, authority, claim_id, owner, domains):
        identifier(claim_id)
        identifier(owner)
        require(type(domains) is list and domains and len(set(domains)) == len(domains))
        for d in domains:
            identifier(d)
        with self.transaction() as s:
            matches(authority, s["authority"])
            require(not s["barrier"] and claim_id not in s["claims"])
            require(UNKNOWN_SCOPE not in domains)
            for c in s["claims"].values():
                require(c["status"] == "released" or (UNKNOWN_SCOPE not in c["domains"]
                        and not set(domains).intersection(c["domains"])))
            token = secret()
            s["claims"][claim_id] = dict(owner=owner, domains=domains, status="active", binding=None,
                                         operations={}, proof=None, scope_proof=None, token=sha(token.encode()))
        return {"token": token, "dispatch_authorized": False}

    @staticmethod
    def owned(s, claim_id, token):
        require(not s["barrier"] and claim_id in s["claims"])
        c = s["claims"][claim_id]
        matches(token, c["token"])
        require(c["status"] == "active")
        return c

    @staticmethod
    def available(c, operation):
        identifier(operation)
        require(all(o["status"] in ("resolved", "bound") for o in c["operations"].values()))
        require(operation not in c["operations"])

    def prepare(self, claim_id, token, operation, kind, task, incarnation, payload):
        """Prepare writes only. Provider-assigned spawn identity is observed later."""
        for v in (operation, task, incarnation):
            identifier(v)
        require(kind == "write")
        digest(payload)
        with self.transaction() as s:
            c = self.owned(s, claim_id, token)
            if operation in c["operations"]:
                return {"dispatch_authorized": False, "reason": "replay"}
            self.available(c, operation)
            require(c["binding"] is not None)
            require(c["binding"]["task"] == task and c["binding"]["incarnation"] == incarnation)
            if "local_execution" in c["binding"]:
                check_local_scope(s, c["binding"]["local_execution"])
            c["operations"][operation] = dict(kind=kind, task=task, incarnation=incarnation,
                                               payload=payload, status="prepared", proof=None)
        return {"dispatch_authorized": False, "operation": operation}

    def prepare_spawn(self, claim_id, token, operation, correlation, specification):
        """Caller-generated random nonce is included in the immutable create request."""
        identifier(operation)
        payload = spawn_payload(correlation, specification)
        with self.transaction() as s:
            c = self.owned(s, claim_id, token)
            if operation in c["operations"]:
                return {"dispatch_authorized": False, "reason": "replay"}
            self.available(c, operation)
            require(c["binding"] is None)
            if "local_execution" in specification:
                check_local_scope(s, specification["local_execution"])
                unused_native_path(s, specification["local_execution"], specification["requested_task"])
            require(all(o.get("correlation") != correlation for other in s["claims"].values()
                        for o in other["operations"].values()))
            c["operations"][operation] = dict(kind="spawn", correlation=correlation,
                specification=spawn_specification(specification), observation=None,
                payload=payload, status="prepared", proof=None)
        return {"dispatch_authorized": False, "operation": operation, "payload": payload}

    def adopt_existing(self, authority, claim_id, token, observed, evidence):
        """Explicit adoption of a known, waiting owner; never invent a spawn event."""
        observed = observation(observed)
        keys(evidence, "identity_observed no_ungated_effects evidence")
        require(evidence["identity_observed"] is True and evidence["no_ungated_effects"] is True)
        digest(evidence["evidence"])
        # One reviewed evidence record must support both the exact identity and adoption.
        require(evidence["evidence"] == observed["evidence"])
        with self.transaction() as s:
            matches(authority, s["authority"])
            c = self.owned(s, claim_id, token)
            require(c["owner"] == observed["task"])
            require(c["binding"] is None and not c["operations"])
            if "local_execution" in observed:
                check_local_scope(s, observed["local_execution"])
                # Sequential claims may adopt the same logical owner after actual
                # reconciliation. New creates may never reuse its namespace path.
                for other in s["claims"].values():
                    old = other["binding"]
                    require(old is None or other["status"] == "released"
                            or old.get("local_execution") != observed["local_execution"]
                            or old["task"] != observed["task"])
            c["binding"] = dict(source="adopted", **observed)
            new = secret()
            c["token"] = sha(new.encode())
        return {"token": new, "dispatch_authorized": False}

    def begin(self, claim_id, token, operation, publication, root_id=None):
        with self.transaction() as s:
            c = self.owned(s, claim_id, token)
            require(operation in c["operations"])
            op = c["operations"][operation]
            if op["status"] != "prepared":
                return {"dispatch_authorized": False, "reason": "replay"}
            local = (op["specification"].get("local_execution") if op["kind"] == "spawn"
                     else c["binding"].get("local_execution"))
            if local is not None:
                require(root_id is not None)
                check_local_scope(s, local, root_id)
            keys(publication, "repo remote ref commit tree snapshot_path")
            verify_publication(**publication, snapshot=self.public(s))
            op["status"] = "pending"
            result = {"dispatch_authorized": True, "operation": operation,
                      "kind": op["kind"], "payload": op["payload"]}
            if op["kind"] == "spawn":
                result.update(correlation=op["correlation"], specification=copy.deepcopy(op["specification"]))
            else:
                result.update(task=op["task"], incarnation=op["incarnation"],
                              provider=c["binding"]["provider"])
                if local is not None:
                    result["local_execution"] = copy.deepcopy(local)
        return result

    def record_spawn(self, claim_id, token, operation, correlation, payload, observed):
        """Persist one authenticated provider result tied to the original create call."""
        observed = observation(observed)
        with self.transaction() as s:
            c = self.owned(s, claim_id, token)
            require(operation in c["operations"])
            op = c["operations"][operation]
            require(op["kind"] == "spawn" and op["status"] == "pending")
            require(op["correlation"] == correlation and op["payload"] == payload)
            require(op["observation"] is None and c["binding"] is None)
            require(observed["provider"] == op["specification"]["provider"])
            require(observed.get("local_execution") == op["specification"].get("local_execution"))
            if "local_execution" in observed:
                check_local_scope(s, observed["local_execution"])
            expected = op["specification"]["requested_task"]
            require(expected is None or expected == observed["task"])
            op["observation"], op["status"] = observed, "observed"
        return {"dispatch_authorized": False}

    def bind(self, claim_id, token, operation, correlation, payload, observed):
        observed = observation(observed)
        with self.transaction() as s:
            c = self.owned(s, claim_id, token)
            require(operation in c["operations"])
            op = c["operations"][operation]
            require(op["kind"] == "spawn" and op["status"] == "observed")
            require(op["correlation"] == correlation and op["payload"] == payload)
            require(op["observation"] == observed and c["binding"] is None)
            if "local_execution" in observed:
                check_local_scope(s, observed["local_execution"])
            c["binding"] = dict(source="spawn", **observed)
            op["status"] = "bound"
            new = secret()
            c["token"] = sha(new.encode())
        return {"token": new, "dispatch_authorized": False}

    def resolve(self, claim_id, token, operation, evidence=None):
        with self.transaction() as s:
            c = self.owned(s, claim_id, token)
            require(operation in c["operations"])
            op = c["operations"][operation]
            require(op["status"] in UNFINISHED)
            if evidence is None:
                op["status"] = "unknown"
            else:
                op["proof"], op["status"] = proof(evidence), "resolved"
        return {"dispatch_authorized": False}

    def release(self, claim_id, token, evidence):
        proof(evidence)
        with self.transaction() as s:
            c = self.owned(s, claim_id, token)
            require(all(o["status"] in ("resolved", "bound") for o in c["operations"].values()))
            c["status"], c["proof"] = "released", evidence
        return {"dispatch_authorized": False}


def verify_publication(repo, remote, ref, commit, tree, snapshot_path, snapshot):
    """Read-only observation: exact ref AND commit/tree/blob; never pushes/fetches."""
    require(re.fullmatch(r"[0-9a-f]{40}", commit) and re.fullmatch(r"[0-9a-f]{40}", tree))
    require(re.fullmatch(r"[a-zA-Z0-9_-]+", remote) is not None)
    require(ref.startswith("refs/heads/") and re.fullmatch(r"[a-zA-Z0-9_./-]+", ref))
    require(".." not in ref and "//" not in ref)
    identifier(snapshot_path)
    require(not snapshot_path.startswith("/") and ":" not in snapshot_path)
    validate(snapshot, False)
    # Never inherit repository, object-store, replacement or config selection.
    # The explicit checkout and its configured remote are the observation target.
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update(GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL=os.devnull,
               GIT_NO_REPLACE_OBJECTS="1", GIT_TERMINAL_PROMPT="0")

    def git(*args):
        try:
            return subprocess.run(["git", "--no-replace-objects", "-C", str(repo), *args], check=True, env=env,
                                  stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                  timeout=30).stdout
        except (OSError, subprocess.SubprocessError) as exc:
            raise Closed("publication observation unavailable") from exc
    expected = (commit + "\t" + ref + "\n").encode()
    require(git("ls-remote", "--refs", remote, ref) == expected)
    require(git("rev-parse", commit + "^{tree}").strip().decode() == tree)
    require(git("show", commit + ":" + snapshot_path) == encoded(snapshot))
    require(git("ls-remote", "--refs", remote, ref) == expected)
    return {"durability": "remote-observed", "ref": ref, "commit": commit,
            "tree": tree, "snapshot_sha256": sha(encoded(snapshot))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("state", help="absolute private directory outside Git")
    parser.add_argument("command", choices=("bootstrap", "tick", "checkpoint", "claim", "prepare", "begin",
                                           "prepare_spawn", "record_spawn", "adopt_existing", "bind",
                                           "resolve", "release", "reconcile_recovery", "admit_recovery",
                                           "bound_recovery_scope", "reconcile_claim", "register_native_execution"))
    args = parser.parse_args()
    # Secrets only via protected stdin/stdout, never argv, logs, or tracked files.
    request = {} if args.command in ("tick", "checkpoint") else json.load(sys.stdin)
    if args.command == "bootstrap":
        _, authority = Coordinator.bootstrap(args.state, **request)
        result = {"authority": authority, "dispatch_authorized": False}
    else:
        result = getattr(Coordinator(args.state), args.command)(**request)
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (Closed, OSError, ValueError, TypeError, KeyError):
        print('{"dispatch_authorized":false,"error":"fail-closed"}', file=sys.stderr)
        sys.exit(1)
