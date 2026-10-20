import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import { ExternalDependencyPolicy } from "./support/ExternalDependencyPolicy.js";

const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
// No XML parser has been selected yet. Stage D must explicitly add the chosen
// package here together with its package.json dependency and the design record.
const selectedXmlPackages: readonly string[] = [];
const externalPolicy = new ExternalDependencyPolicy(selectedXmlPackages);

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path) : path.endsWith(".ts") ? [path] : [];
  });
}

function syntax(file: string) {
  return parse(readFileSync(file, "utf8"), { sourceType: "module", plugins: ["typescript"] }).program;
}

test("production classes use one matching file and no top-level business functions", () => {
  for (const file of sources(sourceRoot)) {
    const declarations = syntax(file).body;
    const classes = declarations.flatMap((statement) => {
      if (statement.type === "ClassDeclaration") return [statement];
      if (statement.type === "ExportNamedDeclaration" && statement.declaration?.type === "ClassDeclaration") {
        return [statement.declaration];
      }
      return [];
    });
    assert.ok(classes.length <= 1, `${file}: more than one class`);
    if (classes.length === 1) {
      assert.equal(classes[0]!.id?.name, basename(file, ".ts"), file);
    }
    const functions = declarations.filter((statement) =>
      statement.type === "FunctionDeclaration" ||
      (statement.type === "ExportNamedDeclaration" && statement.declaration?.type === "FunctionDeclaration"),
    );
    assert.equal(functions.length, 0, file);
  }
});

test("production imports obey the documented module directions", () => {
  const allowed = new Map<string, readonly string[]>([
    ["cli", ["cli", "commands", "application"]],
    ["commands", ["commands", "application", "model"]],
    ["application", ["application", "model"]],
    ["model", ["model"]],
    ["svg", ["svg", "model", "application"]],
    ["infrastructure", ["infrastructure", "application"]],
  ]);
  for (const file of sources(sourceRoot)) {
    const location = relative(sourceRoot, file);
    if (location === "main.ts") continue;
    const layer = location.split(sep)[0]!;
    for (const declaration of syntax(file).body) {
      if (declaration.type !== "ImportDeclaration") continue;
      const dependency = declaration.source.value;
      if (!dependency.startsWith(".")) {
        assert.ok(
          externalPolicy.allows(layer, dependency),
          `${location}: unexpected external dependency ${dependency}`,
        );
        continue;
      }
      const target = relative(sourceRoot, resolve(dirname(file), dependency));
      const targetLayer = target.split(sep)[0]!;
      assert.ok(allowed.get(layer)?.includes(targetLayer), `${location} -> ${target}`);
      if ((layer === "svg" || layer === "infrastructure") && targetLayer === "application") {
        assert.ok(target.startsWith(join("application", "contracts") + sep), `${location} -> ${target}`);
      }
    }
  }
});

test("without an XML selection the external policy remains closed for SVG", () => {
  const policy = new ExternalDependencyPolicy();
  assert.equal(policy.allows("svg", "example-xml"), false);
  assert.equal(policy.allows("svg", "node:fs"), false);
  assert.equal(policy.allows("cli", "node:readline"), true);
  assert.equal(policy.allows("infrastructure", "node:fs"), true);
  assert.equal(policy.allows("model", "node:fs"), false);
});

test("SVG may import the selected XML packages and their subpaths", () => {
  const policy = new ExternalDependencyPolicy(["example-xml", "@example/xml"]);
  for (const dependency of [
    "example-xml", "example-xml/parser", "@example/xml", "@example/xml/parser",
  ]) {
    assert.equal(policy.allows("svg", dependency), true, dependency);
  }
});

test("XML permission does not extend to other layers or similarly named packages", () => {
  const policy = new ExternalDependencyPolicy(["example-xml", "@example/xml"]);
  for (const layer of ["model", "application", "commands", "cli", "infrastructure"]) {
    assert.equal(policy.allows(layer, "example-xml"), false, layer);
    assert.equal(policy.allows(layer, "@example/xml/parser"), false, layer);
  }
  for (const dependency of ["unrelated", "example-xml-extra", "@example/xml-extra", "@example/other"]) {
    assert.equal(policy.allows("svg", dependency), false, dependency);
  }
});
