import type { Shape } from "./Shape.js";

export interface ShapeTopology {
  childrenOf(shape: Shape): readonly Shape[];
}
