import type { Shape } from "./Shape.js";
import type { TreeNode } from "./TreeNode.js";
import { Transform } from "./Transform.js";

export class TreeAnalysis {
  readonly #roots: readonly Shape[];
  readonly #ordered: TreeNode[] = [];
  readonly #nodes = new Map<string, TreeNode>();

  public constructor(roots: readonly Shape[]) {
    this.#roots = [...roots];
    for (const root of roots) this.visit(root, null, new Transform());
  }

  public get ordered(): readonly TreeNode[] {
    return [...this.#ordered];
  }

  public node(id: string): TreeNode {
    const node = this.#nodes.get(id);
    if (!node) throw new Error(`no such shape: ${id}`);
    return node;
  }

  public has(id: string): boolean { return this.#nodes.has(id); }

  public childrenOf(parentId: string | null): readonly Shape[] {
    return parentId === null ? this.#roots : this.node(parentId).children;
  }

  public contains(ancestorId: string, descendantId: string): boolean {
    const ancestor = this.node(ancestorId);
    const descendant = this.node(descendantId);
    return ancestor.start <= descendant.start && descendant.start < ancestor.end;
  }

  private visit(shape: Shape, parentId: string | null, parentWorld: Transform): void {
    const start = this.#ordered.length;
    const children = shape.children;
    const world = parentWorld.compose(shape.transform);
    const initial = { shape, parentId, start, end: start + 1, children, world };
    this.#ordered.push(initial);
    for (const child of children) this.visit(child, shape.id, world);
    const node = { ...initial, end: this.#ordered.length };
    this.#ordered[start] = node;
    this.#nodes.set(shape.id, node);
  }
}
