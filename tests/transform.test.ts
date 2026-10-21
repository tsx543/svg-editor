import assert from "node:assert/strict";
import test from "node:test";
import { PositionalShapeInput } from "../src/model/PositionalShapeInput.js";
import type { Shape } from "../src/model/Shape.js";
import { ShapeFactory } from "../src/model/ShapeFactory.js";
import { SvgDocument } from "../src/model/SvgDocument.js";
import { Transform } from "../src/model/Transform.js";

const factory = new ShapeFactory();
function node(kind: string, id: string, args: readonly string[] = [], transform?: string): Shape {
  const shape = factory.create(kind, id, new PositionalShapeInput(args));
  if (transform) shape.importSvgAttributes(new Map([["transform", transform]]));
  return shape;
}
function fixture(): SvgDocument {
  const document = new SvgDocument();
  document.create(node("g", "outer", [], "translate(60,40) scale(2)"));
  document.create(node("g", "inner", [], "translate(20,10) scale(0.5)"), "outer");
  document.create(node("rect", "r", ["10", "20", "30", "40"], "translate(5,3) scale(0.5)"), "inner");
  document.create(node("text", "t", ["10", "20", "标题"]), "inner");
  document.find("t").importSvgAttributes(new Map([["font-size", "16"], ["text-anchor", "middle"], ["stroke-width", "2"]]));
  document.create(node("g", "target", [], "translate(-20,30) scale(4)"));
  return document;
}
function approximately(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) <= 1e-10 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
}

test("Transform preserves SVG operation order, nested composition and inversion", () => {
  const transform = Transform.parse("translate(60,40) scale(2) translate(20,10) scale(.5)");
  assert.deepEqual(transform.point(10, 20), [110, 80]);
  assert.deepEqual(transform.inverse().point(110, 80), [10, 20]);
  assert.deepEqual(Transform.parse("scale(2) translate(10,20)").point(1, 1), [22, 42]);
  assert.deepEqual(Transform.parse(transform.toSvg()).point(10, 20), [110, 80]);
  assert.deepEqual(Transform.parse("translate(10) scale(2,2)").point(1, 1), [12, 2]);
  assert.deepEqual(Transform.parse(" \ttranslate(10) , scale(2) \n").point(1, 1), [12, 2]);
});

test("Transform rejects unsupported/nonuniform transforms, nonfinite values and nonpositive scales", () => {
  for (const source of ["", "rotate(10)", "skewX(10)", "matrix(1,0,0,1,0,0)", "scale(2,3)", "scale(0)", "scale(-1)", "translate(1px,2)", "translate(NaN)", "scale(1e999)", "translate(1) garbage", ",translate(1)", "translate(1),,scale(2)", "translate(1), ,scale(2)", "translate(1),", "translate(1)scale(2)", "translate(1)\u00a0scale(2)", "translate(\u00a01,2)", "translate\u00a0(1,2)", "translate(1,\u00a02)"]) {
    assert.throws(() => Transform.parse(source));
  }
  const original = new Transform(2, 3, 4);
  original.compose(new Transform(3, 5, 6));
  assert.deepEqual(original.point(1, 1), [5, 6]);
});

test("world-coordinate movement accounts for all ancestor and local scales and preserves indexed identities", () => {
  const document = fixture();
  const rect = document.find("r");
  assert.equal(document.position("r"), "(110,73)");
  document.move("r", 10, 20);
  assert.equal(document.position("r"), "(120,93)");
  assert.equal(rect.position(), "(30,60)");
  assert.equal(document.find("r"), rect);
  document.move("inner", -10, -20);
  assert.equal(document.position("r"), "(110,73)");
  assert.equal(document.position("t"), "(100,60)");
  assert.equal(document.position("inner"), null);
});

test("world-origin scaling changes geometry and positions while leaving font and stroke styles unchanged", () => {
  const document = fixture();
  const before = document.worldTransform("r");
  document.scale("inner", 2);
  assert.equal(document.position("r"), "(220,146)");
  assert.equal(document.position("t"), "(220,160)");
  assert.equal(document.find("r").svgAttributes().get("width"), "60");
  assert.equal(document.find("r").svgAttributes().get("height"), "80");
  assert.equal(document.find("t").svgAttributes().get("font-size"), "16");
  assert.equal(document.find("t").svgAttributes().get("stroke-width"), "2");
  assert.equal(document.worldTransform("r").factor, before.factor);
  assert.equal(document.find("outer").svgAttributes().get("transform"), "translate(60,40) scale(2)");
});

test("world edits keep legacy no-transform geometry semantics and isolate unselected siblings", () => {
  const document = new SvgDocument();
  document.create(node("g", "g"));
  document.create(node("rect", "r", ["1", "2", "3", "4"]), "g");
  document.create(node("circle", "c", ["10", "20", "5"]));
  document.move("g", 2, 3);
  document.scale("g", 2);
  assert.equal(document.find("r").describe(), "rect#r x=6 y=10 w=6 h=8");
  assert.equal(document.find("c").describe(), "circle#c cx=10 cy=20 r=5");
});

test("group/addTo/ungroup compensate changed parent transforms without changing world geometry or scale", () => {
  const document = fixture();
  const original = new Map(["r", "t"].map((id) => [id, { position: document.position(id), transform: document.worldTransform(id) }]));
  document.group("selected", ["t", "r"]);
  document.addTo("target", "selected");
  for (const id of ["r", "t"]) {
    assert.equal(document.position(id), original.get(id)!.position);
    approximately(document.worldTransform(id).factor, original.get(id)!.transform.factor);
  }
  document.ungroup("selected");
  for (const id of ["r", "t"]) {
    assert.equal(document.find(id).parentId, "target");
    assert.equal(document.position(id), original.get(id)!.position);
    approximately(document.worldTransform(id).factor, original.get(id)!.transform.factor);
  }
  document.addTo("outer", "r");
  assert.equal(document.position("r"), original.get("r")!.position);
  approximately(document.worldTransform("r").factor, original.get("r")!.transform.factor);
});

test("ungrouping a transformed group transfers its transform to children and keeps grandchildren coherent", () => {
  const document = fixture();
  const before = document.position("r");
  const factor = document.worldTransform("r").factor;
  document.ungroup("inner");
  assert.equal(document.position("r"), before);
  assert.equal(document.find("r").parentId, "outer");
  assert.equal(document.worldTransform("r").factor, factor);
});

test("overflow world edits and impossible reparenting fail atomically", () => {
  const document = new SvgDocument();
  document.create(node("g", "g"));
  document.create(node("rect", "r", ["5e307", "2", "3", "4"], "scale(2)"), "g");
  document.create(node("rect", "normal", ["1", "2", "3", "4"]), "g");
  const group = document.find("g");
  const rect = document.find("r");
  const before = document.position("r");
  assert.throws(() => document.scale("g", 2), /invalid number/);
  assert.throws(() => document.move("g", 1e308, 0), /invalid number/);
  assert.equal(document.find("g"), group);
  assert.equal(document.find("r"), rect);
  assert.equal(document.position("r"), before);
  assert.equal(document.find("normal").position(), "(1,2)");
  document.create(node("g", "tiny", [], "scale(1e-320)"));
  const old = document.find("r");
  assert.throws(() => document.addTo("tiny", "r"), /invalid number|must be positive/);
  assert.equal(document.find("r"), old);
  assert.equal(old.parentId, "g");
});

test("reparenting under identical extreme transforms avoids an unnecessary overflowing inverse", () => {
  for (const transform of ["translate(1e308,0) scale(1e-10)", "scale(1e-320)"]) {
    const document = new SvgDocument();
    document.create(node("g", "left", [], transform));
    document.create(node("g", "right", [], transform));
    document.create(node("rect", "r", ["1", "1", "1", "1"]), "left");
    document.create(node("text", "t", ["2", "2", "label"]), "left");
    const before = document.position("r");
    const factor = document.worldTransform("r").factor;
    document.addTo("right", "r");
    assert.equal(document.find("r").parentId, "right");
    assert.equal(document.position("r"), before);
    assert.equal(document.worldTransform("r").factor, factor);
    document.addTo("left", "r");
    document.group("bundle", ["r", "t"]);
    document.ungroup("bundle");
    assert.equal(document.position("r"), before);
    assert.equal(document.worldTransform("r").factor, factor);
    assert.equal(document.find("r").parentId, "left");
  }
});

test("world edits traverse a deep wide subtree a constant number of times", (t) => {
  const depth = 64;
  const width = 64;
  const groups = Array.from({ length: depth }, (_, index) => node("g", `g-${index}`, [], "translate(1,2)"));
  const leaves = Array.from({ length: width }, (_, index) => node("rect", `r-${index}`, [String(index), "1", "3", "4"]));
  const children = new Map<string, readonly Shape[]>();
  for (let index = 0; index < depth; index += 1) children.set(groups[index]!.id, groups[index + 1] ? [groups[index + 1]!] : leaves);
  const document = SvgDocument.fromTree(800, 600, [groups[0]!], { childrenOf: (shape) => children.get(shape.id) ?? [] });
  const leaf = document.find("r-0");
  const n = depth + width;
  const originalCompose = Transform.prototype.compose;
  let compositions = 0;
  Transform.prototype.compose = function (this: Transform, local: Transform): Transform {
    compositions += 1;
    return originalCompose.call(this, local);
  };
  let moveCount: number;
  let scaleCount: number;
  try {
    document.move("g-0", 3, 4);
    moveCount = compositions;
    compositions = 0;
    document.scale("g-0", 2);
    scaleCount = compositions;
  } finally {
    Transform.prototype.compose = originalCompose;
  }
  assert.ok(moveCount! <= 6 * n + 10);
  assert.ok(scaleCount! <= 6 * n + 10);
  assert.equal(document.position("r-0"), "(134,266)");
  assert.equal(document.find("r-0"), leaf);
  assert.equal(leaf.svgAttributes().get("width"), "6");
  t.diagnostic(`world-edit subtree n=${n}: move compositions=${moveCount!}, scale compositions=${scaleCount!}`);
});
