import type { UndoableCommand } from "./contracts/UndoableCommand.js";

export class History {
  readonly #undo: UndoableCommand[] = [];
  readonly #redo: UndoableCommand[] = [];
  #blocked = false;

  public record(command: UndoableCommand): void {
    this.#undo.push(command);
    this.#redo.length = 0;
    this.#blocked = false;
  }

  public establishBarrier(): void {
    this.#undo.length = 0;
    this.#redo.length = 0;
    this.#blocked = true;
  }

  public nextUndo(): UndoableCommand {
    this.#checkBarrier();
    const command = this.#undo.at(-1);
    if (command === undefined) {
      throw new Error("nothing to undo");
    }
    return command;
  }

  public nextRedo(): UndoableCommand {
    this.#checkBarrier();
    const command = this.#redo.at(-1);
    if (command === undefined) {
      throw new Error("nothing to redo");
    }
    return command;
  }

  public completeUndo(): void {
    const command = this.#undo.pop();
    if (command !== undefined) {
      this.#redo.push(command);
    }
  }

  public completeRedo(): void {
    const command = this.#redo.pop();
    if (command !== undefined) {
      this.#undo.push(command);
    }
  }

  #checkBarrier(): void {
    if (this.#blocked) {
      throw new Error("undo not allowed after io command");
    }
  }
}
