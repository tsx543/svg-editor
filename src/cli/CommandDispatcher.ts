import type { CommandArguments } from "../application/CommandArguments.js";
import type { Command } from "../application/contracts/Command.js";
import type { CommandRequest } from "../application/contracts/CommandRequest.js";
import { AddToCommand } from "../commands/AddToCommand.js";
import { BackCommand } from "../commands/BackCommand.js";
import { CanvasCommand } from "../commands/CanvasCommand.js";
import { CreateCommand } from "../commands/CreateCommand.js";
import { DeleteCommand } from "../commands/DeleteCommand.js";
import { FrontCommand } from "../commands/FrontCommand.js";
import { GroupCommand } from "../commands/GroupCommand.js";
import { HelpCommand } from "../commands/HelpCommand.js";
import { InitCommand } from "../commands/InitCommand.js";
import { MoveCommand } from "../commands/MoveCommand.js";
import { ReadCommand } from "../commands/ReadCommand.js";
import { RedoCommand } from "../commands/RedoCommand.js";
import { ScaleCommand } from "../commands/ScaleCommand.js";
import { SaveCommand } from "../commands/SaveCommand.js";
import { SetCommand } from "../commands/SetCommand.js";
import { ShowCommand } from "../commands/ShowCommand.js";
import { TreeCommand } from "../commands/TreeCommand.js";
import { UndoCommand } from "../commands/UndoCommand.js";
import { UngroupCommand } from "../commands/UngroupCommand.js";

type CommandConstructor = new (args: CommandArguments) => Command;

export class CommandDispatcher {
  // The assignment permits command-name dispatch here; future registration is
  // documented as a later refactor rather than duplicated in another module.
  private readonly commandTypes = new Map<string, CommandConstructor>([
    ["init", InitCommand],
    ["canvas", CanvasCommand],
    ["create", CreateCommand],
    ["tree", TreeCommand],
    ["show", ShowCommand],
    ["help", HelpCommand],
    ["undo", UndoCommand],
    ["redo", RedoCommand],
    ["read", ReadCommand],
    ["save", SaveCommand],
    ["delete", DeleteCommand],
    ["move", MoveCommand],
    ["scale", ScaleCommand],
    ["set", SetCommand],
    ["group", GroupCommand],
    ["ungroup", UngroupCommand],
    ["addto", AddToCommand],
    ["front", FrontCommand],
    ["back", BackCommand],
  ]);

  public dispatch(request: CommandRequest): Command {
    const CommandType = this.commandTypes.get(request.name);
    if (CommandType === undefined) {
      throw new Error(`unknown command: ${request.name}`);
    }
    return new CommandType(request.arguments);
  }
}
