import type { CommandArguments } from "../application/CommandArguments.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import { EditCommand } from "./EditCommand.js";

export class UngroupCommand extends EditCommand {
  #label = "";

  public constructor(private readonly args: CommandArguments) {
    super();
  }

  protected apply(document: SvgDocument): readonly string[] {
    this.args.expectCount(1, 1, "ungroup <gid>");
    const shape = document.find(this.args.at(0));
    const count = shape.children.length;
    this.#label = `${shape.kind}#${shape.id}`;
    document.ungroup(shape.id);
    return [`${this.#label} ungrouped (${count} children)`];
  }

  protected undoResult(): readonly string[] {
    return [`${this.#label} restored`];
  }
}
