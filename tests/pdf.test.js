import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPdf, readJpegInfo } from '../src/core/pdf.js';
import { fakeJpeg } from './helpers/fake-jpeg.js';

const toImage = bytes => ({ bytes, ...readJpegInfo(bytes) });
const pdfBytes = async images => new Uint8Array(await buildPdf(images).arrayBuffer());
const indexOfBytes = (hay, needle) => Buffer.from(hay).indexOf(Buffer.from(needle));

test('readJpegInfo: 크기와 채널 수를 읽는다', () => {
  assert.deepEqual(readJpegInfo(fakeJpeg({ width: 2844, height: 1600, components: 3 })), { width: 2844, height: 1600, components: 3 });
  assert.deepEqual(readJpegInfo(fakeJpeg({ width: 300, height: 500, components: 1 })), { width: 300, height: 500, components: 1 });
});

test('readJpegInfo: JPEG가 아니면 에러', () => {
  assert.throws(() => readJpegInfo(new Uint8Array([1, 2, 3, 4])), /JPEG/);
  assert.throws(() => readJpegInfo(new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9])), /JPEG/);
});

test('buildPdf: 원본 JPEG 바이트가 그대로 들어간다', async () => {
  const jpgs = [0, 1, 2].map(seed => fakeJpeg({ seed, payload: 40 + seed }));
  const pdf = await pdfBytes(jpgs.map(toImage));
  let from = 0;
  for (const j of jpgs) {
    const at = indexOfBytes(pdf.subarray(from), j);
    assert.ok(at >= 0, '이미지 바이트를 찾지 못함');
    from += at + j.length;   // 순서대로 나타나야 한다
  }
});

test('buildPdf: 헤더·끝·Kids 순서·xref 오프셋', async () => {
  const pdf = await pdfBytes([0, 1, 2, 3].map(seed => toImage(fakeJpeg({ seed }))));
  const txt = Buffer.from(pdf).toString('latin1');
  assert.ok(txt.startsWith('%PDF-1.4\n'));
  assert.ok(txt.endsWith('%%EOF'));
  assert.match(txt, /\/Count 4\/Kids\[3 0 R 6 0 R 9 0 R 12 0 R\]/);

  const xrefAt = Number(txt.match(/startxref\n(\d+)/)[1]);
  assert.ok(txt.startsWith('xref\n0 15\n', xrefAt));
  const entries = txt.slice(xrefAt).split('\n').slice(3, 3 + 14);
  entries.forEach((line, i) => {
    assert.ok(txt.startsWith(`${i + 1} 0 obj`, Number(line.slice(0, 10))), `객체 ${i + 1} 오프셋`);
  });
});

test('buildPdf: 페이지 크기와 색 공간', async () => {
  const pdf = await pdfBytes([
    toImage(fakeJpeg({ width: 2844, height: 1600, components: 3 })),
    toImage(fakeJpeg({ width: 600, height: 800, components: 1, seed: 1 })),
  ]);
  const txt = Buffer.from(pdf).toString('latin1');
  assert.match(txt, /MediaBox\[0 0 2844 1600\]/);
  assert.match(txt, /MediaBox\[0 0 600 800\]/);
  assert.match(txt, /Width 2844\/Height 1600\/ColorSpace\/DeviceRGB/);
  assert.match(txt, /Width 600\/Height 800\/ColorSpace\/DeviceGray/);
  assert.match(txt, /q 2844 0 0 1600 0 0 cm \/Im0 Do Q/);
});

test('buildPdf: 잘못된 입력은 에러', () => {
  assert.throws(() => buildPdf([]), /이미지가 없습니다/);
  assert.throws(() => buildPdf([{ bytes: [1, 2], width: 1, height: 1, components: 3 }]), /Uint8Array/);
  assert.throws(() => buildPdf([{ bytes: new Uint8Array(2), width: 0, height: 1, components: 3 }]), /크기/);
  assert.throws(() => buildPdf([{ bytes: new Uint8Array(2), width: 1, height: 1, components: 4 }]), /채널/);
});
