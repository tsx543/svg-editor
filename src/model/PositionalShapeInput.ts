import { NumericValue } from "./NumericValue.js";
import type { ShapeInput } from "./ShapeInput.js";

export class PositionalShapeInput implements ShapeInput {
  readonly #args: readonly string[];

  public constructor(args: readonly string[]) {
    this.#args = [...args];
  }

  public assertArity(min: number, max: number): void {
    if (this.#args.length < min || this.#args.length > max) {
      const count = min === max ? `${min}` : `${min}-${max}`;
      throw new Error(`expected ${count} shape parameters, got ${this.#args.length}`);
    }
  }

  public number(index: number, name: string): number {
    return NumericValue.parse(this.text(index, name), name);
  }

  public text(index: number, name: string): string {
    const value = this.#args[index];
    if (value === undefined) {
      throw new Error(`missing parameter: ${name}`);
    }
    return value;
  }

  public optionalText(index: number, _name: string): string | undefined {
    return this.#args[index];
  }
}
