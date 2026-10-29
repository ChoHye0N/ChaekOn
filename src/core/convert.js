// 페이지 URL 목록 → PDF Blob. fetchPages로 받아 buildPdf로 조립한다.
import { fetchPages } from './fetcher.js';
import { buildPdf, readJpegInfo } from './pdf.js';

export class ConvertError extends Error {
  constructor(message, { failed = [], stopped = null } = {}) {
    super(message);
    this.name = 'ConvertError';
    this.failed = failed;
    this.stopped = stopped;
  }
}

function failureMessage(failed, stopped) {
  const list = failed.slice(0, 10).join(', ') + (failed.length > 10 ? ` 외 ${failed.length - 10}장` : '');
  return (stopped ? '연속으로 실패해 중단했습니다. ' : '') + '받지 못한 페이지: ' + list;
}

// opts는 fetchPages와 같고, 책의 일부만 받을 때는 firstPage(urls[0]이 책의 몇 쪽인지, 기본 1)를 더 쓴다.
// 오류에 담기는 페이지 번호는 firstPage를 반영한 책의 쪽 번호다.
// 받지 못한 페이지가 있으면 ConvertError(failed, stopped)로 reject한다.
// 취소하면 signal.reason으로 reject하고, 받은 페이지는 opts.cache에 남는다.
export async function convertPages(urls, opts = {}) {
  const { firstPage = 1, ...fetchOpts } = opts;
  const { results, failed, stopped } = await fetchPages(urls, fetchOpts);
  if (failed.length || results.some(r => !r)) {
    const missing = (failed.length ? failed : results.flatMap((r, i) => (r ? [] : [i + 1]))).map(n => n + firstPage - 1);
    throw new ConvertError(failureMessage(missing, stopped), { failed: missing, stopped });
  }
  const images = results.map((bytes, i) => {
    try {
      return { bytes, ...readJpegInfo(bytes) };
    } catch {
      throw new ConvertError(`JPEG를 읽을 수 없습니다: ${i + firstPage}페이지`, { failed: [i + firstPage] });
    }
  });
  return buildPdf(images);
}
