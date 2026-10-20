import { CommandArguments } from "../application/CommandArguments.js";
import type { CommandRequest } from "../application/contracts/CommandRequest.js";
import type { CommandToken } from "../application/contracts/CommandToken.js";

export class CommandLineParser {
  public parse(line: string): CommandRequest | null {
    if (line.trimStart().startsWith("#")) {
      return null;
    }

    const tokens: CommandToken[] = [];
    let index = 0;

    while (index < line.length) {
      if (/\s/u.test(line[index])) {
        index += 1;
        continue;
      }

      const quoted = line[index] === '"';
      let value = "";

      if (quoted) {
        index += 1;
        let closed = false;

        while (index < line.length) {
          const character = line[index];
          if (character === '"') {
            index += 1;
            closed = true;
            break;
          }

          if (
            character === "\\" &&
            (line[index + 1] === '"' || line[index + 1] === "\\")
          ) {
            value += line[index + 1];
            index += 2;
            continue;
          }

          value += character;
          index += 1;
        }

        if (!closed) {
          throw new Error("unterminated double quote");
        }
        if (index < line.length && !/\s/u.test(line[index])) {
          throw new Error("expected whitespace after closing quote");
        }
      } else {
        while (index < line.length && !/\s/u.test(line[index])) {
          if (line[index] === '"') {
            throw new Error("double quote must start a parameter");
          }
          value += line[index];
          index += 1;
        }
      }

      tokens.push({ value, quoted });
    }

    if (tokens.length === 0) {
      return null;
    }

    return {
      name: tokens[0].value,
      arguments: new CommandArguments(tokens.slice(1)),
    };
  }
}
