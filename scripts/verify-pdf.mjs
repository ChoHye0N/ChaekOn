// 사용법: node scripts/verify-pdf.mjs <pdf> [원본이미지폴더]
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [pdfPath, imgDir] = process.argv.slice(2);
if (!pdfPath) { console.error('사용법: node scripts/verify-pdf.mjs <pdf> [원본이미지폴더]'); process.exit(2); }

const buf = readFileSync(pdfPath);
const txt = buf.toString('latin1');
let fail = 0;
const report = (name, ok, detail = '') => {
  console.log((ok ? 'OK   ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) fail++;
};

report('헤더 %PDF-', txt.startsWith('%PDF-'));
report('끝 %%EOF', txt.trimEnd().endsWith('%%EOF'));

const kidsMatch = txt.match(/\/Kids\[([^\]]*)\]/);
const kids = kidsMatch ? kidsMatch[1].trim().split(/\s+/).filter((_, i) => i % 3 === 0).map(Number) : [];
const N = kids.length;
report('페이지 목록 순서(3+3k)', N > 0 && kids.every((v, i) => v === 3 + 3 * i), N + '페이지');

const sx = txt.match(/startxref\n(\d+)/);
let xrefBad = -1;
if (sx) {
  const lines = txt.slice(+sx[1]).split('\n').slice(2).filter(l => /^\d{10} 00000 n/.test(l));
  xrefBad = 0;
  lines.forEach((l, i) => { if (!txt.startsWith((i + 1) + ' 0 obj', +l.slice(0, 10))) xrefBad++; });
  report('xref 항목 수', lines.length === 3 + 3 * N - 1, String(lines.length));
}
report('xref 오프셋 일치', xrefBad === 0, xrefBad >= 0 ? '어긋남 ' + xrefBad : 'xref 없음');

const emb = [];
const re = /\/Filter\/DCTDecode\/Length (\d+)>>\nstream\n/g;
let m;
while ((m = re.exec(txt))) emb.push([m.index + m[0].length, +m[1]]);
report('이미지 수 = 페이지 수', emb.length === N, emb.length + '/' + N);

const badJpeg = [];
emb.forEach(([s, len], i) => {
  const e = buf.subarray(s, s + len);
  if (!(e[0] === 0xFF && e[1] === 0xD8 && e[len - 2] === 0xFF && e[len - 1] === 0xD9)) badJpeg.push(i + 1);
});
report('JPEG 시작·끝 표시', badJpeg.length === 0, badJpeg.length ? '손상 ' + badJpeg.slice(0, 10).join(',') : '');

if (imgDir) {
  const files = readdirSync(imgDir).filter(f => /\.jpe?g$/i.test(f)).sort();
  report('원본 파일 수 = 페이지 수', files.length === N, files.length + '/' + N);
  const diff = [];
  files.forEach((f, i) => {
    const o = readFileSync(join(imgDir, f));
    const [s, len] = emb[i] || [0, -1];
    if (len !== o.length || !o.equals(buf.subarray(s, s + len))) diff.push(i + 1);
  });
  report('원본과 바이트 일치', diff.length === 0, diff.length ? '다름 ' + diff.slice(0, 10).join(',') : '');
}

process.exit(fail ? 1 : 0);
