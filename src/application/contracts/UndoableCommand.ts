import type { Command } from "./Command.js";
import type { EditorSession } from "../EditorSession.js";

export interface UndoableCommand extends Command {
  undo(session: EditorSession): readonly string[];
  redo(session: EditorSession): readonly string[];
}
