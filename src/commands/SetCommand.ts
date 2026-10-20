import type { CommandArguments } from "../application/CommandArguments.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import { EditCommand } from "./EditCommand.js";

export class SetCommand extends EditCommand {
  #undoMessage = "";

  public constructor(private readonly args: CommandArguments) {
    super();
  }

  protected apply(document: SvgDocument): readonly string[] {
    this.args.expectCount(3, 3, "set <id> <attr> <value>");
    const shape = document.find(this.args.at(0));
    const attribute = this.args.at(1);
    const value = this.args.at(2);
    shape.set(attribute, value);
    const label = `${shape.kind}#${shape.id}`;
    this.#undoMessage = `${label} update undone: ${attribute}`;
    return [`${label} updated: ${attribute}=${JSON.stringify(value)}`];
  }

  protected undoResult(): readonly string[] {
    return [this.#undoMessage];
  }
}
