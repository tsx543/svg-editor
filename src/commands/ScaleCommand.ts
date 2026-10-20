import type { CommandArguments } from "../application/CommandArguments.js";
import { PositionalShapeInput } from "../model/PositionalShapeInput.js";
import type { SvgDocument } from "../model/SvgDocument.js";
import { EditCommand } from "./EditCommand.js";

export class ScaleCommand extends EditCommand {
  #label = "";

  public constructor(private readonly args: CommandArguments) {
    super();
  }

  protected apply(document: SvgDocument): readonly string[] {
    this.args.expectCount(2, 2, "scale <id> <factor>");
    const shape = document.find(this.args.at(0));
    const factor = new PositionalShapeInput(this.args.slice(1).values()).number(0, "scale factor");
    shape.scale(factor);
    this.#label = `${shape.kind}#${shape.id}`;
    return [`${this.#label} scaled by ${factor}`];
  }

  protected undoResult(): readonly string[] {
    return [`${this.#label} scale undone`];
  }
}
