import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
  assert.doesNotMatch(result.stdout, /svg>/, 'piped input must not contain interactive prompts');
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

test('piped CLI supports create undo/redo and rejects unpublished future commands', () => {
  const output = runScript([
    'init',
    'create g scene',
    'undo',
    'show scene',
    'redo',
    'show scene',
    'save premature.svg',
    'tree',
  ].join('\n'));
  assert.match(output, /error: no such shape: scene/);
  assert.match(output, /g#scene\s+parent=svg/);
  assert.match(output, /error: .*尚未实现/);
  assert.match(output, /svg \(800x600\)\n└── g#scene/);
});
