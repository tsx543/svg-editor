import type { Command } from "../application/contracts/Command.js";
import type { CommandArguments } from "../application/CommandArguments.js";
import type { EditorSession } from "../application/EditorSession.js";

export class ShowCommand implements Command {
  public constructor(private readonly args: CommandArguments) {}

  public execute(session: EditorSession): readonly string[] {
    session.ensureDocument();
    this.args.expectCount(1, 1, "show <id>");
    return session.show(this.args.at(0));
  }
}
