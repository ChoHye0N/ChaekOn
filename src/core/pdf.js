// 이미지 배열 → PDF Blob. DOM에 의존하지 않는 순수 함수라 node에서도 실행된다.
// 원본 JPEG 바이트는 재압축 없이 그대로(DCTDecode) 넣는다.
const enc = new TextEncoder();

// JPEG의 SOF 마커에서 크기와 채널 수를 읽는다.
export function readJpegInfo(bytes) {
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) throw new Error('JPEG 정보를 읽을 수 없습니다');
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xFF) { i++; continue; }
    const m = bytes[i + 1];
    if (m === 0xFF) { i++; continue; }
    if (m === 0x01 || (m >= 0xD0 && m <= 0xD9)) { i += 2; continue; }
    if (m >= 0xC0 && m <= 0xC2) {
      if (i + 9 >= bytes.length) break;
      return {
        height: (bytes[i + 5] << 8) | bytes[i + 6],
        width: (bytes[i + 7] << 8) | bytes[i + 8],
        components: bytes[i + 9],
      };
    }
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
  }
  throw new Error('JPEG 정보를 읽을 수 없습니다');
}

// images: [{ bytes: Uint8Array, width, height, components }]
export function buildPdf(images) {
  if (!images.length) throw new Error('이미지가 없습니다');
  images.forEach((im, k) => {
    if (!(im.bytes instanceof Uint8Array)) throw new Error(`${k + 1}번째 이미지: bytes가 Uint8Array가 아닙니다`);
    if (!(im.width > 0 && im.height > 0)) throw new Error(`${k + 1}번째 이미지: 크기가 올바르지 않습니다`);
    if (im.components !== 1 && im.components !== 3) throw new Error(`${k + 1}번째 이미지: 지원하지 않는 채널 수(${im.components})`);
  });

  const parts = [], offs = {};
  let off = 0;
  const push = d => { const u = typeof d === 'string' ? enc.encode(d) : d; parts.push(u); off += u.length; };

  push('%PDF-1.4\n');
  offs[1] = off; push('1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n');
  offs[2] = off; push('2 0 obj\n<</Type/Pages/Count ' + images.length + '/Kids[' + images.map((_, k) => (3 + 3 * k) + ' 0 R').join(' ') + ']>>\nendobj\n');
  images.forEach((im, k) => {
    const p = 3 + 3 * k, c = p + 1, x = p + 2;
    offs[p] = off; push(p + ' 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 ' + im.width + ' ' + im.height + ']/Resources<</XObject<</Im0 ' + x + ' 0 R>>>>/Contents ' + c + ' 0 R>>\nendobj\n');
    const cs = enc.encode('q ' + im.width + ' 0 0 ' + im.height + ' 0 0 cm /Im0 Do Q');
    offs[c] = off; push(c + ' 0 obj\n<</Length ' + cs.length + '>>\nstream\n'); push(cs); push('\nendstream\nendobj\n');
    offs[x] = off; push(x + ' 0 obj\n<</Type/XObject/Subtype/Image/Width ' + im.width + '/Height ' + im.height + '/ColorSpace/' + (im.components === 1 ? 'DeviceGray' : 'DeviceRGB') + '/BitsPerComponent 8/Filter/DCTDecode/Length ' + im.bytes.length + '>>\nstream\n');
    push(im.bytes); push('\nendstream\nendobj\n');
  });

  const total = 3 + 3 * images.length, xref = off;
  let t = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
  for (let i = 1; i < total; i++) t += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  push(t + 'trailer\n<</Size ' + total + '/Root 1 0 R>>\nstartxref\n' + xref + '\n%%EOF');
  return new Blob(parts, { type: 'application/pdf' });
}
