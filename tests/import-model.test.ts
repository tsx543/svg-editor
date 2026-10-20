import assert from "node:assert/strict";
import test from "node:test";
import { Group } from "../src/model/Group.js";
import { PositionalShapeInput } from "../src/model/PositionalShapeInput.js";
import { Rect } from "../src/model/Rect.js";
import type { Shape } from "../src/model/Shape.js";
import { ShapeFactory } from "../src/model/ShapeFactory.js";
import { SvgDocument } from "../src/model/SvgDocument.js";

const factory = new ShapeFactory();
function node(kind: string, id: string, args: readonly string[] = []): Shape {
  return factory.create(kind, id, new PositionalShapeInput(args));
}
const natural = { childrenOf: (shape: Shape): readonly Shape[] => shape.children };

test("SVG model import exports normalized px geometry, explicit styles and presentation extras", () => {
  const rect = node("rect", "r", ["0", "0", "1", "2"]);
  rect.importSvgAttributes(new Map([
    ["id", "r"], ["x", " \t12.5px\r\n"], ["width", "20px"], ["fill", "red"],
    ["stroke-width", "2px"], ["font-size", "16px"], ["text-anchor", "middle"],
    ["transform", "translate(10,20) scale(0.5)"],
  ]));
  assert.equal(rect.svgAttributes().get("x"), "12.5");
  assert.equal(rect.svgAttributes().get("width"), "20");
  assert.equal(rect.svgAttributes().get("stroke-width"), "2");
  assert.equal(rect.svgAttributes().get("font-size"), "16");
  assert.equal(rect.svgAttributes().get("text-anchor"), "middle");
  assert.equal(rect.transform.factor, 0.5);
  assert.equal(rect.svgText(), null);
  assert.equal(rect.svgAttributes().has("stroke"), false);
  assert.throws(() => rect.set("font-size", "20"), /unknown attribute: font-size/);
});

test("tree/show descriptions expose imported transforms and text presentation without changing ordinary output", () => {
  const text = node("text", "t", ["10", "20", "标题"]);
  assert.equal(text.describe(), 'text#t (10,20) "标题"');
  text.importSvgAttributes(new Map([
    ["font-size", "16"], ["text-anchor", "middle"], ["transform", "translate(20,30) scale(2)"],
  ]));
  for (const display of [text.describe(), text.detailLines().join("\n")]) {
    assert.match(display, /font-size=16/);
    assert.match(display, /text-anchor=middle/);
    assert.match(display, /transform="translate\(20,30\) scale\(2\)"/);
  }
});

test("all built-in geometry exports and text-body capability are polymorphic", () => {
  const cases = [
    node("rect", "r", ["1", "2", "3", "4"]), node("circle", "c", ["1", "2", "3"]),
    node("ellipse", "e", ["1", "2", "3", "4"]), node("line", "l", ["1", "2", "3", "4"]),
    node("text", "t", ["1", "2", "old"]), node("g", "g"),
  ];
  for (const shape of cases) {
    assert.equal(shape.svgAttributes().get("id"), shape.id);
    if (shape.svgText() === null) {
      assert.throws(() => shape.importSvgAttributes(new Map(), "unexpected"), /unexpected text/);
      assert.throws(() => shape.importSvgAttributes(new Map(), "\u00a0"), /unexpected text/);
      assert.doesNotThrow(() => shape.importSvgAttributes(new Map(), " \t\r\n "));
    } else {
      shape.importSvgAttributes(new Map(), '<开始> & "文字"');
      assert.equal(shape.svgText(), '<开始> & "文字"');
      shape.importSvgAttributes(new Map(), "");
      assert.equal(shape.svgText(), "");
    }
  }
  assert.equal(cases[0]!.svgAttributes().get("width"), "3");
  assert.equal(cases[1]!.svgAttributes().get("r"), "3");
  assert.equal(cases[2]!.svgAttributes().get("rx"), "3");
  assert.equal(cases[3]!.svgAttributes().get("x2"), "3");
});

test("failed import is atomic for geometry, style, transform and text metadata", () => {
  const text = node("text", "t", ["1", "2", "original"]);
  text.importSvgAttributes(new Map([["fill", "blue"], ["transform", "translate(3,4)"]]));
  const before = [...text.svgAttributes()];
  for (const attributes of [
    new Map([["fill", "red"], ["unknown", "bad"]]),
    new Map([["x", "10px"], ["font-size", "-1"]]),
    new Map([["stroke", "red"], ["text-anchor", "invalid"]]),
    new Map([["x", "\u00a01px"]]), new Map([["x", "1px\u00a0"]]),
    new Map([["id", "different"]]), new Map([["fill", "url(https://example.test/x.svg)"]]),
    new Map([["transform", "rotate(20)"]]),
  ]) {
    assert.throws(() => text.importSvgAttributes(attributes, "changed"));
    assert.deepEqual([...text.svgAttributes()], before);
    assert.equal(text.svgText(), "original");
  }
});

test("exported maps, cloned metadata and imported argument maps cannot mutate original state", () => {
  const text = node("text", "t", ["1", "2", "original"]);
  const attributes = new Map([["font-size", "16"], ["fill", "blue"], ["transform", "scale(2)"]]);
  text.importSvgAttributes(attributes);
  attributes.set("fill", "red");
  const output = text.svgAttributes() as Map<string, string>;
  output.set("font-size", "999");
  const copy = text.clone();
  copy.importSvgAttributes(new Map([["font-size", "20"], ["transform", "scale(3)"]]), "copy");
  assert.equal(text.svgAttributes().get("font-size"), "16");
  assert.equal(text.svgAttributes().get("fill"), "blue");
  assert.equal(text.transform.factor, 2);
  assert.equal(text.svgText(), "original");
});

test("bulk tree initialization keeps hierarchy, original ownership and root metadata across clone/resize", () => {
  const group = node("g", "g");
  const text = node("text", "t", ["1", "2", "title"]);
  const rootAttributes = new Map([["id", "canvas"], ["fill", "blue"], ["font-size", "16px"]]);
  const document = SvgDocument.fromTree(400, 200, [group], {
    childrenOf(shape): readonly Shape[] { return shape.id === "g" ? [text] : []; },
  }, rootAttributes);
  assert.equal(document.elementCount, 2);
  assert.equal(document.find("t").parentId, "g");
  text.move(100, 100);
  rootAttributes.set("fill", "red");
  assert.equal(document.find("t").position(), "(1,2)");
  const copy = document.clone();
  copy.resize(800, 600);
  assert.equal(copy.svgAttributes().get("viewBox"), "0 0 800 600");
  assert.equal(copy.svgAttributes().get("fill"), "blue");
  assert.equal(copy.svgAttributes().get("font-size"), "16");
  assert.equal(document.svgAttributes().get("viewBox"), "0 0 400 200");
  (copy.svgAttributes() as Map<string, string>).set("fill", "black");
  assert.equal(copy.svgAttributes().get("fill"), "blue");
});

test("root ids reserve the global namespace without becoming addressable graphic elements", () => {
  const document = SvgDocument.fromTree(100, 100, [node("g", "g")], natural, new Map([["id", "canvas"]]));
  document.create(node("g", "other"));
  assert.equal(document.elementCount, 2);
  assert.throws(() => document.find("canvas"), /no such shape: canvas/);
  assert.throws(() => document.create(node("g", "canvas")), /id already exists: canvas/);
  assert.throws(() => document.group("canvas", ["g", "other"]), /id already exists: canvas/);
  assert.throws(() => SvgDocument.fromTree(100, 100, [node("g", "canvas")], natural, new Map([["id", "canvas"]])), /id already exists: canvas/);
  assert.equal(document.elementCount, 2);
});

test("bulk initialization rejects duplicates and unsupported root attributes", () => {
  assert.throws(() => SvgDocument.fromTree(100, 100, [node("g", "same"), node("g", "same")], natural), /id already exists: same/);
  for (const attributes of [new Map([["style", "fill:red"]]), new Map([["transform", "scale(2)"]]), new Map([["fill", "url(#paint)"]])]) {
    assert.throws(() => SvgDocument.fromTree(100, 100, [], natural, attributes));
  }
});

test("bulk import deep topology copies each leaf once and never clones complete groups per level", () => {
  const depth = 128;
  const groups = Array.from({ length: depth }, (_, index) => node("g", `g-${index}`));
  const leaf = node("rect", "r", ["1", "2", "3", "4"]);
  const children = new Map<string, readonly Shape[]>();
  for (let index = 0; index < depth; index += 1) children.set(groups[index]!.id, [groups[index + 1] ?? leaf]);
  let copies = 0;
  let groupCopies = 0;
  const originalRectClone = Rect.prototype.clone;
  const originalGroupClone = Group.prototype.clone;
  Rect.prototype.clone = function (this: Rect, parentId?: string | null): Rect { copies += 1; return originalRectClone.call(this, parentId); };
  Group.prototype.clone = function (this: Group, parentId?: string | null): Group { groupCopies += 1; return originalGroupClone.call(this, parentId); };
  let document: SvgDocument;
  try {
    document = SvgDocument.fromTree(100, 100, [groups[0]!], { childrenOf: (shape) => children.get(shape.id) ?? [] });
  } finally {
    Rect.prototype.clone = originalRectClone;
    Group.prototype.clone = originalGroupClone;
  }
  assert.ok(copies <= 2);
  assert.ok(groupCopies <= 2 * depth);
  assert.equal(document!.elementCount, depth + 1);
  assert.equal(document!.find("r").parentId, "g-127");
});
