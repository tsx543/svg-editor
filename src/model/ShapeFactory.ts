import { Circle } from "./Circle.js";
import { Ellipse } from "./Ellipse.js";
import { Group } from "./Group.js";
import { Line } from "./Line.js";
import { Rect } from "./Rect.js";
import type { Shape } from "./Shape.js";
import type { ShapeInput } from "./ShapeInput.js";
import { Text } from "./Text.js";

export class ShapeFactory {
  readonly #constructors = new Map<string, new (id: string, input: ShapeInput) => Shape>([
    ["rect", Rect], ["circle", Circle], ["ellipse", Ellipse],
    ["line", Line], ["text", Text], ["g", Group],
  ]);

  public create(type: string, id: string, input: ShapeInput): Shape {
    const Constructor = this.#constructors.get(type);
    if (!Constructor) {
      throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    }
    return new Constructor(id, input);
  }
}
