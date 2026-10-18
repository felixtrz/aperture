import contextlib
import fcntl
import json
import os
import time
from unittest import mock
import unittest

import cleanup as c
import retire_runtime as r
from test_runtime_pressure import RuntimeTests


class RetirementTests(RuntimeTests):
    def prepare(self):
        (self.path / 'chromium').write_bytes(b'fixture')
        (self.path / 'unknown').mkdir()
        (self.path / 'unknown' / 'evidence').write_text('preserve')
        with self.pins():
            r.r.register_runtime(self.cfg, self.run, str(self.path), str(self.runtime))
        with c.Store(self.cfg) as store, store.locked():
            c.complete_run(store, self.run, 0)

    @contextlib.contextmanager
    def old(self):
        # Synthetic fixture clock only; production always requires a full 24h.
        with self.pins(), mock.patch.object(r.time, 'time_ns', return_value=time.time_ns()+c.MIN_AGE_NS+10**9):
            yield

    def test_bounded_retirement_preserves_all_unknown_bytes(self):
        self.prepare()
        with self.old():
            plan = r.preview(self.cfg, self.runtime, 1)
            self.assertTrue((self.path/'chromium').exists())
            self.assertEqual(r.apply(self.cfg, plan), dict(retired=1, bytes=7))
        self.assertFalse((self.path/'chromium').exists())
        self.assertEqual((self.path/'unknown/evidence').read_text(), 'preserve')
        manifest = json.loads((self.path/c.MANIFEST).read_text())
        self.assertEqual(manifest['files'], {})
        self.assertIn('chromium', manifest['retired_files'])
        self.assertEqual(json.loads((self.path/r.RECEIPT).read_text())['state'], 'retired')

    def test_recent_preserved(self):
        self.prepare()
        with self.pins():
            self.assertEqual(r.preview(self.cfg, self.runtime, 1)['runs'], [])
        self.assertTrue((self.path/'chromium').exists())

    def test_active_preserved(self):
        (self.path/'chromium').write_bytes(b'fixture')
        with self.old():
            r.r.register_runtime(self.cfg,self.run,str(self.path),str(self.runtime))
            self.assertEqual(r.preview(self.cfg,self.runtime,1)['runs'], [])

    def test_changed_preview_fails_without_deletion(self):
        self.prepare()
        with self.old():
            plan = r.preview(self.cfg, self.runtime, 1)
            (self.path/'chromium').write_bytes(b'changed')
            with self.assertRaises(c.Unsafe): r.apply(self.cfg, plan)
        self.assertTrue((self.path/'chromium').exists())

    def test_live_lifecycle_lock_refuses_retirement(self):
        self.prepare()
        with self.old(), c.Store(self.cfg) as store, store.locked():
            with self.assertRaises(c.Busy): r.preview(self.cfg,self.runtime,1)

    def test_symlink_preserved(self):
        self.prepare(); (self.path/'chromium').unlink(); (self.path/'chromium').symlink_to(self.source)
        with self.old(): self.assertEqual(r.preview(self.cfg,self.runtime,1)['runs'], [])
        self.assertTrue(self.source.exists())

    def test_hardlink_preserved(self):
        self.prepare(); os.link(self.path/'chromium',self.base/'linked')
        with self.old(): self.assertEqual(r.preview(self.cfg,self.runtime,1)['runs'], [])

    def test_interrupted_intent_preserved(self):
        self.prepare(); (self.path/r.RECEIPT).write_text('{"state":"intent"}')
        with self.old(): self.assertEqual(r.preview(self.cfg,self.runtime,1)['runs'], [])

    def test_wrong_provenance_fails(self):
        self.prepare()
        with self.old(), mock.patch.object(r.r,'SOURCE_SHA256','0'*64), self.assertRaises(c.Unsafe):
            r.preview(self.cfg,self.runtime,1)

    def test_expired_preview_refused(self):
        self.prepare()
        with self.old():
            plan=r.preview(self.cfg,self.runtime,1); plan['created_ns']-=3601*10**9
            with self.assertRaises(c.Unsafe): r.apply(self.cfg,plan)
        self.assertTrue((self.path/'chromium').exists())


if __name__=='__main__': unittest.main()
