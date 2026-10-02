#!/usr/bin/env python3
"""Seal and verify byte-complete, reviewed benchmark evidence using only stdlib."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import sys

SCHEMA = 1
MAX_FILE_BYTES = 16 * 1024 * 1024
MAX_TOTAL_BYTES = 64 * 1024 * 1024
MAX_MANIFEST_BYTES = 2 * 1024 * 1024
MAX_FILES = 512
CATEGORIES = {
    "sources", "references", "settings", "pins", "renders", "diagnostics",
    "editchecks", "judgments", "transcripts", "provenance",
}
TEXT = {".json", ".txt", ".md", ".yaml", ".yml", ".toml"}
IMAGES = {".png", ".jpg", ".jpeg", ".webp"}
EXTENSIONS = {
    "sources": TEXT | IMAGES | {".ts", ".tsx", ".js", ".mjs", ".cjs", ".wgsl",
                                ".html", ".css", ".glb", ".gltf", ".obj", ".mtl",
                                ".bin", ".ktx2", ".wasm", ".lock", ".svg"},
    "references": TEXT | IMAGES | {".glb", ".gltf", ".obj", ".mtl", ".bin", ".svg"},
    "settings": TEXT,
    "pins": TEXT | {".lock"},
    "renders": IMAGES,
    "diagnostics": TEXT,
    "editchecks": TEXT | IMAGES,
    "judgments": TEXT,
    "transcripts": {".json", ".jsonl", ".txt", ".md"},
    "provenance": TEXT,
}
KINDS = {
    "sources": {"source-file"},
    "references": {"reference-file"},
    "renders": {"render-output"},
    "diagnostics": {"tool-output"},
    "editchecks": {"tool-output"},
    "judgments": {"blind-judge-output", "judge-output"},
    "transcripts": {"visible-transcript-export"},
    "settings": {"source-file", "authored-record", "tool-output"},
    "pins": {"source-file", "authored-record", "tool-output"},
    "provenance": {"source-file", "authored-record", "tool-output"},
}
ID = re.compile(r"[a-z0-9][a-z0-9-]{0,79}\Z")
HEX = re.compile(r"[0-9a-f]{64}\Z")
UTC = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\Z")
RESERVED = {"con", "prn", "aux", "nul"} | {
    f"{prefix}{i}" for prefix in ("com", "lpt") for i in range(1, 10)
}
PROTECTED = {"credentials", "secrets", "sessions", "private-reasoning", "chain-of-thought",
             "id_rsa", "id_ed25519", "authorized_keys", "known_hosts"}


class EvidenceError(ValueError):
    """A fail-closed evidence validation error."""


def require(condition, message):
    if not condition:
        raise EvidenceError(message)


def keys(value, expected, label):
    require(isinstance(value, dict), f"{label}: expected an object")
    require(set(value) == set(expected), f"{label}: expected fields {sorted(expected)}")


def string(value, label):
    require(isinstance(value, str) and value.strip() and len(value) <= 2048,
            f"{label}: expected nonempty text (at most 2048 characters)")


def timestamp(value, label):
    from datetime import datetime
    require(isinstance(value, str) and UTC.fullmatch(value), f"{label}: expected UTC YYYY-MM-DDTHH:MM:SSZ")
    try:
        datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError as error:
        raise EvidenceError(f"{label}: invalid date") from error


def identifier(value, label):
    require(isinstance(value, str) and ID.fullmatch(value), f"{label}: expected lowercase ASCII ID")


def safe_path(value):
    require(isinstance(value, str) and 0 < len(value) <= 240, "artifact path: invalid length")
    parts = value.split("/")
    require(len(parts) >= 2 and parts[0] in CATEGORIES, f"path is not in an allowlisted category: {value!r}")
    for part in parts:
        require(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,99}", part) and not part.endswith("."),
                f"unsafe/nonportable path: {value!r}")
        require(part.lower().split(".")[0] not in RESERVED and part.lower() not in PROTECTED,
                f"protected/reserved path: {value!r}")
    require(Path(value).suffix.lower() in EXTENSIONS[parts[0]], f"file type is not allowlisted: {value!r}")
    return parts[0]


def no_symlink_ancestors(path):
    """Do not silently resolve a symlink supplied anywhere in an input path."""
    path = Path(os.path.abspath(path))
    for item in reversed((path, *path.parents)):
        try:
            mode = item.lstat().st_mode
        except FileNotFoundError:
            continue
        require(not stat.S_ISLNK(mode), f"symlink is not allowed: {item}")
    return path


def read_bytes(path, limit=None):
    limit = MAX_FILE_BYTES if limit is None else limit
    path = no_symlink_ancestors(path)
    before = path.lstat()
    require(stat.S_ISREG(before.st_mode), f"not a regular file: {path}")
    require(before.st_nlink == 1, f"hardlinked file is not allowed: {path}")
    require(before.st_size <= limit, f"oversized artifact: {path} is {before.st_size} bytes; limit {limit}; nothing omitted")
    # O_NOFOLLOW also rejects a last-component symlink swapped after lstat.
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    with os.fdopen(fd, "rb") as stream:
        opened = os.fstat(stream.fileno())
        require(opened.st_nlink == 1, f"hardlinked file is not allowed: {path}")
        require((opened.st_dev, opened.st_ino) == (before.st_dev, before.st_ino), f"file changed while reading: {path}")
        data = stream.read(limit + 1)
        after = os.fstat(stream.fileno())
        require(after.st_nlink == 1, f"hardlinked file is not allowed: {path}")
    require(len(data) <= limit, f"oversized artifact: {path}; limit {limit}; nothing omitted")
    require((before.st_size, before.st_mtime_ns, before.st_ctime_ns) ==
            (after.st_size, after.st_mtime_ns, after.st_ctime_ns) and len(data) == before.st_size,
            f"file changed while reading: {path}")
    return data


def pairs_no_duplicates(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f"duplicate JSON key: {key}")
        result[key] = value
    return result


def parse_json(data):
    try:
        return json.loads(data, object_pairs_hook=pairs_no_duplicates,
                          parse_constant=lambda value: (_ for _ in ()).throw(EvidenceError(f"invalid JSON constant: {value}")))
    except (UnicodeError, json.JSONDecodeError) as error:
        raise EvidenceError(f"invalid UTF-8 JSON: {error}") from error


def canonical(value):
    return (json.dumps(value, indent=2, sort_keys=True, ensure_ascii=True, allow_nan=False) + "\n").encode("utf-8")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def inventory(root, metadata=False):
    root = no_symlink_ancestors(root)
    require(root.is_dir(), f"not a directory: {root}")
    found = set()
    collisions = set()
    for directory, dirs, files in os.walk(root, followlinks=False):
        for name in dirs + files:
            path = Path(directory) / name
            relative = path.relative_to(root).as_posix()
            mode = path.lstat().st_mode
            require(not stat.S_ISLNK(mode), f"symlink is not allowed: {relative}")
            require(stat.S_ISREG(mode) or stat.S_ISDIR(mode), f"special file is not allowed: {relative}")
            require(relative.casefold() not in collisions, f"case-colliding path: {relative}")
            collisions.add(relative.casefold())
            if stat.S_ISREG(mode):
                require(path.lstat().st_nlink == 1, f"hardlinked file is not allowed: {relative}")
                if metadata and relative in {"manifest.json", "manifest.sha256"}:
                    continue
                safe_path(relative)
                found.add(relative)
            else:
                # Empty and unknown directories must not conceal an unreviewed tree.
                require(relative.split("/")[0] in CATEGORIES, f"unlisted directory: {relative}")
                require(any(path.iterdir()), f"empty directory is not evidence: {relative}")
    require(len(found) <= MAX_FILES, f"too many artifacts: {len(found)}; limit {MAX_FILES}")
    return found


def validate_spec(spec):
    keys(spec, {"schema_version", "run_id", "mode", "created_at", "source_revision", "review",
                "transcripts", "attempts", "attempt_inventory_complete", "artifacts", "gaps"}, "run specification")
    require(type(spec["schema_version"]) is int and spec["schema_version"] == SCHEMA, "unsupported schema_version")
    identifier(spec["run_id"], "run_id")
    require(spec["mode"] in ("exploratory", "scored"), "mode must be exploratory or scored")
    timestamp(spec["created_at"], "created_at")
    revision = spec["source_revision"]
    require(revision is None or isinstance(revision, str) and re.fullmatch(r"[0-9a-f]{40}", revision),
            "source_revision must be a full Git commit SHA or null")
    review = spec["review"]
    attestations = {"no_secrets_or_private_content", "only_authentic_evidence", "all_known_attempts_and_available_artifacts_listed"}
    keys(review, {"reviewer", "reviewed_at"} | attestations, "review")
    string(review["reviewer"], "review.reviewer")
    timestamp(review["reviewed_at"], "review.reviewed_at")
    for name in attestations:
        require(review[name] is True, f"mandatory human/agent content review not attested: {name}")
    transcripts = spec["transcripts"]
    keys(transcripts, {"status", "note"}, "transcripts")
    require(transcripts["status"] in ("available", "unavailable", "not-applicable"), "invalid transcripts.status")
    string(transcripts["note"], "transcripts.note")
    require(isinstance(spec["attempts"], list) and len(spec["attempts"]) <= MAX_FILES, "attempts must be a bounded list")
    require(type(spec["attempt_inventory_complete"]) is bool, "attempt_inventory_complete must be boolean")
    attempts = {}
    for attempt in spec["attempts"]:
        keys(attempt, {"id", "outcome", "note"}, "attempt")
        identifier(attempt["id"], "attempt.id")
        require(attempt["id"] not in attempts, f"duplicate attempt: {attempt['id']}")
        require(attempt["id"] != "run", "attempt ID 'run' is reserved")
        require(attempt["outcome"] in ("rendered", "failed-before-render", "incomplete"), "invalid attempt outcome")
        string(attempt["note"], "attempt.note")
        attempts[attempt["id"]] = attempt
    require(isinstance(spec["artifacts"], list) and 0 < len(spec["artifacts"]) <= MAX_FILES,
            f"artifacts must contain 1 to {MAX_FILES} entries")
    paths, folded, by_category = set(), set(), {name: [] for name in CATEGORIES}
    for artifact in spec["artifacts"]:
        keys(artifact, {"path", "attempts", "origin"}, "artifact")
        path = artifact["path"]
        category = safe_path(path)
        require(path.casefold() not in folded, f"duplicate/colliding artifact path: {path}")
        # A file cannot also be a directory prefix, even with different casing.
        for existing in folded:
            require(not path.casefold().startswith(existing + "/") and not existing.startswith(path.casefold() + "/"),
                    f"file/directory path collision: {path}")
        paths.add(path)
        folded.add(path.casefold())
        associated = artifact["attempts"]
        require(isinstance(associated, list) and all(isinstance(item, str) for item in associated), "artifact.attempts must be IDs")
        require(len(set(associated)) == len(associated) and set(associated) <= set(attempts), f"unknown/duplicate attempt in {path}")
        origin = artifact["origin"]
        keys(origin, {"kind", "description", "recorded_at"}, f"origin of {path}")
        require(isinstance(origin["kind"], str) and origin["kind"] in KINDS[category], f"origin kind is not allowed for {category}: {origin['kind']}")
        string(origin["description"], "origin.description")
        timestamp(origin["recorded_at"], "origin.recorded_at")
        by_category[category].append(artifact)
    have_transcripts = bool(by_category["transcripts"])
    require(have_transcripts == (transcripts["status"] == "available"),
            "available transcripts require authentic export bytes; otherwise declare unavailable/not-applicable")
    gaps = spec["gaps"]
    require(isinstance(gaps, list) and len(gaps) <= MAX_FILES, "gaps must be a bounded list")
    gap_keys = set()
    for gap in gaps:
        keys(gap, {"scope", "category", "reason"}, "gap")
        require(isinstance(gap["scope"], str) and (gap["scope"] == "run" or gap["scope"] in attempts), "unknown gap scope")
        require(isinstance(gap["category"], str) and gap["category"] in CATEGORIES | {"attempts", "source_revision"}, "unknown gap category")
        string(gap["reason"], "gap.reason")
        key = (gap["scope"], gap["category"])
        require(key not in gap_keys, f"duplicate gap: {key}")
        gap_keys.add(key)
    missing = set()
    if not attempts or not spec["attempt_inventory_complete"]:
        missing.add(("run", "attempts"))
    if revision is None:
        missing.add(("run", "source_revision"))
    for category in ("sources", "references", "settings", "pins", "provenance"):
        if not by_category[category]:
            missing.add(("run", category))
    for attempt_id, attempt in attempts.items():
        required = {"sources", "settings", "diagnostics", "editchecks"}
        if attempt["outcome"] != "failed-before-render":
            required |= {"renders", "judgments"}
        else:
            require(not any(attempt_id in item["attempts"] for item in by_category["renders"]),
                    f"failed-before-render attempt has render bytes: {attempt_id}")
        for category in required:
            if not any(attempt_id in item["attempts"] for item in by_category[category]):
                missing.add((attempt_id, category))
    require(missing <= gap_keys, f"missing evidence needs explicit gaps: {sorted(missing - gap_keys)}")
    if spec["mode"] == "scored":
        require(not gaps, "scored gate: gaps are not allowed; preserve this run as exploratory")
        require(any(a["outcome"] == "rendered" for a in attempts.values()), "scored gate: no rendered attempts")
        require(all(a["outcome"] != "incomplete" for a in attempts.values()), "scored gate: incomplete attempt")
        require(all(a["origin"]["kind"] == "blind-judge-output" for a in by_category["judgments"]),
                "scored gate: every judgment must be an authentic blind-judge output")
    return paths


def validate_payload(spec, path, data):
    require(spec["mode"] != "scored" or len(data) > 0,
            f"scored gate: empty evidence artifact: {path}")
    validate_image(path, data)


def validate_image(path, data):
    """Check basic render container integrity, not pixels, fidelity or authenticity."""
    if not path.startswith("renders/"):
        return
    import struct
    import zlib
    suffix = Path(path).suffix.lower()
    if suffix == ".png":
        require(data.startswith(b"\x89PNG\r\n\x1a\n"), f"invalid PNG render: {path}")
        offset, chunks = 8, []
        while offset < len(data):
            require(offset + 12 <= len(data), f"truncated PNG render: {path}")
            size = struct.unpack(">I", data[offset:offset + 4])[0]
            end = offset + 12 + size
            require(end <= len(data), f"truncated PNG chunk: {path}")
            kind = data[offset + 4:offset + 8]
            content = data[offset + 8:end - 4]
            checksum = struct.unpack(">I", data[end - 4:end])[0]
            require(zlib.crc32(kind + content) == checksum, f"PNG checksum mismatch: {path}")
            if not chunks:
                require(kind == b"IHDR" and size == 13, f"missing PNG header: {path}")
                width, height = struct.unpack(">II", content[:8])
                require(width > 0 and height > 0, f"empty PNG dimensions: {path}")
            chunks.append(kind)
            offset = end
            if kind == b"IEND":
                require(size == 0 and offset == len(data), f"invalid PNG ending: {path}")
                break
        require(chunks and chunks[-1] == b"IEND" and b"IDAT" in chunks, f"incomplete PNG render: {path}")
    elif suffix in {".jpg", ".jpeg"}:
        require(data.startswith(b"\xff\xd8\xff") and data.endswith(b"\xff\xd9"), f"invalid JPEG render: {path}")
    elif suffix == ".webp":
        require(len(data) >= 20 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
                and int.from_bytes(data[4:8], "little") + 8 == len(data), f"invalid WebP render: {path}")


def seal(spec_path, source, archive_root):
    spec = parse_json(read_bytes(spec_path, MAX_MANIFEST_BYTES))
    paths = validate_spec(spec)
    source = no_symlink_ancestors(source)
    archive_root = no_symlink_ancestors(archive_root)
    require(not archive_root.is_relative_to(source), "archive root must not be inside the evidence source")
    require(inventory(source) == paths, "source inventory differs from declared artifacts (missing or unlisted files)")
    # Complete preflight before creating any run directory, including size checks.
    files, payloads, total = [], {}, 0
    for relative in sorted(paths):
        data = read_bytes(source / relative)
        validate_payload(spec, relative, data)
        total += len(data)
        require(total <= MAX_TOTAL_BYTES, f"oversized run: more than {MAX_TOTAL_BYTES} bytes; nothing omitted")
        payloads[relative] = data
        files.append({"path": relative, "bytes": len(data), "sha256": digest(data)})
    manifest = canonical({"schema_version": SCHEMA, "spec": spec, "files": files, "total_bytes": total})
    require(len(manifest) <= MAX_MANIFEST_BYTES, "manifest exceeds size limit")
    archive_root.mkdir(parents=True, exist_ok=True)
    target = archive_root / spec["run_id"]
    try:
        target.mkdir()  # Exclusive allocation: this utility never replaces an existing run.
    except FileExistsError as error:
        raise EvidenceError(f"immutable run already exists: {target}; use a new run ID") from error
    try:
        for relative, data in payloads.items():
            output = target / relative
            output.parent.mkdir(parents=True, exist_ok=True)
            with output.open("xb") as stream:
                stream.write(data)
        (target / "manifest.json").write_bytes(manifest)
        # Written last; interruption leaves an unsealed directory, never a valid partial run.
        (target / "manifest.sha256").write_text(digest(manifest) + "\n", encoding="ascii")
        verify(target, expected_sha256=digest(manifest))
    except BaseException:
        shutil.rmtree(target)
        raise
    return target, digest(manifest)


def verify(run, require_scored=False, expected_sha256=None):
    run = no_symlink_ancestors(run)
    manifest_bytes = read_bytes(run / "manifest.json", MAX_MANIFEST_BYTES)
    checksum_bytes = read_bytes(run / "manifest.sha256", 65)
    try:
        checksum = checksum_bytes.decode("ascii").strip()
    except UnicodeError as error:
        raise EvidenceError("invalid manifest checksum encoding") from error
    require(HEX.fullmatch(checksum), "invalid manifest checksum")
    require(digest(manifest_bytes) == checksum, "manifest modified: checksum mismatch")
    if expected_sha256 is not None:
        require(isinstance(expected_sha256, str) and HEX.fullmatch(expected_sha256), "expected manifest hash must be SHA-256")
        require(checksum == expected_sha256, "manifest differs from externally anchored hash")
    manifest = parse_json(manifest_bytes)
    keys(manifest, {"schema_version", "spec", "files", "total_bytes"}, "manifest")
    require(type(manifest["schema_version"]) is int and manifest["schema_version"] == SCHEMA, "unsupported manifest schema")
    paths = validate_spec(manifest["spec"])
    require(run.name == manifest["spec"]["run_id"], "archive directory does not match run_id")
    require(not require_scored or manifest["spec"]["mode"] == "scored", "scored gate: exploratory run")
    require(inventory(run, metadata=True) == paths, "archive inventory differs from declared artifacts (missing or unlisted files)")
    require(isinstance(manifest["files"], list) and len(manifest["files"]) == len(paths), "invalid manifest file inventory")
    seen, total = set(), 0
    for entry in manifest["files"]:
        keys(entry, {"path", "bytes", "sha256"}, "manifest file")
        path = entry["path"]
        require(isinstance(path, str) and path in paths and path not in seen, "missing/duplicate/unknown manifest file")
        seen.add(path)
        require(type(entry["bytes"]) is int and 0 <= entry["bytes"] <= MAX_FILE_BYTES, f"invalid file size: {path}")
        require(isinstance(entry["sha256"], str) and HEX.fullmatch(entry["sha256"]), f"invalid hash: {path}")
        data = read_bytes(run / path)
        validate_payload(manifest["spec"], path, data)
        require(len(data) == entry["bytes"] and digest(data) == entry["sha256"], f"artifact modified: {path}")
        total += len(data)
    require(seen == paths, "manifest does not hash every artifact")
    require(type(manifest["total_bytes"]) is int and total == manifest["total_bytes"] and total <= MAX_TOTAL_BYTES,
            "invalid/oversized manifest total_bytes")
    return manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    make = commands.add_parser("seal", help="copy reviewed files into a new immutable run")
    make.add_argument("--spec", required=True, type=Path)
    make.add_argument("--source", required=True, type=Path)
    make.add_argument("--archive-root", type=Path, default=Path("benchmarks/evidence/runs"))
    check = commands.add_parser("verify", help="verify every archived byte and the completeness gate")
    check.add_argument("run", type=Path)
    check.add_argument("--require-scored", action="store_true")
    check.add_argument("--manifest-sha256", help="trusted hash from an independently verified Git commit")
    args = parser.parse_args(argv)
    try:
        if args.command == "seal":
            path, checksum = seal(args.spec, args.source, args.archive_root)
            print(f"sealed {path}\nmanifest_sha256 {checksum}")
        else:
            manifest = verify(args.run, args.require_scored, args.manifest_sha256)
            spec = manifest["spec"]
            print(f"verified {spec['run_id']}: {spec['mode']}; {len(manifest['files'])} files; {manifest['total_bytes']} bytes")
    except (EvidenceError, OSError) as error:
        print(f"evidence error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
