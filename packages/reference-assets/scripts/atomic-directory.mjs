import { randomUUID } from "node:crypto";
import { rename, rm } from "node:fs/promises";

/** Publish only a completed sibling directory, retaining old bytes on failure. */
export async function publishDirectory(staged, destination) {
  const backup = `${destination}.previous-${randomUUID()}`;
  let hadPrevious = false;
  try {
    await rename(destination, backup);
    hadPrevious = true;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  try {
    await rename(staged, destination);
  } catch (error) {
    if (hadPrevious) await rename(backup, destination);
    throw error;
  }
  if (hadPrevious) await rm(backup, { recursive: true, force: true });
}
