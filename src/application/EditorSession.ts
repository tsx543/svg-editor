import { SvgDocument } from "../model/SvgDocument.js";
import type { UndoableCommand } from "./contracts/UndoableCommand.js";
import { DocumentPresenter } from "./DocumentPresenter.js";
import { History } from "./History.js";
import type { DocumentGateway } from "./contracts/DocumentGateway.js";

export class EditorSession {
  #document: SvgDocument | null = null;
  readonly #history = new History();
  readonly #presenter = new DocumentPresenter();
  #readPath: string | null = null;

  public constructor(private readonly gateway?: DocumentGateway) {}

  public init(width: number, height: number): readonly string[] {
    const document = new SvgDocument(width, height);
    this.#history.establishBarrier();
    this.#document = document;
    this.#readPath = null;
    return [`canvas ${width}x${height} created`];
  }

  public read(path: string): readonly string[] {
    const loaded = this.#gateway().read(path);
    const document = loaded.document.clone();
    const result = [...loaded.warnings, `read ${path} (${document.elementCount} elements)`];
    this.#history.establishBarrier();
    this.#document = document;
    this.#readPath = path;
    return result;
  }

  public save(path?: string): readonly string[] {
    const document = this.#current();
    const destination = path ?? this.#readPath;
    if (destination === null) {
      throw new Error("no default save path. specify a file or use 'read' first");
    }
    this.#gateway().save(destination, document.clone());
    this.#history.establishBarrier();
    return [`saved to ${destination} (${document.elementCount} elements)`];
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

  #gateway(): DocumentGateway {
    if (this.gateway === undefined) throw new Error("document gateway is not configured");
    return this.gateway;
  }
}
