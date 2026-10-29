// 가짜 뷰어 서버를 실제 HTTP로 호출해 어댑터 -> 수집 -> PDF 조립 -> 검증 스크립트까지 한 번에 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pickAdapter } from '../src/adapters/index.js';
import { convertPages } from '../src/core/convert.js';
import { startFakeViewer, pageImage } from './helpers/fake-viewer.js';

const opts = { intervalMs: 0, backoffMs: 1 };

test('가짜 뷰어에서 PDF를 만들면 verify-pdf를 모두 통과한다', async () => {
  const viewer = await startFakeViewer({ pages: 6 });
  try {
    const adapter = await pickAdapter(viewer.doc);
    assert.equal(adapter.name, 'project-json');
    const urls = (await adapter.listPages(viewer.doc)).map(p => p.url);
    assert.equal(urls.length, 6);

    const blob = await convertPages(urls, opts);

    const dir = mkdtempSync(join(tmpdir(), 'chaekon-e2e-'));
    mkdirSync(join(dir, 'imgs'));
    for (let k = 1; k <= 6; k++) writeFileSync(join(dir, 'imgs', `page-${String(k).padStart(4, '0')}.jpg`), pageImage('abc123', k));
    writeFileSync(join(dir, 'out.pdf'), new Uint8Array(await blob.arrayBuffer()));

    const r = spawnSync(process.execPath, ['scripts/verify-pdf.mjs', join(dir, 'out.pdf'), join(dir, 'imgs')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.doesNotMatch(r.stdout, /FAIL/);
    assert.equal(await adapter.title(viewer.doc), '테스트 책');
  } finally {
    await viewer.close();
  }
});

test('가짜 뷰어가 429를 보내면 기다린 뒤 끝까지 받는다', async () => {
  const viewer = await startFakeViewer({ pages: 4, status: (k, n) => (k === 2 && n === 1 ? 429 : 200) });
  try {
    const urls = (await (await pickAdapter(viewer.doc)).listPages(viewer.doc)).map(p => p.url);
    const blob = await convertPages(urls, { ...opts, backoffMs: 20 });
    assert.match(Buffer.from(await blob.arrayBuffer()).toString('latin1'), /\/Count 4\//);
    assert.equal(viewer.hits.get(2), 2);
  } finally {
    await viewer.close();
  }
});
