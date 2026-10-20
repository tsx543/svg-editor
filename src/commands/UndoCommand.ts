import type { Command } from "../application/contracts/Command.js";
import type { CommandArguments } from "../application/CommandArguments.js";
import type { EditorSession } from "../application/EditorSession.js";

export class UndoCommand implements Command {
  public constructor(private readonly args: CommandArguments) {}

  public execute(session: EditorSession): readonly string[] {
    session.ensureDocument();
    this.args.expectCount(0, 0, "undo");
    return session.undo();
  }
}
