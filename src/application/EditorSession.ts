import { SvgDocument } from "../model/SvgDocument.js";
import type { UndoableCommand } from "./contracts/UndoableCommand.js";
import { DocumentPresenter } from "./DocumentPresenter.js";
import { History } from "./History.js";

export class EditorSession {
  #document: SvgDocument | null = null;
  readonly #history = new History();
  readonly #presenter = new DocumentPresenter();

  public init(width: number, height: number): readonly string[] {
    const document = new SvgDocument(width, height);
    this.#history.establishBarrier();
    this.#document = document;
    return [`canvas ${width}x${height} created`];
  }

  public ensureDocument(): void {
    this.#current();
  }

  public snapshot(): SvgDocument {
    return this.#current().clone();
  }

  public commitEdit(document: SvgDocument, command: UndoableCommand): void {
    this.#history.record(command);
    this.#document = document;
  }

  public restoreDocument(document: SvgDocument): void {
    this.#document = document;
  }

  public canvas(): readonly string[] {
    const document = this.#current();
    return [`canvas ${document.width}x${document.height}`];
  }

  public resize(width: number, height: number): readonly string[] {
    const document = this.snapshot();
    document.resize(width, height);
    this.#history.establishBarrier();
    this.#document = document;
    return [`canvas resized to ${width}x${height}`];
  }

  public tree(id?: string): readonly string[] {
    return this.#presenter.tree(this.#current(), id);
  }

  public show(id: string): readonly string[] {
    return this.#presenter.show(this.#current(), id);
  }

  public undo(): readonly string[] {
    this.ensureDocument();
    const command = this.#history.nextUndo();
    const result = command.undo(this);
    this.#history.completeUndo();
    return result;
  }

  public redo(): readonly string[] {
    this.ensureDocument();
    const command = this.#history.nextRedo();
    const result = command.redo(this);
    this.#history.completeRedo();
    return result;
  }

  #current(): SvgDocument {
    if (this.#document === null) {
      throw new Error("no document. use 'init' or 'read' first");
    }
    return this.#document;
  }
}
