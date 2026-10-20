import { NumericValue } from "./NumericValue.js";
import { PositionalShapeInput } from "./PositionalShapeInput.js";
import { Shape } from "./Shape.js";
import type { ShapeInput } from "./ShapeInput.js";
import type { ShapeTopology } from "./ShapeTopology.js";
import { Transform } from "./Transform.js";

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

  public override assertContainer(): void {
    // A group supports containment, including when it currently has no children.
  }

  public override rebuild(parentId: string | null, topology: ShapeTopology, parentWorld = new Transform()): Group {
    const copy = new Group(this.id, new PositionalShapeInput([]));
    this.copyStateTo(copy, parentId);
    this.copyTransformTo(copy, parentId, topology, parentWorld);
    const world = parentWorld.compose(copy.transform);
    copy.#children = topology.childrenOf(this).map((child) => child.rebuild(copy.id, topology, world));
    return copy;
  }

  public override validateWorldEdit(factor: number, dx: number, dy: number, parent: Transform, scaling: boolean): void {
    const world = parent.compose(this.transform);
    for (const child of this.#children) child.validateWorldEdit(factor, dx, dy, world, scaling);
  }

  protected override applyWorldEdit(factor: number, dx: number, dy: number, parent: Transform, scaling: boolean): void {
    const world = parent.compose(this.transform);
    for (const child of this.#children) Group.applyWorldEditTo(child, factor, dx, dy, world, scaling);
  }

  public override validateMove(dx: number, dy: number): void {
    NumericValue.finite(dx, "dx");
    NumericValue.finite(dy, "dy");
    for (const child of this.#children) child.validateMove(dx, dy);
  }

  public override validateScale(factor: number): void {
    NumericValue.positive(factor, "scale factor");
    for (const child of this.#children) child.validateScale(factor);
  }

  protected override applyMove(dx: number, dy: number): void {
    for (const child of this.#children) Group.applyMoveTo(child, dx, dy);
  }

  protected override applyScale(factor: number): void {
    for (const child of this.#children) Group.applyScaleTo(child, factor);
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
    const copy = new Group(this.id, new PositionalShapeInput([]));
    copy.#children = this.#children.map((child) => child.replaceNode(id, replacement));
    return this.copyStateTo(copy, this.parentId);
  }

  public override withoutNode(id: string): Shape | null {
    if (this.id === id) return null;
    const copy = new Group(this.id, new PositionalShapeInput([]));
    for (const child of this.#children) {
      const retained = child.withoutNode(id);
      if (retained !== null) copy.#children.push(retained);
    }
    return this.copyStateTo(copy, this.parentId);
  }
}
