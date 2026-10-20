import { NumericValue } from "./NumericValue.js";
import { PositionalShapeInput } from "./PositionalShapeInput.js";
import { Shape } from "./Shape.js";
import type { ShapeInput } from "./ShapeInput.js";

export class Group extends Shape {
  #children: Shape[] = [];

  public constructor(id: string, input: ShapeInput) {
    input.assertArity(0, 0);
    super(id);
  }

  public override get kind(): string { return "g"; }

  public override get children(): readonly Shape[] {
    return [...this.#children];
  }

  public override move(dx: number, dy: number): void {
    this.validateMove(dx, dy);
    for (const child of this.#children) child.move(dx, dy);
  }

  public override validateMove(dx: number, dy: number): void {
    NumericValue.finite(dx, "dx");
    NumericValue.finite(dy, "dy");
    for (const child of this.#children) child.validateMove(dx, dy);
  }

  public override scale(factor: number): void {
    this.validateScale(factor);
    for (const child of this.#children) child.scale(factor);
  }

  public override validateScale(factor: number): void {
    NumericValue.positive(factor, "scale factor");
    for (const child of this.#children) child.validateScale(factor);
  }

  public override clone(parentId: string | null = this.parentId): Group {
    const copy = new Group(this.id, new PositionalShapeInput([]));
    copy.#children = this.#children.map((child) => child.clone(copy.id));
    return this.copyStateTo(copy, parentId);
  }

  public override withChild(child: Shape): Group {
    const copy = this.clone();
    copy.#children.push(child.clone(copy.id));
    return copy;
  }

  public override replaceNode(id: string, replacement: Shape): Shape {
    if (this.id === id) return replacement.clone(this.parentId);
    const copy = this.clone();
    copy.#children = this.#children.map((child) => child.replaceNode(id, replacement));
    return copy;
  }
}
