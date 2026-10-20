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
    'create rect background 0 0 800 600 white',
    'create g scene',
    'create circle foreground 1 2 3 red',
    'create rect left 10 20 30 40 in scene',
    'create g branchA in scene',
    'create rect a1 11 12 13 14 blue in branchA',
    'create g deep in branchA',
    'create text deepLabel 15 16 "深层 文字" in deep',
    'create circle deepCircle 17 18 19 in deep',
    'create rect a2 21 22 23 24 in branchA',
    'create g branchB in scene',
    'create circle b1 31 32 33 in branchB',
    'create text b2 34 35 "另一分支" in branchB',
    'create rect right 41 42 43 44 in scene',
  ]) success(cli, command);
  return cli;
}

function children(cli: Cli, id?: string): readonly string[] {
  return success(cli, id === undefined ? 'tree' : `tree ${id}`)
    .split('\n').slice(1).flatMap((line) => {
      const child = line.match(/^[├└]── [^#]+#([^\s]+)/u);
      return child ? [child[1]!] : [];
    });
}

function parent(cli: Cli, id: string, expected: string): void {
  assert.equal(success(cli, `show ${id}`).split('\n')[0]!.split('parent=')[1], expected, id);
}

function details(cli: Cli, id: string): string {
  return success(cli, `show ${id}`).split('\n').slice(1).join('\n');
}

function restores(cli: Cli, before: string, after: string): void {
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), before);
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), after);
}

test('group uses original sibling order and the earliest selected slot rather than argument order', () => {
  const cli = fixture();
  const before = success(cli, 'tree');
  const left = details(cli, 'left');
  const right = details(cli, 'right');
  assert.equal(success(cli, 'group picked right left'), 'g#picked created with 2 children in g#scene (sibling 1 of 3)');
  assert.deepEqual(children(cli, 'scene'), ['picked', 'branchA', 'branchB']);
  assert.deepEqual(children(cli, 'picked'), ['left', 'right']);
  assert.deepEqual(children(cli), ['background', 'scene', 'foreground']);
  parent(cli, 'picked', 'g#scene');
  parent(cli, 'left', 'g#picked');
  parent(cli, 'right', 'g#picked');
  assert.equal(details(cli, 'left'), left);
  assert.equal(details(cli, 'right'), right);
  restores(cli, before, success(cli, 'tree'));
});

test('mixed-parent group uses the LCA, DFS order, and a slot before the earliest retained branch', () => {
  const cli = fixture();
  const before = success(cli, 'tree');
  success(cli, 'group picked b2 a2');
  assert.deepEqual(children(cli, 'scene'), ['left', 'picked', 'branchA', 'branchB', 'right']);
  assert.deepEqual(children(cli, 'picked'), ['a2', 'b2']);
  assert.deepEqual(children(cli, 'branchA'), ['a1', 'deep']);
  assert.deepEqual(children(cli, 'branchB'), ['b1']);
  parent(cli, 'picked', 'g#scene');
  parent(cli, 'a2', 'g#picked');
  parent(cli, 'b2', 'g#picked');
  restores(cli, before, success(cli, 'tree'));
});

test('group chooses a deep LCA and preserves unselected descendants and their order', () => {
  const cli = fixture();
  const before = success(cli, 'tree');
  success(cli, 'group picked a2 deepCircle');
  assert.deepEqual(children(cli, 'scene'), ['left', 'branchA', 'branchB', 'right']);
  assert.deepEqual(children(cli, 'branchA'), ['a1', 'picked', 'deep']);
  assert.deepEqual(children(cli, 'deep'), ['deepLabel']);
  assert.deepEqual(children(cli, 'picked'), ['deepCircle', 'a2']);
  parent(cli, 'picked', 'g#branchA');
  parent(cli, 'deepLabel', 'g#deep');
  restores(cli, before, success(cli, 'tree'));
});

test('group reuses the earliest removed branch position and carries a selected group as one subtree', () => {
  const cli = fixture();
  success(cli, 'set branchA fill blue');
  const before = success(cli, 'tree');
  const branch = details(cli, 'branchA');
  const label = details(cli, 'deepLabel');
  success(cli, 'group picked b1 branchA');
  assert.deepEqual(children(cli, 'scene'), ['left', 'picked', 'branchB', 'right']);
  assert.deepEqual(children(cli, 'picked'), ['branchA', 'b1']);
  assert.deepEqual(children(cli, 'branchA'), ['a1', 'deep', 'a2']);
  parent(cli, 'branchA', 'g#picked');
  parent(cli, 'deep', 'g#branchA');
  parent(cli, 'deepLabel', 'g#deep');
  assert.equal(details(cli, 'branchA'), branch);
  assert.equal(details(cli, 'deepLabel'), label);
  restores(cli, before, success(cli, 'tree'));
});

test('group can use the document root as LCA', () => {
  const cli = fixture();
  const before = success(cli, 'tree');
  success(cli, 'group overall foreground background');
  assert.deepEqual(children(cli), ['overall', 'scene']);
  assert.deepEqual(children(cli, 'overall'), ['background', 'foreground']);
  parent(cli, 'overall', 'svg');
  parent(cli, 'background', 'g#overall');
  restores(cli, before, success(cli, 'tree'));
});

test('group leaves emptied old containers in the document', () => {
  const cli = fixture();
  success(cli, 'group picked b2 a2 b1');
  assert.deepEqual(children(cli, 'picked'), ['a2', 'b1', 'b2']);
  assert.deepEqual(children(cli, 'branchB'), []);
  parent(cli, 'branchB', 'g#scene');
  assert.deepEqual(children(cli, 'scene'), ['left', 'picked', 'branchA', 'branchB', 'right']);
});

test('group rejects an ancestor and descendant in either argument order with the specified error', () => {
  const cli = fixture();
  const before = success(cli, 'tree');
  for (const selection of ['branchA deepLabel', 'deepLabel branchA', 'deep deepCircle', 'deepCircle deep']) {
    const container = selection.includes('branchA') ? 'branchA' : 'deep';
    failure(cli, `group bad ${selection}`, `error: cannot group a container into its own descendant: ${container}`);
    assert.equal(success(cli, 'tree'), before);
    failure(cli, 'show bad', 'error: no such shape: bad');
  }
});

test('group validates unique new IDs, distinct selections, and at least two nodes atomically', () => {
  const cli = fixture();
  const before = success(cli, 'tree');
  failure(cli, 'group scene a1 a2', 'error: id already exists: scene');
  failure(cli, 'group picked a1 missing', 'error: no such shape: missing');
  failure(cli, 'group picked a1 a1', 'error: duplicate shape id: a1');
  failure(cli, 'group picked a1');
  assert.equal(success(cli, 'tree'), before);
  success(cli, 'group Scene a2 a1');
  assert.deepEqual(children(cli, 'Scene'), ['a1', 'a2']);
  parent(cli, 'Scene', 'g#branchA');
});

test('ungroup promotes children into the original slot and restores the group with one undo', () => {
  const cli = fixture();
  const before = success(cli, 'tree');
  const label = details(cli, 'deepLabel');
  success(cli, 'ungroup deep');
  assert.deepEqual(children(cli, 'branchA'), ['a1', 'deepLabel', 'deepCircle', 'a2']);
  parent(cli, 'deepLabel', 'g#branchA');
  parent(cli, 'deepCircle', 'g#branchA');
  assert.equal(details(cli, 'deepLabel'), label);
  failure(cli, 'show deep', 'error: no such shape: deep');
  const after = success(cli, 'tree');
  restores(cli, before, after);
});

test('ungroup retains nested subtrees while changing only the promoted node parents', () => {
  const cli = fixture();
  const before = success(cli, 'tree');
  success(cli, 'ungroup branchA');
  assert.deepEqual(children(cli, 'scene'), ['left', 'a1', 'deep', 'a2', 'branchB', 'right']);
  assert.deepEqual(children(cli, 'deep'), ['deepLabel', 'deepCircle']);
  parent(cli, 'deep', 'g#scene');
  parent(cli, 'deepLabel', 'g#deep');
  parent(cli, 'a2', 'g#scene');
  restores(cli, before, success(cli, 'tree'));
});

test('ungroup removes an empty nested group and frees its ID while empty root groups remain forbidden', () => {
  const cli = fixture();
  success(cli, 'create g empty in branchA');
  const before = success(cli, 'tree');
  success(cli, 'ungroup empty');
  assert.deepEqual(children(cli, 'branchA'), ['a1', 'deep', 'a2']);
  failure(cli, 'show empty', 'error: no such shape: empty');
  success(cli, 'create circle empty 1 2 3');
  parent(cli, 'empty', 'svg');
  success(cli, 'undo');
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), before);
  success(cli, 'redo');
  success(cli, 'create g rootEmpty');
  failure(cli, 'ungroup rootEmpty', 'error: cannot ungroup top-level container: rootEmpty');
});

test('ungroup rejects top-level groups and leaf shapes without affecting state', () => {
  const cli = fixture();
  const before = success(cli, 'tree');
  failure(cli, 'ungroup scene', 'error: cannot ungroup top-level container: scene');
  failure(cli, 'ungroup a1', 'error: not a container: a1');
  failure(cli, 'ungroup missing', 'error: no such shape: missing');
  assert.equal(success(cli, 'tree'), before);
});

test('addto moves a leaf across parents as the last child and preserves its explicit attributes', () => {
  const cli = fixture();
  const before = success(cli, 'tree');
  const a2 = details(cli, 'a2');
  success(cli, 'addto branchB a2');
  assert.deepEqual(children(cli, 'branchA'), ['a1', 'deep']);
  assert.deepEqual(children(cli, 'branchB'), ['b1', 'b2', 'a2']);
  parent(cli, 'a2', 'g#branchB');
  assert.equal(details(cli, 'a2'), a2);
  restores(cli, before, success(cli, 'tree'));
});

test('addto moves whole subtrees without changing descendant parents, order, or explicit styles', () => {
  const cli = fixture();
  success(cli, 'set deep stroke blue');
  const before = success(cli, 'tree');
  const deep = details(cli, 'deep');
  const label = details(cli, 'deepLabel');
  success(cli, 'addto branchB deep');
  assert.deepEqual(children(cli, 'branchA'), ['a1', 'a2']);
  assert.deepEqual(children(cli, 'branchB'), ['b1', 'b2', 'deep']);
  assert.deepEqual(children(cli, 'deep'), ['deepLabel', 'deepCircle']);
  parent(cli, 'deep', 'g#branchB');
  parent(cli, 'deepLabel', 'g#deep');
  assert.equal(details(cli, 'deep'), deep);
  assert.equal(details(cli, 'deepLabel'), label);
  restores(cli, before, success(cli, 'tree'));
});

test('addto may move a nested group upward into an ancestor and a root leaf down into a group', () => {
  const cli = fixture();
  const before = success(cli, 'tree');
  success(cli, 'addto scene deep');
  assert.deepEqual(children(cli, 'branchA'), ['a1', 'a2']);
  assert.deepEqual(children(cli, 'scene'), ['left', 'branchA', 'branchB', 'right', 'deep']);
  parent(cli, 'deep', 'g#scene');
  parent(cli, 'deepCircle', 'g#deep');
  const promoted = success(cli, 'tree');
  success(cli, 'addto deep foreground');
  assert.deepEqual(children(cli), ['background', 'scene']);
  assert.deepEqual(children(cli, 'deep'), ['deepLabel', 'deepCircle', 'foreground']);
  parent(cli, 'foreground', 'g#deep');
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), promoted);
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), before);
});

test('addto within the same parent moves the selected child to the end', () => {
  const cli = fixture();
  const before = success(cli, 'tree');
  success(cli, 'addto branchA a1');
  assert.deepEqual(children(cli, 'branchA'), ['deep', 'a2', 'a1']);
  parent(cli, 'a1', 'g#branchA');
  assert.deepEqual(children(cli, 'scene'), ['left', 'branchA', 'branchB', 'right']);
  restores(cli, before, success(cli, 'tree'));
});

test('addto rejects direct and indirect cycles and noncontainer targets atomically', () => {
  const cli = fixture();
  const before = success(cli, 'tree');
  for (const [destination, source] of [['branchA', 'branchA'], ['deep', 'branchA'], ['deep', 'deep']]) {
    failure(cli, `addto ${destination} ${source}`, `error: cannot move a container into its own descendant: ${source}`);
    assert.equal(success(cli, 'tree'), before);
  }
  failure(cli, 'addto a1 b1', 'error: not a container: a1');
  failure(cli, 'addto deepLabel branchA', 'error: not a container: deepLabel');
  failure(cli, 'addto branchA missing', 'error: no such shape: missing');
  failure(cli, 'addto missing a1');
  assert.equal(success(cli, 'tree'), before);
});

test('front and back change only SVG sibling order and restore the exact previous tree', () => {
  for (const [command, expected] of [
    ['front a1', ['deep', 'a2', 'a1']],
    ['back a2', ['a2', 'a1', 'deep']],
  ] as const) {
    const cli = fixture();
    const before = success(cli, 'tree');
    const a1 = details(cli, 'a1');
    success(cli, command);
    assert.deepEqual(children(cli, 'branchA'), expected);
    assert.deepEqual(children(cli, 'scene'), ['left', 'branchA', 'branchB', 'right']);
    assert.deepEqual(children(cli), ['background', 'scene', 'foreground']);
    parent(cli, 'a1', 'g#branchA');
    assert.equal(details(cli, 'a1'), a1);
    restores(cli, before, success(cli, 'tree'));
  }
});

test('front/back also handle root siblings and entire group subtrees', () => {
  for (const [command, rootOrder, sceneOrder] of [
    ['front background', ['scene', 'foreground', 'background'], ['left', 'branchA', 'branchB', 'right']],
    ['back foreground', ['foreground', 'background', 'scene'], ['left', 'branchA', 'branchB', 'right']],
    ['front branchA', ['background', 'scene', 'foreground'], ['left', 'branchB', 'right', 'branchA']],
    ['back branchB', ['background', 'scene', 'foreground'], ['branchB', 'left', 'branchA', 'right']],
  ] as const) {
    const cli = fixture();
    const before = success(cli, 'tree');
    success(cli, command);
    assert.deepEqual(children(cli), rootOrder);
    assert.deepEqual(children(cli, 'scene'), sceneOrder);
    assert.deepEqual(children(cli, 'branchA'), ['a1', 'deep', 'a2']);
    parent(cli, 'deepLabel', 'g#deep');
    restores(cli, before, success(cli, 'tree'));
  }
});

test('structure edits preserve explicit styles and ungroup removes only the discarded group style', () => {
  const cli = fixture();
  success(cli, 'set branchA fill blue');
  success(cli, 'set branchB fill green');
  const before = success(cli, 'tree');
  const inherited = details(cli, 'a2');
  const explicit = details(cli, 'a1');
  success(cli, 'group picked a2 a1');
  assert.equal(details(cli, 'a2'), inherited);
  assert.equal(details(cli, 'a1'), explicit);
  assert.doesNotMatch(details(cli, 'picked'), /fill=/);
  success(cli, 'set picked fill orange');
  success(cli, 'addto branchB picked');
  assert.equal(details(cli, 'a2'), inherited);
  assert.equal(details(cli, 'a1'), explicit);
  assert.match(details(cli, 'picked'), /fill=orange/);
  const grouped = success(cli, 'tree');
  success(cli, 'ungroup picked');
  parent(cli, 'a2', 'g#branchB');
  parent(cli, 'a1', 'g#branchB');
  assert.equal(details(cli, 'a2'), inherited);
  assert.equal(details(cli, 'a1'), explicit);
  failure(cli, 'show picked', 'error: no such shape: picked');
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), grouped);
  success(cli, 'undo');
  success(cli, 'undo');
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), before);
});

test('successful edge reorder and same-parent addto still record history and clear redo', () => {
  for (const command of ['front a2', 'back a1', 'addto branchA a2']) {
    const cli = fixture();
    success(cli, 'set left fill red');
    success(cli, 'undo');
    const before = success(cli, 'tree');
    success(cli, command);
    assert.equal(success(cli, 'tree'), before, command);
    failure(cli, 'redo');
    success(cli, 'undo');
    assert.equal(success(cli, 'tree'), before);
    success(cli, 'redo');
    assert.equal(success(cli, 'tree'), before);
    success(cli, 'canvas 800 600');
    success(cli, command);
    success(cli, 'undo');
    assert.equal(success(cli, 'tree'), before);
    failure(cli, 'undo');
  }
});

test('failed hierarchy commands preserve the current tree and pending redo', () => {
  const cli = fixture();
  success(cli, 'set deepLabel text "已更新"');
  const updated = success(cli, 'tree');
  success(cli, 'undo');
  const before = success(cli, 'tree');
  for (const command of [
    'group bad branchA deepLabel', 'group bad a1 a1', 'group bad a1',
    'group scene a1 a2', 'group bad a1 missing', 'ungroup scene', 'ungroup a1',
    'addto deep branchA', 'addto a1 b1', 'addto missing a1', 'addto branchA missing',
    'front missing', 'back missing',
  ]) {
    failure(cli, command);
    assert.equal(success(cli, 'tree'), before, command);
  }
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), updated);
});

test('failed hierarchy commands preserve a document barrier', () => {
  const cli = fixture();
  success(cli, 'canvas 400 300');
  const before = success(cli, 'tree');
  for (const command of ['group bad branchA deepLabel', 'ungroup scene', 'addto deep branchA', 'front missing', 'back missing']) {
    failure(cli, command);
    failure(cli, 'undo', 'error: undo not allowed after io command');
    failure(cli, 'redo', 'error: undo not allowed after io command');
  }
  assert.equal(success(cli, 'tree'), before);
});

test('group, ungroup, and addto each reopen history after a canvas barrier', () => {
  for (const command of ['group picked a2 a1', 'ungroup deep', 'addto branchB a2']) {
    const cli = fixture();
    success(cli, 'canvas 400 300');
    const before = success(cli, 'tree');
    success(cli, command);
    const after = success(cli, 'tree');
    success(cli, 'undo');
    assert.equal(success(cli, 'tree'), before);
    failure(cli, 'undo');
    success(cli, 'redo');
    assert.equal(success(cli, 'tree'), after);
  }
});

test('mixed stage A/B/C commands and deleted-ID reuse each keep one undo unit', () => {
  const cli = editor();
  success(cli, 'init');
  const snapshots = [success(cli, 'tree')];
  for (const command of [
    'create g scene', 'create rect a 10 20 30 40 red', 'create rect b 50 60 70 80 blue',
    'group pair b a', 'addto scene pair', 'move pair 2 3', 'scale pair 2',
    'set a fill orange', 'back b', 'front b', 'ungroup pair', 'delete a',
    'create text a 1 2 "复用 ID"',
  ]) {
    success(cli, command);
    snapshots.push(success(cli, 'tree'));
  }
  assert.match(success(cli, 'show a'), /^text#a/);
  for (let index = snapshots.length - 2; index >= 0; index -= 1) {
    success(cli, 'undo');
    assert.equal(success(cli, 'tree'), snapshots[index]);
  }
  failure(cli, 'undo');
  for (let index = 1; index < snapshots.length; index += 1) {
    success(cli, 'redo');
    assert.equal(success(cli, 'tree'), snapshots[index]);
  }
  assert.match(success(cli, 'show a'), /^text#a/);
  failure(cli, 'show pair', 'error: no such shape: pair');
});

test('malformed hierarchy arguments are rejected without state or redo changes', () => {
  const cli = fixture();
  success(cli, 'set left fill purple');
  const updated = success(cli, 'tree');
  success(cli, 'undo');
  const before = success(cli, 'tree');
  for (const command of [
    'group', 'group picked', 'group picked a1', 'group "" a1 a2', 'group picked a1 a2 extra',
    'ungroup', 'ungroup deep extra', 'addto', 'addto branchA', 'addto branchA a1 extra',
    'front', 'front a1 extra', 'back', 'back a1 extra',
  ]) {
    failure(cli, command);
    assert.equal(success(cli, 'tree'), before, command);
  }
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), updated);
});

test('all hierarchy commands keep the specified no-document and missing-shape errors', () => {
  const cli = editor();
  for (const command of ['group picked a b', 'ungroup g', 'addto g a', 'front a', 'back a']) {
    failure(cli, command, "error: no document. use 'init' or 'read' first");
  }
  success(cli, 'init');
  success(cli, 'create g existing');
  success(cli, 'create circle a 1 2 3');
  for (const command of ['group picked a missing', 'ungroup missing', 'addto existing missing', 'front missing', 'back missing']) {
    failure(cli, command, 'error: no such shape: missing');
  }
});

test('group summary locates a cross-parent group before its retained anchor branch', () => {
  const cli = fixture();
  const summary = success(cli, 'group picked b1 deepCircle');
  assert.equal(summary, 'g#picked created with 2 children in g#scene (sibling 2 of 5)');
  assert.deepEqual(children(cli, 'scene'), ['left', 'picked', 'branchA', 'branchB', 'right']);
  assert.deepEqual(children(cli, 'picked'), ['deepCircle', 'b1']);
  assert.deepEqual(children(cli, 'deep'), ['deepLabel']);
  assert.deepEqual(children(cli, 'branchB'), ['b2']);
  parent(cli, 'picked', 'g#scene');
  parent(cli, 'deepCircle', 'g#picked');
});

test('root-LCA group summaries identify first, last, and sole positions and survive undo/redo failures', () => {
  for (const { selection, ordinal, count, expectedRoots } of [
    { selection: ['foreground', 'background'], ordinal: 1, count: 2, expectedRoots: ['overall', 'scene'] },
    { selection: ['foreground', 'scene'], ordinal: 2, count: 2, expectedRoots: ['background', 'overall'] },
    { selection: ['foreground', 'scene', 'background'], ordinal: 1, count: 1, expectedRoots: ['overall'] },
  ]) {
    const cli = fixture();
    const before = success(cli, 'tree');
    const summary = `g#overall created with ${selection.length} children in svg (sibling ${ordinal} of ${count})`;
    assert.equal(success(cli, `group overall ${selection.join(' ')}`), summary);
    assert.deepEqual(children(cli), expectedRoots);
    parent(cli, 'overall', 'svg');
    const after = success(cli, 'tree');
    success(cli, 'undo');
    assert.equal(success(cli, 'tree'), before);
    failure(cli, 'group invalid scene deepLabel', 'error: cannot group a container into its own descendant: scene');
    assert.equal(success(cli, 'tree'), before);
    assert.deepEqual(cli.executeLine('redo'), [summary]);
    assert.equal(success(cli, 'tree'), after);
  }
});
