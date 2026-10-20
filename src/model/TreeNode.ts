import type { Shape } from "./Shape.js";

export interface TreeNode {
  readonly shape: Shape;
  readonly parentId: string | null;
  readonly start: number;
  readonly end: number;
  readonly children: readonly Shape[];
}
