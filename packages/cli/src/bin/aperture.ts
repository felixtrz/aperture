#!/usr/bin/env node

import { runApertureCli } from "../cli.js";

let pendingWrites = Promise.resolve();
const enqueueWrite = (
  stream: NodeJS.WriteStream,
  text: string,
): void => {
  pendingWrites = pendingWrites.then(
    () =>
      new Promise<void>((resolve, reject) => {
        stream.write(text, (error) => {
          if (error !== null && error !== undefined) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  );
};

const exitCode = await runApertureCli({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  stdout: (text) => {
    enqueueWrite(process.stdout, text);
  },
  stderr: (text) => {
    enqueueWrite(process.stderr, text);
  },
});

await pendingWrites;
process.exit(exitCode);
