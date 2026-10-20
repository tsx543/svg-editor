import { PositionalShapeInput } from "./PositionalShapeInput.js";
import { Shape } from "./Shape.js";
import type { ShapeInput } from "./ShapeInput.js";

export class Circle extends Shape {
  public constructor(id: string, input: ShapeInput) {
    input.assertArity(3, 4);
    super(id, [
      { name: "cx", value: input.number(0, "cx") },
      { name: "cy", value: input.number(1, "cy") },
      { name: "r", value: input.number(2, "r"), nonNegative: true },
    ]);
    const fill = input.optionalText(3, "fill");
    if (fill !== undefined) this.set("fill", fill);
  }

  public override get kind(): string { return "circle"; }

  public override move(dx: number, dy: number): void {
    this.coordinates(["cx"], ["cy"], dx, dy);
  }

  public override clone(parentId: string | null = this.parentId): Circle {
    const input = new PositionalShapeInput([
      String(this.number("cx")), String(this.number("cy")), String(this.number("r")),
    ]);
    return this.copyStateTo(new Circle(this.id, input), parentId);
  }
}
