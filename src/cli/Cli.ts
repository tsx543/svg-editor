import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { EditorSession } from "../application/EditorSession.js";
import type { CommandDispatcher } from "./CommandDispatcher.js";
import type { CommandLineParser } from "./CommandLineParser.js";

export class Cli {
  public constructor(
    private readonly session: EditorSession,
    private readonly parser: CommandLineParser,
    private readonly dispatcher: CommandDispatcher,
    private readonly input: Readable = process.stdin,
    private readonly output: Writable = process.stdout,
  ) {}

  public executeLine(line: string): readonly string[] {
    try {
      const request = this.parser.parse(line);
      if (request === null) {
        return [];
      }
      return this.dispatcher.dispatch(request).execute(this.session);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return [`error: ${message.replace(/[\r\n\u2028\u2029]+/gu, " ")}`];
    }
  }

  public async run(): Promise<void> {
    const interactive =
      (this.input as Readable & { readonly isTTY?: boolean }).isTTY === true &&
      (this.output as Writable & { readonly isTTY?: boolean }).isTTY === true;
    const reader = createInterface({
      input: this.input,
      output: this.output,
      terminal: interactive,
      crlfDelay: Infinity,
    });

    this.output.write("svg-editor 0.1 — type 'help' for commands\n");
    reader.setPrompt("svg> ");

    try {
      if (interactive) {
        reader.prompt();
      }
      for await (const line of reader) {
        for (const result of this.executeLine(line)) {
          this.output.write(`${result}\n`);
        }
        if (interactive) {
          reader.prompt();
        }
      }
    } finally {
      reader.close();
    }
  }
}
