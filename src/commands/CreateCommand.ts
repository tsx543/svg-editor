import type { CommandArguments } from "../application/CommandArguments.js";
import { PositionalShapeInput } from "../model/PositionalShapeInput.js";
import { ShapeFactory } from "../model/ShapeFactory.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import { EditCommand } from "./EditCommand.js";

export class CreateCommand extends EditCommand {
  readonly #arguments: CommandArguments;
  #label = "";

  public constructor(args: CommandArguments) {
    super();
    this.#arguments = args;
  }

  protected apply(document: SvgDocument): readonly string[] {
    this.#arguments.expectCount(2, Number.POSITIVE_INFINITY, "create <type> <id> [params...] [in <containerId>]");
    let params = this.#arguments.slice(2);
    let parentId: string | undefined;
    if (params.length >= 2) {
      const keyword = params.token(params.length - 2);
      if (!keyword.quoted && keyword.value === "in") {
        parentId = params.at(params.length - 1);
        params = params.slice(0, -2);
      }
    }
    const shape = new ShapeFactory().create(
      this.#arguments.at(0),
      this.#arguments.at(1),
      new PositionalShapeInput(params.values()),
    );
    document.create(shape, parentId);
    this.#label = `${shape.kind}#${shape.id}`;
    const suffix = parentId === undefined
      ? ""
      : ` in ${document.find(parentId).kind}#${parentId}`;
    return [`${this.#label} created${suffix}`];
  }

  protected undoResult(): readonly string[] {
    return [`${this.#label} creation undone`];
  }
}
