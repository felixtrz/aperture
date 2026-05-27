#!/usr/bin/env node

import { runApertureCli } from "../cli.js";

const exitCode = await runApertureCli({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  stdout: (text) => {
    process.stdout.write(text);
  },
  stderr: (text) => {
    process.stderr.write(text);
  },
});

process.exitCode = exitCode;
