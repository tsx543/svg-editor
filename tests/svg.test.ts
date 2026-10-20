import assert from "node:assert/strict";
import test from "node:test";
import type { FileStore } from "../src/application/contracts/FileStore.js";
import { PositionalShapeInput } from "../src/model/PositionalShapeInput.js";
import { Group } from "../src/model/Group.js";
import { Rect } from "../src/model/Rect.js";
import { ShapeFactory } from "../src/model/ShapeFactory.js";
import type { Shape } from "../src/model/Shape.js";
import { SvgDocument } from "../src/model/SvgDocument.js";
import { SvgCodec } from "../src/svg/SvgCodec.js";
import { SvgDocumentGateway } from "../src/svg/SvgDocumentGateway.js";

const codec = new SvgCodec();

function outline(document: SvgDocument): readonly string[] {
  const lines: string[] = [];
  function visit(shape: Shape): void {
    lines.push(`${shape.parentId ?? "svg"}/${shape.describe()}`);
    for (const child of shape.children) visit(child);
  }
  for (const child of document.children) visit(child);
  return lines;
}

function rejects(source: string): void {
  assert.throws(() => codec.decode(source), /^Error: invalid SVG: /u);
}

test("the teacher's six-type external SVG imports with buffered missing-id warnings", () => {
  const source = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect x="0" y="0" width="400" height="300" fill="#ffffff"/>
  <text id="t1" x="10" y="290">imported</text>
  <circle id="c1" cx="50" cy="50" r="10"/>
  <g id="g1"><rect id="r2" x="0" y="0" width="10" height="10"/>
    <circle id="c2" cx="5" cy="5" r="2"/></g>
  <ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>
</svg>`;
  const loaded = codec.decode(source);
  assert.equal(loaded.document.width, 400);
  assert.equal(loaded.document.height, 300);
  assert.equal(loaded.document.elementCount, 7);
  assert.deepEqual(loaded.warnings, ["warning: assigned id rect1 to unnamed <rect>"]);
  assert.equal(loaded.document.find("r2").parentId, "g1");
  assert.equal(loaded.document.find("t1").svgText(), "imported");
  const saved = codec.encode(loaded.document);
  const again = codec.decode(saved);
  assert.deepEqual(again.warnings, []);
  assert.deepEqual(outline(again.document), outline(loaded.document));
  assert.equal(codec.encode(again.document), saved);
});

test("the teacher's minimal grouped diagram can be saved and read back", () => {
  const { document } = codec.decode(`<svg width="400" height="200" viewBox="0 0 400 200">
<g id="flow"><rect id="start" x="30" y="70" width="120" height="60" fill="#4a90d9"/>
<line id="edge" x1="150" y1="100" x2="250" y2="100" stroke="black"/>
<rect id="end" x="250" y="70" width="120" height="60" fill="#f5a623"/></g></svg>`);
  assert.equal(document.elementCount, 4);
  assert.deepEqual(document.find("flow").children.map((shape) => shape.id), ["start", "edge", "end"]);
  assert.deepEqual(outline(codec.decode(codec.encode(document)).document), outline(document));
});

test("the teacher's nested-transform example preserves transforms and text presentation", () => {
  const { document, warnings } = codec.decode(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
<g id="diagram" transform="translate(60,40)">
  <rect id="a" x="0" y="0" width="120" height="60" fill="#4a90d9"/>
  <line id="e" x1="120" y1="30" x2="200" y2="30" stroke="black"/>
  <g id="nodeB" transform="translate(200,0) scale(0.8)">
    <rect x="0" y="0" width="120" height="60" fill="#f5a623"/>
    <text x="60" y="38" text-anchor="middle" font-size="16" fill="white">End</text>
  </g>
</g></svg>`);
  assert.deepEqual(warnings, [
    "warning: assigned id rect1 to unnamed <rect>",
    "warning: assigned id text1 to unnamed <text>",
  ]);
  assert.equal(document.elementCount, 6);
  assert.ok(document.find("diagram").svgAttributes().has("transform"));
  assert.ok(document.find("nodeB").svgAttributes().has("transform"));
  assert.equal(document.find("text1").svgAttributes().get("font-size"), "16");
  assert.equal(document.find("text1").svgAttributes().get("text-anchor"), "middle");
  assert.equal(document.find("text1").svgText(), "End");
  const saved = codec.encode(document);
  const again = codec.decode(saved);
  assert.equal(codec.encode(again.document), saved);
  assert.equal(again.document.find("text1").parentId, "nodeB");
});

test("ID assignment reserves all explicit IDs before traversing unnamed shapes", () => {
  const loaded = codec.decode(`<svg id="rect1"><rect/><g><rect id="rect2"/><circle id="Circle1"/>
<circle/><rect/></g><g id="g1"/></svg>`);
  assert.deepEqual(loaded.warnings, [
    "warning: assigned id rect3 to unnamed <rect>",
    "warning: assigned id g2 to unnamed <g>",
    "warning: assigned id circle1 to unnamed <circle>",
    "warning: assigned id rect4 to unnamed <rect>",
  ]);
  assert.equal(loaded.document.find("rect4").parentId, "g2");
  assert.equal(loaded.document.find("circle1").id, "circle1");
  assert.equal(loaded.document.find("Circle1").id, "Circle1");
  assert.equal(loaded.document.svgAttributes().get("id"), "rect1");
});

test("duplicate and explicitly invalid IDs reject the entire import without logging warnings", (context) => {
  const warn = context.mock.method(console, "warn", () => {});
  for (const source of [
    '<svg><rect/><g id="same"><rect id="same"/></g></svg>',
    '<svg id="same"><rect id="same"/></svg>',
    '<svg><rect id=""/></svg>',
    '<svg><rect id="bad id"/></svg>',
  ]) rejects(source);
  assert.equal(warn.mock.callCount(), 0);
  const loaded = codec.decode("<svg><rect/></svg>");
  assert.deepEqual(loaded.warnings, ["warning: assigned id rect1 to unnamed <rect>"]);
});

test("SVG default geometry is zero and absent paint attributes stay absent", () => {
  const { document } = codec.decode('<svg><rect id="r"/><circle id="c"/><ellipse id="e"/><line id="l"/><text id="t"/></svg>');
  assert.equal(document.width, 800);
  assert.equal(document.height, 600);
  assert.equal(document.find("r").describe(), "rect#r x=0 y=0 w=0 h=0");
  assert.equal(document.find("c").describe(), "circle#c cx=0 cy=0 r=0");
  assert.equal(document.find("e").describe(), "ellipse#e cx=0 cy=0 rx=0 ry=0");
  assert.equal(document.find("l").position(), "(0,0) -> (0,0)");
  assert.equal(document.find("t").svgText(), "");
  assert.doesNotMatch(codec.encode(document), /(?:fill|stroke)=/u);
});

test("numeric and px dimensions, matching comma-separated viewBox and safe root styles round-trip", () => {
  const { document } = codec.decode(`<svg width="400.5px" height="200px" viewBox="0,0,400.5,200"
fill="#112233" stroke="none" stroke-width="2px" font-size="16px" text-anchor="middle">
<rect id="r" x="-2.5px" y="3px" width="4px" height="5px"/></svg>`);
  assert.equal(document.width, 400.5);
  assert.equal(document.height, 200);
  assert.equal(document.find("r").position(), "(-2.5,3)");
  const saved = codec.encode(document);
  assert.equal(codec.decode(saved).document.svgAttributes().get("fill"), "#112233");
});

test("XML declaration, comments, CDATA, entities and namespaced SVG use the real XML parser", () => {
  const { document } = codec.decode(`<?xml version="1.0" encoding="UTF-8"?>
<!--before--><s:svg xmlns:s="http://www.w3.org/2000/svg"><!--inside-->
<s:text id="t">A &amp; B <![CDATA[<中文>]]> &#x1F600; &quot;yes&quot;</s:text>
</s:svg><!--after-->`);
  assert.equal(document.find("t").svgText(), 'A & B <中文> 😀 "yes"');
  assert.equal(codec.decode(codec.encode(document)).document.find("t").svgText(), 'A & B <中文> 😀 "yes"');
});

test("text whitespace and attribute whitespace survive XML normalization on save/read", () => {
  const value = "  \u00A0中文 & <tag> \"quoted\" 'apostrophe'\t\n\r😀  ";
  const document = new SvgDocument();
  const text = new ShapeFactory().create("text", "t", new PositionalShapeInput(["1", "2", value]));
  text.set("fill", "red\t\n\r");
  document.create(text);
  const saved = codec.encode(document);
  assert.match(saved, /&#9;/u);
  assert.match(saved, /&#10;/u);
  assert.match(saved, /&#13;/u);
  assert.match(saved, /&amp;/u);
  assert.match(saved, /&lt;tag&gt;/u);
  const again = codec.decode(saved).document.find("t");
  assert.equal(again.svgText(), value);
  assert.equal(again.svgAttributes().get("fill"), "red\t\n\r");
});

test("unsupported labels, attributes, style, geometry units and mixed content fail instead of being dropped", () => {
  for (const source of [
    '<svg><path id="p" d="M0 0"/></svg>',
    '<svg><rect id="r" opacity="0.5"/></svg>',
    '<svg><rect id="r" style="fill:red"/></svg>',
    '<svg style="border:1px solid #ddd"><rect/></svg>',
    '<svg><rect id="r" rx="2"/></svg>',
    '<svg><text id="t" font-weight="bold">x</text></svg>',
    '<svg><rect id="r" width="2cm"/></svg>',
    '<svg><rect id="r"/>unexpected</svg>',
    '<svg><g id="g">unexpected</g></svg>',
    '<svg><g id="g">\u00A0</g></svg>', '<svg>\u00A0</svg>',
    '<svg><rect id="r">unexpected</rect></svg>',
    '<svg><text id="t"><rect id="r"/></text></svg>',
    '<svg><rect id="r"><g id="g"/></rect></svg>',
    '<svg><svg/></svg>',
  ]) rejects(source);
});

test("unsupported viewBox, sizes, font values and transformations fail the complete import", () => {
  for (const source of [
    '<svg width="0"/>', '<svg height="-1"/>', '<svg width="Infinity"/>',
    '<svg width="100%"/>', '<svg viewBox="1 0 800 600"/>',
    '<svg viewBox="0 0 400 300"/>', '<svg viewBox="0 0 800"/>',
    '<svg viewBox="0,,0,800,600"/>', '<svg viewBox=",0,0,800,600"/>',
    '<svg viewBox="0\u00A00 800 600"/>', '<svg viewBox="\u00A00 0 800 600"/>',
    '<svg><text font-size="-1">x</text></svg>',
    '<svg><text text-anchor="invalid">x</text></svg>',
    '<svg><g transform="rotate(30)"/></svg>',
    '<svg><g transform="scale(1,2)"/></svg>',
    '<svg><g transform="scale(-1)"/></svg>',
    '<svg><g transform="scale(0)"/></svg>',
    '<svg><g transform="translate(1px,2)"/></svg>',
    '<svg><g transform="translate(1,2) garbage"/></svg>',
    '<svg transform="translate(1,2)"/>',
  ]) rejects(source);
});

test("foreign namespaces and resource-bearing attributes are rejected", () => {
  for (const source of [
    '<svg xmlns="http://example.com/not-svg"/>',
    '<svg xmlns:f="http://example.com/foreign"><f:g/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><g xmlns=""><rect/></g></svg>',
    '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><rect xlink:href="https://example.com"/></svg>',
    '<svg><rect onload="alert(1)"/></svg>',
    '<svg><rect fill="url(https://example.com/paint.svg#p)"/></svg>',
    '<svg fill="url(#paint)"/>',
  ]) rejects(source);
});

test("malformed XML and unresolved entities are rejected by the XML parser", () => {
  for (const source of [
    "", "not xml", "<svg>", "<svg><rect></svg>", "<svg/><svg/>",
    '<svg><rect id="a" id="b"/></svg>', '<svg><text>&unknown;</text></svg>',
    '<svg><text>&#0;</text></svg>', '<svg><text>\u0001</text></svg>',
    '<svg><text><</text></svg>', '<svg><rect width=10/></svg>',
  ]) rejects(source);
});

test("DOCTYPE, external entities, processing instructions and unsupported XML declarations are refused", () => {
  for (const source of [
    '<!DOCTYPE svg><svg/>',
    '<!DOCTYPE svg SYSTEM "https://example.com/svg.dtd"><svg/>',
    '<!DOCTYPE svg [<!ENTITY x "expanded">]><svg><text>&x;</text></svg>',
    '<?xml-stylesheet href="https://example.com/style.css"?><svg/>',
    '<svg><?instruction payload?></svg>',
    '<?xml version="1.1"?><svg/>',
    '<?xml version="1.0" encoding="ISO-8859-1"?><svg/>',
  ]) rejects(source);
});

test("serialization rejects XML-invalid controls, unpaired surrogates and unsupported paint references", () => {
  for (const content of ["bad\u0000text", "bad\u0001text", "\uD800", "\uDC00"]) {
    const document = new SvgDocument();
    document.create(new ShapeFactory().create("text", "t", new PositionalShapeInput(["0", "0", content])));
    assert.throws(() => codec.encode(document), /invalid SVG: content contains an invalid XML character/u);
  }
  const document = new SvgDocument();
  const rect = new ShapeFactory().create("rect", "r", new PositionalShapeInput(["0", "0", "1", "1"]));
  rect.set("fill", "url(https://example.com/paint.svg#p)");
  document.create(rect);
  assert.throws(() => codec.encode(document), /invalid SVG: SVG resource references are not supported/u);
});

test("bounded input size and nesting reject oversized input while allowing the documented depth", () => {
  rejects(`<svg>${" ".repeat(3_000_000)}</svg>`);
  const accepted = `<svg>${'<g>'.repeat(255)}${'</g>'.repeat(255)}</svg>`;
  assert.equal(codec.decode(accepted).document.elementCount, 255);
  const rejected = `<svg>${'<g>'.repeat(256)}${'</g>'.repeat(256)}</svg>`;
  assert.throws(() => codec.decode(rejected), /SVG exceeds 256 nesting levels/u);
});

test("gateway composes text storage and XML conversion without writing an invalid document", () => {
  const files = new Map<string, string>([["input.svg", '<svg><rect id="r"/></svg>']]);
  const calls: string[] = [];
  const store: FileStore = {
    read(path): string {
      calls.push(`read:${path}`);
      const value = files.get(path);
      if (value === undefined) throw new Error(`cannot read file: ${path}`);
      return value;
    },
    writeAtomic(path, content): void { calls.push(`write:${path}`); files.set(path, content); },
  };
  const gateway = new SvgDocumentGateway(store);
  const loaded = gateway.read("input.svg");
  gateway.save("output.svg", loaded.document);
  assert.equal(gateway.read("output.svg").document.find("r").id, "r");
  assert.deepEqual(calls, ["read:input.svg", "write:output.svg", "read:output.svg"]);
  assert.throws(() => gateway.read("missing.svg"), { message: "cannot read file: missing.svg" });
  const invalid = new SvgDocument();
  invalid.create(new ShapeFactory().create("text", "t", new PositionalShapeInput(["0", "0", "\u0000"])));
  const count = calls.length;
  assert.throws(() => gateway.save("output.svg", invalid), /invalid XML character/u);
  assert.equal(calls.length, count);
  assert.equal(gateway.read("output.svg").document.find("r").id, "r");
});

test("wide XML imports use batch construction and bounded copies instead of per-node insertion", (context) => {
  const width = 400;
  const source = `<svg><g id="scene">${Array.from({ length: width }, (_, index) => `<rect id="r${index}"/>`).join("")}</g></svg>`;
  const create = context.mock.method(SvgDocument.prototype, "create", () => { throw new Error("per-node create is forbidden"); });
  const append = context.mock.method(Group.prototype, "withChild", () => { throw new Error("per-node withChild is forbidden"); });
  const clone = context.mock.method(Rect.prototype, "clone");
  const loaded = codec.decode(source);
  assert.equal(create.mock.callCount(), 0);
  assert.equal(append.mock.callCount(), 0);
  assert.ok(clone.mock.callCount() <= width * 3, "XML import must keep leaf copying proportional to the number of leaves");
  assert.equal(loaded.document.elementCount, width + 1);
  assert.equal(loaded.document.find("scene").children.length, width);
  assert.equal(loaded.document.find("r399").parentId, "scene");
  assert.equal(codec.decode(codec.encode(loaded.document)).document.elementCount, width + 1);
});
