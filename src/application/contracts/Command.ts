import type { EditorSession } from "../EditorSession.js";

export interface Command {
  execute(session: EditorSession): readonly string[];
}
