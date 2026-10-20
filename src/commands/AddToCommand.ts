import type { CommandArguments } from "../application/CommandArguments.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import { EditCommand } from "./EditCommand.js";

export class AddToCommand extends EditCommand {
  #undoMessage = "";

  public constructor(private readonly args: CommandArguments) {
    super();
  }

  protected apply(document: SvgDocument): readonly string[] {
    this.args.expectCount(2, 2, "addto <gid> <id>");
    const target = document.find(this.args.at(0));
    const shape = document.find(this.args.at(1));
    const label = `${shape.kind}#${shape.id}`;
    const parent = shape.parentId === null ? null : document.find(shape.parentId);
    const parentLabel = parent === null ? "svg" : `${parent.kind}#${parent.id}`;
    document.addTo(target.id, shape.id);
    this.#undoMessage = `${label} restored into ${parentLabel}`;
    return [`${label} moved into ${target.kind}#${target.id}`];
  }

  protected undoResult(): readonly string[] {
    return [this.#undoMessage];
  }
}
