import { PositionalShapeInput } from "./PositionalShapeInput.js";
import { Shape } from "./Shape.js";
import type { ShapeInput } from "./ShapeInput.js";

export class Line extends Shape {
  public constructor(id: string, input: ShapeInput) {
    input.assertArity(4, 5);
    super(id, [
      { name: "x1", value: input.number(0, "x1") },
      { name: "y1", value: input.number(1, "y1") },
      { name: "x2", value: input.number(2, "x2") },
      { name: "y2", value: input.number(3, "y2") },
    ]);
    const stroke = input.optionalText(4, "stroke");
    if (stroke !== undefined) this.set("stroke", stroke);
  }

  public override get kind(): string { return "line"; }

  public override position(): string {
    return `(${this.number("x1")},${this.number("y1")}) -> (${this.number("x2")},${this.number("y2")})`;
  }

  protected override movementAxes(): readonly [readonly string[], readonly string[]] {
    return [["x1", "x2"], ["y1", "y2"]];
  }

  protected override geometryDescription(): string {
    return this.position();
  }

  public override clone(parentId: string | null = this.parentId): Line {
    const input = new PositionalShapeInput([
      String(this.number("x1")), String(this.number("y1")),
      String(this.number("x2")), String(this.number("y2")),
    ]);
    return this.copyStateTo(new Line(this.id, input), parentId);
  }
}
