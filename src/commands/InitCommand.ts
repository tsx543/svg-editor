import type { Command } from "../application/contracts/Command.js";
import type { CommandArguments } from "../application/CommandArguments.js";
import type { EditorSession } from "../application/EditorSession.js";
import { PositionalShapeInput } from "../model/PositionalShapeInput.js";

export class InitCommand implements Command {
  public constructor(private readonly args: CommandArguments) {}

  public execute(session: EditorSession): readonly string[] {
    this.args.expectCount(0, 2, "init [w] [h]");
    const input = new PositionalShapeInput(this.args.values());
    const width = this.args.length >= 1 ? input.number(0, "width") : 800;
    const height = this.args.length >= 2 ? input.number(1, "height") : 600;
    return session.init(width, height);
  }
}
