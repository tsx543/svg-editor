import { PositionalShapeInput } from "./PositionalShapeInput.js";
import { Shape } from "./Shape.js";
import type { ShapeInput } from "./ShapeInput.js";

export class Text extends Shape {
  #content: string;

  public constructor(id: string, input: ShapeInput) {
    input.assertArity(3, 3);
    super(id, [
      { name: "x", value: input.number(0, "x") },
      { name: "y", value: input.number(1, "y") },
    ]);
    this.#content = input.text(2, "content");
  }

  public override get kind(): string { return "text"; }

  public override move(dx: number, dy: number): void {
    this.coordinates(["x"], ["y"], dx, dy);
  }

  protected override geometryDescription(): string {
    return `(${this.number("x")},${this.number("y")}) ${JSON.stringify(this.#content)}`;
  }

  protected override setContent(attribute: string, value: string): boolean {
    if (attribute !== "text") return false;
    this.#content = value;
    return true;
  }

  protected override contentDetails(): readonly string[] {
    return [`text=${JSON.stringify(this.#content)}`];
  }

  public override clone(parentId: string | null = this.parentId): Text {
    const input = new PositionalShapeInput([
      String(this.number("x")), String(this.number("y")), this.#content,
    ]);
    return this.copyStateTo(new Text(this.id, input), parentId);
  }
}
