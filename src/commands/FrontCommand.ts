import type { CommandArguments } from "../application/CommandArguments.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import { EditCommand } from "./EditCommand.js";

export class FrontCommand extends EditCommand {
  #label = "";

  public constructor(private readonly args: CommandArguments) {
    super();
  }

  protected apply(document: SvgDocument): readonly string[] {
    this.args.expectCount(1, 1, "front <id>");
    const shape = document.find(this.args.at(0));
    this.#label = `${shape.kind}#${shape.id}`;
    document.front(shape.id);
    return [`${this.#label} moved to front`];
  }

  protected undoResult(): readonly string[] {
    return [`${this.#label} order restored`];
  }
}
