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
    const group = document.find(id);
    const parent = group.parentId === null ? null : document.find(group.parentId);
    const parentLabel = parent === null ? "svg" : `${parent.kind}#${parent.id}`;
    const siblings = parent === null ? document.children : parent.children;
    const position = siblings.findIndex((sibling) => sibling.id === id) + 1;
    this.#label = `${group.kind}#${id}`;
    return [`${this.#label} created with ${ids.length} children in ${parentLabel} (sibling ${position} of ${siblings.length})`];
  }

  protected undoResult(): readonly string[] {
    return [`${this.#label} grouping undone`];
  }
}
