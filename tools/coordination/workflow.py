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


def validate(s, private=True):
    keys(s, "version epoch revision barrier admission claims" + (" authority" if private else ""))
    require(type(s["version"]) is int and s["version"] == 1)
    digest(s["epoch"])
    require(type(s["revision"]) is int and s["revision"] >= 0)
    require(type(s["barrier"]) is bool and type(s["claims"]) is dict)
    if private:
        digest(s["authority"])
    if s["admission"] is not None:
        keys(s["admission"], "single_vm evidence")
        require(s["admission"]["single_vm"] is True)
        digest(s["admission"]["evidence"])
    require(s["barrier"] or s["admission"] is not None)
    occupied = set()
    for cid, c in s["claims"].items():
        identifier(cid)
        keys(c, "owner domains status binding operations proof" + (" token" if private else ""))
        identifier(c["owner"])
        require(type(c["domains"]) is list and len(c["domains"]) > 0)
        require(len(set(c["domains"])) == len(c["domains"]))
        for domain in c["domains"]:
            identifier(domain)
        require(c["status"] in ("active", "quarantined", "released"))
        require(s["barrier"] or c["status"] != "quarantined")
        if c["status"] != "released":
            # A recovery barrier permits overlapping historical unknown scopes.
            require(s["barrier"] or not occupied.intersection(c["domains"]))
            occupied.update(c["domains"])
        if private:
            digest(c["token"])
        if c["proof"] is not None:
            proof(c["proof"])
        if c["binding"] is not None:
            keys(c["binding"], "task incarnation")
            identifier(c["binding"]["task"])
            identifier(c["binding"]["incarnation"])
        require(type(c["operations"]) is dict)
        pending = 0
        for oid, op in c["operations"].items():
            identifier(oid)
            keys(op, "kind task incarnation payload status proof")
            require(op["kind"] in ("spawn", "write"))
            identifier(op["task"])
            identifier(op["incarnation"])
            digest(op["payload"])
            require(op["status"] in ("prepared", "pending", "unknown", "resolved", "bound"))
            if op["proof"] is not None:
                proof(op["proof"])
            if op["status"] == "resolved":
                require(op["proof"] is not None)
            if not s["barrier"] and c["status"] == "active" and op["kind"] == "write":
                require(c["binding"] == dict(task=op["task"], incarnation=op["incarnation"]))
            if op["status"] == "bound":
                require(op["kind"] == "spawn")
            pending += op["status"] in ("prepared", "pending", "unknown")
        require(pending <= 1)
        if c["status"] == "released":
            require(pending == 0 and c["proof"] is not None)
    return s


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
        require(info.st_size <= 4_000_000)
        with os.fdopen(os.dup(f), "rb") as stream:
            return stream.read(4_000_001)
    finally:
        os.close(f)


def save(fd, s):
    validate(s)
    name = ".pending-" + secrets.token_hex(16)
    f = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=fd)
    try:
        with os.fdopen(f, "wb") as stream:
            stream.write(encoded(s))
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
        authority = secret()
        s.update(epoch=secret(), authority=sha(authority.encode()), barrier=True, admission=None, revision=0)
        for c in s["claims"].values():
            c["token"] = sha(secret().encode())
            if c["status"] != "released":
                c["status"] = "quarantined"
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
                yield s
                if write:
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
                        if op["status"] in ("prepared", "pending", "unknown"):
                            op["status"], op["proof"] = "resolved", evidence
            s["barrier"] = False
            s["admission"] = copy.deepcopy(admission)
            # Recovery rotates even bootstrap authority; never reuses an old token.
            new = secret()
            s["authority"] = sha(new.encode())
        return {"authority": new, "dispatch_authorized": False}

    def claim(self, authority, claim_id, owner, domains):
        identifier(claim_id)
        identifier(owner)
        require(type(domains) is list and domains and len(set(domains)) == len(domains))
        for d in domains:
            identifier(d)
        with self.transaction() as s:
            matches(authority, s["authority"])
            require(not s["barrier"] and claim_id not in s["claims"])
            for c in s["claims"].values():
                require(c["status"] == "released" or not set(domains).intersection(c["domains"]))
            token = secret()
            s["claims"][claim_id] = dict(owner=owner, domains=domains, status="active", binding=None,
                                         operations={}, proof=None, token=sha(token.encode()))
        return {"token": token, "dispatch_authorized": False}

    @staticmethod
    def owned(s, claim_id, token):
        require(not s["barrier"] and claim_id in s["claims"])
        c = s["claims"][claim_id]
        matches(token, c["token"])
        require(c["status"] == "active")
        return c

    def prepare(self, claim_id, token, operation, kind, task, incarnation, payload):
        for v in (operation, task, incarnation):
            identifier(v)
        require(kind in ("spawn", "write"))
        digest(payload)
        with self.transaction() as s:
            c = self.owned(s, claim_id, token)
            if operation in c["operations"]:
                return {"dispatch_authorized": False, "reason": "replay"}
            require(all(o["status"] in ("resolved", "bound") for o in c["operations"].values()))
            if kind == "spawn":
                require(c["binding"] is None)
            else:
                require(c["binding"] == dict(task=task, incarnation=incarnation))
            c["operations"][operation] = dict(kind=kind, task=task, incarnation=incarnation,
                                               payload=payload, status="prepared", proof=None)
        return {"dispatch_authorized": False, "operation": operation}

    def begin(self, claim_id, token, operation, publication):
        with self.transaction() as s:
            c = self.owned(s, claim_id, token)
            require(operation in c["operations"])
            op = c["operations"][operation]
            if op["status"] != "prepared":
                return {"dispatch_authorized": False, "reason": "replay"}
            keys(publication, "repo remote ref commit tree snapshot_path")
            verify_publication(**publication, snapshot=self.public(s))
            op["status"] = "pending"
            result = {"dispatch_authorized": True, "operation": operation,
                      "kind": op["kind"], "task": op["task"],
                      "incarnation": op["incarnation"], "payload": op["payload"]}
        return result

    def bind(self, claim_id, token, operation, task, incarnation):
        with self.transaction() as s:
            c = self.owned(s, claim_id, token)
            require(operation in c["operations"])
            op = c["operations"][operation]
            require(op["kind"] == "spawn" and op["status"] == "pending")
            require(op["task"] == task and op["incarnation"] == incarnation and c["binding"] is None)
            c["binding"] = dict(task=task, incarnation=incarnation)
            op["status"] = "bound"
            new = secret()
            c["token"] = sha(new.encode())
        return {"token": new, "dispatch_authorized": False}

    def resolve(self, claim_id, token, operation, evidence=None):
        with self.transaction() as s:
            c = self.owned(s, claim_id, token)
            require(operation in c["operations"])
            op = c["operations"][operation]
            require(op["status"] in ("prepared", "pending", "unknown"))
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
    def git(*args):
        try:
            return subprocess.run(["git", "-C", str(repo), *args], check=True,
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
                                           "bind", "resolve", "release", "reconcile_recovery"))
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
