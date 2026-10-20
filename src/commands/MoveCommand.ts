import type { CommandArguments } from "../application/CommandArguments.js";
import { PositionalShapeInput } from "../model/PositionalShapeInput.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import { EditCommand } from "./EditCommand.js";

export class MoveCommand extends EditCommand {
  #undoMessage = "";

  public constructor(private readonly args: CommandArguments) {
    super();
  }

  protected apply(document: SvgDocument): readonly string[] {
    this.args.expectCount(3, 3, "move <id> <dx> <dy>");
    const shape = document.find(this.args.at(0));
    const input = new PositionalShapeInput(this.args.slice(1).values());
    const dx = input.number(0, "dx");
    const dy = input.number(1, "dy");
    const label = `${shape.kind}#${shape.id}`;
    const before = document.position(shape.id);
    document.move(shape.id, dx, dy);
    const after = document.position(shape.id);
    this.#undoMessage = before === null
      ? `${label} moved back by (${-dx},${-dy})`
      : `${label} moved back to ${before}`;
    return [after === null
      ? `${label} moved by (${dx},${dy})`
      : `${label} moved to ${after}`];
  }

  protected undoResult(): readonly string[] {
    return [this.#undoMessage];
  }
}
