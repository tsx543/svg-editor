import { NumericValue } from "../model/NumericValue.js";
import type { ShapeInput } from "../model/ShapeInput.js";

export class SvgShapeInput implements ShapeInput {
  readonly #attributes: ReadonlyMap<string, string>;
  readonly #content: string;

  public constructor(attributes: ReadonlyMap<string, string>, content: string) {
    this.#attributes = new Map(attributes);
    this.#content = content;
  }

  public assertArity(_min: number, _max: number): void {
    // XML uses named attributes. Each concrete shape validates those names.
  }

  public number(_index: number, name: string): number {
    return NumericValue.parseSvg(this.#attributes.get(name) ?? "0", name);
  }

  public text(_index: number, name: string): string {
    if (name === "content") return this.#content;
    const value = this.#attributes.get(name);
    if (value === undefined) throw new Error(`missing attribute: ${name}`);
    return value;
  }

  public optionalText(_index: number, name: string): string | undefined {
    return this.#attributes.get(name);
  }
}
