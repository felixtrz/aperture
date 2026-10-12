import { randomUUID } from "node:crypto";
import { rename, rm } from "node:fs/promises";
import { isNodeErrorCode } from "./files.js";

/** Publish a complete sibling directory and restore the old snapshot on failure. */
export async function publishReferenceDirectory(
  staged: string,
  destination: string,
  afterPublish: () => Promise<void>,
): Promise<void> {
  const backup = `${destination}.previous-${randomUUID()}`;
  let hadPrevious = false;
  let published = false;
  try {
    await rename(destination, backup);
    hadPrevious = true;
  } catch (error) {
    if (!isNodeErrorCode(error, "ENOENT")) throw error;
  }
  try {
    await rename(staged, destination);
    published = true;
    await afterPublish();
  } catch (error) {
    try {
      if (published) await rm(destination, { recursive: true, force: true });
      if (hadPrevious) await rename(backup, destination);
    } catch (restoreError) {
      throw new AggregateError(
        [error, restoreError],
        `Reference publication failed; the previous snapshot is retained at ${backup}.`,
        { cause: restoreError },
      );
    }
    throw error;
  }
  if (hadPrevious) await rm(backup, { recursive: true, force: true });
}
