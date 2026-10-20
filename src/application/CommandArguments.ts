import type { CommandToken } from "./contracts/CommandToken.js";

export class CommandArguments {
  readonly #tokens: readonly CommandToken[];

  public constructor(tokens: readonly CommandToken[]) {
    this.#tokens = Object.freeze(
      tokens.map((token) => Object.freeze({ ...token })),
    );
  }

  public get length(): number {
    return this.#tokens.length;
  }

  public at(index: number): string {
    return this.token(index).value;
  }

  public token(index: number): CommandToken {
    const token = this.#tokens[index];
    if (token === undefined) {
      throw new Error("missing command argument");
    }
    return token;
  }

  public values(): readonly string[] {
    return Object.freeze(this.#tokens.map((token) => token.value));
  }

  public slice(start: number, end?: number): CommandArguments {
    return new CommandArguments(this.#tokens.slice(start, end));
  }

  public expectCount(min: number, max: number, syntax: string): void {
    if (this.length < min || this.length > max) {
      throw new Error(`usage: ${syntax}`);
    }
  }
}
