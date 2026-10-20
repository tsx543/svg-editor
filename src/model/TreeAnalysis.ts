import type { Shape } from "./Shape.js";
import type { TreeNode } from "./TreeNode.js";

export class TreeAnalysis {
  readonly #roots: readonly Shape[];
  readonly #ordered: TreeNode[] = [];
  readonly #nodes = new Map<string, TreeNode>();

  public constructor(roots: readonly Shape[]) {
    this.#roots = [...roots];
    for (const root of roots) this.visit(root, null);
  }

  public get ordered(): readonly TreeNode[] {
    return [...this.#ordered];
  }

  public node(id: string): TreeNode {
    const node = this.#nodes.get(id);
    if (!node) throw new Error(`no such shape: ${id}`);
    return node;
  }

  public childrenOf(parentId: string | null): readonly Shape[] {
    return parentId === null ? this.#roots : this.node(parentId).children;
  }

  public contains(ancestorId: string, descendantId: string): boolean {
    const ancestor = this.node(ancestorId);
    const descendant = this.node(descendantId);
    return ancestor.start <= descendant.start && descendant.start < ancestor.end;
  }

  private visit(shape: Shape, parentId: string | null): void {
    const start = this.#ordered.length;
    const children = shape.children;
    const initial = { shape, parentId, start, end: start + 1, children };
    this.#ordered.push(initial);
    for (const child of children) this.visit(child, shape.id);
    const node = { ...initial, end: this.#ordered.length };
    this.#ordered[start] = node;
    this.#nodes.set(shape.id, node);
  }
}
