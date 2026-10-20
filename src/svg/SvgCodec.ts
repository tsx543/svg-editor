import { SaxesParser } from "saxes";
import type { LoadedDocument } from "../application/contracts/LoadedDocument.js";
import { NumericValue } from "../model/NumericValue.js";
import type { Shape } from "../model/Shape.js";
import { ShapeFactory } from "../model/ShapeFactory.js";
import { SvgDocument } from "../model/SvgDocument.js";
import { SvgPresentation } from "../model/SvgPresentation.js";
import { SvgElement } from "./SvgElement.js";
import { SvgShapeInput } from "./SvgShapeInput.js";

export class SvgCodec {
  readonly #factory = new ShapeFactory();
  private static readonly namespace = "http://www.w3.org/2000/svg";
  private static readonly maxCharacters = 3_000_000;
  private static readonly maxDepth = 256;

  public decode(source: string): LoadedDocument {
    try {
      const root = this.parse(source);
      if (root.name !== "svg") throw new Error("root element must be <svg>");
      if (!this.isXmlWhitespace(root.text)) throw new Error("SVG root cannot contain text");
      const width = NumericValue.parseSvg(root.attributes.get("width") ?? "800", "canvas width");
      const height = NumericValue.parseSvg(root.attributes.get("height") ?? "600", "canvas height");
      this.validateViewBox(root.attributes.get("viewBox"), width, height);
      const extras = this.rootAttributes(root.attributes);
      const occupied = new Set<string>();
      this.collectIds(root, occupied);
      const counters = new Map<string, number>();
      const warnings: string[] = [];
      const children = new Map<string, readonly Shape[]>();
      const roots: Shape[] = [];
      for (const child of root.children) {
        roots.push(this.build(child, occupied, counters, warnings, children));
      }
      const document = SvgDocument.fromTree(width, height, roots, {
        childrenOf(shape: Shape): readonly Shape[] { return children.get(shape.id) ?? []; },
      }, extras);
      return { document, warnings: Object.freeze(warnings) };
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  public encode(document: SvgDocument): string {
    try {
      const output = ['<?xml version="1.0" encoding="UTF-8"?>'];
      output.push(`<svg${this.attributes(document.svgAttributes())}>`);
      for (const child of document.children) this.writeShape(child, 2, output);
      output.push("</svg>");
      const source = `${output.join("\n")}\n`;
      if (source.length > SvgCodec.maxCharacters) throw new Error("SVG exceeds 3000000 characters");
      return source;
    } catch (error: unknown) {
      throw this.failure(error);
    }
  }

  private parse(source: string): SvgElement {
    if (source.length > SvgCodec.maxCharacters) throw new Error("SVG exceeds 3000000 characters");
    const parser = new SaxesParser({ xmlns: true });
    const stack: SvgElement[] = [];
    let root: SvgElement | undefined;
    let unnamespacedRoot = false;
    parser.on("error", (error) => { throw error; });
    parser.on("doctype", () => { throw new Error("DOCTYPE is not supported"); });
    parser.on("processinginstruction", () => { throw new Error("processing instructions are not supported"); });
    parser.on("xmldecl", (declaration) => {
      if (declaration.version !== "1.0") throw new Error("only XML 1.0 is supported");
      if (declaration.encoding !== undefined && !/^utf-8$/iu.test(declaration.encoding)) {
        throw new Error("only UTF-8 XML declarations are supported");
      }
    });
    parser.on("opentag", (tag) => {
      if (stack.length >= SvgCodec.maxDepth) throw new Error("SVG exceeds 256 nesting levels");
      if (root === undefined) unnamespacedRoot = tag.uri === "";
      if (tag.uri !== SvgCodec.namespace && !(unnamespacedRoot && tag.uri === "")) {
        throw new Error(`unsupported element namespace: ${tag.uri}`);
      }
      const attributes = new Map<string, string>();
      for (const attribute of Object.values(tag.attributes)) {
        if (attribute.uri === "http://www.w3.org/2000/xmlns/") continue;
        if (attribute.uri !== "") throw new Error(`unsupported attribute namespace: ${attribute.name}`);
        attributes.set(attribute.local, attribute.value);
      }
      const element = new SvgElement(tag.local, attributes);
      const parent = stack.at(-1);
      if (parent === undefined) {
        if (root !== undefined) throw new Error("more than one root element");
        root = element;
      } else {
        parent.appendChild(element);
      }
      stack.push(element);
    });
    parser.on("closetag", () => { stack.pop(); });
    parser.on("text", (text) => {
      const current = stack.at(-1);
      if (current !== undefined) current.appendText(text);
      else if (!this.isXmlWhitespace(text)) throw new Error("text outside SVG root");
    });
    parser.on("cdata", (text) => {
      const current = stack.at(-1);
      if (current === undefined) throw new Error("CDATA outside SVG root");
      current.appendText(text);
    });
    parser.write(source).close();
    if (root === undefined) throw new Error("missing SVG root");
    return root;
  }

  private collectIds(element: SvgElement, occupied: Set<string>): void {
    const id = element.attributes.get("id");
    if (id !== undefined) {
      if (id === "" || /\s/u.test(id)) throw new Error(`invalid id: ${id}`);
      if (occupied.has(id)) throw new Error(`id already exists: ${id}`);
      occupied.add(id);
    }
    for (const child of element.children) this.collectIds(child, occupied);
  }

  private build(
    element: SvgElement,
    occupied: Set<string>,
    counters: Map<string, number>,
    warnings: string[],
    children: Map<string, readonly Shape[]>,
  ): Shape {
    let id = element.attributes.get("id");
    if (id === undefined) {
      let counter = counters.get(element.name) ?? 1;
      while (occupied.has(`${element.name}${counter}`)) counter += 1;
      id = `${element.name}${counter}`;
      counters.set(element.name, counter + 1);
      occupied.add(id);
      warnings.push(`warning: assigned id ${id} to unnamed <${element.name}>`);
    }
    const attributes = new Map(element.attributes);
    attributes.set("id", id);
    const text = element.text;
    const shape = this.#factory.create(element.name, id, new SvgShapeInput(attributes, text));
    const acceptsText = shape.svgText() !== null;
    if (!acceptsText && !this.isXmlWhitespace(text)) throw new Error(`unexpected text in <${element.name}>`);
    shape.importSvgAttributes(attributes, acceptsText ? text : undefined);
    const descendants: Shape[] = [];
    for (const child of element.children) {
      descendants.push(this.build(child, occupied, counters, warnings, children));
    }
    children.set(id, descendants);
    return shape;
  }

  private rootAttributes(attributes: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
    const extras = new Map<string, string>();
    for (const [name, value] of attributes) {
      if (name === "width" || name === "height" || name === "viewBox") continue;
      if (!["id", "fill", "stroke", "stroke-width", "font-size", "text-anchor"].includes(name)) {
        throw new Error(`unsupported root attribute: ${name}`);
      }
      const normalized = name === "id" ? value : SvgPresentation.normalize(name, value);
      if (normalized === undefined) throw new Error(`unsupported root attribute: ${name}`);
      extras.set(name, normalized);
    }
    return extras;
  }

  private validateViewBox(value: string | undefined, width: number, height: number): void {
    if (value === undefined) return;
    const normalized = value.replace(/^[\t\r\n ]+|[\t\r\n ]+$/gu, "");
    const values = normalized.split(/[\t\r\n ]*,[\t\r\n ]*|[\t\r\n ]+/u)
      .map((part) => NumericValue.parse(part, "viewBox"));
    if (values.length !== 4 || values[0] !== 0 || values[1] !== 0 || values[2] !== width || values[3] !== height) {
      throw new Error("viewBox must match 0 0 width height");
    }
  }

  private writeShape(shape: Shape, depth: number, output: string[]): void {
    if (depth > SvgCodec.maxDepth) throw new Error("SVG exceeds 256 nesting levels");
    const indent = "  ".repeat(depth - 1);
    const open = `${indent}<${shape.kind}${this.attributes(shape.svgAttributes())}`;
    const text = shape.svgText();
    const children = shape.children;
    if (text !== null) {
      if (children.length !== 0) throw new Error("text cannot contain child shapes");
      output.push(`${open}>${this.escape(text, false)}</${shape.kind}>`);
    } else if (children.length === 0) {
      output.push(`${open}/>`);
    } else {
      output.push(`${open}>`);
      for (const child of children) this.writeShape(child, depth + 1, output);
      output.push(`${indent}</${shape.kind}>`);
    }
  }

  private attributes(attributes: ReadonlyMap<string, string>): string {
    return [...attributes].map(([name, value]) => {
      if (name === "fill" || name === "stroke") SvgPresentation.normalize(name, value);
      return ` ${name}="${this.escape(value, true)}"`;
    }).join("");
  }

  private isXmlWhitespace(value: string): boolean {
    return /^[\t\r\n ]*$/u.test(value);
  }

  private escape(value: string, attribute: boolean): string {
    if (/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u.test(value)) {
      throw new Error("content contains an invalid XML character");
    }
    let escaped = value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/\r/gu, "&#13;");
    if (attribute) escaped = escaped.replace(/"/gu, "&quot;").replace(/\t/gu, "&#9;").replace(/\n/gu, "&#10;");
    return escaped;
  }

  private failure(error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(`invalid SVG: ${message.replace(/[\r\n\u2028\u2029]+/gu, " ")}`);
  }
}
