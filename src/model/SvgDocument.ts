import { NumericValue } from "./NumericValue.js";
import type { Shape } from "./Shape.js";

export class SvgDocument {
  #width: number;
  #height: number;
  #children: Shape[] = [];
  #index = new Map<string, Shape>();

  public constructor(width = 800, height = 600) {
    this.#width = NumericValue.positive(width, "canvas width");
    this.#height = NumericValue.positive(height, "canvas height");
  }

  public get width(): number { return this.#width; }
  public get height(): number { return this.#height; }

  public get children(): readonly Shape[] {
    return [...this.#children];
  }

  public resize(width: number, height: number): void {
    const nextWidth = NumericValue.positive(width, "canvas width");
    const nextHeight = NumericValue.positive(height, "canvas height");
    this.#width = nextWidth;
    this.#height = nextHeight;
  }

  public find(id: string): Shape {
    const shape = this.#index.get(id);
    if (!shape) throw new Error(`no such shape: ${id}`);
    return shape;
  }

  public create(shape: Shape, parentId?: string): void {
    const incoming = this.buildIndex([shape]);
    for (const id of incoming.keys()) {
      if (this.#index.has(id)) throw new Error(`id already exists: ${id}`);
    }

    let nextChildren: Shape[];
    if (parentId === undefined) {
      nextChildren = [...this.#children, shape.clone(null)];
    } else {
      const parent = this.#index.get(parentId);
      if (!parent) throw new Error(`no such container: ${parentId}`);
      const replacement = parent.withChild(shape);
      nextChildren = this.#children.map((child) => child.replaceNode(parentId, replacement));
    }
    const nextIndex = this.buildIndex(nextChildren);
    this.#children = nextChildren;
    this.#index = nextIndex;
  }

  public clone(): SvgDocument {
    const copy = new SvgDocument(this.width, this.height);
    copy.#children = this.#children.map((child) => child.clone(null));
    copy.#index = copy.buildIndex(copy.#children);
    return copy;
  }

  private buildIndex(roots: readonly Shape[]): Map<string, Shape> {
    const index = new Map<string, Shape>();
    for (const root of roots) this.indexSubtree(root, index);
    return index;
  }

  private indexSubtree(shape: Shape, index: Map<string, Shape>): void {
    if (index.has(shape.id)) throw new Error(`id already exists: ${shape.id}`);
    index.set(shape.id, shape);
    for (const child of shape.children) this.indexSubtree(child, index);
  }
}
