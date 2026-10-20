import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

function runScript(script: string): string {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
    cwd: projectRoot,
    input: script,
    encoding: 'utf8',
    timeout: 10_000,
    env: { ...process.env, NO_COLOR: '1' },
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, 'CLI must finish naturally on EOF');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '', 'ordinary command errors should be formatted by the CLI');
  assert.doesNotMatch(result.stdout, /^svg>/m, 'piped input must not contain interactive prompts');
  return result.stdout;
}

test('piped CLI consumes comments, reports errors, continues, and exits on EOF', () => {
  const output = runScript([
    '# repeatable stage A command script',
    '',
    'tree',
    'init 400 200',
    'create g flow',
    'create rect start 30 70 120 60 #4a90d9 in flow',
    'create text label 45 100 "开始 节点" in flow',
    'create rect start 0 0 1 1',
    'create hexagon h',
    'create line edge 150 100 250 100 black in flow',
    'show label',
    'tree',
    '',
  ].join('\n'));
  assert.match(output, /error: no document\. use 'init' or 'read' first/);
  assert.match(output, /canvas 400x200 created/);
  assert.match(output, /rect#start created in g#flow/);
  assert.match(output, /error: id already exists: start/);
  assert.match(output, /error: unknown shape type: hexagon \(is the plugin loaded\?\)/);
  assert.match(output, /line#edge created in g#flow/);
  assert.match(output, /text#label\s+parent=g#flow/);
  assert.match(output, /"开始 节点"/);
  assert.match(output, /fill=#4a90d9/);
  assert.match(output, /svg \(400x200\)/);
  assert.equal(output.split('\n').filter((line) => line.startsWith('error:')).length, 3);
});

test('piped CLI processes a final line without a trailing newline', () => {
  const output = runScript('init\ncreate circle c1 100 100 20 red\nshow c1');
  assert.match(output, /circle#c1 created/);
  assert.match(output, /circle#c1\s+parent=svg/);
  assert.match(output, /cx=100 cy=100 r=20/);
  assert.match(output, /fill=red/);
});

test('piped CLI supports create undo/redo and reports a missing default save path', () => {
  const output = runScript([
    'init',
    'create g scene',
    'undo',
    'show scene',
    'redo',
    'show scene',
    'save',
    'tree',
  ].join('\n'));
  assert.match(output, /error: no such shape: scene/);
  assert.match(output, /g#scene\s+parent=svg/);
  assert.match(output, /error: no default save path\. specify a file or use 'read' first/);
  assert.match(output, /svg \(800x600\)\n└── g#scene/);
});

test('piped CLI moves, scales, updates, deletes, and restores a complete nested node', () => {
  const output = runScript([
    'init 800 600',
    'create g flowchart',
    'create g node2 in flowchart',
    'create rect process 520 100 160 60 #f5a623 in node2',
    'create text process-label 545 135 "处理数据" in node2',
    'move node2 0 100',
    'show process-label',
    'scale node2 .5',
    'show process',
    'set process-label text "处理数据 v2"',
    'delete node2',
    'show process',
    'undo',
    'show process-label',
    'scale node2 0',
    'tree',
  ].join('\n'));
  assert.match(output, /g#node2 moved by \(0,100\)/);
  assert.match(output, /x=545 y=235/);
  assert.match(output, /x=260 y=100 width=80 height=30/);
  assert.match(output, /text#process-label updated: text="处理数据 v2"/);
  assert.match(output, /error: no such shape: process/);
  assert.match(output, /error: scale factor must be positive/);
  assert.match(output, /text#process-label\s+parent=g#node2\n\s+x=272\.5 y=117\.5\n\s+text="处理数据 v2"/);
  assert.match(output, /g#node2\n\s+├── rect#process.*x=260 y=100 w=80 h=30/);
  assert.equal(output.split('\n').filter((line) => line.startsWith('error:')).length, 2);
});

test('piped CLI groups, reparents, reorders, ungroups, and restores ordered shapes', () => {
  const output = runScript([
    'init 400 200',
    'create g scene',
    'create rect a 10 20 30 40 red in scene',
    'create rect b 50 60 70 80 blue in scene',
    'group pair b a',
    'create circle c 90 100 5 green in scene',
    'addto pair c',
    'front a',
    'back a',
    'ungroup pair',
    'show c',
    'undo',
    'delete pair',
    'undo',
    'group invalid scene a',
    'ungroup scene',
    'tree',
  ].join('\n'));
  assert.match(output, /^g#pair created with 2 children in g#scene \(sibling 1 of 1\)$/m);
  assert.match(output, /circle#c\s+parent=g#scene\n\s+cx=90 cy=100 r=5/);
  assert.match(output, /error: cannot group a container into its own descendant: scene/);
  assert.match(output, /error: cannot ungroup top-level container: scene/);
  assert.match(output, /svg \(400x200\)\n└── g#scene\n    └── g#pair\n        ├── rect#a x=10 y=20 w=30 h=40 fill=red\n        ├── rect#b x=50 y=60 w=70 h=80 fill=blue\n        └── circle#c cx=90 cy=100 r=5 fill=green/);
  assert.equal(output.split('\n').filter((line) => line.startsWith('error:')).length, 2);
});

test('piped CLI reads the teacher fixture, saves a Chinese space path, and continues after file errors', (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'svg-editor-cli-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const outputPath = join(directory, '中文 diagram.svg');
  const missingPath = join(directory, 'missing.svg');
  const output = runScript([
    'read examples/other.svg',
    'move c1 5 10',
    `save ${JSON.stringify(outputPath)}`,
    'undo',
    `read ${JSON.stringify(missingPath)}`,
    'show c1',
    'help',
  ].join('\n'));
  assert.match(output, /warning: assigned id rect1 to unnamed <rect>/);
  assert.match(output, /read examples\/other\.svg \(7 elements\)/);
  assert.ok(output.includes(`saved to ${outputPath} (7 elements)`));
  assert.ok(output.includes(`error: cannot read file: ${missingPath}`));
  assert.match(output, /error: undo not allowed after io command/);
  assert.match(output, /cx=55 cy=60 r=10/);
  assert.doesNotMatch(output, /尚未实现/);
  assert.match(readFileSync(outputPath, 'utf8'), /<svg\b/);
  const reopened = runScript(`read ${JSON.stringify(outputPath)}\nshow c1\ntree`);
  assert.match(reopened, /cx=55 cy=60 r=10/);
  assert.match(reopened, /parent=svg/);
  assert.doesNotMatch(reopened, /warning:|error:/);
});
