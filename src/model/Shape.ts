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

  public move(dx: number, dy: number): void {
    this.validateMove(dx, dy);
    this.applyMove(dx, dy);
  }

  public validateMove(dx: number, dy: number): void {
    const [xs, ys] = this.movementAxes();
    this.#geometry.validateTranslation(xs, ys, dx, dy);
  }

  public scale(factor: number): void {
    this.validateScale(factor);
    this.applyScale(factor);
  }

  public validateScale(factor: number): void {
    this.#geometry.validateScale(factor);
  }

  public position(): string | null {
    return null;
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

  /** Returns a separate tree, omitting the requested subtree if present. */
  public withoutNode(id: string): Shape | null {
    return this.id === id ? null : this.clone();
  }

  protected static applyMoveTo(shape: Shape, dx: number, dy: number): void {
    shape.applyMove(dx, dy);
  }

  protected static applyScaleTo(shape: Shape, factor: number): void {
    shape.applyScale(factor);
  }

  protected movementAxes(): readonly [readonly string[], readonly string[]] {
    return [[], []];
  }

  protected applyMove(dx: number, dy: number): void {
    const [xs, ys] = this.movementAxes();
    this.coordinates(xs, ys, dx, dy);
  }

  protected applyScale(factor: number): void {
    this.#geometry.scale(factor);
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
