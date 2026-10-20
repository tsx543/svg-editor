import assert from "node:assert/strict";
import test from "node:test";
import { CommandLineParser } from "../src/cli/CommandLineParser.js";

const parser = new CommandLineParser();

test("blank and whole-line comments produce no command", () => {
  for (const line of ["", "  \t  ", "# command sequence", "  # a comment"]) {
    assert.equal(parser.parse(line), null);
  }
});

test("colors remain arguments and comments are not stripped inside commands", () => {
  const request = parser.parse("create rect r1 0 0 20 10 #ffffff in scene");
  assert.equal(request?.name, "create");
  assert.deepEqual(request?.arguments.values(), [
    "rect", "r1", "0", "0", "20", "10", "#ffffff", "in", "scene",
  ]);
  assert.deepEqual(parser.parse("help #literal")?.arguments.values(), ["#literal"]);
});

test("quoted text supports spaces, Chinese characters, and empty content", () => {
  const request = parser.parse('create text title 20 40 "开始 My Diagram"');
  assert.deepEqual(request?.arguments.values(), ["text", "title", "20", "40", "开始 My Diagram"]);
  assert.deepEqual(request?.arguments.token(4), { value: "开始 My Diagram", quoted: true });
  assert.deepEqual(parser.parse('create text empty 0 0 ""')?.arguments.token(4), {
    value: "", quoted: true,
  });
});

test("quoted in remains distinguishable from the parent suffix", () => {
  const request = parser.parse('create text t1 0 0 "in" in scene');
  assert.deepEqual(request?.arguments.token(4), { value: "in", quoted: true });
  assert.deepEqual(request?.arguments.token(5), { value: "in", quoted: false });
  assert.deepEqual(request?.arguments.slice(4).values(), ["in", "in", "scene"]);
});

test("escaped quotes and backslashes are decoded only inside double quotes", () => {
  const request = parser.parse(String.raw`create text t1 0 0 "He said \"start\" at C:\\work"`);
  assert.equal(request?.arguments.at(4), 'He said "start" at C:\\work');
  assert.equal(parser.parse(String.raw`read C:\work\demo.svg`)?.arguments.at(0), String.raw`C:\work\demo.svg`);
  assert.equal(parser.parse(String.raw`read "C:\new\demo.svg"`)?.arguments.at(0), String.raw`C:\new\demo.svg`);
});

test("unterminated and glued quotes are rejected", () => {
  assert.throws(() => parser.parse('create text t1 0 0 "missing'), /unterminated double quote/u);
  assert.throws(() => parser.parse('create text t1 0 0 "label"in scene'), /whitespace after closing quote/u);
  assert.throws(() => parser.parse('create text t1 0 0 pre"label"'), /double quote must start a parameter/u);
});

test("tabs and multiple spaces separate unquoted parameters", () => {
  const request = parser.parse("\t canvas\t 400   300 \r");
  assert.equal(request?.name, "canvas");
  assert.equal(request?.arguments.length, 2);
  assert.deepEqual(request?.arguments.values(), ["400", "300"]);
  assert.deepEqual(request?.arguments.token(0), { value: "400", quoted: false });
});
