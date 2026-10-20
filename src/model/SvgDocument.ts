import { NumericValue } from "./NumericValue.js";
import { Group } from "./Group.js";
import { PositionalShapeInput } from "./PositionalShapeInput.js";
import type { Shape } from "./Shape.js";
import { TreeAnalysis } from "./TreeAnalysis.js";
import type { TreeNode } from "./TreeNode.js";
import { TreeTopology } from "./TreeTopology.js";

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

  public delete(id: string): void {
    this.find(id);
    const nextChildren: Shape[] = [];
    for (const child of this.#children) {
      const retained = child.withoutNode(id);
      if (retained !== null) nextChildren.push(retained);
    }
    const nextIndex = this.buildIndex(nextChildren);
    this.#children = nextChildren;
    this.#index = nextIndex;
  }

  public group(newId: string, ids: readonly string[]): void {
    if (this.#index.has(newId)) throw new Error(`id already exists: ${newId}`);
    const group = new Group(newId, new PositionalShapeInput([]));
    if (ids.length < 2) throw new Error("group requires at least two shapes");
    const selected = new Set<string>();
    for (const id of ids) {
      this.find(id);
      if (selected.has(id)) throw new Error(`duplicate shape id: ${id}`);
      selected.add(id);
    }

    const analysis = new TreeAnalysis(this.#children);
    const ordered = analysis.ordered;
    const selections: TreeNode[] = [];
    let previous: TreeNode | undefined;
    for (const node of ordered) {
      if (!selected.has(node.shape.id)) continue;
      if (previous && node.start < previous.end) {
        throw new Error(`cannot group a container into its own descendant: ${previous.shape.id}`);
      }
      selections.push(node);
      previous = node;
    }

    const first = selections[0]!;
    const last = selections[selections.length - 1]!;
    let parentId: string | null = null;
    for (const node of ordered) {
      if (node.start <= first.start && node.end > last.start) parentId = node.shape.id;
    }
    let anchor = first;
    while (anchor.parentId !== parentId) anchor = analysis.node(anchor.parentId!);

    const topology = new TreeTopology(analysis);
    const parents = new Set(selections.map((node) => node.parentId));
    for (const parent of parents) {
      topology.setChildren(parent, analysis.childrenOf(parent).filter((child) => !selected.has(child.id)));
    }
    const siblings: Shape[] = [];
    for (const child of analysis.childrenOf(parentId)) {
      if (child.id === anchor.shape.id) siblings.push(group);
      if (!selected.has(child.id)) siblings.push(child);
    }
    topology.setChildren(parentId, siblings);
    topology.setChildren(newId, selections.map((node) => node.shape));
    this.publish(topology);
  }

  public ungroup(id: string): void {
    const group = this.find(id);
    group.assertUngroupable();
    if (group.parentId === null) throw new Error(`cannot ungroup top-level container: ${id}`);
    const analysis = new TreeAnalysis(this.#children);
    const topology = new TreeTopology(analysis);
    const siblings: Shape[] = [];
    for (const sibling of analysis.childrenOf(group.parentId)) {
      if (sibling.id === id) {
        for (const child of analysis.childrenOf(id)) siblings.push(child);
      } else {
        siblings.push(sibling);
      }
    }
    topology.setChildren(group.parentId, siblings);
    this.publish(topology);
  }

  public addTo(groupId: string, id: string): void {
    const target = this.find(groupId);
    target.assertContainer();
    const source = this.find(id);
    const analysis = new TreeAnalysis(this.#children);
    if (analysis.contains(id, groupId)) {
      throw new Error(`cannot move a container into its own descendant: ${id}`);
    }
    const topology = new TreeTopology(analysis);
    topology.setChildren(source.parentId, analysis.childrenOf(source.parentId).filter((child) => child.id !== id));
    topology.setChildren(groupId, [...topology.childrenOfParent(groupId), source]);
    this.publish(topology);
  }

  public front(id: string): void {
    this.reorder(id, false);
  }

  public back(id: string): void {
    this.reorder(id, true);
  }

  private reorder(id: string, toBeginning: boolean): void {
    const shape = this.find(id);
    const analysis = new TreeAnalysis(this.#children);
    const topology = new TreeTopology(analysis);
    const siblings = analysis.childrenOf(shape.parentId).filter((child) => child.id !== id);
    topology.setChildren(shape.parentId, toBeginning ? [shape, ...siblings] : [...siblings, shape]);
    this.publish(topology);
  }

  private publish(topology: TreeTopology): void {
    const children = topology.childrenOfParent(null).map((child) => child.rebuild(null, topology));
    const index = this.buildIndex(children);
    this.#children = children;
    this.#index = index;
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
