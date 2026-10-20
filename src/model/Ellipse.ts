import { PositionalShapeInput } from "./PositionalShapeInput.js";
import { Shape } from "./Shape.js";
import type { ShapeInput } from "./ShapeInput.js";

export class Ellipse extends Shape {
  public constructor(id: string, input: ShapeInput) {
    input.assertArity(4, 5);
    super(id, [
      { name: "cx", value: input.number(0, "cx") },
      { name: "cy", value: input.number(1, "cy") },
      { name: "rx", value: input.number(2, "rx"), nonNegative: true },
      { name: "ry", value: input.number(3, "ry"), nonNegative: true },
    ]);
    const fill = input.optionalText(4, "fill");
    if (fill !== undefined) this.set("fill", fill);
  }

  public override get kind(): string { return "ellipse"; }

  public override position(): string {
    return `(${this.number("cx")},${this.number("cy")})`;
  }

  protected override movementAxes(): readonly [readonly string[], readonly string[]] {
    return [["cx"], ["cy"]];
  }

  public override clone(parentId: string | null = this.parentId): Ellipse {
    const input = new PositionalShapeInput([
      String(this.number("cx")), String(this.number("cy")),
      String(this.number("rx")), String(this.number("ry")),
    ]);
    return this.copyStateTo(new Ellipse(this.id, input), parentId);
  }
}
