import { PositionalShapeInput } from "./PositionalShapeInput.js";
import { Shape } from "./Shape.js";
import type { ShapeInput } from "./ShapeInput.js";

export class Rect extends Shape {
  public constructor(id: string, input: ShapeInput) {
    input.assertArity(4, 5);
    super(id, [
      { name: "x", value: input.number(0, "x") },
      { name: "y", value: input.number(1, "y") },
      { name: "width", value: input.number(2, "width"), nonNegative: true, label: "w" },
      { name: "height", value: input.number(3, "height"), nonNegative: true, label: "h" },
    ]);
    const fill = input.optionalText(4, "fill");
    if (fill !== undefined) this.set("fill", fill);
  }

  public override get kind(): string { return "rect"; }

  public override position(): string {
    return `(${this.number("x")},${this.number("y")})`;
  }

  protected override movementAxes(): readonly [readonly string[], readonly string[]] {
    return [["x"], ["y"]];
  }

  public override clone(parentId: string | null = this.parentId): Rect {
    const input = new PositionalShapeInput([
      String(this.number("x")), String(this.number("y")),
      String(this.number("width")), String(this.number("height")),
    ]);
    return this.copyStateTo(new Rect(this.id, input), parentId);
  }
}
