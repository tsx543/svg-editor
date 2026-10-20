import type { CommandArguments } from "../application/CommandArguments.js";
import type { EditorSession } from "../application/EditorSession.js";
import type { Command } from "../application/contracts/Command.js";

export class ReadCommand implements Command {
  public constructor(private readonly args: CommandArguments) {}

  public execute(session: EditorSession): readonly string[] {
    this.args.expectCount(1, 1, "read <file.svg>");
    return session.read(this.args.at(0));
  }
}
