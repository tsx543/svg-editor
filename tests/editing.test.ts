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

function fixture(): Cli {
  const cli = editor();
  for (const command of [
    'init',
    'create g scene',
    'create rect rect 10 20 30 40 #4a90d9 in scene',
    'create circle circle 50 60 7 red in scene',
    'create g nested in scene',
    'create ellipse ellipse 80 90 10 12 blue in nested',
    'create line line 1 2 30 40 black in nested',
    'create text label 20 40 "标题 文本" in nested',
    'create rect outside -10 -20 5 6 orange',
  ]) success(cli, command);
  return cli;
}

function attributes(cli: Cli, id: string, expected: Readonly<Record<string, number>>): void {
  const detail = success(cli, `show ${id}`);
  for (const [attribute, value] of Object.entries(expected)) {
    const match = detail.match(new RegExp(`(?:^|\\s)${attribute}=([^\\s]+)`));
    assert.ok(match, `${id}: missing ${attribute} in ${detail}`);
    assert.equal(Number(match[1]), value, `${id}.${attribute}`);
  }
}

test('move translates each leaf geometry, reports its new position, and is one undo unit', () => {
  const cli = fixture();
  const cases: readonly {
    id: string;
    kind: string;
    position: string;
    values: Readonly<Record<string, number>>;
  }[] = [
    { id: 'rect', kind: 'rect', position: '(13,16)', values: { x: 13, y: 16, width: 30, height: 40 } },
    { id: 'circle', kind: 'circle', position: '(53,56)', values: { cx: 53, cy: 56, r: 7 } },
    { id: 'ellipse', kind: 'ellipse', position: '(83,86)', values: { cx: 83, cy: 86, rx: 10, ry: 12 } },
    { id: 'line', kind: 'line', position: '(4,-2) -> (33,36)', values: { x1: 4, y1: -2, x2: 33, y2: 36 } },
    { id: 'label', kind: 'text', position: '(23,36)', values: { x: 23, y: 36 } },
  ];
  for (const { id, kind, position, values } of cases) {
    const before = success(cli, 'tree');
    assert.equal(success(cli, `move ${id} 3 -4`), `${kind}#${id} moved to ${position}`);
    attributes(cli, id, values);
    const after = success(cli, 'tree');
    success(cli, 'undo');
    assert.equal(success(cli, 'tree'), before);
    success(cli, 'redo');
    assert.equal(success(cli, 'tree'), after);
    success(cli, 'undo');
  }
  assert.match(success(cli, 'show label'), /text="标题 文本"/);
});

test('moving a nested group moves every descendant exactly once and leaves outside shapes alone', () => {
  const cli = fixture();
  const before = success(cli, 'tree');
  const outside = success(cli, 'show outside');
  assert.equal(success(cli, 'move scene -5 2.5'), 'g#scene moved by (-5,2.5)');
  attributes(cli, 'rect', { x: 5, y: 22.5, width: 30, height: 40 });
  attributes(cli, 'circle', { cx: 45, cy: 62.5, r: 7 });
  attributes(cli, 'ellipse', { cx: 75, cy: 92.5, rx: 10, ry: 12 });
  attributes(cli, 'line', { x1: -4, y1: 4.5, x2: 25, y2: 42.5 });
  attributes(cli, 'label', { x: 15, y: 42.5 });
  assert.equal(success(cli, 'show outside'), outside);
  const after = success(cli, 'tree');
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), before);
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), after);
});

test('scale multiplies every leaf position and dimension while keeping text and styles', () => {
  const cli = fixture();
  const cases: readonly { id: string; values: Readonly<Record<string, number>> }[] = [
    { id: 'rect', values: { x: 20, y: 40, width: 60, height: 80 } },
    { id: 'circle', values: { cx: 100, cy: 120, r: 14 } },
    { id: 'ellipse', values: { cx: 160, cy: 180, rx: 20, ry: 24 } },
    { id: 'line', values: { x1: 2, y1: 4, x2: 60, y2: 80 } },
    { id: 'label', values: { x: 40, y: 80 } },
  ];
  for (const { id, values } of cases) {
    success(cli, `set ${id} stroke-width 3.5`);
    const before = success(cli, 'tree');
    success(cli, `scale ${id} 2`);
    attributes(cli, id, values);
    assert.match(success(cli, `show ${id}`), /stroke-width=3\.5(?:\s|$)/);
    const after = success(cli, 'tree');
    success(cli, 'undo');
    assert.equal(success(cli, 'tree'), before);
    success(cli, 'redo');
    assert.equal(success(cli, 'tree'), after);
    success(cli, 'undo');
  }
  assert.match(success(cli, 'show rect'), /fill=#4a90d9/);
  assert.match(success(cli, 'show line'), /stroke=black/);
  assert.match(success(cli, 'show label'), /text="标题 文本"/);
});

test('group scale recursively changes geometry around the SVG origin without scaling stroke-width', () => {
  const cli = fixture();
  success(cli, 'set scene stroke-width 6');
  success(cli, 'set nested stroke-width 4');
  success(cli, 'set line stroke-width 2');
  const before = success(cli, 'tree');
  const outside = success(cli, 'show outside');
  success(cli, 'scale scene .5');
  attributes(cli, 'rect', { x: 5, y: 10, width: 15, height: 20 });
  attributes(cli, 'circle', { cx: 25, cy: 30, r: 3.5 });
  attributes(cli, 'ellipse', { cx: 40, cy: 45, rx: 5, ry: 6 });
  attributes(cli, 'line', { x1: .5, y1: 1, x2: 15, y2: 20 });
  attributes(cli, 'label', { x: 10, y: 20 });
  assert.match(success(cli, 'show scene'), /stroke-width=6(?:\s|$)/);
  assert.match(success(cli, 'show nested'), /stroke-width=4(?:\s|$)/);
  assert.match(success(cli, 'show line'), /stroke-width=2(?:\s|$)/);
  assert.equal(success(cli, 'show outside'), outside);
  const after = success(cli, 'tree');
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), before);
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), after);
});

test('empty groups have the same edit and history semantics as populated groups', () => {
  const cli = editor();
  success(cli, 'init');
  success(cli, 'create g empty');
  success(cli, 'move empty 2 3');
  success(cli, 'scale empty 1.5');
  success(cli, 'set empty fill red');
  success(cli, 'delete empty');
  failure(cli, 'show empty', 'error: no such shape: empty');
  success(cli, 'undo');
  assert.match(success(cli, 'show empty'), /fill=red/);
  success(cli, 'undo');
  assert.doesNotMatch(success(cli, 'show empty'), /fill=/);
  success(cli, 'undo');
  success(cli, 'undo');
  assert.match(success(cli, 'show empty'), /^g#empty/);
  success(cli, 'undo');
  failure(cli, 'show empty', 'error: no such shape: empty');
});

test('set accepts exactly the geometry whitelist for every leaf and each change is reversible', () => {
  const cli = fixture();
  const cases = [
    ['rect', ['x', 'y', 'width', 'height']],
    ['circle', ['cx', 'cy', 'r']],
    ['ellipse', ['cx', 'cy', 'rx', 'ry']],
    ['line', ['x1', 'y1', 'x2', 'y2']],
    ['label', ['x', 'y']],
  ] as const;
  for (const [id, names] of cases) {
    for (const attribute of names) {
      const before = success(cli, 'tree');
      success(cli, `set ${id} ${attribute} 12.5`);
      attributes(cli, id, { [attribute]: 12.5 });
      const after = success(cli, 'tree');
      success(cli, 'undo');
      assert.equal(success(cli, 'tree'), before, `${id}.${attribute}`);
      success(cli, 'redo');
      assert.equal(success(cli, 'tree'), after, `${id}.${attribute}`);
    }
  }
  for (const [id, attribute] of [
    ['rect', 'cx'], ['rect', 'text'], ['circle', 'width'], ['ellipse', 'r'],
    ['line', 'x'], ['label', 'width'], ['scene', 'x'], ['nested', 'text'],
    ['label', 'font-size'], ['rect', 'transform'], ['rect', 'id'], ['rect', 'w'],
  ]) {
    const before = success(cli, 'tree');
    failure(cli, `set ${id} ${attribute} 1`, `error: unknown attribute: ${attribute}`);
    assert.equal(success(cli, 'tree'), before);
  }
});

test('all six types accept public styles and group styles keep descendants explicit styles intact', () => {
  const cli = fixture();
  for (const id of ['rect', 'circle', 'ellipse', 'line', 'label', 'scene']) {
    for (const [attribute, value] of [['fill', '#112233'], ['stroke', 'purple'], ['stroke-width', '2.5']]) {
      success(cli, `set ${id} ${attribute} ${value}`);
      assert.ok(success(cli, `show ${id}`).includes(`${attribute}=${value}`));
    }
  }
  success(cli, 'create text inherited 5 6 "继承样式" in nested');
  const rect = success(cli, 'show rect');
  const nested = success(cli, 'show nested');
  const label = success(cli, 'show inherited');
  success(cli, 'set scene fill orange');
  success(cli, 'set scene stroke green');
  success(cli, 'set scene stroke-width 9');
  assert.equal(success(cli, 'show rect'), rect);
  assert.equal(success(cli, 'show nested'), nested);
  assert.equal(success(cli, 'show inherited'), label);
  assert.doesNotMatch(label, /(?:fill|stroke)=/);
  assert.match(success(cli, 'show inherited'), /parent=g#nested/);
});

test('set text preserves Chinese, whitespace, empty content, quotes, and backslashes through undo/redo', () => {
  const cli = fixture();
  const values = ['处理数据 v2', '', '  两侧 空格  ', '他说 "Hello"，路径 C:\\tmp'];
  for (const value of values) {
    const before = success(cli, 'tree');
    const encoded = JSON.stringify(value);
    assert.equal(success(cli, `set label text ${encoded}`), `text#label updated: text=${encoded}`);
    assert.ok(success(cli, 'show label').includes(`text=${encoded}`));
    const after = success(cli, 'tree');
    success(cli, 'undo');
    assert.equal(success(cli, 'tree'), before);
    success(cli, 'redo');
    assert.equal(success(cli, 'tree'), after);
  }
});

test('zero geometric sizes are valid and negative coordinates remain valid', () => {
  const cli = fixture();
  for (const command of [
    'set rect width 0', 'set rect height 0', 'set circle r 0',
    'set ellipse rx 0', 'set ellipse ry 0', 'set line stroke-width 0',
    'set rect x -12.5', 'set label y -20', 'move line -.5 -2.5',
  ]) success(cli, command);
  attributes(cli, 'rect', { x: -12.5, width: 0, height: 0 });
  attributes(cli, 'circle', { r: 0 });
  attributes(cli, 'ellipse', { rx: 0, ry: 0 });
  attributes(cli, 'line', { x1: .5, y1: -.5, x2: 29.5, y2: 37.5 });
  attributes(cli, 'label', { y: -20 });
  assert.match(success(cli, 'show line'), /stroke-width=0(?:\s|$)/);
});

test('deleting a leaf preserves sibling order and restores its original parent and index', () => {
  const cli = fixture();
  const before = success(cli, 'tree');
  success(cli, 'delete circle');
  failure(cli, 'show circle', 'error: no such shape: circle');
  const after = success(cli, 'tree');
  assert.doesNotMatch(after, /circle#circle/);
  assert.ok(after.indexOf('rect#rect') < after.indexOf('g#nested'));
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), before);
  assert.match(success(cli, 'show circle'), /parent=g#scene/);
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), after);
});

test('deleting a nested group removes every descendant ID and undo restores the entire ordered subtree', () => {
  const cli = fixture();
  const before = success(cli, 'tree');
  const outside = success(cli, 'show outside');
  success(cli, 'delete nested');
  for (const id of ['nested', 'ellipse', 'line', 'label']) {
    failure(cli, `show ${id}`, `error: no such shape: ${id}`);
  }
  assert.equal(success(cli, 'show outside'), outside);
  assert.match(success(cli, 'show rect'), /parent=g#scene/);
  const after = success(cli, 'tree');
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), before);
  assert.match(success(cli, 'show nested'), /parent=g#scene/);
  for (const id of ['ellipse', 'line', 'label']) assert.match(success(cli, `show ${id}`), /parent=g#nested/);
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), after);
  success(cli, 'delete scene');
  assert.equal(success(cli, 'tree').split('\n').length, 2);
  failure(cli, 'show rect', 'error: no such shape: rect');
  failure(cli, 'show circle', 'error: no such shape: circle');
});

test('deleted group and descendant IDs can be reused without corrupting old undo snapshots', () => {
  const cli = fixture();
  const original = success(cli, 'tree');
  success(cli, 'delete nested');
  const deleted = success(cli, 'tree');
  success(cli, 'create circle nested 2 3 4');
  success(cli, 'create rect label 1 2 3 4 in scene');
  const reused = success(cli, 'tree');
  success(cli, 'undo');
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), deleted);
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), original);
  assert.match(success(cli, 'show nested'), /^g#nested/);
  assert.match(success(cli, 'show label'), /^text#label/);
  success(cli, 'redo');
  success(cli, 'redo');
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), reused);
  assert.match(success(cli, 'show nested'), /^circle#nested/);
  assert.match(success(cli, 'show label'), /^rect#label/);
});

test('interleaved create/move/scale/set/delete each occupies exactly one undo unit', () => {
  const cli = editor();
  success(cli, 'init');
  const snapshots = [success(cli, 'tree')];
  for (const command of [
    'create rect r 10 20 30 40 red', 'move r 5 -10', 'scale r 2',
    'set r fill #f5a623', 'create text t 1 2 "历史测试"', 'delete r',
  ]) {
    success(cli, command);
    snapshots.push(success(cli, 'tree'));
    success(cli, 'canvas');
    success(cli, 'help');
  }
  for (let index = snapshots.length - 2; index >= 0; index -= 1) {
    success(cli, 'undo');
    assert.equal(success(cli, 'tree'), snapshots[index]);
  }
  failure(cli, 'undo');
  for (let index = 1; index < snapshots.length; index += 1) {
    success(cli, 'redo');
    assert.equal(success(cli, 'tree'), snapshots[index]);
  }
  failure(cli, 'redo');
});

test('new move, scale, set, or delete after undo clears redo', () => {
  for (const command of ['move rect 1 2', 'scale rect 2', 'set rect fill orange', 'delete rect']) {
    const cli = fixture();
    success(cli, 'set rect fill green');
    success(cli, 'undo');
    success(cli, command);
    const before = success(cli, 'tree');
    failure(cli, 'redo');
    assert.equal(success(cli, 'tree'), before, command);
  }
});

test('failed edits preserve current geometry and a pending redo, including non-positive scale', () => {
  const cli = fixture();
  success(cli, 'set label text "已更新"');
  const completed = success(cli, 'tree');
  success(cli, 'undo');
  const before = success(cli, 'tree');
  for (const factor of ['0', '-0', '-1', '-2.5']) {
    failure(cli, `scale scene ${factor}`, 'error: scale factor must be positive');
  }
  for (const command of [
    'move missing 1 2', 'scale missing 2', 'set missing fill red', 'delete missing',
    'set rect width -1', 'set rect height -1', 'set circle r -1',
    'set ellipse rx -1', 'set ellipse ry -1', 'set scene stroke-width -1',
    'set rect width 1e309', 'set label font-size 12',
  ]) {
    failure(cli, command);
    assert.equal(success(cli, 'tree'), before, command);
  }
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), completed);
});

test('group arithmetic overflow leaves no partial edit and preserves redo history', () => {
  for (const command of ['move scene 1e308 0', 'scale scene 2']) {
    const cli = editor();
    for (const setup of [
      'init', 'create g scene', 'create rect safe 1 2 3 4 in scene',
      'create g nested in scene', 'create circle huge 1e308 4 5 in nested',
      'set scene fill red',
    ]) success(cli, setup);
    const completed = success(cli, 'tree');
    success(cli, 'undo');
    const before = success(cli, 'tree');
    failure(cli, command);
    assert.equal(success(cli, 'tree'), before, command);
    attributes(cli, 'safe', { x: 1, y: 2, width: 3, height: 4 });
    success(cli, 'redo');
    assert.equal(success(cli, 'tree'), completed);
  }
});

test('malformed phase B arguments are rejected without changing the tree or history', () => {
  const cli = fixture();
  success(cli, 'set rect fill green');
  const completed = success(cli, 'tree');
  success(cli, 'undo');
  const before = success(cli, 'tree');
  for (const command of [
    'move', 'move rect 1', 'move rect 1 2 extra', 'move rect NaN 2',
    'move rect 1 Infinity', 'move rect 0x10 2', 'move rect 1e309 2',
    'scale', 'scale rect', 'scale rect 2 extra', 'scale rect NaN', 'scale rect 1e309',
    'set', 'set rect', 'set rect fill', 'set rect fill red extra',
    'set rect x NaN', 'set rect x 12abc', 'set rect stroke-width Infinity',
    'delete', 'delete rect extra',
  ]) {
    failure(cli, command);
    assert.equal(success(cli, 'tree'), before, command);
  }
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), completed);
});

test('phase B commands retain exact no-document and missing-ID errors', () => {
  const cli = editor();
  for (const command of ['move r 1 2', 'scale r 2', 'set r fill red', 'delete r']) {
    failure(cli, command, "error: no document. use 'init' or 'read' first");
  }
  success(cli, 'init');
  for (const command of ['move r 1 2', 'scale r 2', 'set r fill red', 'delete r']) {
    failure(cli, command, 'error: no such shape: r');
  }
  failure(cli, 'undo', 'error: undo not allowed after io command');
});

test('failed edits keep document barriers and successful phase B edits start new undo history', () => {
  for (const command of ['move rect 1 2', 'scale rect 2', 'set rect fill green', 'delete rect']) {
    const cli = fixture();
    success(cli, 'canvas 400 300');
    const barrierTree = success(cli, 'tree');
    failure(cli, 'move rect NaN 1');
    failure(cli, 'scale rect 0', 'error: scale factor must be positive');
    failure(cli, 'set rect height -1');
    failure(cli, 'delete missing', 'error: no such shape: missing');
    failure(cli, 'undo', 'error: undo not allowed after io command');
    failure(cli, 'redo', 'error: undo not allowed after io command');
    success(cli, command);
    success(cli, 'undo');
    assert.equal(success(cli, 'tree'), barrierTree, command);
    failure(cli, 'undo');
    success(cli, 'init');
    failure(cli, 'redo', 'error: undo not allowed after io command');
  }
});
