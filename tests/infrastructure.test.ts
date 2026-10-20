import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs, { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { NodeFileStore } from '../src/infrastructure/NodeFileStore.js';

function temporary(context: TestContext): string {
  const directory = mkdtempSync(join(tmpdir(), 'svg-editor-files-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('NodeFileStore reads UTF-8 and atomically creates and overwrites files without leaving temporary files', (context) => {
  const directory = temporary(context);
  const path = join(directory, '中文 file.svg');
  const store = new NodeFileStore();
  const first = '<svg>开始 &amp; 结束</svg>\n';
  const second = '<svg>更新 "第二版"</svg>\n';
  store.writeAtomic(path, first);
  assert.equal(store.read(path), first);
  assert.deepEqual(readFileSync(path), Buffer.from(first, 'utf8'));
  store.writeAtomic(path, second);
  assert.equal(store.read(path), second);
  assert.deepEqual(readdirSync(directory), ['中文 file.svg']);
});

test('a failed final rename preserves the target original bytes and cleans the temporary file', (context) => {
  const directory = temporary(context);
  const path = join(directory, 'existing.svg');
  const original = Buffer.from('<svg>原始内容</svg>\n', 'utf8');
  writeFileSync(path, original);
  const rename = context.mock.method(fs, 'renameSync', () => { throw new Error('injected rename failure'); });
  syncBuiltinESMExports();
  try {
    assert.throws(() => new NodeFileStore().writeAtomic(path, '<svg>replacement</svg>'),
      { message: `cannot write file: ${path}` });
  } finally {
    rename.mock.restore();
    syncBuiltinESMExports();
  }
  assert.deepEqual(readFileSync(path), original);
  assert.deepEqual(readdirSync(directory), ['existing.svg']);
});

test('filesystem errors use prescribed messages and leave no files at directory or missing-parent targets', (context) => {
  const directory = temporary(context);
  const store = new NodeFileStore();
  const missing = join(directory, 'missing.svg');
  assert.throws(() => store.read(missing), { message: `cannot read file: ${missing}` });
  assert.throws(() => store.read(directory), { message: `cannot read file: ${directory}` });
  assert.throws(() => store.writeAtomic(directory, 'content'), { message: `cannot write file: ${directory}` });
  const impossible = join(directory, 'absent', 'new.svg');
  assert.throws(() => store.writeAtomic(impossible, 'content'), { message: `cannot write file: ${impossible}` });
  assert.deepEqual(readdirSync(directory), []);
});

test('a colliding temporary name preserves both the existing temporary file and target bytes', (context) => {
  const directory = temporary(context);
  const target = join(directory, 'existing.svg');
  const uuid = '11111111-1111-4111-8111-111111111111';
  const collision = join(directory, `.existing.svg.${uuid}.tmp`);
  const original = Buffer.from('<svg>original</svg>\n', 'utf8');
  const unrelated = Buffer.from([0, 255, 1, 2, 3]);
  writeFileSync(target, original);
  writeFileSync(collision, unrelated);
  const random = context.mock.method(crypto, 'randomUUID', () => uuid);
  syncBuiltinESMExports();
  try {
    assert.throws(() => new NodeFileStore().writeAtomic(target, '<svg>replacement</svg>'),
      { message: `cannot write file: ${target}` });
  } finally {
    random.mock.restore();
    syncBuiltinESMExports();
  }
  assert.deepEqual(readFileSync(target), original);
  assert.deepEqual(readFileSync(collision), unrelated);
  assert.deepEqual(readdirSync(directory).sort(), [`.existing.svg.${uuid}.tmp`, 'existing.svg'].sort());
});
