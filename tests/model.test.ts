import assert from "node:assert/strict";
import test from "node:test";
import { PositionalShapeInput } from "../src/model/PositionalShapeInput.js";
import type { Shape } from "../src/model/Shape.js";
import { ShapeFactory } from "../src/model/ShapeFactory.js";
import { SvgDocument } from "../src/model/SvgDocument.js";

const factory = new ShapeFactory();

function shape(type: string, id: string, args: readonly string[] = []): Shape {
  return factory.create(type, id, new PositionalShapeInput(args));
}

function descriptions(document: SvgDocument): readonly string[] {
  function subtree(node: Shape): readonly string[] {
    return [node.describe(), ...node.children.flatMap((child) => subtree(child))];
  }
  return document.children.flatMap((child) => subtree(child));
}

test("six built-in classes describe the geometry and retain omitted styles", () => {
  assert.equal(shape("rect", "r", ["10", "20", "100", "50"]).describe(), "rect#r x=10 y=20 w=100 h=50");
  assert.equal(shape("circle", "c", ["100", "100", "20", "red"]).describe(), "circle#c cx=100 cy=100 r=20 fill=red");
  assert.equal(shape("ellipse", "e", ["1", "2", "3", "4"]).describe(), "ellipse#e cx=1 cy=2 rx=3 ry=4");
  assert.equal(shape("line", "l", ["1", "2", "3", "4", "black"]).describe(), "line#l (1,2) -> (3,4) stroke=black");
  assert.equal(shape("text", "t", ["20", "40", "开始 My Diagram"]).describe(), 'text#t (20,40) "开始 My Diagram"');
  assert.equal(shape("g", "g").describe(), "g#g");
});

test("the only shape factory rejects future types and validates every shape's arity", () => {
  assert.throws(() => shape("box", "future"), { message: "unknown shape type: box (is the plugin loaded?)" });
  assert.throws(() => shape("Rect", "case", ["0", "0", "1", "1"]), /unknown shape type/);
  for (const [kind, args] of [
    ["rect", ["0", "0", "1"]], ["circle", ["0", "0"]],
    ["ellipse", ["0", "0", "1"]], ["line", ["0", "0", "1"]],
    ["text", ["0", "0"]], ["g", ["unexpected"]],
  ] as const) {
    assert.throws(() => shape(kind, "bad", args), /shape parameters/);
  }
  assert.throws(() => shape("rect", "extra", ["0", "0", "1", "1", "red", "extra"]), /shape parameters/);
});

test("numeric input accepts finite decimal coordinates but rejects non-decimal or invalid input", () => {
  const rect = shape("rect", "r", ["-.5", "+1.25", "0", "2e2"]);
  assert.equal(rect.describe(), "rect#r x=-0.5 y=1.25 w=0 h=200");
  for (const value of ["", "NaN", "Infinity", "1e999", "0x10", "0b10", "1px", " 1 "]) {
    assert.throws(() => shape("circle", "c", [value, "0", "1"]), /invalid number/);
  }
});

test("dimensions and radii are non-negative while coordinates may be negative", () => {
  assert.doesNotThrow(() => shape("line", "l", ["-1", "-2", "-3", "-4"]));
  assert.doesNotThrow(() => shape("circle", "c", ["-1", "-2", "0"]));
  assert.throws(() => shape("rect", "r", ["0", "0", "-1", "1"]), /width must be non-negative/);
  assert.throws(() => shape("circle", "c", ["0", "0", "-1"]), /r must be non-negative/);
  assert.throws(() => shape("ellipse", "e", ["0", "0", "1", "-1"]), /ry must be non-negative/);
  for (const id of ["", "has space", "tab\tid", "new\nline"]) {
    assert.throws(() => shape("g", id), /invalid id/);
  }
});

test("position input owns its arguments and reports missing parameters", () => {
  const args = ["1", "2", "3"];
  const input = new PositionalShapeInput(args);
  args[0] = "9";
  assert.equal(input.number(0, "x"), 1);
  assert.equal(input.optionalText(3, "fill"), undefined);
  assert.throws(() => input.text(3, "content"), /missing parameter: content/);
});

test("the document creates ordered nested shapes with correct parent ids and global lookup", () => {
  const document = new SvgDocument();
  document.create(shape("g", "scene"));
  document.create(shape("rect", "bg", ["0", "0", "800", "600", "#fff"]));
  document.create(shape("g", "node"), "scene");
  document.create(shape("rect", "r", ["10", "20", "30", "40"]), "node");
  document.create(shape("text", "t", ["15", "35", "标题"]), "node");
  assert.deepEqual(document.children.map((node) => node.id), ["scene", "bg"]);
  assert.equal(document.find("scene").parentId, null);
  assert.equal(document.find("node").parentId, "scene");
  assert.equal(document.find("r").parentId, "node");
  assert.deepEqual(document.find("node").children.map((node) => node.id), ["r", "t"]);
  assert.equal(document.find("node").children[0], document.find("r"));
  assert.throws(() => document.find("missing"), { message: "no such shape: missing" });
});

test("create validates all ids and containers without changing the tree", () => {
  const document = new SvgDocument();
  document.create(shape("g", "scene"));
  document.create(shape("circle", "c", ["1", "2", "3"]), "scene");
  document.create(shape("circle", "C", ["1", "2", "3"]), "scene");
  const before = descriptions(document);
  assert.throws(() => document.create(shape("g", "c")), { message: "id already exists: c" });
  assert.throws(() => document.create(shape("g", "n"), "missing"), { message: "no such container: missing" });
  assert.throws(() => document.create(shape("g", "n"), "c"), { message: "not a container: c" });
  assert.deepEqual(descriptions(document), before);
  assert.throws(() => document.find("n"), /no such shape: n/);
});

test("document ownership and read-only collections prevent external structural mutation", () => {
  const document = new SvgDocument();
  const incoming = shape("rect", "r", ["0", "0", "10", "20"]);
  document.create(incoming);
  incoming.move(99, 99);
  assert.equal(document.find("r").describe(), "rect#r x=0 y=0 w=10 h=20");
  const roots = document.children as Shape[];
  roots.splice(0, roots.length);
  assert.equal(document.children.length, 1);
  document.create(shape("g", "g"));
  document.create(shape("g", "nested"), "g");
  const children = document.find("g").children as Shape[];
  children.push(shape("g", "external"));
  assert.deepEqual(document.find("g").children.map((node) => node.id), ["nested"]);
  assert.throws(() => document.find("external"), /no such shape/);
});

test("inserting an imported subtree validates descendant ids and normalizes parents", () => {
  const source = new SvgDocument();
  source.create(shape("g", "branch"));
  source.create(shape("circle", "c", ["1", "2", "3"]), "branch");
  const target = new SvgDocument();
  target.create(shape("g", "destination"));
  target.create(source.find("branch"), "destination");
  assert.equal(target.find("branch").parentId, "destination");
  assert.equal(target.find("c").parentId, "branch");
  assert.equal(source.find("branch").parentId, null);
  target.create(shape("g", "another"));
  assert.throws(() => target.create(source.find("branch"), "another"), /id already exists: branch/);

  const colliding = new SvgDocument();
  colliding.create(shape("circle", "c", ["0", "0", "0"]));
  const before = descriptions(colliding);
  assert.throws(() => colliding.create(source.find("branch")), /id already exists: c/);
  assert.deepEqual(descriptions(colliding), before);
});

test("leaf moves and scaling update all geometry, including both line endpoints", () => {
  const rect = shape("rect", "r", ["1", "2", "3", "4"]);
  rect.move(2, -1);
  rect.scale(2);
  assert.equal(rect.describe(), "rect#r x=6 y=2 w=6 h=8");
  const line = shape("line", "l", ["1", "2", "3", "4"]);
  line.move(10, 20);
  line.scale(0.5);
  assert.equal(line.describe(), "line#l (5.5,11) -> (6.5,12)");
  const ellipse = shape("ellipse", "e", ["1", "2", "3", "4"]);
  ellipse.scale(2);
  assert.equal(ellipse.describe(), "ellipse#e cx=2 cy=4 rx=6 ry=8");
});

test("nested groups recurse uniformly and styles use group inheritance without overwriting children", () => {
  const document = new SvgDocument();
  document.create(shape("g", "outer"));
  document.create(shape("g", "inner"), "outer");
  document.create(shape("circle", "c", ["1", "2", "3", "red"]), "inner");
  document.create(shape("text", "t", ["4", "5", "开始"]), "outer");
  document.find("outer").set("fill", "blue");
  document.find("outer").move(10, 20);
  document.find("outer").scale(2);
  assert.equal(document.find("outer").describe(), "g#outer fill=blue");
  assert.equal(document.find("c").describe(), "circle#c cx=22 cy=44 r=6 fill=red");
  assert.equal(document.find("t").describe(), 'text#t (28,50) "开始"');
  assert.equal(document.find("inner").parentId, "outer");
  assert.equal(document.find("c").parentId, "inner");
});

test("set respects each type's whitelist and leaves failed edits unchanged", () => {
  const rect = shape("rect", "r", ["1", "2", "3", "4"]);
  rect.set("width", "7.5");
  rect.set("fill", "#ffffff");
  rect.set("stroke", "black");
  rect.set("stroke-width", "2.5");
  assert.equal(rect.describe(), "rect#r x=1 y=2 w=7.5 h=4 fill=#ffffff stroke=black stroke-width=2.5");
  const before = rect.describe();
  assert.throws(() => rect.set("width", "-1"), /must be non-negative/);
  assert.throws(() => rect.set("stroke-width", "-1"), /must be non-negative/);
  assert.throws(() => rect.set("id", "another"), { message: "unknown attribute: id" });
  assert.throws(() => rect.set("r", "1"), { message: "unknown attribute: r" });
  assert.equal(rect.describe(), before);
  const text = shape("text", "t", ["1", "2", "old"]);
  text.set("text", '新文字 "with quotes"');
  assert.equal(text.describe(), `text#t (1,2) ${JSON.stringify('新文字 "with quotes"')}`);
  assert.throws(() => text.set("font-size", "12"), /unknown attribute: font-size/);
  assert.throws(() => shape("g", "g").set("x", "1"), /unknown attribute: x/);
});

test("clone independently preserves geometry, text, styles, parents, descendants and indexes", () => {
  const document = new SvgDocument(400, 300);
  document.create(shape("g", "g"));
  document.create(shape("text", "t", ["1", "2", "original"]), "g");
  document.find("g").set("stroke-width", "2");
  const copy = document.clone();
  assert.deepEqual(descriptions(copy), descriptions(document));
  assert.notEqual(copy.find("g"), document.find("g"));
  assert.notEqual(copy.find("t"), document.find("t"));
  copy.find("t").set("text", "copy");
  copy.find("g").move(10, 20);
  copy.find("g").set("stroke-width", "3");
  copy.resize(900, 700);
  assert.equal(document.find("t").describe(), 'text#t (1,2) "original"');
  assert.equal(document.find("g").describe(), "g#g stroke-width=2");
  assert.equal(copy.find("t").describe(), 'text#t (11,22) "copy"');
  assert.equal(copy.find("t").parentId, "g");
  assert.equal(document.width, 400);
  assert.equal(copy.width, 900);
});

test("canvas defaults and resize enforce positive finite dimensions atomically", () => {
  const document = new SvgDocument();
  assert.equal(document.width, 800);
  assert.equal(document.height, 600);
  document.resize(123.5, 456.25);
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.throws(() => new SvgDocument(invalid, 1));
    assert.throws(() => document.resize(999, invalid));
    assert.equal(document.width, 123.5);
    assert.equal(document.height, 456.25);
  }
});

test("nonpositive scaling and geometry overflow cannot partially mutate leaves or groups", () => {
  const document = new SvgDocument();
  document.create(shape("g", "g"));
  document.create(shape("circle", "ordinary", ["1", "2", "3"]), "g");
  document.create(shape("circle", "huge", ["1e308", "2", "3"]), "g");
  const before = descriptions(document);
  for (const factor of [0, -1]) {
    assert.throws(() => document.find("g").scale(factor), { message: "scale factor must be positive" });
  }
  assert.throws(() => document.find("g").scale(2), /invalid number/);
  assert.throws(() => document.find("g").move(1e308, 1), /invalid number/);
  assert.deepEqual(descriptions(document), before);
  const line = shape("line", "line", ["1", "2", "1e308", "4"]);
  assert.throws(() => line.move(1e308, 0), /invalid number/);
  assert.equal(line.describe(), "line#line (1,2) -> (1e+308,4)");
});
