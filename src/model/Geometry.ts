import type { GeometryAttribute } from "./GeometryAttribute.js";
import { NumericValue } from "./NumericValue.js";

export class Geometry {
  readonly #attributes: Map<string, GeometryAttribute>;

  public constructor(attributes: readonly GeometryAttribute[]) {
    this.#attributes = new Map();
    for (const attribute of attributes) {
      const value = attribute.nonNegative
        ? NumericValue.nonNegative(attribute.value, attribute.name)
        : NumericValue.finite(attribute.value, attribute.name);
      this.#attributes.set(attribute.name, { ...attribute, value });
    }
  }

  public get(name: string): number {
    const attribute = this.#attributes.get(name);
    if (!attribute) {
      throw new Error(`unknown attribute: ${name}`);
    }
    return attribute.value;
  }

  public set(name: string, value: string): boolean {
    const attribute = this.#attributes.get(name);
    if (!attribute) {
      return false;
    }
    const parsed = NumericValue.parse(value, name);
    const validated = attribute.nonNegative
      ? NumericValue.nonNegative(parsed, name)
      : parsed;
    this.#attributes.set(name, { ...attribute, value: validated });
    return true;
  }

  public translate(xs: readonly string[], ys: readonly string[], dx: number, dy: number): void {
    this.apply(this.translatedValues(xs, ys, dx, dy));
  }

  public validateTranslation(xs: readonly string[], ys: readonly string[], dx: number, dy: number): void {
    this.translatedValues(xs, ys, dx, dy);
  }

  public scale(factor: number): void {
    this.apply(this.scaledValues(factor));
  }

  public validateScale(factor: number): void {
    this.scaledValues(factor);
  }

  public describe(aliases = false): string {
    return [...this.#attributes.values()]
      .map((attribute) => `${aliases ? attribute.label ?? attribute.name : attribute.name}=${attribute.value}`)
      .join(" ");
  }

  private translatedValues(xs: readonly string[], ys: readonly string[], dx: number, dy: number): ReadonlyMap<string, number> {
    NumericValue.finite(dx, "dx");
    NumericValue.finite(dy, "dy");
    const values = new Map<string, number>();
    for (const name of xs) {
      values.set(name, NumericValue.finite(this.get(name) + dx, name));
    }
    for (const name of ys) {
      values.set(name, NumericValue.finite(this.get(name) + dy, name));
    }
    return values;
  }

  private scaledValues(factor: number): ReadonlyMap<string, number> {
    NumericValue.positive(factor, "scale factor");
    const values = new Map<string, number>();
    for (const [name, attribute] of this.#attributes) {
      values.set(name, NumericValue.finite(attribute.value * factor, name));
    }
    return values;
  }

  private apply(values: ReadonlyMap<string, number>): void {
    for (const [name, value] of values) {
      const attribute = this.#attributes.get(name);
      if (attribute) {
        this.#attributes.set(name, { ...attribute, value });
      }
    }
  }
}
