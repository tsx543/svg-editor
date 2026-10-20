import assert from "node:assert/strict";
import test from "node:test";
import { Group } from "../src/model/Group.js";
import { PositionalShapeInput } from "../src/model/PositionalShapeInput.js";
import { Rect } from "../src/model/Rect.js";
import { Shape } from "../src/model/Shape.js";
import { ShapeFactory } from "../src/model/ShapeFactory.js";
import { SvgDocument } from "../src/model/SvgDocument.js";
import { TreeAnalysis } from "../src/model/TreeAnalysis.js";

const factory = new ShapeFactory();

function shape(kind: string, id: string, args: readonly string[] = []): Shape {
  return factory.create(kind, id, new PositionalShapeInput(args));
}

function rect(id: string): Shape {
  return shape("rect", id, ["1", "2", "3", "4"]);
}

function ids(nodes: readonly Shape[]): readonly string[] {
  return nodes.map((node) => node.id);
}

function assertCoherent(document: SvgDocument): void {
  const seen = new Set<string>();
  function visit(nodes: readonly Shape[], parentId: string | null): void {
    for (const node of nodes) {
      assert.equal(seen.has(node.id), false, `duplicate id: ${node.id}`);
      seen.add(node.id);
      assert.equal(node.parentId, parentId);
      assert.equal(document.find(node.id), node);
      visit(node.children, node.id);
    }
  }
  visit(document.children, null);
}

function nestedFixture(): SvgDocument {
  const document = new SvgDocument();
  document.create(shape("g", "scene"));
  document.create(rect("before"), "scene");
  document.create(shape("g", "left"), "scene");
  document.create(rect("middle"), "scene");
  document.create(shape("g", "right"), "scene");
  document.create(rect("after"), "scene");
  document.create(rect("left-a"), "left");
  document.create(rect("left-b"), "left");
  document.create(rect("right-a"), "right");
  document.create(rect("right-b"), "right");
  return document;
}

function budget(operation: () => void): { copies: number; groupClones: number; childReads: number; relationReads: number } {
  const counts = { copies: 0, groupClones: 0, childReads: 0, relationReads: 0 };
  const originalRectClone = Rect.prototype.clone;
  const originalGroupClone = Group.prototype.clone;
  const originalNode = TreeAnalysis.prototype.node;
  const baseChildren = Object.getOwnPropertyDescriptor(Shape.prototype, "children")!;
  const groupChildren = Object.getOwnPropertyDescriptor(Group.prototype, "children")!;
  Rect.prototype.clone = function (this: Rect, parentId?: string | null): Rect {
    counts.copies += 1;
    return originalRectClone.call(this, parentId);
  };
  Group.prototype.clone = function (this: Group, parentId?: string | null): Group {
    counts.groupClones += 1;
    return originalGroupClone.call(this, parentId);
  };
  TreeAnalysis.prototype.node = function (this: TreeAnalysis, id: string) {
    counts.relationReads += 1;
    return originalNode.call(this, id);
  };
  Object.defineProperty(Shape.prototype, "children", {
    ...baseChildren,
    get(this: Shape): readonly Shape[] {
      counts.childReads += 1;
      return baseChildren.get!.call(this) as readonly Shape[];
    },
  });
  Object.defineProperty(Group.prototype, "children", {
    ...groupChildren,
    get(this: Group): readonly Shape[] {
      counts.childReads += 1;
      return groupChildren.get!.call(this) as readonly Shape[];
    },
  });
  try {
    operation();
  } finally {
    Rect.prototype.clone = originalRectClone;
    Group.prototype.clone = originalGroupClone;
    TreeAnalysis.prototype.node = originalNode;
    Object.defineProperty(Shape.prototype, "children", baseChildren);
    Object.defineProperty(Group.prototype, "children", groupChildren);
  }
  return counts;
}

test("group uses document order and reuses the first selected sibling's position", () => {
  const document = new SvgDocument();
  for (const id of ["before", "a", "middle", "b", "after"]) document.create(rect(id));
  document.group("selected", ["b", "a"]);
  assert.deepEqual(ids(document.children), ["before", "selected", "middle", "after"]);
  assert.deepEqual(ids(document.find("selected").children), ["a", "b"]);
  assert.equal(document.find("a").parentId, "selected");
  assertCoherent(document);
});

test("cross-parent group goes into the lowest common ancestor before a retained earliest branch", () => {
  const document = nestedFixture();
  document.group("selected", ["right-a", "left-b"]);
  assert.deepEqual(ids(document.children), ["scene"]);
  assert.deepEqual(ids(document.find("scene").children), ["before", "selected", "left", "middle", "right", "after"]);
  assert.deepEqual(ids(document.find("selected").children), ["left-b", "right-a"]);
  assert.deepEqual(ids(document.find("left").children), ["left-a"]);
  assert.deepEqual(ids(document.find("right").children), ["right-b"]);
  assert.equal(document.find("selected").parentId, "scene");
  assertCoherent(document);
});

test("cross-root group occupies the root-level branch position and keeps emptied former groups", () => {
  const document = new SvgDocument();
  document.create(rect("before"));
  document.create(shape("g", "left"));
  document.create(shape("g", "right"));
  document.create(rect("a"), "left");
  document.create(rect("b"), "right");
  document.group("selected", ["b", "a"]);
  assert.deepEqual(ids(document.children), ["before", "selected", "left", "right"]);
  assert.deepEqual(document.find("left").children, []);
  assert.deepEqual(document.find("right").children, []);
  assert.equal(document.find("selected").parentId, null);
  assert.deepEqual(ids(document.find("selected").children), ["a", "b"]);
  assertCoherent(document);
});

test("grouping a whole branch with another branch's descendant preserves independent subtree order", () => {
  const document = nestedFixture();
  document.group("selected", ["right-b", "left"]);
  assert.deepEqual(ids(document.find("scene").children), ["before", "selected", "middle", "right", "after"]);
  assert.deepEqual(ids(document.find("selected").children), ["left", "right-b"]);
  assert.deepEqual(ids(document.find("left").children), ["left-a", "left-b"]);
  assert.deepEqual(ids(document.find("right").children), ["right-a"]);
  assertCoherent(document);
});

test("group validation is atomic for duplicate names, missing ids, invalid names and ancestor selections", () => {
  const cases: readonly [string, readonly string[], string][] = [
    ["scene", ["left-a", "right-a"], "id already exists: scene"],
    ["new", ["left-a"], "group requires at least two shapes"],
    ["new", ["left-a", "left-a"], "duplicate shape id: left-a"],
    ["new", ["left-a", "missing"], "no such shape: missing"],
    ["bad id", ["left-a", "right-a"], "invalid id: bad id"],
    ["new", ["left-a", "left"], "cannot group a container into its own descendant: left"],
    ["new", ["right-a", "scene"], "cannot group a container into its own descendant: scene"],
  ];
  for (const [name, selected, message] of cases) {
    const document = nestedFixture();
    const scene = document.find("scene");
    const original = document.find("left-a");
    const before = ids(scene.children);
    assert.throws(() => document.group(name, selected), { message });
    assert.equal(document.find("scene"), scene);
    assert.equal(document.find("left-a"), original);
    assert.deepEqual(ids(scene.children), before);
    assertCoherent(document);
  }
});

test("ungroup lifts children into exactly the former group slot and releases the group id", () => {
  const document = nestedFixture();
  document.ungroup("left");
  assert.deepEqual(ids(document.find("scene").children), ["before", "left-a", "left-b", "middle", "right", "after"]);
  assert.equal(document.find("left-a").parentId, "scene");
  assert.equal(document.find("left-b").parentId, "scene");
  assert.throws(() => document.find("left"), { message: "no such shape: left" });
  document.create(shape("g", "left"), "scene");
  document.ungroup("left");
  assert.deepEqual(ids(document.find("scene").children), ["before", "left-a", "left-b", "middle", "right", "after"]);
  assertCoherent(document);
});

test("ungroup refuses roots, leaves and missing ids without replacing original nodes", () => {
  const document = nestedFixture();
  const scene = document.find("scene");
  const leaf = document.find("left-a");
  assert.throws(() => document.ungroup("scene"), { message: "cannot ungroup top-level container: scene" });
  assert.throws(() => document.ungroup("left-a"), { message: "not a container: left-a" });
  assert.throws(() => document.ungroup("missing"), { message: "no such shape: missing" });
  assert.equal(document.find("scene"), scene);
  assert.equal(document.find("left-a"), leaf);
  assertCoherent(document);
});

test("addTo appends complete subtrees, normalizes parents and moves existing children to the end", () => {
  const document = nestedFixture();
  document.addTo("right", "left-a");
  assert.deepEqual(ids(document.find("left").children), ["left-b"]);
  assert.deepEqual(ids(document.find("right").children), ["right-a", "right-b", "left-a"]);
  document.addTo("right", "right-a");
  assert.deepEqual(ids(document.find("right").children), ["right-b", "left-a", "right-a"]);
  document.addTo("right", "left");
  assert.deepEqual(ids(document.find("right").children), ["right-b", "left-a", "right-a", "left"]);
  assert.equal(document.find("left").parentId, "right");
  assert.equal(document.find("left-b").parentId, "left");
  assert.deepEqual(ids(document.find("scene").children), ["before", "middle", "right", "after"]);
  assertCoherent(document);
});

test("addTo rejects self/descendant cycles and invalid targets before changing identities", () => {
  const document = nestedFixture();
  const scene = document.find("scene");
  const left = document.find("left");
  assert.throws(() => document.addTo("left", "left"), { message: "cannot move a container into its own descendant: left" });
  assert.throws(() => document.addTo("left", "scene"), { message: "cannot move a container into its own descendant: scene" });
  assert.throws(() => document.addTo("left-a", "right"), { message: "not a container: left-a" });
  assert.throws(() => document.addTo("missing", "left"), { message: "no such shape: missing" });
  assert.throws(() => document.addTo("left", "missing"), { message: "no such shape: missing" });
  assert.equal(document.find("scene"), scene);
  assert.equal(document.find("left"), left);
  assertCoherent(document);
});

test("front/back only change sibling order, including SVG root order", () => {
  const document = nestedFixture();
  document.front("before");
  assert.deepEqual(ids(document.find("scene").children), ["left", "middle", "right", "after", "before"]);
  assert.deepEqual(ids(document.find("left").children), ["left-a", "left-b"]);
  document.back("after");
  assert.deepEqual(ids(document.find("scene").children), ["after", "left", "middle", "right", "before"]);
  document.create(rect("root-second"));
  document.front("scene");
  assert.deepEqual(ids(document.children), ["root-second", "scene"]);
  document.back("scene");
  assert.deepEqual(ids(document.children), ["scene", "root-second"]);
  const original = document.find("scene");
  assert.throws(() => document.front("missing"), { message: "no such shape: missing" });
  assert.throws(() => document.back("missing"), { message: "no such shape: missing" });
  assert.equal(document.find("scene"), original);
  assertCoherent(document);
});

test("structure rebuilding keeps old nodes, snapshots, styles and outside replacements independent", () => {
  const document = nestedFixture();
  document.find("left").set("fill", "blue");
  document.find("left-a").set("stroke", "red");
  const before = document.clone();
  const oldNode = document.find("left-a");
  document.group("selected", ["right-a", "left"]);
  oldNode.move(100, 100);
  assert.equal(document.find("left-a").position(), "(1,2)");
  assert.equal(document.find("left").describe(), "g#left fill=blue");
  assert.match(document.find("left-a").describe(), /stroke=red/);
  document.find("left-a").set("stroke", "black");
  assert.match(before.find("left-a").describe(), /stroke=red/);
  assert.equal(before.find("left").parentId, "scene");

  const outside = rect("outside");
  const copied = before.find("left").rebuild(null, {
    childrenOf(node): readonly Shape[] { return node.id === "left" ? [outside] : node.children; },
  });
  outside.move(20, 20);
  assert.equal(copied.children[0]!.position(), "(1,2)");
  copied.children[0]!.set("fill", "green");
  assert.doesNotMatch(outside.describe(), /fill=green/);
  const publicChildren = copied.children as Shape[];
  publicChildren.pop();
  assert.equal(copied.children.length, 1);
  assertCoherent(document);
  assertCoherent(before);
});

test("wide many-selection grouping keeps copying and tree reads within linear budgets", (t) => {
  const document = new SvgDocument();
  const width = 240;
  for (let index = 0; index < width; index += 1) document.create(rect(`r-${index}`));
  const selected = Array.from({ length: width / 2 }, (_, index) => `r-${index * 2}`).reverse();
  const counts = budget(() => document.group("selected", selected));
  assert.ok(counts.copies <= 2 * width, JSON.stringify(counts));
  assert.ok(counts.groupClones <= 2, JSON.stringify(counts));
  assert.ok(counts.childReads <= 3 * width + 10, JSON.stringify(counts));
  assert.ok(counts.relationReads <= 4 * width + 2 * selected.length + 10, JSON.stringify(counts));
  t.diagnostic(`wide group: n=${width}, k=${selected.length}, ${JSON.stringify(counts)}`);
  assert.deepEqual(ids(document.find("selected").children), [...selected].reverse());
  assertCoherent(document);
});

test("deep structure operations rebuild once rather than recursively cloning rebuilt subtrees", (t) => {
  const depth = 120;
  let branch = rect("tip");
  for (let level = depth - 1; level >= 0; level -= 1) {
    branch = shape("g", `level-${level}`).withChild(branch);
  }
  const document = new SvgDocument();
  document.create(branch);
  document.create(rect("outside"));
  const total = depth + 2;
  for (const operation of [
    () => document.group("selected", ["outside", "tip"]),
    () => document.addTo("level-0", "selected"),
    () => document.ungroup("selected"),
    () => document.front("level-0"),
    () => document.back("level-0"),
  ]) {
    const counts = budget(operation);
    assert.ok(counts.copies <= 2 * 2, JSON.stringify(counts));
    assert.ok(counts.groupClones <= 2 * (depth + 1), JSON.stringify(counts));
    assert.ok(counts.childReads <= 3 * (total + 1) + 10, JSON.stringify(counts));
    assert.ok(counts.relationReads <= 4 * (total + 1) + 10, JSON.stringify(counts));
    t.diagnostic(`deep operation ${operation.toString()}: depth=${depth}, ${JSON.stringify(counts)}`);
    assertCoherent(document);
  }
  assert.equal(document.find("tip").parentId, "level-0");
  assert.equal(document.find("outside").parentId, "level-0");
});

test("deep ancestry combined with many selections keeps relation access and copying linear", (t) => {
  const depth = 64;
  const width = 96;
  let branch = shape("g", "junction");
  for (let index = 0; index < width; index += 1) branch = branch.withChild(rect(`leaf-${index}`));
  for (let level = depth - 1; level >= 0; level -= 1) {
    branch = shape("g", `trunk-${level}`).withChild(branch);
  }
  const document = new SvgDocument();
  document.create(branch);
  document.create(rect("outside"));
  const selection = ["outside", ...Array.from({ length: width / 2 }, (_, index) => `leaf-${index * 2}`).reverse()];
  const n = depth + width + 2;
  const counts = budget(() => document.group("selected", selection));
  assert.ok(counts.copies <= 2 * (width + 1), JSON.stringify(counts));
  assert.ok(counts.groupClones <= 2 * (depth + 2), JSON.stringify(counts));
  assert.ok(counts.childReads <= 3 * n + 10, JSON.stringify(counts));
  assert.ok(counts.relationReads <= 4 * n + 2 * selection.length + 10, JSON.stringify(counts));
  t.diagnostic(`deep many-select group: n=${n}, k=${selection.length}, ${JSON.stringify(counts)}`);
  assert.deepEqual(ids(document.children), ["selected", "trunk-0"]);
  assert.deepEqual(ids(document.find("selected").children), [...selection.slice(1)].reverse().concat("outside"));
  assert.equal(document.find("junction").children.length, width / 2);
  assertCoherent(document);
});

test("legacy replaceNode keeps linear copying and replacement/source independence on a deep chain", () => {
  let branch = rect("tip");
  for (let level = 79; level >= 0; level -= 1) branch = shape("g", `level-${level}`).withChild(branch);
  const replacement = shape("rect", "tip", ["5", "6", "7", "8", "red"]);
  let result: Shape | undefined;
  const counts = budget(() => { result = branch.replaceNode("tip", replacement); });
  assert.ok(counts.copies <= 2, JSON.stringify(counts));
  assert.ok(counts.groupClones <= 2 * 80, JSON.stringify(counts));
  const document = new SvgDocument();
  document.create(result!);
  replacement.move(100, 100);
  assert.equal(document.find("tip").position(), "(5,6)");
  assert.equal(document.find("tip").parentId, "level-79");
  const original = new SvgDocument();
  original.create(branch);
  assert.equal(original.find("tip").position(), "(1,2)");
  assertCoherent(document);
});
