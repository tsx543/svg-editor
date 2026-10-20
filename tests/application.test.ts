import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EditorSession } from '../src/application/EditorSession.js';
import { Cli } from '../src/cli/Cli.js';
import { CommandDispatcher } from '../src/cli/CommandDispatcher.js';
import { CommandLineParser } from '../src/cli/CommandLineParser.js';

function editor(): Cli {
  return new Cli(new EditorSession(), new CommandLineParser(), new CommandDispatcher());
}

function success(cli: Cli, command: string): string {
  const lines = cli.executeLine(command);
  assert.ok(lines.every((line) => !line.startsWith('error:')), `${command}: ${lines.join('\n')}`);
  return lines.join('\n');
}

function failure(cli: Cli, command: string, expected?: string): void {
  const lines = cli.executeLine(command);
  assert.equal(lines.length, 1, `${command} should produce exactly one error line`);
  assert.match(lines[0]!, /^error: /, command);
  if (expected !== undefined) assert.equal(lines[0], expected);
}

test('help works before init and lists all 19 commands with future work marked honestly', () => {
  const cli = editor();
  const help = success(cli, 'help');
  for (const command of [
    'init', 'read', 'save', 'canvas', 'create', 'delete', 'move', 'scale', 'set',
    'group', 'ungroup', 'addto', 'front', 'back', 'tree', 'show', 'help', 'undo', 'redo',
  ]) {
    assert.match(help, new RegExp(`\\b${command}\\b`));
  }
  assert.match(help, /尚未实现/);
  for (const command of ['tree', 'canvas', 'show r1', 'create g scene', 'undo', 'redo']) {
    failure(cli, command, "error: no document. use 'init' or 'read' first");
  }
});

test('init accepts documented defaults, a width, and finite floating-point dimensions', () => {
  const cli = editor();
  assert.match(success(cli, 'init'), /800x600/);
  assert.match(success(cli, 'canvas'), /800x600/);
  assert.match(success(cli, 'init 400'), /400x600/);
  assert.match(success(cli, 'init 400.5 250.25'), /400\.5x250\.25/);
  assert.equal(success(cli, 'tree'), 'svg (400.5x250.25)');
  success(cli, 'canvas 640.5 480.25');
  assert.match(success(cli, 'canvas'), /640\.5x480\.25/);
});

test('all six built-in types support in, and show reports their actual parent', () => {
  const cli = editor();
  success(cli, 'init');
  success(cli, 'create g owner');
  const commands = [
    ['rect', 'r', '1.5 -2.5 30 40 #eeeeee'],
    ['circle', 'c', '50 60 7 red'],
    ['ellipse', 'e', '80 90 10 12 blue'],
    ['line', 'l', '0 0 100 100 #333333'],
    ['text', 't', '20 40 "你好 SVG 世界"'],
    ['g', 'nested', ''],
  ];
  for (const [type, id, params] of commands) {
    assert.equal(success(cli, `create ${type} ${id} ${params} in owner`), `${type}#${id} created in g#owner`);
    assert.match(success(cli, `show ${id}`), /parent=g#owner/);
  }
  const tree = success(cli, 'tree owner');
  assert.match(tree, /^g#owner\n/);
  assert.doesNotMatch(tree, /^svg /m);
  for (const [type, id] of commands) assert.match(tree, new RegExp(`${type}#${id}\\b`));
  assert.match(tree, /x=1\.5 y=-2\.5 (?:w|width)=30 (?:h|height)=40 fill=#eeeeee/);
  assert.match(tree, /cx=50 cy=60 r=7 fill=red/);
  assert.match(tree, /cx=80 cy=90 rx=10 ry=12 fill=blue/);
  assert.match(tree, /\(0,0\) -> \(100,100\).*stroke=#333333/);
  assert.match(tree, /\(20,40\) "你好 SVG 世界"/);
  assert.match(tree, /├──/);
  assert.match(tree, /└── g#nested/);
});

test('optional fill and stroke remain absent rather than inventing explicit defaults', () => {
  const cli = editor();
  success(cli, 'init');
  success(cli, 'create rect r 0 0 10 20');
  success(cli, 'create circle c 1 2 3');
  success(cli, 'create ellipse e 1 2 3 4');
  success(cli, 'create line l 1 2 3 4');
  for (const id of ['r', 'c', 'e', 'l']) {
    assert.doesNotMatch(success(cli, `show ${id}`), /(?:fill|stroke)=/);
  }
});

test('full-line comments and empty lines are ignored while # color and quoted text survive', () => {
  const cli = editor();
  assert.deepEqual(cli.executeLine(''), []);
  assert.deepEqual(cli.executeLine('  \t  '), []);
  assert.deepEqual(cli.executeLine('  # create rect ignored 0 0 10 10'), []);
  success(cli, 'init');
  success(cli, 'create rect colored 0 0 10 20 #4a90d9');
  success(cli, 'create text title 20 40 "# My Diagram 中文"');
  success(cli, 'create text keyword 10 50 "in"');
  assert.match(success(cli, 'show colored'), /fill=#4a90d9/);
  assert.match(success(cli, 'show title'), /# My Diagram 中文/);
  assert.match(success(cli, 'show keyword'), /"in"/);
});

test('IDs are globally unique and case sensitive, including group IDs', () => {
  const cli = editor();
  success(cli, 'init');
  success(cli, 'create g scene');
  success(cli, 'create rect r1 0 0 10 20 in scene');
  success(cli, 'create circle R1 30 40 5');
  const before = success(cli, 'tree');
  failure(cli, 'create circle r1 1 2 3', 'error: id already exists: r1');
  failure(cli, 'create g scene', 'error: id already exists: scene');
  failure(cli, 'show r9', 'error: no such shape: r9');
  failure(cli, 'tree Scene', 'error: no such shape: Scene');
  assert.equal(success(cli, 'tree'), before);
  assert.match(success(cli, 'show r1'), /^rect#r1/);
  assert.match(success(cli, 'show R1'), /^circle#R1/);
});

test('unknown types and invalid in targets use teacher-specified errors without changing state', () => {
  const cli = editor();
  success(cli, 'init');
  success(cli, 'create rect start 0 0 10 20');
  const before = success(cli, 'tree');
  failure(cli, 'create hexagon h', 'error: unknown shape type: hexagon (is the plugin loaded?)');
  failure(cli, 'create box b 0 0 10 20 "title"', 'error: unknown shape type: box (is the plugin loaded?)');
  failure(cli, 'create circle c 1 2 3 in node9', 'error: no such container: node9');
  failure(cli, 'create circle c 1 2 3 in start', 'error: not a container: start');
  assert.equal(success(cli, 'tree'), before);
});

test('malformed dimensions and creation arguments never partly edit the document', () => {
  const cli = editor();
  success(cli, 'init 400 300');
  success(cli, 'create g scene');
  const before = success(cli, 'tree');
  for (const command of [
    'init 0 300', 'init -1 300', 'init Infinity 300', 'init 400 NaN', 'init 1 2 3',
    'canvas 100', 'canvas 100 0', 'canvas 1e309 200', 'canvas 100 200 extra',
    'create', 'create g', 'create g extra unexpected',
    'create rect r 0 0 10', 'create rect r 0 0 -1 20',
    'create rect r 1abc 0 10 20', 'create rect r 0 0 10 20 red extra',
    'create circle c 0 0 -1', 'create ellipse e 0 0 -1 2',
    'create ellipse e 0 0 1 -2', 'create line l 0 0 NaN 2',
    'create text t 0 0', 'create text t 0 0 "unterminated',
    'create g child in', 'create g child in scene extra',
    'tree scene extra', 'show scene extra', 'help extra', 'undo extra', 'redo extra',
  ]) {
    failure(cli, command);
    assert.equal(success(cli, 'tree'), before, command);
  }
});

test('each create is exactly one undo unit, and redo restores nested structure and order', () => {
  const cli = editor();
  success(cli, 'init');
  success(cli, 'create g scene');
  const groupOnly = success(cli, 'tree');
  success(cli, 'create rect a 0 0 10 20 in scene');
  const firstChild = success(cli, 'tree');
  success(cli, 'create text b 5 15 "第二个 节点" in scene');
  const bothChildren = success(cli, 'tree');
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), firstChild);
  failure(cli, 'show b', 'error: no such shape: b');
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), groupOnly);
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), firstChild);
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), bothChildren);
});

test('new successful edit after undo clears redo', () => {
  const cli = editor();
  success(cli, 'init');
  success(cli, 'create circle old 10 10 2');
  success(cli, 'undo');
  success(cli, 'create circle fresh 20 20 3');
  const before = success(cli, 'tree');
  failure(cli, 'redo');
  assert.equal(success(cli, 'tree'), before);
  failure(cli, 'show old', 'error: no such shape: old');
});

test('failed edits, failed document commands, and queries preserve redo history', () => {
  const cli = editor();
  success(cli, 'init');
  success(cli, 'create g scene');
  success(cli, 'create rect r 1 2 3 4 in scene');
  const completed = success(cli, 'tree');
  success(cli, 'undo');
  const undone = success(cli, 'tree');
  failure(cli, 'create g scene', 'error: id already exists: scene');
  failure(cli, 'create circle bad 0 0 -1');
  failure(cli, 'init 0 100');
  failure(cli, 'canvas 10 0');
  failure(cli, 'not-a-command');
  success(cli, 'canvas');
  success(cli, 'show scene');
  success(cli, 'tree scene');
  success(cli, 'help');
  assert.deepEqual(cli.executeLine('# comment after undo'), []);
  assert.deepEqual(cli.executeLine('   '), []);
  assert.equal(success(cli, 'tree'), undone);
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), completed);
});

test('init and a successful canvas resize block history until a new edit', () => {
  const cli = editor();
  success(cli, 'init');
  failure(cli, 'undo', 'error: undo not allowed after io command');
  failure(cli, 'redo', 'error: undo not allowed after io command');
  success(cli, 'create circle old 10 10 2');
  success(cli, 'canvas 400 300');
  const resized = success(cli, 'tree');
  failure(cli, 'undo', 'error: undo not allowed after io command');
  failure(cli, 'redo', 'error: undo not allowed after io command');
  success(cli, 'create circle fresh 20 20 3');
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), resized);
  failure(cli, 'undo');
  success(cli, 'redo');
  success(cli, 'init 200 100');
  assert.equal(success(cli, 'tree'), 'svg (200x100)');
  failure(cli, 'redo', 'error: undo not allowed after io command');
  success(cli, 'create g newScene');
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), 'svg (200x100)');
});

test('canvas query does not prevent undoing a successful create', () => {
  const cli = editor();
  success(cli, 'init');
  const empty = success(cli, 'tree');
  success(cli, 'create line edge 1 2 3 4 black');
  success(cli, 'canvas');
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), empty);
});

test('teacher two-node flowchart version A can be built and inspected in stage A', () => {
  const cli = editor();
  for (const command of [
    'init 800 600',
    'create g flowchart',
    'create g node1 in flowchart',
    'create rect start 120 100 160 60 #4a90d9 in node1',
    'create text start-label 155 135 "开始" in node1',
    'create g node2 in flowchart',
    'create rect process 520 100 160 60 #f5a623 in node2',
    'create text process-label 545 135 "处理数据" in node2',
    'create line arrow1 280 130 520 130 black in flowchart',
  ]) success(cli, command);
  const tree = success(cli, 'tree');
  assert.match(tree, /^svg \(800x600\)\n└── g#flowchart\n/);
  assert.match(tree, /    ├── g#node1\n    │   ├── rect#start\b/);
  assert.match(tree, /    ├── g#node2\n    │   ├── rect#process\b/);
  assert.match(tree, /    └── line#arrow1\b/);
  assert.match(success(cli, 'show start-label'), /parent=g#node1/);
  assert.match(success(cli, 'show process-label'), /处理数据/);
  assert.match(success(cli, 'show arrow1'), /parent=g#flowchart/);
  assert.equal(tree.match(/(?:g|rect|text|line)#[\w-]+/g)?.length, 8);
});

test('unimplemented phase C and D commands report failure and preserve the current document', () => {
  const cli = editor();
  success(cli, 'init');
  success(cli, 'create circle c 10 20 3');
  const before = success(cli, 'tree');
  for (const command of ['group group1 c c', 'ungroup group1', 'addto group1 c', 'front c', 'back c', 'read missing.svg', 'save out.svg']) {
    const lines = cli.executeLine(command);
    assert.equal(lines.length, 1);
    assert.match(lines[0]!, /^error: .*尚未实现/);
    assert.equal(success(cli, 'tree'), before);
  }
});
