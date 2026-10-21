import type { Shape } from "./Shape.js";
import type { ShapeTopology } from "./ShapeTopology.js";
import { TreeAnalysis } from "./TreeAnalysis.js";
import type { Transform } from "./Transform.js";

export class TreeTopology implements ShapeTopology {
  readonly #analysis: TreeAnalysis;
  readonly #overrides = new Map<string | null, readonly Shape[]>();

  public constructor(analysis: TreeAnalysis) {
    this.#analysis = analysis;
  }

  public setChildren(parentId: string | null, children: readonly Shape[]): void {
    this.#overrides.set(parentId, [...children]);
  }

  public childrenOf(shape: Shape): readonly Shape[] {
    return this.childrenOfParent(shape.id);
  }

  public childrenOfParent(parentId: string | null): readonly Shape[] {
    return this.#overrides.get(parentId) ?? this.#analysis.childrenOf(parentId);
  }

  public transformFor(shape: Shape, parentId: string | null, parentWorld: Transform): Transform {
    if (!this.#analysis.has(shape.id)) return shape.transform;
    const original = this.#analysis.node(shape.id);
    return original.parentId === parentId ? shape.transform : original.world.relativeTo(parentWorld);
  }
}
