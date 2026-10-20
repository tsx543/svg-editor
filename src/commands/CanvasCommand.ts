import type { Command } from "../application/contracts/Command.js";
import type { CommandArguments } from "../application/CommandArguments.js";
import type { EditorSession } from "../application/EditorSession.js";
import { PositionalShapeInput } from "../model/PositionalShapeInput.js";

export class CanvasCommand implements Command {
  public constructor(private readonly args: CommandArguments) {}

  public execute(session: EditorSession): readonly string[] {
    session.ensureDocument();
    if (this.args.length === 0) {
      return session.canvas();
    }
    this.args.expectCount(2, 2, "canvas [w h]");
    const input = new PositionalShapeInput(this.args.values());
    return session.resize(input.number(0, "width"), input.number(1, "height"));
  }
}
