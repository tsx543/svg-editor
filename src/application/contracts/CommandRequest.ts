import type { CommandArguments } from "../CommandArguments.js";

export interface CommandRequest {
  readonly name: string;
  readonly arguments: CommandArguments;
}
