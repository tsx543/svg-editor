import type { Shape } from "./Shape.js";
import type { Transform } from "./Transform.js";

export interface ShapeTopology {
  childrenOf(shape: Shape): readonly Shape[];
  transformFor?(shape: Shape, parentId: string | null, parentWorld: Transform): Transform;
}
