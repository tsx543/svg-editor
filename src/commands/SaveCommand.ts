import type { CommandArguments } from "../application/CommandArguments.js";
import type { EditorSession } from "../application/EditorSession.js";
import type { Command } from "../application/contracts/Command.js";

export class SaveCommand implements Command {
  public constructor(private readonly args: CommandArguments) {}

  public execute(session: EditorSession): readonly string[] {
    session.ensureDocument();
    this.args.expectCount(0, 1, "save [file.svg]");
    return session.save(this.args.length === 0 ? undefined : this.args.at(0));
  }
}
