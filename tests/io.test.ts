import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { EditorSession } from '../src/application/EditorSession.js';
import { Cli } from '../src/cli/Cli.js';
import { CommandDispatcher } from '../src/cli/CommandDispatcher.js';
import { CommandLineParser } from '../src/cli/CommandLineParser.js';
import { NodeFileStore } from '../src/infrastructure/NodeFileStore.js';
import { SvgCodec } from '../src/svg/SvgCodec.js';
import { SvgDocumentGateway } from '../src/svg/SvgDocumentGateway.js';

function editor(): Cli {
  return new Cli(new EditorSession(new SvgDocumentGateway(new NodeFileStore(), new SvgCodec())),
    new CommandLineParser(), new CommandDispatcher());
}

function temporary(context: TestContext): string {
  const directory = mkdtempSync(join(tmpdir(), 'svg-editor-io-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function success(cli: Cli, command: string): string {
  const lines = cli.executeLine(command);
  assert.ok(lines.every((line) => !line.startsWith('error:')), `${command}: ${lines.join('\n')}`);
  return lines.join('\n');
}

function failure(cli: Cli, command: string, expected?: string): void {
  const lines = cli.executeLine(command);
  assert.equal(lines.length, 1, `${command} must produce one error without leaked warnings`);
  assert.match(lines[0]!, /^error: /);
  if (expected !== undefined) assert.equal(lines[0], expected);
}

function svg(body: string, width = 200, height = 100): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}

function write(directory: string, name: string, content = svg('<rect id="r" x="10" y="20" width="30" height="40"/>')): string {
  const path = join(directory, name);
  writeFileSync(path, content, 'utf8');
  return path;
}

function fixture(name: string): string {
  return fileURLToPath(new URL(`../examples/${name}`, import.meta.url));
}

test('read works before init and imports the teacher other.svg with its exact warning and hierarchy', () => {
  const cli = editor();
  const path = fixture('other.svg');
  assert.deepEqual(cli.executeLine(`read ${JSON.stringify(path)}`), [
    'warning: assigned id rect1 to unnamed <rect>', `read ${path} (7 elements)`,
  ]);
  assert.equal(success(cli, 'tree'), [
    'svg (400x300)',
    '├── rect#rect1 x=0 y=0 w=400 h=300 fill=#ffffff',
    '├── text#t1 (10,290) "imported"',
    '├── circle#c1 cx=50 cy=50 r=10',
    '├── g#g1',
    '│   ├── rect#r2 x=0 y=0 w=10 h=10',
    '│   └── circle#c2 cx=5 cy=5 r=2',
    '└── ellipse#e1 cx=1 cy=2 rx=3 ry=4',
  ].join('\n'));
  assert.match(success(cli, 'show r2'), /parent=g#g1/);
  failure(cli, 'undo', 'error: undo not allowed after io command');
});

test('all six types, nested styles, and escaped Unicode text survive a real saved-file round trip', (context) => {
  const directory = temporary(context);
  const path = join(directory, '六种 图形.svg');
  const cli = editor();
  const content = '中文 <>& "quoted" C:\\tmp';
  for (const command of [
    'init 640.5 480.25', 'create g scene', 'set scene fill #112233', 'set scene stroke-width 2.5',
    'create rect r -1.5 2.5 30 40 #4a90d9 in scene', 'create circle c 50 60 7 in scene',
    'create ellipse e 80 90 10 12 blue in scene', 'create line l 1 2 3 4 black in scene',
    'create g nested in scene', `create text t 20 40 ${JSON.stringify(content)} in nested`,
  ]) success(cli, command);
  const before = success(cli, 'tree');
  const details = success(cli, 'show t');
  assert.equal(success(cli, `save ${JSON.stringify(path)}`), `saved to ${path} (7 elements)`);
  const xml = readFileSync(path, 'utf8');
  assert.match(xml, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(xml, /&lt;/);
  assert.match(xml, /&amp;/);
  const loaded = editor();
  assert.equal(success(loaded, `read ${JSON.stringify(path)}`), `read ${path} (7 elements)`);
  assert.equal(success(loaded, 'tree'), before);
  assert.equal(success(loaded, 'show t'), details);
  assert.doesNotMatch(success(loaded, 'show c'), /fill=/);
  success(loaded, 'move nested 5 10');
  assert.match(success(loaded, 'show t'), /x=25 y=50/);
  success(loaded, 'undo');
  assert.equal(success(loaded, 'tree'), before);
});

test('the three exact teacher SVG fixtures preserve model state and required imported attributes on round trip', (context) => {
  const directory = temporary(context);
  for (const name of ['background-basic.svg', 'background-transformed.svg', 'other.svg']) {
    const cli = editor();
    const read = success(cli, `read ${JSON.stringify(fixture(name))}`);
    const before = success(cli, 'tree');
    const output = join(directory, name);
    success(cli, `save ${JSON.stringify(output)}`);
    const xml = readFileSync(output, 'utf8');
    if (name === 'background-transformed.svg') {
      assert.match(read, /warning: assigned id rect1 to unnamed <rect>/);
      assert.match(read, /warning: assigned id text1 to unnamed <text>/);
      assert.match(xml, /transform=/);
      assert.match(xml, /font-size="16"/);
      assert.match(xml, /text-anchor="middle"/);
    }
    const loaded = editor();
    const reopened = success(loaded, `read ${JSON.stringify(output)}`);
    assert.doesNotMatch(reopened, /warning:/);
    assert.equal(success(loaded, 'tree'), before, name);
  }
});

test('read reserves explicit IDs across the entire file before assigning IDs of every type', (context) => {
  const directory = temporary(context);
  const path = write(directory, 'assigned.svg', svg([
    '<rect x="0" y="0" width="1" height="2"/>',
    '<g><circle cx="1" cy="2" r="3"/><ellipse cx="1" cy="2" rx="3" ry="4"/>',
    '<line x1="1" y1="2" x2="3" y2="4"/><text x="1" y="2">auto</text></g>',
    '<rect id="rect1" x="0" y="0" width="1" height="2"/><g id="g1"/>',
    '<circle id="circle1" cx="1" cy="2" r="3"/><ellipse id="ellipse1" cx="1" cy="2" rx="3" ry="4"/>',
    '<line id="line1" x1="1" y1="2" x2="3" y2="4"/><text id="text1" x="1" y="2">explicit</text>',
  ].join('')));
  const cli = editor();
  const lines = cli.executeLine(`read ${JSON.stringify(path)}`);
  assert.deepEqual(lines.slice(0, -1), ['rect', 'g', 'circle', 'ellipse', 'line', 'text']
    .map((kind) => `warning: assigned id ${kind}2 to unnamed <${kind}>`));
  assert.equal(lines.at(-1), `read ${path} (12 elements)`);
  for (const kind of ['rect', 'g', 'circle', 'ellipse', 'line', 'text']) {
    assert.match(success(cli, `show ${kind}1`), new RegExp(`^${kind}#${kind}1`));
    assert.match(success(cli, `show ${kind}2`), new RegExp(`^${kind}#${kind}2`));
  }
  assert.match(success(cli, 'show circle2'), /parent=g#g2/);
});

test('read preserves case-sensitive IDs but rejects duplicate explicit IDs without leaking buffered warnings', (context) => {
  const directory = temporary(context);
  const good = write(directory, 'case.svg', svg('<g id="id"/><g id="ID"/>'));
  const duplicate = write(directory, 'duplicate.svg', svg('<rect x="0" y="0" width="1" height="1"/><g id="same"/><g id="same"/>'));
  const cli = editor();
  success(cli, `read ${JSON.stringify(good)}`);
  assert.match(success(cli, 'show id'), /^g#id/);
  assert.match(success(cli, 'show ID'), /^g#ID/);
  const before = success(cli, 'tree');
  failure(cli, `read ${JSON.stringify(duplicate)}`);
  assert.equal(success(cli, 'tree'), before);
});

test('default save uses the last successful read path while explicit save does not change it', (context) => {
  const directory = temporary(context);
  const source = write(directory, '原始 drawing.svg');
  const alternate = join(directory, '另存 copy.svg');
  const cli = editor();
  success(cli, `read ${JSON.stringify(source)}`);
  success(cli, 'move r 5 0');
  assert.equal(success(cli, `save ${JSON.stringify(alternate)}`), `saved to ${alternate} (1 elements)`);
  const copiedBytes = readFileSync(alternate, 'utf8');
  success(cli, 'move r 7 0');
  assert.equal(success(cli, 'save'), `saved to ${source} (1 elements)`);
  assert.equal(readFileSync(alternate, 'utf8'), copiedBytes);
  const loaded = editor();
  success(loaded, `read ${JSON.stringify(source)}`);
  assert.match(success(loaded, 'show r'), /x=22 y=20/);
  success(loaded, `read ${JSON.stringify(alternate)}`);
  assert.match(success(loaded, 'show r'), /x=15 y=20/);
});

test('init clears a read-derived path and explicit save from init never sets a default', (context) => {
  const directory = temporary(context);
  const source = write(directory, 'source.svg');
  const target = join(directory, 'explicit.svg');
  const cli = editor();
  success(cli, `read ${JSON.stringify(source)}`);
  success(cli, 'init');
  failure(cli, 'save', "error: no default save path. specify a file or use 'read' first");
  success(cli, `save ${JSON.stringify(target)}`);
  failure(cli, 'save', "error: no default save path. specify a file or use 'read' first");
  assert.match(readFileSync(source, 'utf8'), /id="r"/);
});

test('a later successful read replaces both the document and its default path', (context) => {
  const directory = temporary(context);
  const first = write(directory, 'first.svg');
  const second = write(directory, 'second.svg', svg('<circle id="c" cx="1" cy="2" r="3"/>', 300, 400));
  const original = readFileSync(first, 'utf8');
  const cli = editor();
  success(cli, `read ${JSON.stringify(first)}`);
  success(cli, `read ${JSON.stringify(second)}`);
  failure(cli, 'show r', 'error: no such shape: r');
  assert.match(success(cli, 'canvas'), /300x400/);
  success(cli, 'move c 10 20');
  assert.equal(success(cli, 'save'), `saved to ${second} (1 elements)`);
  assert.equal(readFileSync(first, 'utf8'), original);
});

test('failed reads preserve the document, original save path, and a pending redo', (context) => {
  const directory = temporary(context);
  const source = write(directory, 'source.svg');
  const missing = join(directory, 'missing.svg');
  const invalid = write(directory, 'bad.svg', svg('<rect x="0" y="0" width="1" height="1"/><path id="unsupported" d="M0 0"/>'));
  const cli = editor();
  success(cli, `read ${JSON.stringify(source)}`);
  success(cli, 'move r 5 10');
  const completed = success(cli, 'tree');
  success(cli, 'undo');
  const before = success(cli, 'tree');
  failure(cli, `read ${JSON.stringify(missing)}`, `error: cannot read file: ${missing}`);
  failure(cli, `read ${JSON.stringify(invalid)}`);
  assert.equal(success(cli, 'tree'), before);
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), completed);
  assert.equal(success(cli, 'save'), `saved to ${source} (1 elements)`);
  const loaded = editor();
  success(loaded, `read ${JSON.stringify(source)}`);
  assert.equal(success(loaded, 'tree'), completed);
});

test('late parse or semantic failures do not expose assigned-ID warnings or change either history stack', (context) => {
  const directory = temporary(context);
  const cli = editor();
  success(cli, 'init');
  success(cli, 'create circle c 1 2 3');
  success(cli, 'move c 4 5');
  const completed = success(cli, 'tree');
  success(cli, 'undo');
  const before = success(cli, 'tree');
  const unnamed = '<rect x="0" y="0" width="1" height="1"/>';
  for (const [index, content] of [
    svg(`${unnamed}<g id="duplicate"/><g id="duplicate"/>`),
    svg(`${unnamed}<unknown id="bad"/>`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">${unnamed}<g></svg>`,
  ].entries()) {
    const path = write(directory, `bad-${index}.svg`, content);
    failure(cli, `read ${JSON.stringify(path)}`);
    assert.equal(success(cli, 'tree'), before);
  }
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), completed);
  success(cli, 'undo');
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), 'svg (800x600)');
});

test('save after undo writes the visible state and blocks undo/redo until the next successful edit', (context) => {
  const directory = temporary(context);
  const target = join(directory, 'visible.svg');
  const cli = editor();
  for (const command of ['init', 'create g scene', 'create circle c 1 2 3 in scene', 'create text undone 1 2 "hidden"']) success(cli, command);
  success(cli, 'undo');
  const saved = success(cli, 'tree');
  success(cli, `save ${JSON.stringify(target)}`);
  failure(cli, 'undo', 'error: undo not allowed after io command');
  failure(cli, 'redo', 'error: undo not allowed after io command');
  failure(cli, 'move c NaN 2');
  failure(cli, 'undo', 'error: undo not allowed after io command');
  success(cli, 'move c 4 5');
  const edited = success(cli, 'tree');
  success(cli, 'canvas');
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), saved);
  failure(cli, 'undo');
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), edited);
  const loaded = editor();
  success(loaded, `read ${JSON.stringify(target)}`);
  assert.equal(success(loaded, 'tree'), saved);
  failure(loaded, 'show undone', 'error: no such shape: undone');
});

test('successful read replaces old history and new edits can undo only back to that import', (context) => {
  const directory = temporary(context);
  const path = write(directory, 'import.svg');
  const cli = editor();
  success(cli, 'init');
  success(cli, 'create circle previous 1 2 3');
  success(cli, 'undo');
  success(cli, `read ${JSON.stringify(path)}`);
  const imported = success(cli, 'tree');
  failure(cli, 'undo', 'error: undo not allowed after io command');
  failure(cli, 'redo', 'error: undo not allowed after io command');
  success(cli, 'create g fresh');
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), imported);
  failure(cli, 'undo');
});

test('stable file write errors preserve visible state and pending redo', (context) => {
  const directory = temporary(context);
  const cli = editor();
  success(cli, 'init');
  success(cli, 'create circle c 1 2 3');
  success(cli, 'move c 4 5');
  const completed = success(cli, 'tree');
  success(cli, 'undo');
  const before = success(cli, 'tree');
  for (const target of [directory, join(directory, 'absent', 'target.svg')]) {
    failure(cli, `save ${JSON.stringify(target)}`, `error: cannot write file: ${target}`);
    assert.equal(success(cli, 'tree'), before);
  }
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), completed);
});

test('failed file operations retain an existing barrier and failed read before init leaves no document', (context) => {
  const directory = temporary(context);
  const missing = join(directory, 'missing.svg');
  const cli = editor();
  failure(cli, `read ${JSON.stringify(missing)}`, `error: cannot read file: ${missing}`);
  failure(cli, 'tree', "error: no document. use 'init' or 'read' first");
  failure(cli, 'save', "error: no document. use 'init' or 'read' first");
  success(cli, 'init');
  failure(cli, `read ${JSON.stringify(missing)}`, `error: cannot read file: ${missing}`);
  failure(cli, `save ${JSON.stringify(directory)}`, `error: cannot write file: ${directory}`);
  failure(cli, 'undo', 'error: undo not allowed after io command');
  failure(cli, 'redo', 'error: undo not allowed after io command');
  assert.equal(success(cli, 'tree'), 'svg (800x600)');
});

test('read/save reject missing or extra parameters without changing state or redo', (context) => {
  const directory = temporary(context);
  const cli = editor();
  success(cli, 'init');
  success(cli, 'create circle c 1 2 3');
  success(cli, 'move c 4 5');
  const completed = success(cli, 'tree');
  success(cli, 'undo');
  const before = success(cli, 'tree');
  for (const command of ['read', 'read ""', 'read a.svg b.svg', 'save a.svg b.svg', 'save "unterminated']) {
    failure(cli, command);
    assert.equal(success(cli, 'tree'), before);
  }
  failure(cli, `read ${JSON.stringify(directory)}`, `error: cannot read file: ${directory}`);
  success(cli, 'redo');
  assert.equal(success(cli, 'tree'), completed);
});

test('an empty SVG document keeps its floating-point canvas size through save/read', (context) => {
  const directory = temporary(context);
  const target = join(directory, 'empty.svg');
  const cli = editor();
  success(cli, 'init 123.5 456.25');
  assert.equal(success(cli, `save ${JSON.stringify(target)}`), `saved to ${target} (0 elements)`);
  const loaded = editor();
  success(loaded, `read ${JSON.stringify(target)}`);
  assert.equal(success(loaded, 'tree'), 'svg (123.5x456.25)');
});

test('extreme finite parent transforms can reparent, undo, redo and round trip through a saved file', (context) => {
  const directory = temporary(context);
  const input = write(directory, 'extreme.svg', svg(
    '<g id="left" transform="translate(1e308,0) scale(1e-10)"><rect id="r" x="1" y="1" width="1" height="1"/></g>' +
    '<g id="right" transform="translate(1e308,0) scale(1e-10)"/>',
  ));
  const output = join(directory, 'reparented.svg');
  const cli = editor();
  success(cli, `read ${JSON.stringify(input)}`);
  const before = success(cli, 'tree');
  success(cli, 'addto right r');
  assert.match(success(cli, 'show r'), /parent=g#right/);
  success(cli, 'undo');
  assert.equal(success(cli, 'tree'), before);
  success(cli, 'redo');
  const after = success(cli, 'tree');
  success(cli, `save ${JSON.stringify(output)}`);
  success(cli, `read ${JSON.stringify(output)}`);
  assert.equal(success(cli, 'tree'), after);
  assert.match(success(cli, 'show r'), /parent=g#right/);
});

test('the full teacher session in section 6 saves and reopens the edited document before reading other.svg', (context) => {
  const directory = temporary(context);
  const demo = join(directory, 'demo.svg');
  const cli = editor();
  for (const command of [
    'init 800 600', 'create rect bg 0 0 800 600 #ffffff', 'create text title 20 40 "My Diagram"',
    'create circle c1 100 100 20 red', 'create rect box 200 80 60 60 #3366ff',
    'group markers c1 box', 'tree', 'move c1 30 0', 'undo', 'redo',
    'set title text "My Diagram v2"', 'undo',
  ]) success(cli, command);
  failure(cli, 'group bad c1 markers', 'error: cannot group a container into its own descendant: markers');
  success(cli, 'delete box');
  success(cli, 'undo');
  const before = success(cli, 'tree');
  assert.match(before, /circle#c1 cx=130 cy=100 r=20 fill=red/);
  assert.match(before, /text#title \(20,40\) "My Diagram"/);
  assert.equal(success(cli, `save ${JSON.stringify(demo)}`), `saved to ${demo} (5 elements)`);
  failure(cli, 'undo', 'error: undo not allowed after io command');
  const reopened = editor();
  success(reopened, `read ${JSON.stringify(demo)}`);
  assert.equal(success(reopened, 'tree'), before);
  const other = join(directory, 'other.svg');
  copyFileSync(fixture('other.svg'), other);
  assert.match(success(cli, `read ${JSON.stringify(other)}`), /warning: assigned id rect1 to unnamed <rect>/);
  assert.match(success(cli, 'tree'), /^svg \(400x300\)/);
  assert.match(success(cli, 'show r2'), /parent=g#g1/);
  failure(cli, 'show markers', 'error: no such shape: markers');
});

test('the full two-node flowchart version A survives editing, save, read, and further editing', (context) => {
  const directory = temporary(context);
  const target = join(directory, 'flowchart.svg');
  const cli = editor();
  for (const command of [
    'init 800 600', 'create g flowchart', 'create g node1 in flowchart',
    'create rect start 120 100 160 60 #4a90d9 in node1', 'create text start-label 155 135 "开始" in node1',
    'create g node2 in flowchart', 'create rect process 520 100 160 60 #f5a623 in node2',
    'create text process-label 545 135 "处理数据" in node2', 'create line arrow1 280 130 520 130 black in flowchart',
    'tree', 'move node2 0 100', 'undo', 'set process-label text "处理数据 v2"',
  ]) success(cli, command);
  const before = success(cli, 'tree');
  assert.equal(success(cli, `save ${JSON.stringify(target)}`), `saved to ${target} (8 elements)`);
  const loaded = editor();
  success(loaded, `read ${JSON.stringify(target)}`);
  assert.equal(success(loaded, 'tree'), before);
  assert.match(success(loaded, 'show process-label'), /parent=g#node2\n\s+x=545 y=135\n\s+text="处理数据 v2"/);
  success(loaded, 'move node2 0 100');
  assert.match(success(loaded, 'show process-label'), /x=545 y=235/);
  success(loaded, 'undo');
  assert.equal(success(loaded, 'tree'), before);
});
