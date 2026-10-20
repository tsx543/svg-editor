import type { Shape } from "../model/Shape.js";
import type { SvgDocument } from "../model/SvgDocument.js";

export class DocumentPresenter {
  public tree(document: SvgDocument, id?: string): readonly string[] {
    if (id !== undefined) {
      const root = document.find(id);
      const lines = [root.describe()];
      this.#appendChildren(root.children, "", lines);
      return lines;
    }
    const lines = [`svg (${document.width}x${document.height})`];
    this.#appendChildren(document.children, "", lines);
    return lines;
  }

  public show(document: SvgDocument, id: string): readonly string[] {
    const shape = document.find(id);
    const parent = shape.parentId === null
      ? "svg"
      : this.#label(document.find(shape.parentId));
    return [
      `${this.#label(shape)}  parent=${parent}`,
      ...shape.detailLines().map((line) => `  ${line}`),
    ];
  }

  #label(shape: Shape): string {
    return `${shape.kind}#${shape.id}`;
  }

  #appendChildren(
    children: readonly Shape[],
    prefix: string,
    lines: string[],
  ): void {
    children.forEach((child, index) => {
      const last = index === children.length - 1;
      lines.push(`${prefix}${last ? "└── " : "├── "}${child.describe()}`);
      this.#appendChildren(child.children, `${prefix}${last ? "    " : "│   "}`, lines);
    });
  }
}
