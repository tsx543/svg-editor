import { Geometry } from "./Geometry.js";
import type { GeometryAttribute } from "./GeometryAttribute.js";
import { NumericValue } from "./NumericValue.js";

export abstract class Shape {
  readonly #id: string;
  #parentId: string | null = null;
  #styles = new Map<string, string>();
  readonly #geometry: Geometry;

  protected constructor(id: string, attributes: readonly GeometryAttribute[] = []) {
    if (!id || /\s/.test(id)) {
      throw new Error(`invalid id: ${id}`);
    }
    this.#id = id;
    this.#geometry = new Geometry(attributes);
  }

  public get id(): string {
    return this.#id;
  }

  public abstract get kind(): string;

  public get parentId(): string | null {
    return this.#parentId;
  }

  public get children(): readonly Shape[] {
    return [];
  }

  public abstract move(dx: number, dy: number): void;

  public validateMove(dx: number, dy: number): void {
    this.clone().move(dx, dy);
  }

  public scale(factor: number): void {
    this.#geometry.scale(factor);
  }

  public validateScale(factor: number): void {
    this.clone().scale(factor);
  }

  public set(attribute: string, value: string): void {
    if (attribute === "fill" || attribute === "stroke") {
      this.#styles.set(attribute, value);
      return;
    }
    if (attribute === "stroke-width") {
      const width = NumericValue.nonNegative(NumericValue.parse(value, attribute), attribute);
      this.#styles.set(attribute, String(width));
      return;
    }
    if (this.#geometry.set(attribute, value) || this.setContent(attribute, value)) {
      return;
    }
    throw new Error(`unknown attribute: ${attribute}`);
  }

  public describe(): string {
    const parts = [`${this.kind}#${this.id}`, this.geometryDescription(), this.styleDescription()];
    return parts.filter((part) => part.length > 0).join(" ");
  }

  public detailLines(): readonly string[] {
    return [this.#geometry.describe(), ...this.contentDetails(), this.styleDescription()]
      .filter((part) => part.length > 0);
  }

  public abstract clone(parentId?: string | null): Shape;

  /** Returns a new tree; it never changes the receiver's children. */
  public withChild(_child: Shape): Shape {
    throw new Error(`not a container: ${this.id}`);
  }

  /** Rebuilds structure without exposing a mutable child collection. */
  public replaceNode(id: string, replacement: Shape): Shape {
    return this.id === id ? replacement.clone(this.parentId) : this.clone();
  }

  protected number(name: string): number {
    return this.#geometry.get(name);
  }

  protected coordinates(xs: readonly string[], ys: readonly string[], dx: number, dy: number): void {
    this.#geometry.translate(xs, ys, dx, dy);
  }

  protected geometryDescription(): string {
    return this.#geometry.describe(true);
  }

  protected setContent(_attribute: string, _value: string): boolean {
    return false;
  }

  protected contentDetails(): readonly string[] {
    return [];
  }

  protected copyStateTo<T extends Shape>(copy: T, parentId: string | null): T {
    copy.#parentId = parentId;
    copy.#styles = new Map(this.#styles);
    return copy;
  }

  private styleDescription(): string {
    return ["fill", "stroke", "stroke-width"]
      .filter((name) => this.#styles.has(name))
      .map((name) => `${name}=${this.#styles.get(name)}`)
      .join(" ");
  }
}
