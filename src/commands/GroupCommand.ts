import type { CommandArguments } from "../application/CommandArguments.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import { EditCommand } from "./EditCommand.js";

export class GroupCommand extends EditCommand {
  #label = "";

  public constructor(private readonly args: CommandArguments) {
    super();
  }

  protected apply(document: SvgDocument): readonly string[] {
    this.args.expectCount(3, Number.POSITIVE_INFINITY, "group <newGid> <id1> <id2>...");
    const id = this.args.at(0);
    const ids = this.args.slice(1).values();
    document.group(id, ids);
    this.#label = `${document.find(id).kind}#${id}`;
    return [`${this.#label} created with ${ids.length} children`];
  }

  protected undoResult(): readonly string[] {
    return [`${this.#label} grouping undone`];
  }
}
