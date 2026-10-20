import { Geometry } from "./Geometry.js";
import type { GeometryAttribute } from "./GeometryAttribute.js";
import { NumericValue } from "./NumericValue.js";
import type { ShapeTopology } from "./ShapeTopology.js";
import { Transform } from "./Transform.js";
import { SvgPresentation } from "./SvgPresentation.js";

export abstract class Shape {
  readonly #id: string;
  #parentId: string | null = null;
  #styles = new Map<string, string>();
  #geometry: Geometry;
  #transform: Transform | null = null;
  #extensions = new Map<string, string>();

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

  public get transform(): Transform { return this.#transform ?? new Transform(); }

  public svgAttributes(): ReadonlyMap<string, string> {
    const attributes = new Map([["id", this.id], ...this.#geometry.attributes(), ...this.#styles, ...this.#extensions]);
    if (this.#transform !== null) attributes.set("transform", this.#transform.toSvg());
    return attributes;
  }

  public svgText(): string | null { return null; }

  public importSvgAttributes(attributes: ReadonlyMap<string, string>, text?: string): void {
    const candidate = this.clone();
    candidate.readSvgAttributes(attributes, text);
    this.#geometry = candidate.#geometry;
    this.#styles = new Map(candidate.#styles);
    this.#extensions = new Map(candidate.#extensions);
    this.#transform = candidate.#transform;
    this.importText(candidate.svgText() ?? undefined);
  }

  public projectedPosition(world: Transform): string | null {
    const [xs, ys] = this.movementAxes();
    if (xs.length === 0) return null;
    return xs.map((x, index) => {
      const [px, py] = world.point(this.number(x), this.number(ys[index]!));
      return `(${px},${py})`;
    }).join(" -> ");
  }

  public moveInWorld(dx: number, dy: number, parent: Transform): void {
    NumericValue.finite(dx, "dx");
    NumericValue.finite(dy, "dy");
    this.validateWorldEdit(1, dx, dy, parent, false);
    this.applyWorldEdit(1, dx, dy, parent, false);
  }

  public scaleInWorld(factor: number, parent: Transform): void {
    NumericValue.positive(factor, "scale factor");
    this.validateWorldEdit(factor, 0, 0, parent, true);
    this.applyWorldEdit(factor, 0, 0, parent, true);
  }

  public validateProjection(world: Transform): void {
    const [xs, ys] = this.movementAxes();
    this.#geometry.validateAffine(world.factor, xs, ys, world.tx, world.ty);
  }

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

  public assertContainer(): void {
    throw new Error(`not a container: ${this.id}`);
  }

  public assertUngroupable(): void {
    this.assertContainer();
  }

  /** Topology supplies structure only; every resulting mutable node is newly copied. */
  public rebuild(parentId: string | null, topology: ShapeTopology, parentWorld = new Transform()): Shape {
    if (topology.childrenOf(this).length > 0) this.assertContainer();
    const copy = this.clone(parentId);
    return this.copyTransformTo(copy, parentId, topology, parentWorld);
  }

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

  public validateWorldEdit(factor: number, dx: number, dy: number, parent: Transform, scaling: boolean): void {
    const world = parent.compose(this.transform);
    const [xs, ys] = this.movementAxes();
    const offsetX = scaling ? (factor - 1) * world.tx / world.factor : dx / world.factor;
    const offsetY = scaling ? (factor - 1) * world.ty / world.factor : dy / world.factor;
    this.#geometry.validateAffine(factor, xs, ys, offsetX, offsetY);
    this.#geometry.validateAffine(world.factor * factor, xs, ys,
      scaling ? world.tx * factor : world.tx + dx,
      scaling ? world.ty * factor : world.ty + dy);
  }

  protected applyWorldEdit(factor: number, dx: number, dy: number, parent: Transform, scaling: boolean): void {
    const world = parent.compose(this.transform);
    const [xs, ys] = this.movementAxes();
    const offsetX = scaling ? (factor - 1) * world.tx / world.factor : dx / world.factor;
    const offsetY = scaling ? (factor - 1) * world.ty / world.factor : dy / world.factor;
    this.#geometry.affine(factor, xs, ys, offsetX, offsetY);
  }

  protected static applyWorldEditTo(shape: Shape, factor: number, dx: number, dy: number, parent: Transform, scaling: boolean): void {
    shape.applyWorldEdit(factor, dx, dy, parent, scaling);
  }

  protected copyTransformTo<T extends Shape>(copy: T, parentId: string | null, topology: ShapeTopology, parentWorld: Transform): T {
    const transform = topology.transformFor?.(this, parentId, parentWorld);
    if (transform) copy.#transform = transform.isIdentity && this.#transform === null ? null : transform;
    return copy;
  }

  protected importText(text?: string): void {
    if (text !== undefined && !/^[\x20\t\r\n]*$/.test(text)) throw new Error(`unexpected text in <${this.kind}>`);
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
    copy.#extensions = new Map(this.#extensions);
    copy.#transform = this.#transform;
    return copy;
  }

  private readSvgAttributes(attributes: ReadonlyMap<string, string>, text?: string): void {
    for (const [name, value] of attributes) {
      if (name === "id") {
        if (value !== this.id) throw new Error(`id mismatch: ${value}`);
      } else if (this.#geometry.has(name)) {
        this.#geometry.set(name, String(NumericValue.parseSvg(value, name)));
      } else if (name === "transform") {
        this.#transform = Transform.parse(value);
      } else {
        const normalized = SvgPresentation.normalize(name, value);
        if (normalized === undefined) throw new Error(`unsupported SVG attribute: ${name}`);
        if (name === "font-size" || name === "text-anchor") this.#extensions.set(name, normalized);
        else this.#styles.set(name, normalized);
      }
    }
    this.importText(text);
  }

  private styleDescription(): string {
    const styles = ["fill", "stroke", "stroke-width"]
      .filter((name) => this.#styles.has(name))
      .map((name) => `${name}=${this.#styles.get(name)}`);
    const extensions = ["font-size", "text-anchor"]
      .filter((name) => this.#extensions.has(name))
      .map((name) => `${name}=${this.#extensions.get(name)}`);
    if (this.#transform !== null) extensions.push(`transform="${this.#transform.toSvg()}"`);
    return [...styles, ...extensions].join(" ");
  }
}
