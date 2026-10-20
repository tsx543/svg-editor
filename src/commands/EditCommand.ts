import type { SvgDocument } from "../model/SvgDocument.js";
import type { EditorSession } from "../application/EditorSession.js";
import type { UndoableCommand } from "../application/contracts/UndoableCommand.js";

export abstract class EditCommand implements UndoableCommand {
  #before: SvgDocument | null = null;
  #after: SvgDocument | null = null;
  #result: readonly string[] = [];

  public execute(session: EditorSession): readonly string[] {
    const before = session.snapshot();
    const working = before.clone();
    const result = this.apply(working);
    const after = working.clone();
    this.#before = before;
    this.#after = after;
    this.#result = Object.freeze([...result]);
    session.commitEdit(working, this);
    return this.#result;
  }

  public undo(session: EditorSession): readonly string[] {
    if (this.#before === null) {
      throw new Error("command has not been executed");
    }
    const document = this.#before.clone();
    const result = this.undoResult();
    session.restoreDocument(document);
    return result;
  }

  public redo(session: EditorSession): readonly string[] {
    if (this.#after === null) {
      throw new Error("command has not been executed");
    }
    session.restoreDocument(this.#after.clone());
    return this.#result;
  }

  protected abstract apply(document: SvgDocument): readonly string[];
  protected abstract undoResult(): readonly string[];
}
