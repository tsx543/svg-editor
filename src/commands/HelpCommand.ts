import type { Command } from "../application/contracts/Command.js";
import type { CommandArguments } from "../application/CommandArguments.js";
import type { EditorSession } from "../application/EditorSession.js";

export class HelpCommand implements Command {
  public constructor(private readonly args: CommandArguments) {}

  public execute(_session: EditorSession): readonly string[] {
    this.args.expectCount(0, 0, "help");
    return [
      "阶段 C：基础图形、编辑与层级顺序；全部十种编辑命令支持 undo/redo。",
      "init [w] [h]",
      "read <file.svg>  （尚未实现，阶段 D）",
      "save [file.svg]  （尚未实现，阶段 D）",
      "canvas [w] [h]",
      "create <type> <id> [params...] [in <containerId>]",
      "  rect <id> <x> <y> <w> <h> [fill]",
      "  circle <id> <cx> <cy> <r> [fill]",
      "  ellipse <id> <cx> <cy> <rx> <ry> [fill]",
      "  line <id> <x1> <y1> <x2> <y2> [stroke]",
      '  text <id> <x> <y> "content"',
      "  g <id>",
      "delete <id>",
      "move <id> <dx> <dy>",
      "scale <id> <factor>",
      "set <id> <attr> <value>",
      "group <newGid> <id1> <id2>...",
      "ungroup <gid>",
      "addto <gid> <id>",
      "front <id>",
      "back <id>",
      "tree [id]",
      "show <id>",
      "help",
      "undo",
      "redo",
    ];
  }
}
