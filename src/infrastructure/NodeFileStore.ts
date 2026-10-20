import { constants, accessSync, closeSync, fchmodSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import type { Stats } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";
import type { FileStore } from "../application/contracts/FileStore.js";

export class NodeFileStore implements FileStore {
  public read(path: string): string {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(path));
    } catch {
      throw new Error(`cannot read file: ${path}`);
    }
  }

  public writeAtomic(path: string, content: string): void {
    let temporary: string | undefined;
    let descriptor: number | undefined;
    try {
      const destination = this.destination(path);
      const candidate = join(dirname(destination.path), `.${basename(destination.path)}.${randomUUID()}.tmp`);
      descriptor = openSync(candidate, "wx", destination.mode ?? 0o666);
      temporary = candidate;
      if (destination.mode !== undefined) fchmodSync(descriptor, destination.mode);
      writeFileSync(descriptor, content, "utf8");
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = undefined;
      renameSync(temporary, destination.path);
      temporary = undefined;
    } catch {
      throw new Error(`cannot write file: ${path}`);
    } finally {
      if (descriptor !== undefined) {
        try { closeSync(descriptor); } catch { /* Preserve the original write error. */ }
      }
      if (temporary !== undefined) {
        try { unlinkSync(temporary); } catch { /* A failed creation may leave no file. */ }
      }
    }
  }

  private destination(path: string): { readonly path: string; readonly mode?: number } {
    let existing: Stats | undefined;
    try {
      existing = lstatSync(path);
    } catch (error: unknown) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    }
    if (existing === undefined) return { path };
    const destination = existing.isSymbolicLink() ? realpathSync(path) : path;
    const target = statSync(destination);
    if (!target.isFile()) throw new Error("destination is not a regular file");
    accessSync(destination, constants.W_OK);
    return { path: destination, mode: target.mode & 0o777 };
  }
}
