import assert from "node:assert/strict";
import test from "node:test";
import { Circle } from "../src/model/Circle.js";
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

test("position reports polymorphic coordinates without including style or text content", () => {
  const cases: readonly [string, readonly string[], string | null][] = [
    ["rect", ["1", "2", "3", "4", "red"], "(1,2)"],
    ["circle", ["3", "4", "5"], "(3,4)"],
    ["ellipse", ["5", "6", "7", "8"], "(5,6)"],
    ["line", ["1", "2", "3", "4"], "(1,2) -> (3,4)"],
    ["text", ["7", "8", "标题"], "(7,8)"],
    ["g", [], null],
  ];
  for (const [kind, args, expected] of cases) {
    const node = shape(kind, "node", args);
    assert.equal(node.position(), expected);
    node.move(2, -1);
    if (expected !== null) assert.notEqual(node.position(), expected);
  }
});

test("delete removes a nested leaf from both the ordered tree and global index and frees its id", () => {
  const document = new SvgDocument(400, 300);
  document.create(shape("g", "scene"));
  for (const id of ["first", "middle", "last"]) {
    document.create(shape("rect", id, ["1", "2", "3", "4"]), "scene");
  }
  document.find("scene").set("fill", "blue");
  document.delete("middle");
  assert.deepEqual(document.find("scene").children.map((child) => child.id), ["first", "last"]);
  assert.equal(document.find("scene").describe(), "g#scene fill=blue");
  assert.equal(document.find("first").parentId, "scene");
  assert.equal(document.find("last").parentId, "scene");
  assert.throws(() => document.find("middle"), { message: "no such shape: middle" });
  document.create(shape("text", "middle", ["5", "6", "reused"]), "scene");
  assert.equal(document.find("middle").describe(), 'text#middle (5,6) "reused"');
  assert.deepEqual(document.find("scene").children.map((child) => child.id), ["first", "last", "middle"]);
  assert.equal(document.width, 400);
  assert.equal(document.height, 300);
});

test("delete removes an entire nested group while preserving its siblings and root order", () => {
  const document = new SvgDocument();
  document.create(shape("g", "before"));
  document.create(shape("g", "scene"));
  document.create(shape("g", "after"));
  document.create(shape("g", "keep-before"), "scene");
  document.create(shape("g", "removed"), "scene");
  document.create(shape("g", "keep-after"), "scene");
  document.create(shape("g", "nested"), "removed");
  document.create(shape("circle", "descendant", ["1", "2", "3"]), "nested");
  document.delete("removed");
  for (const id of ["removed", "nested", "descendant"]) {
    assert.throws(() => document.find(id), { message: `no such shape: ${id}` });
  }
  assert.deepEqual(document.children.map((child) => child.id), ["before", "scene", "after"]);
  assert.deepEqual(document.find("scene").children.map((child) => child.id), ["keep-before", "keep-after"]);
  document.create(shape("g", "nested"), "scene");
  document.create(shape("g", "descendant"), "scene");
  assert.equal(document.find("nested").parentId, "scene");
  document.delete("scene");
  assert.deepEqual(document.children.map((child) => child.id), ["before", "after"]);
  for (const id of ["scene", "keep-before", "keep-after", "nested", "descendant"]) {
    assert.throws(() => document.find(id), { message: `no such shape: ${id}` });
  }
});

test("failed deletion preserves values, node identities and ordered structure", () => {
  const document = new SvgDocument();
  document.create(shape("g", "scene"));
  document.create(shape("circle", "c", ["1", "2", "3"]), "scene");
  const before = descriptions(document);
  const root = document.find("scene");
  const circle = document.find("c");
  assert.throws(() => document.delete("missing"), { message: "no such shape: missing" });
  assert.deepEqual(descriptions(document), before);
  assert.equal(document.find("scene"), root);
  assert.equal(document.find("c"), circle);
  const empty = new SvgDocument();
  assert.throws(() => empty.delete("missing"), { message: "no such shape: missing" });
  assert.deepEqual(empty.children, []);
});

test("clones remain independent snapshots before and after deletion", () => {
  const document = new SvgDocument();
  document.create(shape("g", "scene"));
  document.create(shape("text", "t", ["1", "2", "original"]), "scene");
  const snapshot = document.clone();
  document.delete("scene");
  assert.deepEqual(document.children, []);
  assert.equal(snapshot.find("t").describe(), 'text#t (1,2) "original"');
  assert.equal(snapshot.find("t").parentId, "scene");
  document.create(snapshot.find("scene"));
  document.find("t").set("text", "restored and edited");
  assert.equal(snapshot.find("t").describe(), 'text#t (1,2) "original"');
  snapshot.delete("t");
  assert.equal(document.find("t").describe(), 'text#t (1,2) "restored and edited"');
  assert.deepEqual(snapshot.find("scene").children, []);
});

test("group transformations preserve indexed node identities and reject overflow before any edit", () => {
  const document = new SvgDocument();
  document.create(shape("g", "outer"));
  document.create(shape("g", "inner"), "outer");
  document.create(shape("circle", "ordinary", ["1", "2", "3"]), "outer");
  document.create(shape("line", "huge", ["1e308", "2", "1e308", "4"]), "inner");
  const outer = document.find("outer");
  const inner = document.find("inner");
  const ordinary = document.find("ordinary");
  const huge = document.find("huge");
  const before = descriptions(document);
  assert.throws(() => outer.move(1e308, 1), /invalid number/);
  assert.throws(() => outer.scale(2), /invalid number/);
  assert.deepEqual(descriptions(document), before);
  assert.equal(document.find("outer"), outer);
  assert.equal(document.find("inner"), inner);
  assert.equal(document.find("ordinary"), ordinary);
  assert.equal(document.find("huge"), huge);
  outer.move(0, 1);
  outer.scale(0.5);
  assert.equal(document.find("ordinary"), ordinary);
  assert.equal(document.find("huge"), huge);
  assert.equal(ordinary.describe(), "circle#ordinary cx=0.5 cy=1.5 r=1.5");
  assert.equal(huge.position(), "(5e+307,1.5) -> (5e+307,2.5)");
});

test("moderately deep chains support repeated atomic transforms without rebuilding indexed nodes", { timeout: 5_000 }, () => {
  let branch = shape("circle", "tip", ["1", "2", "3"]);
  for (let index = 95; index >= 0; index -= 1) {
    branch = shape("g", `level-${index}`).withChild(branch);
  }
  const document = new SvgDocument();
  document.create(branch);
  const root = document.find("level-0");
  const tip = document.find("tip");
  for (let count = 0; count < 100; count += 1) {
    root.move(1, -1);
    root.scale(2);
    root.scale(0.5);
    root.move(-1, 1);
  }
  assert.equal(document.find("tip"), tip);
  assert.equal(tip.describe(), "circle#tip cx=1 cy=2 r=3");
  assert.equal(tip.parentId, "level-95");
  const before = tip.describe();
  assert.throws(() => root.move(Infinity, 0), /invalid number/);
  assert.equal(tip.describe(), before);
});

test("replacing a nested group preserves hierarchy, order, styles and independent tree ownership", () => {
  const target = shape("g", "target").withChild(shape("circle", "old", ["1", "2", "3"]));
  target.set("fill", "orange");
  const inner = shape("g", "inner")
    .withChild(shape("circle", "before", ["4", "5", "6"]))
    .withChild(target)
    .withChild(shape("circle", "after", ["7", "8", "9"]));
  inner.set("stroke", "gray");
  const outer = shape("g", "outer")
    .withChild(shape("circle", "head", ["10", "20", "30"]))
    .withChild(inner)
    .withChild(shape("circle", "tail", ["40", "50", "60"]));
  outer.set("fill", "blue");
  outer.set("stroke-width", "2");
  const original = new SvgDocument();
  original.create(shape("g", "scene"));
  original.create(outer, "scene");
  const before = descriptions(original);

  const donor = new SvgDocument();
  donor.create(shape("g", "donor"));
  donor.create(shape("g", "target"), "donor");
  donor.create(shape("text", "new-label", ["15", "25", "replacement"]), "target");
  donor.create(shape("g", "new-nested"), "target");
  donor.create(shape("circle", "new-circle", ["35", "45", "5"]), "new-nested");
  donor.find("target").set("fill", "purple");
  donor.find("target").set("stroke-width", "3");
  const incoming = descriptions(donor);
  const replacement = donor.find("target");
  const result = original.find("outer").replaceNode("target", replacement);
  const flatten = (node: Shape): readonly Shape[] => [node, ...node.children.flatMap(flatten)];
  const resultNodes = new Map(flatten(result).map((node) => [node.id, node]));
  const expectedParents: Readonly<Record<string, string>> = {
    outer: "scene", head: "outer", inner: "outer", before: "inner", target: "inner",
    "new-label": "target", "new-nested": "target", "new-circle": "new-nested",
    after: "inner", tail: "outer",
  };
  assert.deepEqual([...resultNodes.keys()], Object.keys(expectedParents));
  for (const [id, parent] of Object.entries(expectedParents)) {
    assert.equal(resultNodes.get(id)?.parentId, parent, id);
  }
  assert.deepEqual(result.children.map((node) => node.id), ["head", "inner", "tail"]);
  assert.deepEqual(resultNodes.get("inner")?.children.map((node) => node.id), ["before", "target", "after"]);
  assert.equal(result.describe(), "g#outer fill=blue stroke-width=2");
  assert.equal(resultNodes.get("inner")?.describe(), "g#inner stroke=gray");
  assert.equal(resultNodes.get("target")?.describe(), "g#target fill=purple stroke-width=3");
  assert.equal(resultNodes.get("new-label")?.describe(), 'text#new-label (15,25) "replacement"');
  assert.deepEqual(descriptions(original), before);
  assert.deepEqual(descriptions(donor), incoming);
  assert.notEqual(resultNodes.get("target"), replacement);
  assert.notEqual(resultNodes.get("head"), original.find("head"));

  result.set("fill", "green");
  resultNodes.get("inner")!.set("stroke", "black");
  resultNodes.get("head")!.move(1, 2);
  resultNodes.get("new-label")!.set("text", "result only");
  resultNodes.get("new-circle")!.scale(2);
  assert.deepEqual(descriptions(original), before);
  assert.deepEqual(descriptions(donor), incoming);

  original.find("tail").move(100, 200);
  original.find("inner").set("stroke", "red");
  donor.find("new-label").set("text", "donor only");
  donor.find("new-circle").move(10, 20);
  replacement.set("fill", "yellow");
  assert.equal(resultNodes.get("tail")?.describe(), "circle#tail cx=40 cy=50 r=60");
  assert.equal(resultNodes.get("inner")?.describe(), "g#inner stroke=black");
  assert.equal(resultNodes.get("new-label")?.describe(), 'text#new-label (15,25) "result only"');
  assert.equal(resultNodes.get("new-circle")?.describe(), "circle#new-circle cx=70 cy=90 r=10");
  assert.equal(resultNodes.get("target")?.describe(), "g#target fill=purple stroke-width=3");
});

test("deep replacement keeps leaf-copy work proportional to the resulting tree", (context) => {
  const clone = context.mock.method(Circle.prototype, "clone");
  const measurements: { depth: number; leaves: number; copies: number }[] = [];
  for (const depth of [4, 16, 48]) {
    let branch = shape("circle", "target", ["1", "2", "3"]);
    for (let index = depth - 1; index >= 0; index -= 1) {
      branch = shape("g", `level-${index}`)
        .withChild(shape("circle", `side-${index}`, ["4", "5", "6"]))
        .withChild(branch);
    }
    const replacement = shape("circle", "target", ["7", "8", "9"]);
    clone.mock.resetCalls();
    const result = branch.replaceNode("target", replacement);
    measurements.push({ depth, leaves: depth + 1, copies: clone.mock.callCount() });
    assert.equal(result.children[0]?.parentId, "level-0");
    assert.equal(branch.children[0]?.parentId, "level-0");
  }
  context.diagnostic(`leaf-copy counts: ${measurements.map(({ depth, leaves, copies }) => `depth ${depth}: ${copies} copies / ${leaves} leaves`).join("; ")}`);
  for (const { depth, leaves, copies } of measurements) {
    assert.ok(copies <= leaves * 2,
      `depth ${depth}: ${copies} leaf copies for ${leaves} output leaves exceeds the linear copy budget`);
  }
});
