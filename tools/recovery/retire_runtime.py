#!/usr/bin/env python3
"""Bounded retirement of old, registered, exactly pinned Chromium cache bytes.

Preserves every other entry, including unknown directories. Uses the existing
exclusive lifecycle lock, 24-hour inactivity rule, immutable preview and audit.
"""
import argparse
import json
import os
from pathlib import Path
import time

import cleanup as c
import runtime_pressure as r

RECEIPT = '.chromium-retirement.json'


def source_pin(runtime):
    package = (Path(runtime) / 'node_modules/@sparticuz/chromium').resolve(strict=True)
    c.require(json.loads((package / 'package.json').read_text())['version'] == '153.0.0', 'unapproved runtime package')
    c.require(r.file_hash(package / 'bin/chromium.br')[1] == r.SOURCE_SHA256, 'runtime provenance mismatch')


def inspect(store, run, now):
    fd = c.open_run(store, run)
    try:
        with c.registry_lock(fd):
            m, mst, _ = c.read_json(fd, c.MANIFEST)
            c.validate_manifest(m, run)
            c.require(m['state'] == 'completed', 'not completed')
            c.require(RECEIPT not in os.listdir(fd), 'retirement already started')
            item = m['files'].get('chromium')
            c.require(item and item['kind'] == 'download-cache', 'runtime is not registered')
            _, st, digest = c.read_file(fd, 'chromium')
            observed = dict(device=st.st_dev, inode=st.st_ino, size=st.st_size,
                            mtime_ns=st.st_mtime_ns, ctime_ns=st.st_ctime_ns, sha256=digest)
            c.require(all(item[k] == v for k, v in observed.items()), 'registered bytes or inode changed')
            c.require((st.st_size, digest) == (r.RUNTIME_SIZE, r.RUNTIME_SHA256), 'runtime pin mismatch')
            c.require(st.st_dev == os.fstat(fd).st_dev, 'runtime crosses filesystem')
            dst = os.fstat(fd)
            latest = max(m['completed_ns'], mst.st_mtime_ns, mst.st_ctime_ns,
                         dst.st_mtime_ns, dst.st_ctime_ns, st.st_mtime_ns, st.st_ctime_ns)
            c.require(latest <= now and now - latest >= c.MIN_AGE_NS, 'not inactive for 24 hours')
            store.verify()
            return dict(run=run, directory=list(c.identity(dst)), manifest=m,
                        manifest_fingerprint=list(c.fingerprint(mst)),
                        runtime_fingerprint=list(c.fingerprint(st)))
    finally:
        os.close(fd)


def preview(cfg, runtime, limit):
    c.require(type(limit) is int and 1 <= limit <= 64, 'limit must be 1..64')
    source_pin(runtime)
    with c.Store(cfg) as store, store.locked(exclusive=True), c.Audit(cfg) as audit:
        selected, preserved = [], []
        now = time.time_ns()
        for run in sorted(os.listdir(store.fd)):
            if not c.RUN_RE.fullmatch(run):
                continue
            try:
                selected.append(inspect(store, run, now))
            except (c.Unsafe, OSError) as exc:
                preserved.append(dict(run=run, reason=str(exc)))
            if len(selected) == limit:
                break
        plan = dict(schema='aperture.pinned-runtime-retirement.v1', root=cfg.root,
                    created_ns=now, runtime=str(Path(runtime).absolute()), runs=selected,
                    bytes=len(selected)*r.RUNTIME_SIZE, preserved=preserved)
        audit.emit('runtime-retirement-preview', plan=plan)
        return plan


def apply(cfg, plan):
    c.require(plan.get('schema') == 'aperture.pinned-runtime-retirement.v1' and plan['root'] == cfg.root, 'invalid preview')
    c.require(0 <= time.time_ns()-plan['created_ns'] <= 3600*10**9, 'preview expired')
    rows = plan['runs']
    c.require(0 < len(rows) <= 64 and len({row['run'] for row in rows}) == len(rows), 'invalid bounded run set')
    c.require(plan['bytes'] == len(rows)*r.RUNTIME_SIZE, 'byte bound mismatch')
    source_pin(plan['runtime'])
    with c.Store(cfg) as store, store.locked(exclusive=True), c.Audit(cfg) as audit:
        # Revalidate the entire reviewed set before the first mutation.
        for row in rows:
            c.require(inspect(store, row['run'], time.time_ns()) == row, 'preview changed')
        audit.emit('runtime-retirement-begin', plan=plan)
        for row in rows:
            c.require(inspect(store, row['run'], time.time_ns()) == row, 'runtime changed during apply')
            fd = c.open_run(store, row['run'])
            try:
                with c.registry_lock(fd):
                    c.require(list(c.identity(os.fstat(fd))) == row['directory'], 'run replaced')
                    m, mst, _ = c.read_json(fd, c.MANIFEST)
                    c.require(m == row['manifest'] and list(c.fingerprint(mst)) == row['manifest_fingerprint'], 'manifest changed')
                    st = os.stat('chromium', dir_fd=fd, follow_symlinks=False)
                    c.require(list(c.fingerprint(st)) == row['runtime_fingerprint'], 'runtime replaced')
                    receipt = dict(state='intent', retired_ns=time.time_ns(), artifact=m['files']['chromium'],
                                   source_sha256=r.SOURCE_SHA256, runtime=plan['runtime'])
                    c.create_file(fd, RECEIPT, c.json_bytes(receipt))
                    store.verify()
                    c.require(list(c.identity(os.stat(row['run'], dir_fd=store.fd, follow_symlinks=False))) == row['directory'], 'run replaced')
                    c.require(list(c.fingerprint(os.stat('chromium', dir_fd=fd, follow_symlinks=False))) == row['runtime_fingerprint'], 'runtime replaced before unlink')
                    # Only this fixed, registered basename is ever removed.
                    os.unlink('chromium', dir_fd=fd)
                    os.fsync(fd)
                    m['retired_files'] = {**m.get('retired_files', {}), 'chromium': m['files'].pop('chromium')}
                    c.replace_json(fd, c.MANIFEST, m)
                    c.replace_json(fd, RECEIPT, {**receipt, 'state':'retired'})
                    audit.emit('runtime-retired', run=row['run'], bytes=r.RUNTIME_SIZE, receipt=receipt)
            finally:
                os.close(fd)
        return dict(retired=len(rows), bytes=plan['bytes'])


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', required=True)
    p.add_argument('--audit-dir', required=True)
    sub = p.add_subparsers(dest='action', required=True)
    s = sub.add_parser('preview'); s.add_argument('--runtime', required=True); s.add_argument('--limit', type=int, default=32); s.add_argument('--out', required=True)
    s = sub.add_parser('apply'); s.add_argument('--plan', required=True)
    a = p.parse_args(); cfg = c.Config(a.root, a.audit_dir)
    if a.action == 'preview':
        result = preview(cfg, a.runtime, a.limit)
        with open(a.out, 'x') as f:
            json.dump(result, f, indent=2)
        print(json.dumps(dict(runs=len(result['runs']), bytes=result['bytes'], plan=a.out)))
    else:
        print(json.dumps(apply(cfg, json.loads(Path(a.plan).read_text()))))


if __name__ == '__main__':
    main()
