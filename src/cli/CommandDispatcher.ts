import type { CommandArguments } from "../application/CommandArguments.js";
import type { Command } from "../application/contracts/Command.js";
import type { CommandRequest } from "../application/contracts/CommandRequest.js";
import { CanvasCommand } from "../commands/CanvasCommand.js";
import { CreateCommand } from "../commands/CreateCommand.js";
import { HelpCommand } from "../commands/HelpCommand.js";
import { InitCommand } from "../commands/InitCommand.js";
import { RedoCommand } from "../commands/RedoCommand.js";
import { ShowCommand } from "../commands/ShowCommand.js";
import { TreeCommand } from "../commands/TreeCommand.js";
import { UndoCommand } from "../commands/UndoCommand.js";

type CommandConstructor = new (args: CommandArguments) => Command;

export class CommandDispatcher {
  // The assignment permits command-name dispatch here; future registration is
  // documented as a later refactor rather than duplicated in another module.
  private readonly commandTypes = new Map<string, CommandConstructor | null>([
    ["init", InitCommand],
    ["canvas", CanvasCommand],
    ["create", CreateCommand],
    ["tree", TreeCommand],
    ["show", ShowCommand],
    ["help", HelpCommand],
    ["undo", UndoCommand],
    ["redo", RedoCommand],
    ["read", null],
    ["save", null],
    ["delete", null],
    ["move", null],
    ["scale", null],
    ["set", null],
    ["group", null],
    ["ungroup", null],
    ["addto", null],
    ["front", null],
    ["back", null],
  ]);

  public dispatch(request: CommandRequest): Command {
    const CommandType = this.commandTypes.get(request.name);
    if (CommandType === undefined) {
      throw new Error(`unknown command: ${request.name}`);
    }
    if (CommandType === null) {
      throw new Error(`command 尚未实现（阶段 A）: ${request.name}`);
    }
    return new CommandType(request.arguments);
  }
}
