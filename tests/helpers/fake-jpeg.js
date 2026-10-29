// 테스트용 가짜 JPEG: SOI + APP0 + SOF0 + 구분용 페이로드 + EOI. 실제 디코딩은 되지 않는다.
export function fakeJpeg({ width = 8, height = 4, components = 3, seed = 0, payload = 32 } = {}) {
  const sofLen = 8 + 3 * components;
  const body = Array.from({ length: payload }, (_, i) => (seed * 31 + i * 7) & 0xFE); // 0xFF 마커와 섞이지 않게
  return new Uint8Array([
    0xFF, 0xD8,
    0xFF, 0xE0, 0x00, 0x04, 0x4A, 0x46,                 // APP0 (길이 4: 건너뛰기 확인용)
    0xFF, 0xC0, sofLen >> 8, sofLen & 0xFF, 8,
    height >> 8, height & 0xFF, width >> 8, width & 0xFF, components,
    ...Array.from({ length: components }, (_, c) => [c + 1, 0x11, 0]).flat(),
    ...body,
    0xFF, 0xD9,
  ]);
}
